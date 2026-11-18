/**
 * P8.2: the daily reminder has a fixed id and never cancels other scheduled
 * notifications (the challenge Day-2 nudge in particular).
 */
import * as Notifications from "expo-notifications";
import {
  DAILY_REMINDER_ID,
  DAILY_REMINDER_SAME_WEEKDAY_WEEKS,
  cancelAllReminders,
  migrateLegacyDailyReminders,
  rescheduleAfterCompletion,
  scheduleDailyReminder,
} from "../notifications";

jest.mock("react-native", () => ({ Platform: { OS: "ios" } }));

type Req = {
  identifier: string;
  content: { data?: Record<string, unknown> };
  trigger?: Record<string, unknown>;
};
const mockScheduled: Req[] = [];

jest.mock("expo-notifications", () => ({
  SchedulableTriggerInputTypes: {
    TIME_INTERVAL: "timeInterval",
    DAILY: "daily",
    WEEKLY: "weekly",
    DATE: "date",
  },
  setNotificationHandler: jest.fn(),
  scheduleNotificationAsync: jest.fn(
    async (req: {
      identifier?: string;
      content: Req["content"];
      trigger?: Record<string, unknown>;
    }) => {
      const identifier = req.identifier ?? `auto-${mockScheduled.length}`;
      const i = mockScheduled.findIndex((r) => r.identifier === identifier);
      if (i >= 0) mockScheduled.splice(i, 1);
      mockScheduled.push({
        identifier,
        content: req.content,
        trigger: req.trigger,
      });
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
  nudgeState: {} as Record<string, unknown>,
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
    getChallengeDay2NudgeState: async () => ({ ...mockStore.nudgeState }),
    updateChallengeDay2NudgeState: async (patch: Record<string, unknown>) => {
      mockStore.nudgeState = { ...mockStore.nudgeState, ...patch };
      return mockStore.nudgeState;
    },
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
  mockStore.nudgeState = {};
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

  it("today done, time still ahead: skips today but keeps every other day", async () => {
    jest.useFakeTimers({ now: new Date(2026, 10, 18, 7, 0) }); // Wed 07:00
    try {
      mockStore.completedDates = [localDate(new Date())];
      await scheduleDailyReminder("08:00");
      const reminders = mockScheduled.filter((r) =>
        r.identifier.startsWith(DAILY_REMINDER_ID),
      );
      expect(reminders).toHaveLength(6 + DAILY_REMINDER_SAME_WEEKDAY_WEEKS);
      expect(reminders.some((r) => r.trigger?.type === "daily")).toBe(false);
      const weekly = reminders.filter((r) => r.trigger?.type === "weekly");
      expect(weekly.map((r) => r.trigger?.weekday).sort()).toEqual([
        1, 2, 3, 5, 6, 7,
      ]); // Wednesday (4) skipped
      const oneOffs = reminders
        .filter((r) => r.trigger?.type === "date")
        .map((r) => r.trigger?.date as Date);
      expect(oneOffs).toHaveLength(DAILY_REMINDER_SAME_WEEKDAY_WEEKS);
      expect(
        oneOffs.map((d) => [d.getMonth(), d.getDate(), d.getHours()]),
      ).toEqual([
        [10, 25, 8],
        [11, 2, 8],
        [11, 9, 8],
        [11, 16, 8],
        [11, 23, 8],
        [11, 30, 8],
        [0, 6, 8],
        [0, 13, 8],
      ]);
      expect(ids()).toContain("challenge-day2-nudge");
      expect(ids()).toContain("challenge-followup-d3");

      // Next launch on a not-done day re-arms the plain DAILY reminder.
      mockStore.completedDates = [];
      await scheduleDailyReminder("08:00");
      const after = mockScheduled.filter((r) =>
        r.identifier.startsWith(DAILY_REMINDER_ID),
      );
      expect(after.map((r) => r.identifier)).toEqual([DAILY_REMINDER_ID]);
    } finally {
      jest.useRealTimers();
    }
  });

  it("L8: a lapsed user gets the reminder 7 days a week for the whole window, never today", async () => {
    const now = new Date(2026, 10, 18, 7, 0); // Wed 07:00
    jest.useFakeTimers({ now });
    try {
      mockStore.completedDates = [localDate(new Date())];
      await scheduleDailyReminder("08:00");
      const reminders = mockScheduled.filter((r) =>
        r.identifier.startsWith(DAILY_REMINDER_ID),
      );
      // Expand every trigger into concrete fire days over the window.
      const fireDays = new Set<string>();
      const days = 7 * DAILY_REMINDER_SAME_WEEKDAY_WEEKS;
      for (let i = 0; i <= days; i++) {
        const day = new Date(2026, 10, 18 + i, 8, 0);
        for (const r of reminders) {
          const t = r.trigger ?? {};
          const hit =
            (t.type === "weekly" && t.weekday === day.getDay() + 1) ||
            (t.type === "date" && (t.date as Date).getTime() === day.getTime());
          if (hit) fireDays.add(localDate(day));
        }
      }
      expect(fireDays.has(localDate(now))).toBe(false); // not again today
      for (let i = 1; i <= days; i++) {
        expect(fireDays.has(localDate(new Date(2026, 10, 18 + i)))).toBe(true);
      }
      // Ids are unique and well inside iOS's 64 pending limit.
      const reminderIds = reminders.map((r) => r.identifier);
      expect(new Set(reminderIds).size).toBe(reminderIds.length);
      expect(mockScheduled.length).toBeLessThanOrEqual(20);
    } finally {
      jest.useRealTimers();
    }
  });

  it("L8: the window rolls forward on every rebuild (no stale or duplicate ids)", async () => {
    jest.useFakeTimers({ now: new Date(2026, 10, 18, 7, 0) });
    try {
      mockStore.completedDates = [localDate(new Date())];
      await scheduleDailyReminder("08:00");
      jest.setSystemTime(new Date(2026, 10, 19, 7, 0)); // Thu, done again
      mockStore.completedDates = [localDate(new Date())];
      await scheduleDailyReminder("08:00");
      const reminders = mockScheduled.filter((r) =>
        r.identifier.startsWith(DAILY_REMINDER_ID),
      );
      expect(reminders).toHaveLength(6 + DAILY_REMINDER_SAME_WEEKDAY_WEEKS);
      const weekly = reminders.filter((r) => r.trigger?.type === "weekly");
      expect(weekly.map((r) => r.trigger?.weekday).sort()).toEqual([
        1, 2, 3, 4, 6, 7,
      ]); // Thursday (5) skipped now; Wednesday is back
      const first = reminders.find(
        (r) => r.identifier === `${DAILY_REMINDER_ID}-once-1`,
      );
      expect((first?.trigger?.date as Date).getDate()).toBe(26);
    } finally {
      jest.useRealTimers();
    }
  });

  it("today done, time already passed: plain DAILY (next fire is tomorrow)", async () => {
    jest.useFakeTimers({ now: new Date(2026, 10, 18, 20, 0) });
    try {
      mockStore.completedDates = [localDate(new Date())];
      await scheduleDailyReminder("08:00");
      const reminders = mockScheduled.filter((r) =>
        r.identifier.startsWith(DAILY_REMINDER_ID),
      );
      expect(reminders.map((r) => r.trigger?.type)).toEqual(["daily"]);
    } finally {
      jest.useRealTimers();
    }
  });

  it("open Q3: arming the reminder drops a pending (unfired) Day-3 push", async () => {
    mockStore.nudgeState = {
      followupD3: { fireAt: new Date(Date.now() + 86_400_000).toISOString() },
    };
    await scheduleDailyReminder("08:00");
    expect(ids()).not.toContain("challenge-followup-d3");
    expect(ids()).toContain("challenge-day2-nudge");
    expect(mockStore.nudgeState.followupD3).toBeNull();
  });

  it("open Q3: a Day-3 push that already fired is left alone", async () => {
    mockStore.nudgeState = {
      followupD3: { fireAt: new Date(Date.now() - 60_000).toISOString() },
    };
    await scheduleDailyReminder("08:00");
    expect(ids()).toContain("challenge-followup-d3");
  });
});

describe("legacy daily reminder migration", () => {
  it("cancels unidentified Home reminders once and never challenge-* ids", async () => {
    mockScheduled.push(
      { identifier: "legacy-uuid-1", content: { data: { screen: "Home" } } },
      {
        identifier: "daily-reminder-wd3",
        content: { data: { screen: "Home" } },
      },
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
      "daily-reminder-wd3",
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
