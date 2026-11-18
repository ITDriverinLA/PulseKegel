/**
 * Epic C — Day-2 nudge after challenge Day 1 complete.
 * P8 Phase B — timing, path-aware target and honest delivery counting.
 *
 * - The nudge targets the next *workout* day (P8 open Q1 default). Only the
 *   accelerated path trains on Day 2, so only it gets the Day-2 push (9:00
 *   next morning, or 24h) or the in-app Day-2 banner. Standard, gentle and
 *   uncalibrated paths rest on Day 2 and get no Day-2 nudge; instead they
 *   get one Day-3 push at 9:00 local on challenge Day 3 (see
 *   scheduleChallengeDay3Push).
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
  CHALLENGE_DAY3_PUSH_ID,
  getNotificationPermissionStatus,
  localDateString,
  requestNotificationPermissionInstrumented,
} from "./notifications";
import { getWeek1WorkoutForDayIndex } from "@/data/workoutProgram";

const NUDGE_ID = "challenge-day2-nudge";
/**
 * Day-3 push for rest-day paths. Phase C's "2 minutes" Day-3 follow-up
 * (P8.3) REPLACES this push rather than adding a second one: it reuses this
 * id, so scheduling it overwrites this notification, and this Phase B
 * scheduler should be removed in the same change.
 */
const DAY3_PUSH_ID = CHALLENGE_DAY3_PUSH_ID; // "challenge-followup-d3"
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

// Single local-date helper, shared with the daily reminder.
export { localDateString };

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

    // The post-Day-1 permission ask stays ahead of the path check on purpose:
    // rest-day paths (standard, gentle, uncalibrated) now get the Day-3 push,
    // which needs permission just like the accelerated Day-2 push. P8.4
    // (Phase C) moves this ask to the soft pre-prompt; attribute prompts by
    // surface, not as "Day-2 push" prompts.
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

    // P8 open Q1 default: no Day-2 nudge when Day 2 is a rest day. These
    // paths get one Day-3 push at 9:00 instead (push channel only).
    const calibration = await storage.getCalibrationState();
    if (!isDay2WorkoutDay(calibration.difficultyPath)) {
      await storage.setChallengeDay2InAppNudgePending(false);
      if (channel === "push") await scheduleChallengeDay3Push(now);
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

/** Local Date for 9:00 on challenge day `day` (1-based) from a YYYY-MM-DD start. */
export function challengeDayMorning(startLocalDate: string, day: number): Date {
  const [y, m, d] = startLocalDate.split("-").map(Number);
  return new Date(y, m - 1, d + (day - 1), 9, 0, 0, 0);
}

/**
 * Rest-day paths (standard, gentle, uncalibrated): one local push at 9:00 on
 * challenge Day 3, opening the Day-3 workout. Skipped if that time has passed
 * or Day 3 is already complete. Copy is Keg-cleared; no "2 minutes" because
 * the tap opens the full Day-3 workout, not the short session.
 * Phase C's "2 minutes" follow-up replaces this push (same id); it does not
 * add a second Day-3 push.
 */
export async function scheduleChallengeDay3Push(
  now: Date = new Date(),
): Promise<void> {
  try {
    if (await storage.hasChallengeDayCompleted(1, 3)) return;
    // Spec open Q3 default (Ashley-approved): daily reminder on -> no
    // follow-up push; they already get a morning ping. If the reminder is
    // turned on later, notifications.ts cancels a pending Day-3 push. If it
    // is turned off before Day 3, we don't re-schedule (kept simple; Phase C
    // replaces this push anyway).
    const settings = await storage.getSettings();
    if (settings.reminderEnabled) return;
    const start = (await storage.getProgramStartDate()) ?? localDateString(now);
    const when = challengeDayMorning(start, 3);
    const seconds = Math.round((when.getTime() - now.getTime()) / 1000);
    if (seconds < 60) return;
    const fireAt = when.toISOString();
    await Notifications.scheduleNotificationAsync({
      identifier: DAY3_PUSH_ID,
      content: {
        title: "Day 3 is ready",
        body: "Pick up where you left off.",
        data: {
          screen: "ChallengeDay",
          week: 1,
          day: 3,
          nudge: "followup",
          followup_day: 3,
          fire_at: fireAt,
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds,
        repeats: false,
      },
    });
    await storage.updateChallengeDay2NudgeState({ followupD3: { fireAt } });
    trackChallengeDay2NudgeScheduled({
      channel: "push",
      followup_day: 3,
      fire_at: fireAt,
    });
  } catch {
    /* Nudge must never break session completion. */
  }
}

/** Cancel the Day-3 push (Day 3 completed, or the push was tapped). */
export async function cancelChallengeDay3Push(): Promise<void> {
  await reportDay2NudgeFirePassed();
  try {
    await Notifications.cancelScheduledNotificationAsync(DAY3_PUSH_ID);
  } catch {
    /* ignore */
  }
  try {
    await storage.updateChallengeDay2NudgeState({ followupD3: null });
  } catch {
    /* ignore */
  }
}

/**
 * P8.3 cancel rule (Rev L5): any session start after Day 1 cancels the
 * Day-3 push. Called from the workout player's session-start effect; the
 * push only exists after Day-1 completion, so the Day-1 start never hits it.
 */
export async function cancelChallengeDay3PushOnSessionStart(): Promise<void> {
  try {
    const state = await storage.getChallengeDay2NudgeState();
    if (!state.followupD3) return;
    await cancelChallengeDay3Push();
  } catch {
    /* ignore */
  }
}

/** On open: Day 3 already completed (e.g. restored progress) — drop the push. */
export async function reconcileChallengeDay3Push(): Promise<void> {
  try {
    const state = await storage.getChallengeDay2NudgeState();
    if (!state.followupD3) return;
    if (await storage.hasChallengeDayCompleted(1, 3)) {
      await cancelChallengeDay3Push();
    }
  } catch {
    /* ignore */
  }
}

/**
 * Log challenge_nudge_fire_passed once per scheduled push (Day-2 and the
 * Day-3 push) whose fire time has passed. Called on every app open / resume,
 * and before cancelling. The due check and the "logged" mark are one atomic
 * step in storage, so concurrent callers can't log twice or drop the mark.
 */
export async function reportDay2NudgeFirePassed(
  now: Date = new Date(),
): Promise<void> {
  try {
    const due = (
      r: { fireAt: string; firePassedLogged?: boolean } | null | undefined,
    ) => {
      if (!r || r.firePassedLogged) return false;
      const fireMs = Date.parse(r.fireAt);
      return Number.isFinite(fireMs) && fireMs <= now.getTime();
    };
    const { day2Due, day3Due } = await storage.mutateChallengeDay2NudgeState(
      (state) => {
        const d2 = due(state.push);
        const d3 = due(state.followupD3);
        return {
          patch:
            d2 || d3
              ? {
                  ...(d2 && state.push
                    ? { push: { ...state.push, firePassedLogged: true } }
                    : {}),
                  ...(d3 && state.followupD3
                    ? {
                        followupD3: {
                          ...state.followupD3,
                          firePassedLogged: true,
                        },
                      }
                    : {}),
                }
              : undefined,
          result: { day2Due: d2, day3Due: d3 },
        };
      },
    );
    if (!day2Due && !day3Due) return;
    const permission_status = toPermissionStatus(
      await getNotificationPermissionStatus(),
    );
    if (day2Due) {
      trackChallengeNudgeFirePassed({ nudge: "day2", permission_status });
    }
    if (day3Due) {
      trackChallengeNudgeFirePassed({
        nudge: "followup",
        followup_day: 3,
        permission_status,
      });
    }
  } catch {
    /* ignore */
  }
}

/**
 * Foreground receipt of a challenge push (app open when it fired). Once each,
 * via an atomic check-and-set. When there is no stored push record (e.g. a
 * pre-P8 Day-2 push that was already scheduled at upgrade) there is nothing
 * to mark, so it isn't deduped: that push fires at most once, so at most one
 * event is logged.
 */
export async function reportDay2NudgeReceived(
  data: { nudge?: unknown; followup_day?: unknown } | null | undefined,
): Promise<void> {
  const isDay3 = data?.nudge === "followup" && data?.followup_day === 3;
  if (data?.nudge !== "day2" && !isDay3) return;
  try {
    const shouldLog = await storage.mutateChallengeDay2NudgeState((state) => {
      const record = isDay3 ? state.followupD3 : state.push;
      if (record?.receivedLogged) return { result: false };
      if (!record) return { result: true };
      const marked = { ...record, receivedLogged: true };
      return {
        patch: isDay3 ? { followupD3: marked } : { push: marked },
        result: true,
      };
    });
    if (!shouldLog) return;
    if (isDay3) {
      trackChallengeNudgeReceived({
        nudge: "followup",
        followup_day: 3,
        method: "foreground",
      });
    } else {
      trackChallengeNudgeReceived({ nudge: "day2", method: "foreground" });
    }
  } catch {
    /* ignore */
  }
}

/**
 * P8.1.6: a cold launch replays the last notification response. Returns
 * true the first time a response key is seen, false for repeats. Atomic
 * check-and-set, so two concurrent claims of one key return [true, false].
 */
export async function claimNotificationResponse(key: string): Promise<boolean> {
  try {
    return await storage.mutateChallengeDay2NudgeState((state) =>
      state.lastHandledResponseKey === key
        ? { result: false }
        : { patch: { lastHandledResponseKey: key }, result: true },
    );
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

/**
 * Banner has actually been seen: Home focused with the banner visible for
 * DAY2_BANNER_SEEN_MS (HomeScreen runs the timer). Logs "shown" once per
 * local day and arms clear-on-leave. Atomic, so a concurrent blur can't
 * drop the mark.
 */
export async function markInAppDay2NudgeRendered(
  now: Date = new Date(),
): Promise<void> {
  try {
    const today = localDateString(now);
    const firstToday = await storage.mutateChallengeDay2NudgeState((state) => ({
      patch: {
        lastShownLocalDate: today,
        renderedOnEligibleDay: true,
      },
      result: state.lastShownLocalDate !== today,
    }));
    if (firstToday) trackChallengeDay2NudgeShown({ channel: "in_app" });
  } catch {
    /* ignore */
  }
}

/**
 * User navigated away from Home after the banner was seen: clear it. A blur
 * before the banner was seen (e.g. a modal or paywall auto-presented right
 * after Home loads) never armed the clear, so it does nothing.
 */
export async function onHomeLeftAfterDay2Nudge(): Promise<void> {
  try {
    const wasSeen = await storage.mutateChallengeDay2NudgeState((state) =>
      state.renderedOnEligibleDay
        ? { patch: { renderedOnEligibleDay: false }, result: true }
        : { result: false },
    );
    if (wasSeen) await storage.setChallengeDay2InAppNudgePending(false);
  } catch {
    /* ignore */
  }
}

/** How long the banner must be visible on a focused Home to count as seen. */
export const DAY2_BANNER_SEEN_MS = 2000;

/** Exported for tests — delay bounds used by scheduler. */
export const __day2NudgeTestUtils = {
  computeDay2TriggerDate,
  MIN_DELAY_MS,
  MAX_DELAY_MS,
  DEFAULT_DELAY_MS,
  NUDGE_ID,
  DAY3_PUSH_ID,
};
