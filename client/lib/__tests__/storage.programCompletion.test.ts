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
      backfillVersion: 2,
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

  it("restartTwelveWeekProgram after Control Mode: streak stays intact when completed dates are cleared", async () => {
    // Seed a Control Mode score state: backfillVersion=2 (current), streak=8.
    await AsyncStorage.setItem(
      "pulsekegel_control_score_state",
      JSON.stringify({
        controlScore: 800,
        currentRank: "Strong",
        highestRank: "Strong",
        highestScore: 800,
        highestRankAchieved: "Strong",
        highestScoreAchieved: 800,
        eliteAchieved: false,
        currentStreak: 8,
        longestStreak: 8,
        idleDays: 0,
        lastSessionDate: "2026-03-10",
        lastScoreUpdateDate: "2026-03-10",
        backfilled: true,
        backfillVersion: 2,
        history: [],
        scoreHistory: [],
      }),
    );
    // Some completed dates from Control Mode activity.
    await AsyncStorage.setItem(
      "pulsekegel_completed_dates",
      JSON.stringify([
        "2026-03-03",
        "2026-03-04",
        "2026-03-05",
        "2026-03-06",
        "2026-03-07",
        "2026-03-08",
        "2026-03-09",
        "2026-03-10",
      ]),
    );

    // User restarts the 12-week program.
    await storage.restartTwelveWeekProgram("2026-03-11");

    // Completed dates must be cleared.
    expect(await storage.getCompletedDates()).toEqual([]);

    // getControlScoreState must NOT mis-count the streak by replaying the now-
    // empty session history.  backfillVersion=2 matches CURRENT_BACKFILL_VERSION
    // so no re-backfill runs — the stored streak of 8 is returned verbatim.
    const score = await storage.getControlScoreState();
    expect(score.currentStreak).toBe(8);
    // Core score fields preserved across the restart.
    expect(score.controlScore).toBe(800);
    expect(score.currentRank).toBe("Strong");
    expect(score.backfillVersion).toBe(2);
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

  it("restartFromWeekFive after Control Mode: streak stays intact when completed dates are cleared", async () => {
    // Seed a Control Mode score state: backfillVersion=2 (current), streak=6.
    await AsyncStorage.setItem(
      "pulsekegel_control_score_state",
      JSON.stringify({
        controlScore: 600,
        currentRank: "Journeyman",
        highestRank: "Journeyman",
        highestScore: 600,
        highestRankAchieved: "Journeyman",
        highestScoreAchieved: 600,
        eliteAchieved: false,
        currentStreak: 6,
        longestStreak: 6,
        idleDays: 0,
        lastSessionDate: "2026-04-06",
        lastScoreUpdateDate: "2026-04-06",
        backfilled: true,
        backfillVersion: 2,
        history: [],
        scoreHistory: [],
      }),
    );
    // Seed completed dates from Control Mode activity.
    await AsyncStorage.setItem(
      "pulsekegel_completed_dates",
      JSON.stringify([
        "2026-04-01",
        "2026-04-02",
        "2026-04-03",
        "2026-04-04",
        "2026-04-05",
        "2026-04-06",
      ]),
    );

    // User restarts from Week Five.
    await storage.restartFromWeekFive("2026-04-07");

    // Completed dates must be cleared.
    expect(await storage.getCompletedDates()).toEqual([]);

    // getControlScoreState must NOT mis-count the streak by replaying the now-
    // empty session history. backfillVersion=2 matches CURRENT_BACKFILL_VERSION
    // so no re-backfill runs — the stored streak of 6 is returned verbatim.
    const score = await storage.getControlScoreState();
    expect(score.currentStreak).toBe(6);
    // Core score fields preserved across the restart.
    expect(score.controlScore).toBe(600);
    expect(score.currentRank).toBe("Journeyman");
    expect(score.backfillVersion).toBe(2);
  });

  it("restartSevenDayCalibration after Control Mode: streak stays intact when completed dates are cleared", async () => {
    // Seed a Control Mode score state: backfillVersion=2 (current), streak=7.
    await AsyncStorage.setItem(
      "pulsekegel_control_score_state",
      JSON.stringify({
        controlScore: 700,
        currentRank: "Strong",
        highestRank: "Strong",
        highestScore: 700,
        highestRankAchieved: "Strong",
        highestScoreAchieved: 700,
        eliteAchieved: false,
        currentStreak: 7,
        longestStreak: 7,
        idleDays: 0,
        lastSessionDate: "2026-05-07",
        lastScoreUpdateDate: "2026-05-07",
        backfilled: true,
        backfillVersion: 2,
        history: [],
        scoreHistory: [],
      }),
    );
    // Seed completed dates from Control Mode activity.
    await AsyncStorage.setItem(
      "pulsekegel_completed_dates",
      JSON.stringify([
        "2026-05-01",
        "2026-05-02",
        "2026-05-03",
        "2026-05-04",
        "2026-05-05",
        "2026-05-06",
        "2026-05-07",
      ]),
    );

    // User restarts the 7-day calibration challenge.
    await storage.restartSevenDayCalibration("2026-05-08");

    // Completed dates must be cleared.
    expect(await storage.getCompletedDates()).toEqual([]);

    // getControlScoreState must NOT mis-count the streak by replaying the now-
    // empty session history. backfillVersion=2 matches CURRENT_BACKFILL_VERSION
    // so no re-backfill runs — the stored streak of 7 is returned verbatim.
    const score = await storage.getControlScoreState();
    expect(score.currentStreak).toBe(7);
    // Core score fields preserved across the restart.
    expect(score.controlScore).toBe(700);
    expect(score.currentRank).toBe("Strong");
    expect(score.backfillVersion).toBe(2);
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

describe("Rest-day streak preservation", () => {
  beforeEach(() => store.clear());

  it("two consecutive logged rest days do not reset the streak", async () => {
    // Establish a streak of 5 ending on 2026-03-01.
    await AsyncStorage.setItem(
      "pulsekegel_completed_dates",
      JSON.stringify([
        "2026-02-25",
        "2026-02-26",
        "2026-02-27",
        "2026-02-28",
        "2026-03-01",
        // Two rest days logged via breathwork (addCompletedDate).
        "2026-03-02",
        "2026-03-03",
      ]),
    );
    // Backfill / markRestDay also writes to REST_DATES for scheduled rest days.
    await AsyncStorage.setItem(
      "pulsekegel_rest_dates",
      JSON.stringify(["2026-03-02", "2026-03-03"]),
    );
    await AsyncStorage.setItem(
      "pulsekegel_control_score_state",
      JSON.stringify({
        controlScore: 200,
        currentRank: "Journeyman",
        highestRankAchieved: "Journeyman",
        highestScoreAchieved: 200,
        eliteAchieved: false,
        currentStreak: 5,
        idleDays: 0,
        lastSessionDate: "2026-03-01",
        lastScoreUpdateDate: "2026-03-01",
        backfilled: true,
        backfillVersion: 2,
        scoreHistory: [],
      }),
    );

    // User completes a workout the day after the two rest days.
    const result = await storage._completeSessionForScoreUnsafe("2026-03-04");

    // Streak should continue (5 + 1 = 6), not reset to 1.
    expect(result.state.currentStreak).toBe(6);
    // Score should have gained points, not decayed.
    expect(result.state.controlScore).toBeGreaterThanOrEqual(200);
  });

  it("daily decay does not reset streak or apply score decay for logged rest days", async () => {
    // User last completed a real workout on 2026-03-01 with streak of 5.
    // They then had two consecutive rest days that were logged.
    await AsyncStorage.setItem(
      "pulsekegel_completed_dates",
      JSON.stringify([
        "2026-02-25",
        "2026-02-26",
        "2026-02-27",
        "2026-02-28",
        "2026-03-01",
        "2026-03-02",
        "2026-03-03",
      ]),
    );
    await AsyncStorage.setItem(
      "pulsekegel_rest_dates",
      JSON.stringify(["2026-03-02", "2026-03-03"]),
    );
    await AsyncStorage.setItem(
      "pulsekegel_control_score_state",
      JSON.stringify({
        controlScore: 200,
        currentRank: "Journeyman",
        highestRankAchieved: "Journeyman",
        highestScoreAchieved: 200,
        eliteAchieved: false,
        currentStreak: 5,
        idleDays: 0,
        lastSessionDate: "2026-03-01",
        lastScoreUpdateDate: "2026-03-01",
        backfilled: true,
        backfillVersion: 2,
        scoreHistory: [],
      }),
    );

    // Simulate applyDailyDecay running on 2026-03-04 (two rest days have passed).
    const state = await storage._applyDailyDecayUnsafe("2026-03-04");

    // Streak must NOT have been reset to 0.
    expect(state.currentStreak).toBe(5);
    // Score must NOT have decayed (rest days are not idle days).
    expect(state.controlScore).toBe(200);
    // idleDays should be 0 (rest day resets the idle counter).
    expect(state.idleDays).toBe(0);
  });

  it("re-backfills stored state with missing backfillVersion and corrects under-counted streak", async () => {
    // Simulate a user whose backfill ran before the rest-day fix.
    // They have 5 consecutive workout days followed by 2 rest days, but the
    // old bug would have set currentStreak=3 (only counting workouts after a gap
    // that didn't exist). We seed backfillVersion=undefined (old format) so the
    // migration re-runs and produces the correct streak=5.
    const d = (offset: number): string => {
      const dt = new Date();
      dt.setDate(dt.getDate() + offset);
      return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
    };

    const sessionDays = [d(-6), d(-5), d(-4), d(-3), d(-2)];
    const restDays = [d(-1)];

    await AsyncStorage.setItem(
      "pulsekegel_completed_dates",
      JSON.stringify([...sessionDays, ...restDays]),
    );
    await AsyncStorage.setItem(
      "pulsekegel_rest_dates",
      JSON.stringify(restDays),
    );

    // Seed stale state: backfilled=true but NO backfillVersion (old format).
    // Under-counted streak of 3 — migration should correct it to 5.
    await AsyncStorage.setItem(
      "pulsekegel_control_score_state",
      JSON.stringify({
        controlScore: 100,
        currentRank: "Rookie",
        highestRankAchieved: "Rookie",
        highestScoreAchieved: 100,
        eliteAchieved: false,
        currentStreak: 3,
        idleDays: 0,
        lastSessionDate: d(-2),
        lastScoreUpdateDate: d(-2),
        backfilled: true,
        scoreHistory: [],
      }),
    );

    const state = await storage.getControlScoreState();

    // Migration must have re-run and corrected the streak to 5.
    expect(state.currentStreak).toBe(5);
    // backfillVersion must now be stamped as current.
    expect(state.backfillVersion).toBe(2);
    // highestScoreAchieved must not be downgraded (kept max of stored vs rebackfilled).
    expect(state.highestScoreAchieved).toBeGreaterThanOrEqual(100);
    // eliteAchieved must be preserved if it was set.
    expect(state.eliteAchieved).toBe(false);
  });

  it("migration only runs once — second call returns cached re-backfilled state", async () => {
    const d = (offset: number): string => {
      const dt = new Date();
      dt.setDate(dt.getDate() + offset);
      return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
    };

    const sessionDays = [d(-4), d(-3), d(-2)];
    await AsyncStorage.setItem(
      "pulsekegel_completed_dates",
      JSON.stringify(sessionDays),
    );
    await AsyncStorage.setItem("pulsekegel_rest_dates", JSON.stringify([]));

    // Seed stale state without backfillVersion.
    await AsyncStorage.setItem(
      "pulsekegel_control_score_state",
      JSON.stringify({
        controlScore: 50,
        currentRank: "Rookie",
        highestRankAchieved: "Rookie",
        highestScoreAchieved: 50,
        eliteAchieved: false,
        currentStreak: 1,
        idleDays: 0,
        lastSessionDate: d(-2),
        lastScoreUpdateDate: d(-2),
        backfilled: true,
        scoreHistory: [],
      }),
    );

    const first = await storage.getControlScoreState();
    expect(first.backfillVersion).toBe(2);

    const second = await storage.getControlScoreState();
    // Must return same value without re-running (no change to session data).
    expect(second.currentStreak).toBe(first.currentStreak);
    expect(second.backfillVersion).toBe(2);
  });

  it("migration preserves highestRankAchieved using rank order, not string comparison", async () => {
    const d = (offset: number): string => {
      const dt = new Date();
      dt.setDate(dt.getDate() + offset);
      return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
    };

    await AsyncStorage.setItem(
      "pulsekegel_completed_dates",
      JSON.stringify([d(-2)]),
    );
    await AsyncStorage.setItem("pulsekegel_rest_dates", JSON.stringify([]));

    // Stored state claims Elite rank achieved — the rebackfill from 1 session
    // will produce a much lower rank. The merge must keep Elite.
    await AsyncStorage.setItem(
      "pulsekegel_control_score_state",
      JSON.stringify({
        controlScore: 900,
        currentRank: "Elite",
        highestRankAchieved: "Elite",
        highestScoreAchieved: 900,
        eliteAchieved: true,
        currentStreak: 10,
        idleDays: 0,
        lastSessionDate: d(-2),
        lastScoreUpdateDate: d(-2),
        backfilled: true,
        scoreHistory: [],
      }),
    );

    const state = await storage.getControlScoreState();

    // Elite rank must not be downgraded even though rebackfill produces Rookie.
    expect(state.highestRankAchieved).toBe("Elite");
    expect(state.eliteAchieved).toBe(true);
  });

  it("migration also runs when backfillVersion is 1 (< 2 gate)", async () => {
    const d = (offset: number): string => {
      const dt = new Date();
      dt.setDate(dt.getDate() + offset);
      return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
    };

    const sessionDays = [d(-5), d(-4), d(-3), d(-2)];
    const restDays = [d(-1)];

    await AsyncStorage.setItem(
      "pulsekegel_completed_dates",
      JSON.stringify([...sessionDays, ...restDays]),
    );
    await AsyncStorage.setItem(
      "pulsekegel_rest_dates",
      JSON.stringify(restDays),
    );

    // Seed state with backfillVersion: 1 — must trigger re-backfill since 1 < 2.
    // Under-counted streak of 2 should be corrected to 4.
    await AsyncStorage.setItem(
      "pulsekegel_control_score_state",
      JSON.stringify({
        controlScore: 80,
        currentRank: "Rookie",
        highestRankAchieved: "Journeyman",
        highestScoreAchieved: 120,
        eliteAchieved: false,
        currentStreak: 2,
        idleDays: 0,
        lastSessionDate: d(-2),
        lastScoreUpdateDate: d(-2),
        backfilled: true,
        backfillVersion: 1,
        scoreHistory: [],
      }),
    );

    const state = await storage.getControlScoreState();

    // Re-backfill must have run (version was 1, below current 2).
    expect(state.backfillVersion).toBe(2);
    // Streak corrected from 2 to 4.
    expect(state.currentStreak).toBe(4);
    // highestScoreAchieved must not be downgraded.
    expect(state.highestScoreAchieved).toBeGreaterThanOrEqual(120);
    // highestRankAchieved preserved (Journeyman outranks Rookie from replay).
    expect(state.highestRankAchieved).toBe("Journeyman");
  });

  it("migration runs correctly for a Control Mode user — streak corrected and backfillVersion stamped", async () => {
    // Simulate a user who has graduated to Control Mode.  The re-backfill
    // migration in getControlScoreState() must behave identically regardless of
    // which phase is stored in pulsekegel_program_progress.
    const d = (offset: number): string => {
      const dt = new Date();
      dt.setDate(dt.getDate() + offset);
      return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
    };

    // Seed program progress indicating the user is in Control Mode.
    await AsyncStorage.setItem(
      "pulsekegel_program_progress",
      JSON.stringify({ phase: "control_mode" }),
    );

    // Session history: 5 consecutive workout days followed by 1 rest day.
    const sessionDays = [d(-6), d(-5), d(-4), d(-3), d(-2)];
    const restDays = [d(-1)];

    await AsyncStorage.setItem(
      "pulsekegel_completed_dates",
      JSON.stringify([...sessionDays, ...restDays]),
    );
    await AsyncStorage.setItem(
      "pulsekegel_rest_dates",
      JSON.stringify(restDays),
    );

    // Stale state: backfilled=true but NO backfillVersion (old format).
    // Under-counted streak of 2 and eliteAchieved preserved from before.
    await AsyncStorage.setItem(
      "pulsekegel_control_score_state",
      JSON.stringify({
        controlScore: 300,
        currentRank: "Journeyman",
        highestRankAchieved: "Elite",
        highestScoreAchieved: 900,
        eliteAchieved: true,
        currentStreak: 2,
        idleDays: 0,
        lastSessionDate: d(-2),
        lastScoreUpdateDate: d(-2),
        backfilled: true,
        scoreHistory: [],
      }),
    );

    const state = await storage.getControlScoreState();

    // Migration must have re-run: streak corrected from 2 to 5.
    expect(state.currentStreak).toBe(5);
    // backfillVersion must now be stamped as the current version.
    expect(state.backfillVersion).toBe(2);
    // highestRankAchieved must not be downgraded (Elite preserved over replay result).
    expect(state.highestRankAchieved).toBe("Elite");
    // eliteAchieved flag must be preserved.
    expect(state.eliteAchieved).toBe(true);
    // highestScoreAchieved must not be downgraded.
    expect(state.highestScoreAchieved).toBeGreaterThanOrEqual(900);
  });

  it("migration handles phase transition from seven_day_challenge to control_mode — streak counted correctly across phase boundary", async () => {
    // Simulate a user who completed the 7-day challenge and then entered
    // Control Mode. Their session history spans both phases, so the migration
    // must replay ALL dates regardless of which phase they belong to.
    const d = (offset: number): string => {
      const dt = new Date();
      dt.setDate(dt.getDate() + offset);
      return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
    };

    // Seed program progress showing the user is now in Control Mode,
    // having transitioned from seven_day_challenge.
    await AsyncStorage.setItem(
      "pulsekegel_program_progress",
      JSON.stringify({
        phase: "control_mode",
        controlModeUnlocked: true,
        controlModePath: "maintain",
      }),
    );

    // Session history spanning the phase boundary:
    //   Challenge phase  : 4 workout days (d-11 to d-8)
    //   Phase boundary   : 1 rest day (d-7) — bridges the transition
    //   Control mode     : 4 workout days (d-6 to d-3) + 1 trailing rest day (d-2)
    //   Final session    : 1 workout day (d-1)
    // Total workout days: 9; rest days maintain the streak so no gap resets it.
    const challengeDays = [d(-11), d(-10), d(-9), d(-8)];
    const boundaryRestDay = [d(-7)];
    const controlDays = [d(-6), d(-5), d(-4), d(-3)];
    const trailingRestDay = [d(-2)];
    const finalDay = [d(-1)];

    const allCompletedDates = [
      ...challengeDays,
      ...boundaryRestDay,
      ...controlDays,
      ...trailingRestDay,
      ...finalDay,
    ];
    const restDays = [...boundaryRestDay, ...trailingRestDay];

    await AsyncStorage.setItem(
      "pulsekegel_completed_dates",
      JSON.stringify(allCompletedDates),
    );
    await AsyncStorage.setItem(
      "pulsekegel_rest_dates",
      JSON.stringify(restDays),
    );

    // Stale state: backfilled=true but NO backfillVersion (old format).
    // Streak was under-counted at 4 — only the control-mode days after the
    // phase switch were counted, ignoring the challenge-phase sessions.
    await AsyncStorage.setItem(
      "pulsekegel_control_score_state",
      JSON.stringify({
        controlScore: 150,
        currentRank: "Rookie",
        highestRankAchieved: "Journeyman",
        highestScoreAchieved: 250,
        eliteAchieved: false,
        currentStreak: 4,
        idleDays: 0,
        lastSessionDate: d(-1),
        lastScoreUpdateDate: d(-1),
        backfilled: true,
        scoreHistory: [],
      }),
    );

    const state = await storage.getControlScoreState();

    // Migration must replay all 9 workout sessions across both phases.
    // The rest days (d-7, d-2) bridge the gaps without resetting the streak.
    // Expected streak: 4 (challenge) + 1 (d-6, rest bridges d-7) + 3 (d-5 to d-3)
    //                  + 1 (d-1, rest bridges d-2) = 9 total.
    expect(state.currentStreak).toBe(9);
    // backfillVersion must now be stamped as 2.
    expect(state.backfillVersion).toBe(2);
    // highestRankAchieved must not be downgraded (Journeyman preserved).
    expect(state.highestRankAchieved).toBe("Journeyman");
    // Score must be positive from replaying all 9 sessions.
    expect(state.controlScore).toBeGreaterThan(0);
    // eliteAchieved preserved from stored state.
    expect(state.eliteAchieved).toBe(false);
    // idleDays must be 0 — no idle gap exists in the session history.
    expect(state.idleDays).toBe(0);
  });

  it("backfill replay treats consecutive rest days as active so streak is not under-counted", async () => {
    // Build dates relative to today so no idle gap appears between the history and now.
    // Layout: 4 workout days (-6 to -3), then 2 consecutive rest days (-2 and -1).
    // The tail-end backfill loop will see the rest days instead of idle days, so
    // currentStreak must remain 4 after the replay (rest days don't reset it).
    const d = (offset: number): string => {
      const dt = new Date();
      dt.setDate(dt.getDate() + offset);
      return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
    };

    const sessionDays = [d(-6), d(-5), d(-4), d(-3)];
    const restDays = [d(-2), d(-1)];

    await AsyncStorage.setItem(
      "pulsekegel_completed_dates",
      JSON.stringify([...sessionDays, ...restDays]),
    );
    await AsyncStorage.setItem(
      "pulsekegel_rest_dates",
      JSON.stringify(restDays),
    );

    // No pulsekegel_control_score_state entry — forces backfill path.
    const state = await storage.getControlScoreState();

    // The backfill should have produced a streak of 4 (the 4 workout days).
    // The two trailing rest days must NOT have reset the streak counter.
    expect(state.currentStreak).toBe(4);
    // Score must have gone up (4 session gains), not decayed by the rest days.
    expect(state.controlScore).toBeGreaterThan(0);
    // idleDays must be 0 — the trailing rest days are not idle days.
    expect(state.idleDays).toBe(0);
    // Backfill flag must be set.
    expect(state.backfilled).toBe(true);
  });
});
