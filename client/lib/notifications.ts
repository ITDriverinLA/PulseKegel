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

export async function scheduleDailyReminder(timeStr: string): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();

    const [hours, minutes] = timeStr.split(":").map(Number);

    const progress = await storage.getProgress();
    const today = new Date().toISOString().split("T")[0];
    const todayCompleted = progress.completedDates.includes(today);

    if (todayCompleted) {
      return;
    }

    const earnedBadges = await storage.getEarnedBadges();
    const earnedIds = earnedBadges.map((b: { badgeId: string }) => b.badgeId);
    const programStartDate = await storage.getProgramStartDate();
    const isRestDay = programStartDate
      ? isRestDayForDate(new Date(), programStartDate)
      : false;

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];
    const yesterdayMissed = !progress.completedDates.includes(yesterdayStr);
    const isFirstEver = progress.totalSessions === 0;

    const message = buildReminderMessage(
      progress.currentStreak,
      isRestDay,
      earnedIds,
      yesterdayMissed,
      isFirstEver,
    );

    await Notifications.scheduleNotificationAsync({
      content: {
        title: message.title,
        body: message.body,
        data: { screen: "Home" },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: hours,
        minute: minutes,
      },
    });
  } catch {}
}

export async function cancelAllReminders(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
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

    await Notifications.cancelAllScheduledNotificationsAsync();

    const timeStr = settings.reminderTime || "08:00";
    const [hours, minutes] = timeStr.split(":").map(Number);

    const progress = await storage.getProgress();
    const earnedBadges = await storage.getEarnedBadges();
    const earnedIds = earnedBadges.map((b: { badgeId: string }) => b.badgeId);
    const programStartDate = await storage.getProgramStartDate();

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isRestDay = programStartDate
      ? isRestDayForDate(tomorrow, programStartDate)
      : false;

    const isFirstEver = progress.totalSessions <= 1;

    const message = buildReminderMessage(
      progress.currentStreak,
      isRestDay,
      earnedIds,
      false,
      isFirstEver,
    );

    await Notifications.scheduleNotificationAsync({
      content: {
        title: message.title,
        body: message.body,
        data: { screen: "Home" },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: hours,
        minute: minutes,
      },
    });
  } catch {}
}
