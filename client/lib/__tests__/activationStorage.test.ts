import AsyncStorage from "@react-native-async-storage/async-storage";
import { storage } from "../storage";

jest.mock("@react-native-async-storage/async-storage", () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn((k: string) =>
        Promise.resolve(store.has(k) ? (store.get(k) as string) : null),
      ),
      setItem: jest.fn((k: string, v: string) => {
        store.set(k, v);
        return Promise.resolve();
      }),
      removeItem: jest.fn((k: string) => {
        store.delete(k);
        return Promise.resolve();
      }),
      multiRemove: jest.fn((keys: string[]) => {
        keys.forEach((k) => store.delete(k));
        return Promise.resolve();
      }),
      clear: jest.fn(() => {
        store.clear();
        return Promise.resolve();
      }),
      __store: store,
    },
  };
});

jest.mock("@/data/workoutProgram", () => ({
  isRestDayForDate: jest.fn(),
  getWorkoutCompletionsForWeek: jest.fn().mockReturnValue(0),
  getScheduledDaysForWeek: jest.fn().mockReturnValue(3),
}));

jest.mock("@/data/controlModeWorkouts", () => ({
  buildHabitSchedule: jest.fn(() => ({ preferredRestWeekdays: [] })),
}));

jest.mock("@/data/badges", () => ({
  BADGE_DEFINITIONS: [],
}));

const store = (AsyncStorage as unknown as { __store: Map<string, string> })
  .__store;

describe("activation storage helpers", () => {
  beforeEach(() => {
    store.clear();
    jest.clearAllMocks();
  });

  it("persists and clears onboarding progress", async () => {
    await storage.saveOnboardingProgress("anatomy", 1);
    expect(await storage.getOnboardingProgress()).toEqual({
      screenKey: "anatomy",
      index: 1,
    });
    await storage.setOnboardingComplete();
    expect(await storage.isOnboardingComplete()).toBe(true);
    expect(await storage.getOnboardingProgress()).toBeNull();
  });

  it("tracks first-session in-progress and progress pct", async () => {
    expect(await storage.hasCompletedFirstSession()).toBe(false);
    await storage.setFirstSessionInProgress(true, 42);
    expect(await storage.isFirstSessionInProgress()).toBe(true);
    expect(await storage.getFirstSessionProgressPct()).toBe(42);
    await storage.setFirstSessionInProgress(false);
    expect(await storage.isFirstSessionInProgress()).toBe(false);
  });

  it("consumes first-session gate source once", async () => {
    await storage.setFirstSessionGateSource("post_onboarding");
    expect(await storage.consumeFirstSessionGateSource()).toBe(
      "post_onboarding",
    );
    expect(await storage.consumeFirstSessionGateSource()).toBeNull();
  });

  it("marks celebration only after first session", async () => {
    expect(await storage.hasCelebratedFirstSession()).toBe(false);
    await storage.markFirstSessionCelebrated();
    expect(await storage.hasCelebratedFirstSession()).toBe(true);
  });

  it("peeks gate source without consuming and stores session id", async () => {
    await storage.setFirstSessionGateSource("cold_open");
    expect(await storage.peekFirstSessionGateSource()).toBe("cold_open");
    expect(await storage.peekFirstSessionGateSource()).toBe("cold_open");
    await storage.clearFirstSessionGateSource();
    expect(await storage.peekFirstSessionGateSource()).toBeNull();
    await storage.setFirstSessionId("sess-1");
    expect(await storage.getFirstSessionId()).toBe("sess-1");
    await storage.setFirstSessionInProgress(false);
    expect(await storage.getFirstSessionId()).toBeNull();
  });

  it("tracks challenge day started/completed and day2 nudge flags", async () => {
    expect(await storage.hasChallengeDayStarted(1, 1)).toBe(false);
    await storage.markChallengeDayStarted(1, 1);
    expect(await storage.hasChallengeDayStarted(1, 1)).toBe(true);
    await storage.markChallengeDayCompleted(1, 1);
    expect(await storage.hasChallengeDayCompleted(1, 1)).toBe(true);
    await storage.markChallengeDayViewed(1, 2);
    expect(await storage.hasChallengeDayViewed(1, 2)).toBe(true);
    expect(await storage.hasScheduledChallengeDay2Nudge()).toBe(false);
    await storage.markChallengeDay2NudgeScheduled();
    expect(await storage.hasScheduledChallengeDay2Nudge()).toBe(true);
    await storage.setChallengeDay2InAppNudgePending(true);
    expect(await storage.isChallengeDay2InAppNudgePending()).toBe(true);
    await storage.setChallengeDay2InAppNudgePending(false);
    expect(await storage.isChallengeDay2InAppNudgePending()).toBe(false);
  });

  it("persists settings tip seen and pending open settings", async () => {
    expect(await storage.hasSettingsTipSeen()).toBe(false);
    await storage.markSettingsTipSeen();
    expect(await storage.hasSettingsTipSeen()).toBe(true);

    expect(await storage.consumePendingOpenSettings()).toBe(false);
    await storage.setPendingOpenSettings(true);
    expect(await storage.consumePendingOpenSettings()).toBe(true);
    expect(await storage.consumePendingOpenSettings()).toBe(false);

    await storage.setPendingOpenSettings(true);
    await storage.setPendingOpenSettings(false);
    expect(await storage.consumePendingOpenSettings()).toBe(false);
  });
});
