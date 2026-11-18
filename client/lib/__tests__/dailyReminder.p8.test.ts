/**
 * P8.2: the daily reminder has a fixed id and never cancels other scheduled
 * notifications (the challenge Day-2 nudge in particular).
 */
import * as Notifications from "expo-notifications";
import {
  DAILY_REMINDER_ID,
  cancelAllReminders,
  migrateLegacyDailyReminders,
  rescheduleAfterCompletion,
  scheduleDailyReminder,
} from "../notifications";

jest.mock("react-native", () => ({ Platform: { OS: "ios" } }));

type Req = {
  identifier: string;
  content: { data?: Record<string, unknown> };
};
const mockScheduled: Req[] = [];

jest.mock("expo-notifications", () => ({
  SchedulableTriggerInputTypes: {
    TIME_INTERVAL: "timeInterval",
    DAILY: "daily",
  },
  setNotificationHandler: jest.fn(),
  scheduleNotificationAsync: jest.fn(
    async (req: { identifier?: string; content: Req["content"] }) => {
      const identifier = req.identifier ?? `auto-${mockScheduled.length}`;
      const i = mockScheduled.findIndex((r) => r.identifier === identifier);
      if (i >= 0) mockScheduled.splice(i, 1);
      mockScheduled.push({ identifier, content: req.content });
      return identifier;
    },
  ),
  cancelScheduledNotificationAsync: jest.fn(async (id: string) => {
    const i = mockScheduled.findIndex((r) => r.identifier === id);
    if (i >= 0) mockScheduled.splice(i, 1);
  }),
  cancelAllScheduledNotificationsAsync: jest.fn(async () => {
    mockScheduled.length = 0;
  }),
  getAllScheduledNotificationsAsync: jest.fn(async () => [...mockScheduled]),
}));

jest.mock("../analytics", () => ({
  trackPermissionPromptShown: jest.fn(),
  trackPermissionResult: jest.fn(),
}));

const mockStore = {
  completedDates: [] as string[],
  reminderEnabled: true,
  migrated: false,
};
jest.mock("../storage", () => ({
  storage: {
    getProgress: async () => ({
      completedDates: mockStore.completedDates,
      currentStreak: 1,
      totalSessions: 1,
    }),
    getEarnedBadges: async () => [],
    getProgramStartDate: async () => "2026-11-17",
    getCalibrationState: async () => ({ difficultyPath: null }),
    getSettings: async () => ({
      reminderEnabled: mockStore.reminderEnabled,
      reminderTime: "08:00",
    }),
    hasCompletedFirstSession: async () => true,
    isDailyReminderIdMigrated: async () => mockStore.migrated,
    markDailyReminderIdMigrated: async () => {
      mockStore.migrated = true;
    },
  },
}));

jest.mock("@/data/workoutProgram", () => ({ isRestDayForDate: () => false }));

const cancelAll =
  Notifications.cancelAllScheduledNotificationsAsync as jest.Mock;

const localDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function seedChallengeNudge() {
  mockScheduled.push(
    {
      identifier: "challenge-day2-nudge",
      content: { data: { screen: "ChallengeDay", nudge: "day2" } },
    },
    {
      identifier: "challenge-followup-d3",
      content: {
        data: { screen: "ChallengeDay", nudge: "followup", followup_day: 3 },
      },
    },
  );
}
const ids = () => mockScheduled.map((r) => r.identifier).sort();

beforeEach(() => {
  jest.clearAllMocks();
  mockScheduled.length = 0;
  mockStore.completedDates = [];
  mockStore.reminderEnabled = true;
  mockStore.migrated = false;
  seedChallengeNudge();
});

describe("daily reminder keeps challenge nudges scheduled", () => {
  it("scheduleDailyReminder (launch / Settings time change)", async () => {
    await scheduleDailyReminder("08:00");
    await scheduleDailyReminder("09:30");
    expect(cancelAll).not.toHaveBeenCalled();
    expect(ids()).toEqual([
      "challenge-day2-nudge",
      "challenge-followup-d3",
      DAILY_REMINDER_ID,
    ]);
  });

  it("rescheduleAfterCompletion (Day-1 / Breathwork completion)", async () => {
    await rescheduleAfterCompletion();
    expect(cancelAll).not.toHaveBeenCalled();
    expect(ids()).toEqual([
      "challenge-day2-nudge",
      "challenge-followup-d3",
      DAILY_REMINDER_ID,
    ]);
  });

  it("cancelAllReminders (Settings toggle off) cancels only the reminder", async () => {
    await scheduleDailyReminder("08:00");
    await cancelAllReminders();
    expect(cancelAll).not.toHaveBeenCalled();
    expect(ids()).toEqual(["challenge-day2-nudge", "challenge-followup-d3"]);
  });

  it("keeps a reminder scheduled when today (local date) is already done", async () => {
    mockStore.completedDates = [localDate(new Date())];
    await scheduleDailyReminder("08:00");
    expect(ids()).toEqual([
      "challenge-day2-nudge",
      "challenge-followup-d3",
      DAILY_REMINDER_ID,
    ]);
  });
});

describe("legacy daily reminder migration", () => {
  it("cancels unidentified Home reminders once and never challenge-* ids", async () => {
    mockScheduled.push(
      { identifier: "legacy-uuid-1", content: { data: { screen: "Home" } } },
      { identifier: "legacy-uuid-2", content: { data: { screen: "Home" } } },
      { identifier: "badge-x", content: { data: { screen: "Badges" } } },
      {
        identifier: "challenge-followup-d5",
        content: { data: { screen: "Home" } },
      },
    );
    await migrateLegacyDailyReminders();
    expect(ids()).toEqual([
      "badge-x",
      "challenge-day2-nudge",
      "challenge-followup-d3",
      "challenge-followup-d5",
    ]);
    expect(mockStore.migrated).toBe(true);

    // Launch then reschedules with the id: exactly one daily reminder.
    await scheduleDailyReminder("08:00");
    mockScheduled.push({
      identifier: "legacy-uuid-3",
      content: { data: { screen: "Home" } },
    });
    await migrateLegacyDailyReminders(); // already migrated: no-op
    expect(ids()).toContain("legacy-uuid-3");
    expect(
      mockScheduled.filter((r) => r.identifier === DAILY_REMINDER_ID),
    ).toHaveLength(1);
  });
});
