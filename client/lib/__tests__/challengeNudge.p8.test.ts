/**
 * P8 Phase B: Day-2 nudge timing, path-aware target and delivery events.
 * Uses the real Week-1 schedule (workoutProgram) so the rest-day defaults
 * are tested against the actual program.
 */
import {
  __day2NudgeTestUtils,
  cancelChallengeDay2Nudge,
  claimNotificationResponse,
  isDay2WorkoutDay,
  markInAppDay2NudgeRendered,
  nextLocalDateString,
  onHomeLeftAfterDay2Nudge,
  reportDay2NudgeFirePassed,
  reportDay2NudgeReceived,
  scheduleChallengeDay2Nudge,
  shouldShowInAppDay2Nudge,
} from "../challengeNudge";
import * as Notifications from "expo-notifications";

const mockPlatform = { OS: "ios" };
jest.mock("react-native", () => ({
  get Platform() {
    return mockPlatform;
  },
}));

jest.mock("expo-notifications", () => ({
  SchedulableTriggerInputTypes: {
    TIME_INTERVAL: "timeInterval",
    DAILY: "daily",
  },
  scheduleNotificationAsync: jest.fn(async () => "id"),
  cancelScheduledNotificationAsync: jest.fn(async () => undefined),
  setNotificationHandler: jest.fn(),
}));

const mockTrack = {
  scheduled: jest.fn(),
  shown: jest.fn(),
  received: jest.fn(),
  firePassed: jest.fn(),
};
jest.mock("../analytics", () => ({
  trackChallengeDay2NudgeScheduled: (d: unknown) => mockTrack.scheduled(d),
  trackChallengeDay2NudgeShown: (d: unknown) => mockTrack.shown(d),
  trackChallengeNudgeReceived: (d: unknown) => mockTrack.received(d),
  trackChallengeNudgeFirePassed: (d: unknown) => mockTrack.firePassed(d),
}));

const mockPermission = { status: "granted", requestGrants: false };
jest.mock("../notifications", () => ({
  getNotificationPermissionStatus: jest.fn(async () => mockPermission.status),
  requestNotificationPermissionInstrumented: jest.fn(
    async () => mockPermission.requestGrants,
  ),
}));

type Path = "accelerated" | "standard" | "gentle" | null;
const mockDb: {
  scheduled: boolean;
  day2Started: boolean;
  pending: boolean;
  path: Path;
  completedDates: string[];
  state: Record<string, unknown>;
} = {
  scheduled: false,
  day2Started: false,
  pending: false,
  path: null,
  completedDates: [],
  state: {},
};
jest.mock("../storage", () => ({
  storage: {
    hasScheduledChallengeDay2Nudge: async () => mockDb.scheduled,
    markChallengeDay2NudgeScheduled: async () => {
      mockDb.scheduled = true;
    },
    hasChallengeDayStarted: async () => mockDb.day2Started,
    isChallengeDay2InAppNudgePending: async () => mockDb.pending,
    setChallengeDay2InAppNudgePending: async (p: boolean) => {
      mockDb.pending = p;
    },
    getCalibrationState: async () => ({
      calibrationLevel: null,
      difficultyPath: mockDb.path,
      calibrationCompleted: mockDb.path != null,
    }),
    getProgress: async () => ({ completedDates: mockDb.completedDates }),
    getChallengeDay2NudgeState: async () => ({ ...mockDb.state }),
    updateChallengeDay2NudgeState: async (patch: Record<string, unknown>) => {
      mockDb.state = { ...mockDb.state, ...patch };
      return mockDb.state;
    },
  },
}));

const schedule = Notifications.scheduleNotificationAsync as jest.Mock;
const cancel = Notifications.cancelScheduledNotificationAsync as jest.Mock;

// Day 1 finished Tue Nov 17 2026, 10:00 local.
const DAY1 = new Date(2026, 10, 17, 10, 0, 0);
const SAME_DAY_EVENING = new Date(2026, 10, 17, 19, 0, 0);
const NEXT_DAY = new Date(2026, 10, 18, 12, 0, 0);
const DAY_AFTER = new Date(2026, 10, 19, 12, 0, 0);

beforeEach(() => {
  jest.clearAllMocks();
  mockPlatform.OS = "ios";
  mockPermission.status = "granted";
  mockPermission.requestGrants = false;
  Object.assign(mockDb, {
    scheduled: false,
    day2Started: false,
    pending: false,
    path: null,
    completedDates: [],
    state: {},
  });
});

describe("isDay2WorkoutDay (real Week-1 schedule)", () => {
  it("only the accelerated path trains on Day 2", () => {
    expect(isDay2WorkoutDay("accelerated")).toBe(true);
    expect(isDay2WorkoutDay("standard")).toBe(false);
    expect(isDay2WorkoutDay("gentle")).toBe(false);
    expect(isDay2WorkoutDay(null)).toBe(false);
  });
});

describe("scheduleChallengeDay2Nudge — accelerated path", () => {
  beforeEach(() => {
    mockDb.path = "accelerated";
  });

  it("schedules the Day-2 push for 9:00 next morning with fire_at", async () => {
    await scheduleChallengeDay2Nudge(DAY1);
    expect(schedule).toHaveBeenCalledTimes(1);
    const req = schedule.mock.calls[0][0];
    expect(req.identifier).toBe(__day2NudgeTestUtils.NUDGE_ID);
    expect(req.content.title).toBe("Day 2 is ready");
    expect(req.content.body).toBe(
      "Come back for Day 2 of 7 — we’ll keep it short and clear.",
    );
    const fireAt = req.content.data.fire_at as string;
    const fire = new Date(fireAt);
    expect(fire.getDate()).toBe(18);
    expect(fire.getHours()).toBe(9);
    expect(fire.getMinutes()).toBe(0);
    expect(req.trigger.seconds).toBe(
      Math.round((fire.getTime() - DAY1.getTime()) / 1000),
    );
    expect(fireAt.length).toBeLessThanOrEqual(40);
    expect(mockTrack.scheduled).toHaveBeenCalledWith({
      channel: "push",
      fire_at: fireAt,
    });
    expect(mockDb.state.push).toEqual({ fireAt });
    expect(mockDb.state.eligibleFromLocalDate).toBe("2026-11-18");
    expect(mockDb.pending).toBe(false);
  });

  it("falls back to the in-app banner without permission", async () => {
    mockPermission.status = "denied";
    await scheduleChallengeDay2Nudge(DAY1);
    expect(schedule).not.toHaveBeenCalled();
    expect(mockDb.pending).toBe(true);
    expect(mockTrack.scheduled).toHaveBeenCalledWith({ channel: "in_app" });
  });

  it("logs in_app on web even though web reports granted", async () => {
    mockPlatform.OS = "web";
    await scheduleChallengeDay2Nudge(DAY1);
    expect(schedule).not.toHaveBeenCalled();
    expect(mockTrack.scheduled).toHaveBeenCalledWith({ channel: "in_app" });
  });

  it("does nothing twice", async () => {
    await scheduleChallengeDay2Nudge(DAY1);
    await scheduleChallengeDay2Nudge(DAY1);
    expect(schedule).toHaveBeenCalledTimes(1);
  });
});

describe.each(["standard", "gentle", null] as Path[])(
  "scheduleChallengeDay2Nudge — rest-day path %s",
  (path) => {
    beforeEach(() => {
      mockDb.path = path;
    });

    it("schedules no Day-2 push or banner and logs no scheduled event", async () => {
      await scheduleChallengeDay2Nudge(DAY1);
      expect(schedule).not.toHaveBeenCalled();
      expect(mockDb.pending).toBe(false);
      expect(mockTrack.scheduled).not.toHaveBeenCalled();
      expect(mockDb.scheduled).toBe(true);
    });

    it("never shows the Day-2 banner, even with a legacy pending flag", async () => {
      mockDb.pending = true;
      expect(await shouldShowInAppDay2Nudge(NEXT_DAY)).toBe(false);
    });
  },
);

describe("in-app Day-2 banner (accelerated, no permission)", () => {
  beforeEach(async () => {
    mockDb.path = "accelerated";
    mockPermission.status = "denied";
    await scheduleChallengeDay2Nudge(DAY1);
    jest.clearAllMocks();
  });

  it("same-day Home visit after Day 1 neither shows, logs nor clears", async () => {
    expect(await shouldShowInAppDay2Nudge(SAME_DAY_EVENING)).toBe(false);
    await onHomeLeftAfterDay2Nudge();
    expect(mockDb.pending).toBe(true);
    expect(mockTrack.shown).not.toHaveBeenCalled();
  });

  it("shows the next local day and logs shown once per day", async () => {
    expect(await shouldShowInAppDay2Nudge(NEXT_DAY)).toBe(true);
    await markInAppDay2NudgeRendered(NEXT_DAY);
    await markInAppDay2NudgeRendered(NEXT_DAY);
    expect(mockTrack.shown).toHaveBeenCalledTimes(1);
    expect(mockTrack.shown).toHaveBeenCalledWith({ channel: "in_app" });
  });

  it("clears after rendering on an eligible day and leaving Home", async () => {
    await markInAppDay2NudgeRendered(NEXT_DAY);
    await onHomeLeftAfterDay2Nudge();
    expect(mockDb.pending).toBe(false);
    expect(await shouldShowInAppDay2Nudge(DAY_AFTER)).toBe(false);
  });

  it("stops once a session after Day 1 happened", async () => {
    mockDb.completedDates = ["2026-11-17", "2026-11-18"];
    expect(await shouldShowInAppDay2Nudge(DAY_AFTER)).toBe(false);
    expect(mockDb.pending).toBe(false);
  });

  it("uses the local calendar date (late-evening finish)", () => {
    expect(nextLocalDateString(new Date(2026, 10, 17, 23, 59))).toBe(
      "2026-11-18",
    );
    // DST end (US) on Nov 1 2026.
    expect(nextLocalDateString(new Date(2026, 10, 1, 0, 30))).toBe(
      "2026-11-02",
    );
  });
});

describe("push delivery vs tap", () => {
  beforeEach(async () => {
    mockDb.path = "accelerated";
    await scheduleChallengeDay2Nudge(DAY1);
    jest.clearAllMocks();
  });

  it("logs fire-passed once, only after fire_at, with a bounded status", async () => {
    await reportDay2NudgeFirePassed(SAME_DAY_EVENING);
    expect(mockTrack.firePassed).not.toHaveBeenCalled();
    mockPermission.status = "weird-status";
    await reportDay2NudgeFirePassed(NEXT_DAY);
    await reportDay2NudgeFirePassed(DAY_AFTER);
    expect(mockTrack.firePassed).toHaveBeenCalledTimes(1);
    expect(mockTrack.firePassed).toHaveBeenCalledWith({
      nudge: "day2",
      permission_status: "unknown",
    });
  });

  it("logs a foreground receipt once and ignores other notifications", async () => {
    await reportDay2NudgeReceived({ nudge: "other" });
    await reportDay2NudgeReceived({ nudge: "day2" });
    await reportDay2NudgeReceived({ nudge: "day2" });
    expect(mockTrack.received).toHaveBeenCalledTimes(1);
    expect(mockTrack.received).toHaveBeenCalledWith({
      nudge: "day2",
      method: "foreground",
    });
  });

  it("dedupes a replayed notification response", async () => {
    expect(await claimNotificationResponse("challenge-day2-nudge|123")).toBe(
      true,
    );
    expect(await claimNotificationResponse("challenge-day2-nudge|123")).toBe(
      false,
    );
    expect(await claimNotificationResponse("challenge-day2-nudge|456")).toBe(
      true,
    );
  });

  it("cancel removes only the Day-2 nudge id and clears the push record", async () => {
    await cancelChallengeDay2Nudge();
    expect(cancel).toHaveBeenCalledWith("challenge-day2-nudge");
    expect(mockDb.state.push).toBeNull();
  });
});
