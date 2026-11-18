/**
 * Epic C — Day-2 nudge after challenge Day 1 complete.
 * P8 Phase B — timing, path-aware target and honest delivery counting.
 *
 * - The nudge targets the next *workout* day (P8 open Q1 default). Only the
 *   accelerated path trains on Day 2, so only it gets the Day-2 push (9:00
 *   next morning, or 24h) or the in-app Day-2 banner. Standard, gentle and
 *   uncalibrated paths rest on Day 2 and get no Day-2 nudge; their first
 *   nudge is the Day-3 follow-up (P8.3, Phase C).
 * - The in-app banner is eligible from the next local calendar day after
 *   Day 1, logs "shown" when it renders (once per local day), and clears only
 *   after it rendered on an eligible day and was tapped or Home was left.
 * - Push "shown" is no longer logged on tap. A scheduled push records
 *   fire_at; foreground receipt and fire-passed are logged once each.
 * - Push prompt is still requested post–Day-1 only (P8.4 moves it, Phase C).
 */
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { storage } from "./storage";
import {
  trackChallengeDay2NudgeScheduled,
  trackChallengeDay2NudgeShown,
  trackChallengeNudgeFirePassed,
  trackChallengeNudgeReceived,
  type PushPermissionStatusValue,
} from "./analytics";
import {
  getNotificationPermissionStatus,
  requestNotificationPermissionInstrumented,
} from "./notifications";
import { getWeek1WorkoutForDayIndex } from "@/data/workoutProgram";

const NUDGE_ID = "challenge-day2-nudge";
const MIN_DELAY_MS = 20 * 60 * 60 * 1000;
const MAX_DELAY_MS = 28 * 60 * 60 * 1000;
const DEFAULT_DELAY_MS = 24 * 60 * 60 * 1000;

type DifficultyPath = "accelerated" | "standard" | "gentle" | null;

function computeDay2TriggerDate(from: Date = new Date()): Date {
  const target = new Date(from.getTime() + DEFAULT_DELAY_MS);
  // Prefer next local morning (9:00) when it still lands inside 20–28h.
  const morning = new Date(from);
  morning.setDate(morning.getDate() + 1);
  morning.setHours(9, 0, 0, 0);
  const morningDelay = morning.getTime() - from.getTime();
  if (morningDelay >= MIN_DELAY_MS && morningDelay <= MAX_DELAY_MS) {
    return morning;
  }
  return target;
}

/** Local calendar date as YYYY-MM-DD (same format as completedDates). */
export function localDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** The local calendar day after `d` (DST-safe: calendar arithmetic). */
export function nextLocalDateString(d: Date): string {
  return localDateString(
    new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1),
  );
}

/** True when this path trains on challenge Day 2 (accelerated only today). */
export function isDay2WorkoutDay(path: DifficultyPath): boolean {
  return getWeek1WorkoutForDayIndex(1, path).isRestDay !== true;
}

function toPermissionStatus(status: string): PushPermissionStatusValue {
  switch (status) {
    case "granted":
    case "denied":
    case "undetermined":
    case "provisional":
    case "ephemeral":
      return status;
    default:
      return "unknown";
  }
}

export async function scheduleChallengeDay2Nudge(
  now: Date = new Date(),
): Promise<void> {
  try {
    const already = await storage.hasScheduledChallengeDay2Nudge();
    if (already) return;

    // Only for users who finished Day 1 and have not started Day 2 yet.
    const day2Started = await storage.hasChallengeDayStarted(1, 2);
    if (day2Started) {
      await storage.markChallengeDay2NudgeScheduled();
      return;
    }

    // P8.1.1: banner eligibility starts the next local calendar day.
    await storage.updateChallengeDay2NudgeState({
      eligibleFromLocalDate: nextLocalDateString(now),
      lastShownLocalDate: undefined,
      renderedOnEligibleDay: false,
      push: null,
    });

    let channel: "push" | "in_app" = "in_app";
    const status = await getNotificationPermissionStatus();

    if (status !== "granted") {
      // Post–Day-1 only: ask once so declining does not orphan pre-session users.
      const granted = await requestNotificationPermissionInstrumented(
        "post_day1_challenge_nudge",
      );
      if (granted) channel = "push";
    } else {
      channel = "push";
    }
    // P8.1.7: web always uses the in-app banner.
    if (Platform.OS === "web") channel = "in_app";

    // P8 open Q1 default: no Day-2 nudge when Day 2 is a rest day.
    const calibration = await storage.getCalibrationState();
    if (!isDay2WorkoutDay(calibration.difficultyPath)) {
      await storage.setChallengeDay2InAppNudgePending(false);
      await storage.markChallengeDay2NudgeScheduled();
      return;
    }

    if (channel === "push") {
      const when = computeDay2TriggerDate(now);
      const seconds = Math.max(
        60,
        Math.round((when.getTime() - now.getTime()) / 1000),
      );
      const fireAt = new Date(now.getTime() + seconds * 1000).toISOString();
      await Notifications.scheduleNotificationAsync({
        identifier: NUDGE_ID,
        content: {
          title: "Day 2 is ready",
          body: "Come back for Day 2 of 7 — we’ll keep it short and clear.",
          data: {
            screen: "ChallengeDay",
            week: 1,
            day: 2,
            nudge: "day2",
            fire_at: fireAt,
          },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds,
          repeats: false,
        },
      });
      await storage.updateChallengeDay2NudgeState({ push: { fireAt } });
      await storage.markChallengeDay2NudgeScheduled();
      trackChallengeDay2NudgeScheduled({ channel, fire_at: fireAt });
      return;
    }

    await storage.setChallengeDay2InAppNudgePending(true);
    await storage.markChallengeDay2NudgeScheduled();
    trackChallengeDay2NudgeScheduled({ channel: "in_app" });
  } catch {
    // Nudge must never break session completion.
    try {
      const calibration = await storage.getCalibrationState();
      if (isDay2WorkoutDay(calibration.difficultyPath)) {
        await storage.setChallengeDay2InAppNudgePending(true);
        trackChallengeDay2NudgeScheduled({ channel: "in_app" });
      }
      await storage.markChallengeDay2NudgeScheduled();
    } catch {
      /* ignore */
    }
  }
}

/**
 * Log challenge_nudge_fire_passed once if the stored push's fire time has
 * passed. Called on every app open / resume, and before cancelling.
 */
export async function reportDay2NudgeFirePassed(
  now: Date = new Date(),
): Promise<void> {
  try {
    const state = await storage.getChallengeDay2NudgeState();
    const push = state.push;
    if (!push || push.firePassedLogged) return;
    const fireMs = Date.parse(push.fireAt);
    if (!Number.isFinite(fireMs) || fireMs > now.getTime()) return;
    await storage.updateChallengeDay2NudgeState({
      push: { ...push, firePassedLogged: true },
    });
    const status = await getNotificationPermissionStatus();
    trackChallengeNudgeFirePassed({
      nudge: "day2",
      permission_status: toPermissionStatus(status),
    });
  } catch {
    /* ignore */
  }
}

/** Foreground receipt of the Day-2 push (app open when it fired). Once. */
export async function reportDay2NudgeReceived(
  data: { nudge?: unknown } | null | undefined,
): Promise<void> {
  if (data?.nudge !== "day2") return;
  try {
    const state = await storage.getChallengeDay2NudgeState();
    if (state.push?.receivedLogged) return;
    if (state.push) {
      await storage.updateChallengeDay2NudgeState({
        push: { ...state.push, receivedLogged: true },
      });
    }
    trackChallengeNudgeReceived({ nudge: "day2", method: "foreground" });
  } catch {
    /* ignore */
  }
}

/**
 * P8.1.6: a cold launch replays the last notification response. Returns
 * true the first time a response key is seen, false for repeats.
 */
export async function claimNotificationResponse(key: string): Promise<boolean> {
  try {
    const state = await storage.getChallengeDay2NudgeState();
    if (state.lastHandledResponseKey === key) return false;
    await storage.updateChallengeDay2NudgeState({
      lastHandledResponseKey: key,
    });
    return true;
  } catch {
    return true;
  }
}

export async function cancelChallengeDay2Nudge(): Promise<void> {
  await reportDay2NudgeFirePassed();
  try {
    await Notifications.cancelScheduledNotificationAsync(NUDGE_ID);
  } catch {
    /* ignore */
  }
  await storage.setChallengeDay2InAppNudgePending(false);
  try {
    await storage.updateChallengeDay2NudgeState({
      push: null,
      renderedOnEligibleDay: false,
    });
  } catch {
    /* ignore */
  }
}

/**
 * P8.1.1–3: should Home show the in-app Day-2 banner right now? Does not log
 * and does not clear on a same-day visit right after Day 1.
 */
export async function shouldShowInAppDay2Nudge(
  now: Date = new Date(),
): Promise<boolean> {
  const pending = await storage.isChallengeDay2InAppNudgePending();
  if (!pending) return false;

  // Only until a session after Day 1 starts.
  const day2Started = await storage.hasChallengeDayStarted(1, 2);
  const state = await storage.getChallengeDay2NudgeState();
  const eligibleFrom = state.eligibleFromLocalDate;
  let laterSession = false;
  if (eligibleFrom) {
    const progress = await storage.getProgress();
    laterSession = progress.completedDates.some((d) => d >= eligibleFrom);
  }
  if (day2Started || laterSession) {
    await storage.setChallengeDay2InAppNudgePending(false);
    return false;
  }

  // Path-aware: rest-day paths have no Day-2 banner (Day 3 is Phase C).
  const calibration = await storage.getCalibrationState();
  if (!isDay2WorkoutDay(calibration.difficultyPath)) return false;

  // Legacy pending flag (set before P8) has no date: already past Day 1.
  if (!eligibleFrom) return true;
  return localDateString(now) >= eligibleFrom;
}

/** Banner rendered on an eligible day: log "shown" once per local day. */
export async function markInAppDay2NudgeRendered(
  now: Date = new Date(),
): Promise<void> {
  try {
    const today = localDateString(now);
    const state = await storage.getChallengeDay2NudgeState();
    const firstToday = state.lastShownLocalDate !== today;
    await storage.updateChallengeDay2NudgeState({
      lastShownLocalDate: today,
      renderedOnEligibleDay: true,
    });
    if (firstToday) trackChallengeDay2NudgeShown({ channel: "in_app" });
  } catch {
    /* ignore */
  }
}

/** User left Home after the banner rendered on an eligible day: clear it. */
export async function onHomeLeftAfterDay2Nudge(): Promise<void> {
  try {
    const state = await storage.getChallengeDay2NudgeState();
    if (!state.renderedOnEligibleDay) return;
    await storage.setChallengeDay2InAppNudgePending(false);
    await storage.updateChallengeDay2NudgeState({
      renderedOnEligibleDay: false,
    });
  } catch {
    /* ignore */
  }
}

/** Exported for tests — delay bounds used by scheduler. */
export const __day2NudgeTestUtils = {
  computeDay2TriggerDate,
  MIN_DELAY_MS,
  MAX_DELAY_MS,
  DEFAULT_DELAY_MS,
  NUDGE_ID,
};
