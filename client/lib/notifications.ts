import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { storage } from "./storage";
import { isRestDayForDate } from "@/data/workoutProgram";

const BADGE_MILESTONES = [
  { streak: 3, name: "Three-Peat" },
  { streak: 7, name: "Week Warrior" },
  { streak: 14, name: "Fortnight Force" },
  { streak: 30, name: "Iron Will" },
  { streak: 60, name: "Unstoppable" },
  { streak: 90, name: "Iron Core" },
];

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermission(): Promise<boolean> {
  try {
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    if (existingStatus === "granted") return true;

    const { status } = await Notifications.requestPermissionsAsync();
    if (status === "granted") return true;

    if (Platform.OS === "web") return true;

    return false;
  } catch {
    return Platform.OS === "web";
  }
}

/**
 * Epic D/C: instrumented push prompt. Call only after first session (Settings
 * is gated) or post–Day-1 for the challenge nudge — never before first-session CTA.
 */
export async function requestNotificationPermissionInstrumented(
  surface: string,
): Promise<boolean> {
  // Lazy import to avoid circular deps with analytics at module load.
  const { trackPermissionPromptShown, trackPermissionResult } = await import(
    "./analytics"
  );
  try {
    const afterFirstSession = await storage.hasCompletedFirstSession();
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    if (existingStatus === "granted") {
      trackPermissionResult({
        type: "push",
        status: "granted",
        surface,
        already_granted: true,
        after_first_session: afterFirstSession,
      });
      return true;
    }

    // P2c: hard guard — never show the OS prompt (Android 13+
    // POST_NOTIFICATIONS / iOS alert) before the first session is complete.
    if (!afterFirstSession) {
      trackPermissionResult({
        type: "push",
        status: "deferred_pre_first_session",
        surface,
        deferred: true,
        after_first_session: false,
      });
      return false;
    }

    trackPermissionPromptShown({
      type: "push",
      surface,
      after_first_session: afterFirstSession,
    });
    const { status } = await Notifications.requestPermissionsAsync();
    trackPermissionResult({
      type: "push",
      status,
      surface,
      after_first_session: afterFirstSession,
    });
    if (status === "granted") return true;
    if (Platform.OS === "web") return true;
    return false;
  } catch {
    trackPermissionResult({
      type: "push",
      status: "error",
      surface,
    });
    return Platform.OS === "web";
  }
}

export async function getNotificationPermissionStatus(): Promise<string> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (Platform.OS === "web" && status !== "granted") return "granted";
    return status;
  } catch {
    return "granted";
  }
}

function getNextBadgeMilestone(
  currentStreak: number,
  earnedBadgeIds: string[],
): (typeof BADGE_MILESTONES)[number] | null {
  for (const milestone of BADGE_MILESTONES) {
    const badgeId = `streak_${milestone.streak}`;
    if (!earnedBadgeIds.includes(badgeId) && currentStreak < milestone.streak) {
      return milestone;
    }
  }
  return null;
}

export function buildReminderMessage(
  streak: number,
  isRestDay: boolean,
  earnedBadgeIds: string[],
  yesterdayMissed: boolean,
  isFirstEver: boolean,
): { title: string; body: string } {
  const nextBadge = getNextBadgeMilestone(streak, earnedBadgeIds);
  if (nextBadge) {
    const daysAway = nextBadge.streak - streak;
    if (daysAway === 1) {
      return {
        title: "One Day Away",
        body: `One more session and you unlock the ${nextBadge.name} badge. Make it count.`,
      };
    }
    if (daysAway === 2) {
      return {
        title: "Almost There",
        body: `Just 2 days to your ${nextBadge.name} badge. Keep showing up.`,
      };
    }
  }

  if (isRestDay) {
    if (streak === 0) {
      return {
        title: "Rest Day - You Earned It",
        body: "Recovery is part of the program.",
      };
    }
    return {
      title: "Rest Day - You Earned It",
      body: "Streak locked in. Tap to log today's rest.",
    };
  }

  if (streak >= 30) {
    return {
      title: `${streak}-Day Legend`,
      body: "You're in elite territory. Don't stop now.",
    };
  }
  if (streak >= 14) {
    return {
      title: `${streak} Days Strong`,
      body: "Two weeks in - this is a habit now. Keep the fire burning.",
    };
  }
  if (streak >= 7) {
    return {
      title: `${streak}-Day Streak!`,
      body: "A full week down. You're building something real.",
    };
  }
  if (streak >= 3) {
    return {
      title: `${streak} Days In`,
      body: "Momentum is building - open PulseKegel and keep it going.",
    };
  }
  if (streak === 2) {
    return {
      title: "Day 3 - Keep Going",
      body: "Two days down. Consistency is the whole game - open PulseKegel.",
    };
  }
  if (streak === 1) {
    return {
      title: "Day 2 - Let's Go",
      body: "One down, keep the streak alive. It only gets easier.",
    };
  }
  if (yesterdayMissed && !isFirstEver) {
    return {
      title: "Fresh Start Today",
      body: "Yesterday's gone - today's wide open. Let's build that streak.",
    };
  }
  return {
    title: "Day 1 Starts Now",
    body: "Every streak starts somewhere. Open PulseKegel and get it done.",
  };
}

/** P8.2: fixed id so the daily reminder can be replaced without cancel-all. */
export const DAILY_REMINDER_ID = "daily-reminder";

/** Local calendar date as YYYY-MM-DD (same format as completedDates). */
export function localDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * P8.2 / Rev L1 + L8: when today is already done and the reminder time is
 * still ahead today, a DAILY trigger would still fire today. Expo's DAILY
 * (and WEEKLY) triggers have no start date on either platform, and a
 * repeating TIME_INTERVAL can't be anchored to a clock time, so "every day
 * from tomorrow on, forever" isn't expressible as one trigger. Instead:
 *   - a repeating WEEKLY trigger for each of the other six weekdays
 *     (`daily-reminder-wd<1-7>`, open-ended), plus
 *   - a rolling window of one-off DATE triggers for today's weekday, 1..N
 *     weeks out (`daily-reminder-once-<1-N>`).
 * Every launch, completion and Settings change rebuilds this (or goes back
 * to the plain DAILY trigger when today isn't done), so the window keeps
 * rolling for anyone who opens the app. A user who stops opening it gets the
 * reminder 7 days a week for N weeks, then 6 days a week indefinitely
 * (today's weekday drops out once the window runs dry). That's the remaining
 * limitation; N is bounded to stay well inside iOS's 64 pending
 * notifications (6 + N = 14 here, alongside the few challenge pushes).
 */
export const DAILY_REMINDER_SAME_WEEKDAY_WEEKS = 8;
const WEEKDAY_REMINDER_IDS = [1, 2, 3, 4, 5, 6, 7].map(
  (weekday) => `${DAILY_REMINDER_ID}-wd${weekday}`,
);
const ONE_OFF_REMINDER_IDS = Array.from(
  { length: DAILY_REMINDER_SAME_WEEKDAY_WEEKS },
  (_, k) => `${DAILY_REMINDER_ID}-once-${k + 1}`,
);

/** Every id the daily reminder can use (plain DAILY + the done-today split). */
export const DAILY_REMINDER_IDS = [
  DAILY_REMINDER_ID,
  ...WEEKDAY_REMINDER_IDS,
  ...ONE_OFF_REMINDER_IDS,
];

async function cancelDailyReminderOnly(): Promise<void> {
  for (const id of DAILY_REMINDER_IDS) {
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch {}
  }
}

/** Expo weekday numbering: 1 = Sunday … 7 = Saturday. */
function expoWeekday(d: Date): number {
  return d.getDay() + 1;
}

async function scheduleDailyReminderNotification(
  timeStr: string,
  message: { title: string; body: string },
  options: { todayDone?: boolean; now?: Date } = {},
): Promise<void> {
  const [hours, minutes] = timeStr.split(":").map(Number);
  const content = {
    title: message.title,
    body: message.body,
    data: { screen: "Home" },
  };
  const now = options.now ?? new Date();
  const todayFire = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    hours,
    minutes,
    0,
    0,
  );
  if (!options.todayDone || todayFire.getTime() <= now.getTime()) {
    // Next DAILY fire is already tomorrow (or today isn't done): plain daily.
    await Notifications.scheduleNotificationAsync({
      identifier: DAILY_REMINDER_ID,
      content,
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: hours,
        minute: minutes,
      },
    });
    return;
  }
  // Today is done and today's time is still ahead: skip today only.
  const today = expoWeekday(now);
  for (let weekday = 1; weekday <= 7; weekday++) {
    if (weekday === today) continue;
    await Notifications.scheduleNotificationAsync({
      identifier: `${DAILY_REMINDER_ID}-wd${weekday}`,
      content,
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday,
        hour: hours,
        minute: minutes,
      },
    });
  }
  for (let week = 1; week <= DAILY_REMINDER_SAME_WEEKDAY_WEEKS; week++) {
    // Calendar arithmetic (setDate), so DST shifts keep the local time.
    const date = new Date(todayFire);
    date.setDate(date.getDate() + 7 * week);
    await Notifications.scheduleNotificationAsync({
      identifier: `${DAILY_REMINDER_ID}-once-${week}`,
      content,
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date,
      },
    });
  }
}

/**
 * Spec open Q3 default (Ashley-approved): no follow-up push when the daily
 * reminder is on, since those users already get a morning ping. When the
 * reminder is (re)armed, drop a pending Day-3 push that hasn't fired yet.
 * Kept here (not in challengeNudge) to avoid a circular import.
 */
async function cancelPendingDay3PushForReminder(now: Date): Promise<void> {
  try {
    const state = await storage.getChallengeDay2NudgeState();
    const fireMs = state.followupD3 ? Date.parse(state.followupD3.fireAt) : NaN;
    if (!Number.isFinite(fireMs) || fireMs <= now.getTime()) return;
    await Notifications.cancelScheduledNotificationAsync(
      CHALLENGE_DAY3_PUSH_ID,
    );
    await storage.updateChallengeDay2NudgeState({ followupD3: null });
  } catch {}
}

/** Id of the rest-day Day-3 push (see challengeNudge.scheduleChallengeDay3Push). */
export const CHALLENGE_DAY3_PUSH_ID = "challenge-followup-d3";

/** Reminder content as of tomorrow (used once today is already done). */
async function buildTomorrowReminderMessage(): Promise<{
  title: string;
  body: string;
}> {
  const progress = await storage.getProgress();
  const earnedBadges = await storage.getEarnedBadges();
  const earnedIds = earnedBadges.map((b: { badgeId: string }) => b.badgeId);
  const programStartDate = await storage.getProgramStartDate();
  const calibrationState = await storage.getCalibrationState();

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isRestDay = programStartDate
    ? isRestDayForDate(
        tomorrow,
        programStartDate,
        calibrationState.difficultyPath,
      )
    : false;

  const isFirstEver = progress.totalSessions <= 1;

  return buildReminderMessage(
    progress.currentStreak,
    isRestDay,
    earnedIds,
    false,
    isFirstEver,
  );
}

export async function scheduleDailyReminder(timeStr: string): Promise<void> {
  try {
    // P8.2: replace only the daily reminder; challenge-* nudges survive.
    await cancelDailyReminderOnly();

    const progress = await storage.getProgress();
    // P8.2 side-bug fix: completedDates are local dates, so compare local.
    const today = localDateString(new Date());
    const todayCompleted = progress.completedDates.includes(today);

    // Q3 default: reminder on -> no Day-3 follow-up push.
    await cancelPendingDay3PushForReminder(new Date());

    if (todayCompleted) {
      // Keep a reminder scheduled (tomorrow's message) instead of none, but
      // don't fire again today (see scheduleDailyReminderNotification).
      await scheduleDailyReminderNotification(
        timeStr,
        await buildTomorrowReminderMessage(),
        { todayDone: true },
      );
      return;
    }

    const earnedBadges = await storage.getEarnedBadges();
    const earnedIds = earnedBadges.map((b: { badgeId: string }) => b.badgeId);
    const programStartDate = await storage.getProgramStartDate();
    const calibrationState = await storage.getCalibrationState();
    const isRestDay = programStartDate
      ? isRestDayForDate(
          new Date(),
          programStartDate,
          calibrationState.difficultyPath,
        )
      : false;

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = localDateString(yesterday);
    const yesterdayMissed = !progress.completedDates.includes(yesterdayStr);
    const isFirstEver = progress.totalSessions === 0;

    const message = buildReminderMessage(
      progress.currentStreak,
      isRestDay,
      earnedIds,
      yesterdayMissed,
      isFirstEver,
    );

    await scheduleDailyReminderNotification(timeStr, message);
  } catch {}
}

/** P8.2: cancels only the daily reminder (Settings toggle). */
export async function cancelAllReminders(): Promise<void> {
  await cancelDailyReminderOnly();
}

/**
 * P8.2 one-time migration: builds before P8 scheduled the daily reminder
 * with no identifier. Cancel those legacy reminders (no daily-reminder id,
 * data.screen === "Home"); never touch challenge-* ids. The caller then
 * reschedules with the id if the reminder is on.
 */
export async function migrateLegacyDailyReminders(): Promise<void> {
  try {
    if (await storage.isDailyReminderIdMigrated()) return;
    if (Platform.OS !== "web") {
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      for (const request of scheduled) {
        const id = request.identifier ?? "";
        const data = request.content?.data as { screen?: unknown } | undefined;
        if (
          !id.startsWith(DAILY_REMINDER_ID) &&
          !id.startsWith("challenge-") &&
          data?.screen === "Home"
        ) {
          await Notifications.cancelScheduledNotificationAsync(id);
        }
      }
    }
    await storage.markDailyReminderIdMigrated();
  } catch {}
}

export async function sendBadgeEarnedNotification(
  badgeName: string,
): Promise<void> {
  const status = await getNotificationPermissionStatus();
  if (status !== "granted") return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: `Badge Unlocked: ${badgeName}`,
      body: `You just earned the ${badgeName} badge. You're building something real.`,
      data: { screen: "Badges" },
    },
    trigger: null,
  });
}

export async function cancelTodaysReminderIfCompleted(): Promise<void> {
  const settings = await storage.getSettings();
  if (!settings.reminderEnabled) return;
  await cancelAllReminders();
}

export async function rescheduleAfterCompletion(): Promise<void> {
  try {
    const settings = await storage.getSettings();
    if (!settings.reminderEnabled) return;

    // P8.2: replace only the daily reminder; challenge-* nudges survive.
    await cancelDailyReminderOnly();

    await cancelPendingDay3PushForReminder(new Date());

    const timeStr = settings.reminderTime || "08:00";
    await scheduleDailyReminderNotification(
      timeStr,
      await buildTomorrowReminderMessage(),
      { todayDone: true },
    );
  } catch {}
}
