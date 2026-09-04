/**
 * Epic C — Day-2 nudge after challenge Day 1 complete.
 *
 * Schedules a local notification ~20–28h later (or next calendar morning if
 * that falls earlier), deep-linking to Day 2. If push is not granted, stores
 * an in-app pending nudge shown on next open. Push prompt is only requested
 * post–Day-1 (never before first-session CTA).
 */
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { storage } from "./storage";
import {
  trackChallengeDay2NudgeScheduled,
  trackChallengeDay2NudgeShown,
} from "./analytics";
import {
  getNotificationPermissionStatus,
  requestNotificationPermissionInstrumented,
} from "./notifications";

const NUDGE_ID = "challenge-day2-nudge";
const MIN_DELAY_MS = 20 * 60 * 60 * 1000;
const MAX_DELAY_MS = 28 * 60 * 60 * 1000;
const DEFAULT_DELAY_MS = 24 * 60 * 60 * 1000;

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

export async function scheduleChallengeDay2Nudge(): Promise<void> {
  try {
    const already = await storage.hasScheduledChallengeDay2Nudge();
    if (already) return;

    // Only for users who finished Day 1 and have not started Day 2 yet.
    const day2Started = await storage.hasChallengeDayStarted(1, 2);
    if (day2Started) {
      await storage.markChallengeDay2NudgeScheduled();
      return;
    }

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

    if (channel === "push" && Platform.OS !== "web") {
      const when = computeDay2TriggerDate();
      const seconds = Math.max(
        60,
        Math.round((when.getTime() - Date.now()) / 1000),
      );
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
          },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds,
          repeats: false,
        },
      });
    } else {
      await storage.setChallengeDay2InAppNudgePending(true);
    }

    await storage.markChallengeDay2NudgeScheduled();
    trackChallengeDay2NudgeScheduled({ channel });
  } catch {
    // Nudge must never break session completion.
    try {
      await storage.setChallengeDay2InAppNudgePending(true);
      await storage.markChallengeDay2NudgeScheduled();
      trackChallengeDay2NudgeScheduled({ channel: "in_app" });
    } catch {
      /* ignore */
    }
  }
}

export async function cancelChallengeDay2Nudge(): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(NUDGE_ID);
  } catch {
    /* ignore */
  }
  await storage.setChallengeDay2InAppNudgePending(false);
}

export async function consumeInAppDay2Nudge(): Promise<boolean> {
  const pending = await storage.isChallengeDay2InAppNudgePending();
  if (!pending) return false;
  const day2Started = await storage.hasChallengeDayStarted(1, 2);
  if (day2Started) {
    await storage.setChallengeDay2InAppNudgePending(false);
    return false;
  }
  await storage.setChallengeDay2InAppNudgePending(false);
  trackChallengeDay2NudgeShown({ channel: "in_app" });
  return true;
}

export async function markPushDay2NudgeShown(): Promise<void> {
  trackChallengeDay2NudgeShown({ channel: "push" });
}

/** Exported for tests — delay bounds used by scheduler. */
export const __day2NudgeTestUtils = {
  computeDay2TriggerDate,
  MIN_DELAY_MS,
  MAX_DELAY_MS,
  DEFAULT_DELAY_MS,
  NUDGE_ID,
};
