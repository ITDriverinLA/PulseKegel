jest.mock("react-native", () => ({
  Platform: { OS: "ios" },
}));

jest.mock("expo-notifications", () => ({
  SchedulableTriggerInputTypes: {
    TIME_INTERVAL: "timeInterval",
    DAILY: "daily",
  },
  scheduleNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  getPermissionsAsync: jest.fn(async () => ({ status: "undetermined" })),
  requestPermissionsAsync: jest.fn(async () => ({ status: "denied" })),
  setNotificationHandler: jest.fn(),
}));

jest.mock("../analytics", () => ({
  trackChallengeDay2NudgeScheduled: jest.fn(),
  trackChallengeDay2NudgeShown: jest.fn(),
  trackPermissionPromptShown: jest.fn(),
  trackPermissionResult: jest.fn(),
}));

jest.mock("../storage", () => ({
  storage: {
    hasScheduledChallengeDay2Nudge: jest.fn(async () => false),
    markChallengeDay2NudgeScheduled: jest.fn(),
    hasChallengeDayStarted: jest.fn(async () => false),
    setChallengeDay2InAppNudgePending: jest.fn(),
    isChallengeDay2InAppNudgePending: jest.fn(async () => false),
  },
}));

jest.mock("../notifications", () => ({
  getNotificationPermissionStatus: jest.fn(async () => "undetermined"),
  requestNotificationPermissionInstrumented: jest.fn(async () => false),
}));

import { __day2NudgeTestUtils } from "../challengeNudge";

describe("challenge day2 nudge timing", () => {
  it("prefers next calendar morning when inside 20–28h window", () => {
    const from = new Date(2026, 8, 3, 10, 0, 0);
    const target = __day2NudgeTestUtils.computeDay2TriggerDate(from);
    expect(target.getDate()).toBe(4);
    expect(target.getHours()).toBe(9);
  });

  it("falls back to ~24h when morning is outside the window", () => {
    const from = new Date(2026, 8, 3, 20, 0, 0);
    const target = __day2NudgeTestUtils.computeDay2TriggerDate(from);
    const delay = target.getTime() - from.getTime();
    expect(delay).toBe(__day2NudgeTestUtils.DEFAULT_DELAY_MS);
  });
});
