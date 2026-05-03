import AsyncStorage from "@react-native-async-storage/async-storage";
import { storage } from "../storage";
import { defaultProgramProgress } from "../programCompletion";

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

const store = (AsyncStorage as unknown as { __store: Map<string, string> })
  .__store;

const fmt = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;

const seedScoreState = async () => {
  await AsyncStorage.setItem(
    "pulsekegel_control_score_state",
    JSON.stringify({
      controlScore: 1234,
      currentRank: "Strong",
      highestRank: "Elite",
      highestScore: 1500,
      eliteAchieved: true,
      currentStreak: 5,
      longestStreak: 9,
      idleDays: 0,
      lastSessionDate: "2026-01-01",
      lastScoreUpdateDate: "2026-01-01",
      backfilled: true,
      history: [],
    }),
  );
};

beforeEach(() => {
  store.clear();
  jest.clearAllMocks();
});

describe("storage program-completion helpers", () => {
  it("getProgramProgress lazy-inits to twelve_week_program for legacy users with no calibration record", async () => {
    // No PROGRAM_PROGRESS, no CHALLENGE_CALIBRATION - typical legacy user.
    await AsyncStorage.setItem("pulsekegel_program_start_date", "2026-01-01");
    const p = await storage.getProgramProgress();
    expect(p.phase).toBe("twelve_week_program");
    expect(p.twelveWeekStartDate).toBe("2026-01-01");
  });

  it("getProgramProgress lazy-inits to seven_day_challenge only when calibration is in progress (record exists, not completed)", async () => {
    await AsyncStorage.setItem(
      "pulsekegel_challenge_calibration",
      JSON.stringify({
        calibrationLevel: null,
        difficultyPath: null,
        calibrationCompleted: false,
      }),
    );
    const p = await storage.getProgramProgress();
    expect(p.phase).toBe("seven_day_challenge");
  });

  it("getProgramProgress lazy-inits to twelve_week_program when calibration is completed", async () => {
    await AsyncStorage.setItem("pulsekegel_program_start_date", "2026-01-01");
    await AsyncStorage.setItem(
      "pulsekegel_challenge_calibration",
      JSON.stringify({
        calibrationLevel: "okay",
        difficultyPath: "standard",
        calibrationCompleted: true,
      }),
    );
    const p = await storage.getProgramProgress();
    expect(p.phase).toBe("twelve_week_program");
    expect(p.twelveWeekStartDate).toBe("2026-01-01");
  });

  it("getProgramProgress lazy-inits to twelve_week_program for fresh installs (no data at all)", async () => {
    const p = await storage.getProgramProgress();
    expect(p.phase).toBe("twelve_week_program");
    expect(p.twelveWeekStartDate).toBeNull();
  });

  it("evaluateAndStoreCompletionTier persists tier and twelveWeekCompletionDate", async () => {
    await storage.saveProgramProgress({
      ...defaultProgramProgress,
      phase: "twelve_week_program",
      twelveWeekStartDate: "2026-01-01",
    });
    // 60 unique non-rest days in the 84-day window -> strong
    const dates: string[] = [];
    const start = new Date(2026, 0, 1);
    for (let i = 0; i < 60; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      dates.push(fmt(d));
    }
    await AsyncStorage.setItem(
      "pulsekegel_completed_dates",
      JSON.stringify(dates),
    );
    const evalResult = await storage.evaluateAndStoreCompletionTier();
    expect(evalResult?.tier).toBe("strong");
    const stored = await storage.getProgramProgress();
    expect(stored.completionTier).toBe("strong");
    expect(stored.twelveWeekCompletionDate).not.toBeNull();
  });

  it("shouldShowProgramCompletion triggers immediately on Week 12 Day 7 when today is in completedDates", async () => {
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - 83); // today is start + 83 = Week 12 Day 7
    const startStr = fmt(start);
    const todayStr = fmt(today);
    await storage.saveProgramProgress({
      ...defaultProgramProgress,
      phase: "twelve_week_program",
      twelveWeekStartDate: startStr,
    });
    // Without today completed → false
    await AsyncStorage.setItem(
      "pulsekegel_completed_dates",
      JSON.stringify([]),
    );
    expect(await storage.shouldShowProgramCompletion(todayStr)).toBe(false);
    // With today completed → true
    await AsyncStorage.setItem(
      "pulsekegel_completed_dates",
      JSON.stringify([todayStr]),
    );
    expect(await storage.shouldShowProgramCompletion(todayStr)).toBe(true);
  });

  it("shouldShowProgramCompletion returns false after a decision has been recorded", async () => {
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - 90);
    const startStr = fmt(start);
    const todayStr = fmt(today);
    await storage.saveProgramProgress({
      ...defaultProgramProgress,
      phase: "twelve_week_program",
      twelveWeekStartDate: startStr,
      twelveWeekDecisionDate: todayStr,
    });
    expect(await storage.shouldShowProgramCompletion(todayStr)).toBe(false);
  });

  it("restartTwelveWeekProgram preserves control score state and lifetime totals while resetting program progress", async () => {
    await seedScoreState();
    await AsyncStorage.setItem("pulsekegel_total_sessions", "42");
    await AsyncStorage.setItem("pulsekegel_total_minutes", "315");
    await AsyncStorage.setItem(
      "pulsekegel_completed_dates",
      JSON.stringify(["2026-01-05", "2026-01-06"]),
    );
    await storage.saveProgramProgress({
      ...defaultProgramProgress,
      phase: "twelve_week_program",
      twelveWeekStartDate: "2026-01-01",
      completionTier: "strong",
      lifetimeProgramsCompleted: 0,
    });

    await storage.restartTwelveWeekProgram("2026-04-15");

    // Score state preserved verbatim.
    const score = await storage.getControlScoreState();
    expect(score.controlScore).toBe(1234);
    expect(score.currentRank).toBe("Strong");
    expect(score.highestRank).toBe("Elite");
    expect(score.highestScore).toBe(1500);
    expect(score.eliteAchieved).toBe(true);

    // Lifetime totals preserved.
    expect(await storage.getTotalSessions()).toBe(42);
    expect(await storage.getTotalMinutes()).toBe(315);

    // Program progress reset, lifetime counter incremented, start moved.
    const p = await storage.getProgramProgress();
    expect(p.phase).toBe("twelve_week_program");
    expect(p.twelveWeekStartDate).toBe("2026-04-15");
    expect(p.completionTier).toBeNull();
    expect(p.twelveWeekDecisionDate).toBeNull();
    expect(p.lifetimeProgramsCompleted).toBe(1);

    // Workout session dates cleared.
    expect(await storage.getCompletedDates()).toEqual([]);
  });

  it("restartFromWeekFive backdates start date by 28 days and preserves score state", async () => {
    await seedScoreState();
    await storage.restartFromWeekFive("2026-05-01");
    const p = await storage.getProgramProgress();
    expect(p.twelveWeekStartDate).toBe("2026-04-03"); // 28 days before 2026-05-01
    expect(p.lifetimeProgramsCompleted).toBe(0);
    const score = await storage.getControlScoreState();
    expect(score.controlScore).toBe(1234);
  });

  it("switchToControlMode increments lifetimeProgramsCompleted only when prior phase was twelve_week strong", async () => {
    await seedScoreState();
    await storage.saveProgramProgress({
      ...defaultProgramProgress,
      phase: "twelve_week_program",
      twelveWeekStartDate: "2026-01-01",
      completionTier: "strong",
      lifetimeProgramsCompleted: 2,
    });
    await storage.switchToControlMode("build", "2026-04-15");
    const p1 = await storage.getProgramProgress();
    expect(p1.phase).toBe("control_mode");
    expect(p1.controlModePath).toBe("build");
    expect(p1.controlModeUnlocked).toBe(true);
    expect(p1.weeklyTarget).toBe(6); // build target
    expect(p1.lifetimeProgramsCompleted).toBe(3);

    // Score state still preserved across the transition.
    const score = await storage.getControlScoreState();
    expect(score.controlScore).toBe(1234);

    // From control_mode (or non-strong tier) it should NOT increment.
    await storage.switchToControlMode("maintain", "2026-04-20");
    const p2 = await storage.getProgramProgress();
    expect(p2.controlModePath).toBe("maintain");
    expect(p2.lifetimeProgramsCompleted).toBe(3);
  });
});

describe("Segment-type history window", () => {
  beforeEach(() => store.clear());

  it("getRecentSegmentTypeCounts respects the lookback window and excludes today", async () => {
    await storage.addSegmentTypeHistoryEntry("2026-01-01", ["slowHolds"]);
    await storage.addSegmentTypeHistoryEntry("2026-01-10", [
      "slowHolds",
      "quickFlicks",
    ]);
    await storage.addSegmentTypeHistoryEntry("2026-01-14", [
      "quickFlicks",
      "elevator",
    ]);
    // today's session should NOT be counted (window is < today)
    await storage.addSegmentTypeHistoryEntry("2026-01-15", ["contractRelax"]);

    const counts = await storage.getRecentSegmentTypeCounts("2026-01-15", 14);
    // 2026-01-01 is exactly 14 days before 2026-01-15 → cutoff inclusive,
    // so the 01-01 entry IS included.
    expect(counts.slowHolds).toBe(2);
    expect(counts.quickFlicks).toBe(2);
    expect(counts.elevator).toBe(1);
    expect(counts.contractRelax).toBeUndefined();
  });

  it("getRecentSegmentTypeCounts returns an empty object when there is no history", async () => {
    const counts = await storage.getRecentSegmentTypeCounts("2026-01-15");
    expect(counts).toEqual({});
  });

  it("addSegmentTypeHistoryEntry caps history at 60 entries", async () => {
    for (let i = 0; i < 75; i++) {
      const day = String(i + 1).padStart(2, "0");
      await storage.addSegmentTypeHistoryEntry(`2026-01-${day}`, ["slowHolds"]);
    }
    const history = await storage.getSegmentTypeHistory();
    expect(history.length).toBe(60);
    // Oldest should have been dropped — earliest remaining is entry #16.
    expect(history[0].date).toBe("2026-01-16");
  });
});
