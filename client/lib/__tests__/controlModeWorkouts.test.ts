import {
  DEFAULT_SCHEDULES,
  RANK_TO_TIER,
  RANK_TIER_SCALING,
  buildHabitSchedule,
  scaleDayForRank,
  getWeekdayLabel,
  detectWeakAreaType,
  pickWorkoutForType,
  getPrimaryExerciseType,
  getExerciseTypesIn,
  PATH_LIBRARIES,
} from "@/data/controlModeWorkouts";
import { getControlModeTodaysWorkout } from "@/lib/programCompletion";

describe("Control Mode default schedules", () => {
  test("maintain has 4 workouts and 3 rest days", () => {
    const slots = DEFAULT_SCHEDULES.maintain;
    expect(slots).toHaveLength(7);
    expect(slots.filter((s) => s !== null)).toHaveLength(4);
    expect(slots.filter((s) => s === null)).toHaveLength(3);
  });

  test("build has 6 workouts and 1 rest day", () => {
    const slots = DEFAULT_SCHEDULES.build;
    expect(slots).toHaveLength(7);
    expect(slots.filter((s) => s !== null)).toHaveLength(6);
  });

  test("precision has 5 workouts and 2 rest days", () => {
    const slots = DEFAULT_SCHEDULES.precision;
    expect(slots).toHaveLength(7);
    expect(slots.filter((s) => s !== null)).toHaveLength(5);
  });

  test("every workout slot produces a non-rest DayTemplate with segments", () => {
    for (const path of ["maintain", "build", "precision"] as const) {
      for (const slot of DEFAULT_SCHEDULES[path]) {
        if (slot === null) continue;
        const day = slot();
        expect(day.isRestDay).not.toBe(true);
        expect(day.segments.length).toBeGreaterThan(0);
        expect(day.estimatedMinutes).toBeGreaterThan(0);
        expect(day.name.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("Rank tier scaling", () => {
  test("Rookie scales reps and hold below 1.0", () => {
    expect(RANK_TIER_SCALING[RANK_TO_TIER.Rookie].reps).toBeLessThan(1);
    expect(RANK_TIER_SCALING[RANK_TO_TIER.Elite].reps).toBeGreaterThan(1);
  });

  test("scaleDayForRank produces lower reps for Rookie than Elite", () => {
    const slot = DEFAULT_SCHEDULES.build[0]!;
    const base = slot();
    const rookie = scaleDayForRank(base, "Rookie");
    const elite = scaleDayForRank(base, "Elite");
    const baseFirstReps = base.segments.find(
      (s) => s.type === "slowHolds",
    )!.repsPerSet;
    const rookieFirstReps = rookie.segments.find(
      (s) => s.type === "slowHolds",
    )!.repsPerSet;
    const eliteFirstReps = elite.segments.find(
      (s) => s.type === "slowHolds",
    )!.repsPerSet;
    expect(rookieFirstReps).toBeLessThan(baseFirstReps);
    expect(eliteFirstReps).toBeGreaterThan(baseFirstReps);
    expect(eliteFirstReps).toBeGreaterThan(rookieFirstReps);
  });

  test("scaleDayForRank does not scale getReady or blockRest segments", () => {
    const base = DEFAULT_SCHEDULES.maintain[0]!();
    const elite = scaleDayForRank(base, "Elite");
    base.segments.forEach((s, i) => {
      if (
        s.type === "getReady" ||
        s.type === "blockRest" ||
        s.type === "breathing"
      ) {
        expect(elite.segments[i].repsPerSet).toBe(s.repsPerSet);
        expect(elite.segments[i].squeezeSeconds).toBe(s.squeezeSeconds);
      }
    });
  });

  test("scaleDayForRank returns rest days unchanged", () => {
    const restTemplate = {
      id: "x",
      name: "Rest Day",
      dayType: "rest" as const,
      segments: [],
      estimatedMinutes: 0,
      isRestDay: true,
    };
    expect(scaleDayForRank(restTemplate, "Elite")).toBe(restTemplate);
  });

  test("squeezeSeconds and reps stay >= 1 even after scaling down", () => {
    const tinyDay = {
      id: "t",
      name: "Tiny",
      dayType: "speed" as const,
      segments: [
        {
          id: "s",
          name: "Tiny Squeeze",
          instructions: "x",
          sets: 1,
          repsPerSet: 1,
          squeezeSeconds: 1,
          restSeconds: 1,
          type: "quickFlicks" as const,
        },
      ],
      estimatedMinutes: 1,
    };
    const scaled = scaleDayForRank(tinyDay, "Rookie");
    expect(scaled.segments[0].repsPerSet).toBeGreaterThanOrEqual(1);
    expect(scaled.segments[0].squeezeSeconds).toBeGreaterThanOrEqual(1);
  });
});

describe("Habit-aware scheduling", () => {
  // 2026-01-05 is a Monday
  const MON = "2026-01-05";

  test("falls back to default when there is no signal", () => {
    const result = buildHabitSchedule("maintain", [], MON);
    expect(result.appliedHabits).toBe(false);
    expect(result.preferredRestWeekdays).toEqual([2, 5, 6]); // Wed, Sat, Sun
    expect(result.schedule[2].isRestDay).toBe(true);
    expect(result.schedule[5].isRestDay).toBe(true);
    expect(result.schedule[6].isRestDay).toBe(true);
    expect(result.schedule[0].isRestDay).toBe(false);
  });

  test("falls back to default when fewer than 3 completions", () => {
    const result = buildHabitSchedule(
      "build",
      ["2026-01-04", "2026-01-03"],
      MON,
    );
    expect(result.appliedHabits).toBe(false);
  });

  test("uses least-trained weekdays as rest with sufficient signal", () => {
    // Last 14 days before MON 2026-01-05 → 2025-12-22..2026-01-04.
    // Train every day Mon..Fri across both weeks (10 sessions), never Sat/Sun.
    // For maintain (3 rest days), Sat (5) and Sun (6) have count 0 each, then
    // the next-lowest count is the lowest weekday count among Mon-Fri.
    const completed: string[] = [
      // Week of Mon 12/22..Fri 12/26
      "2025-12-22",
      "2025-12-23",
      "2025-12-24",
      "2025-12-25",
      "2025-12-26",
      // Week of Mon 12/29..Fri 1/2
      "2025-12-29",
      "2025-12-30",
      "2025-12-31",
      "2026-01-01",
      "2026-01-02",
    ];
    const result = buildHabitSchedule("maintain", completed, MON);
    expect(result.appliedHabits).toBe(true);
    // Sat (5) and Sun (6) should be rest because they have count 0.
    expect(result.preferredRestWeekdays).toContain(5);
    expect(result.preferredRestWeekdays).toContain(6);
    // Third rest comes from Mon..Fri (all tied at 2). Tie-break = lowest
    // weekday index → Mon (0).
    expect(result.preferredRestWeekdays).toContain(0);
    expect(result.schedule[0].isRestDay).toBe(true);
    expect(result.schedule[5].isRestDay).toBe(true);
    expect(result.schedule[6].isRestDay).toBe(true);
  });

  test("schedule always has 7 entries", () => {
    for (const path of ["maintain", "build", "precision"] as const) {
      const result = buildHabitSchedule(path, [], MON);
      expect(result.schedule).toHaveLength(7);
    }
  });

  test("pinned rest weekdays override default schedule with no signal", () => {
    // Build path defaults to rest only on Sun (6). Pin Sun (6) — already rest,
    // plus Tue (1). Expect both to be rest, even with no habit signal, and
    // Wed default workout returns.
    const result = buildHabitSchedule("build", [], MON, [1, 6]);
    expect(result.appliedHabits).toBe(false);
    expect(result.pinnedRestWeekdays).toEqual([1, 6]);
    expect(result.schedule[1].isRestDay).toBe(true);
    expect(result.schedule[6].isRestDay).toBe(true);
    expect(result.preferredRestWeekdays).toEqual(
      expect.arrayContaining([1, 6]),
    );
  });

  test("pinned rest weekdays override habit-detected rest with signal", () => {
    // Same dataset as the "least-trained" test: Sat/Sun never trained, Mon-Fri
    // tied at 2 each. Pin Wed (2) — auto-detection would NOT have picked Wed.
    const completed: string[] = [
      "2025-12-22",
      "2025-12-23",
      "2025-12-24",
      "2025-12-25",
      "2025-12-26",
      "2025-12-29",
      "2025-12-30",
      "2025-12-31",
      "2026-01-01",
      "2026-01-02",
    ];
    const result = buildHabitSchedule("maintain", completed, MON, [2]);
    expect(result.appliedHabits).toBe(true);
    expect(result.pinnedRestWeekdays).toEqual([2]);
    // Wed (pinned), Sat, Sun must be rest. Mon (auto-pick previously) is now
    // workout because Wed already filled the third slot.
    expect(result.schedule[2].isRestDay).toBe(true);
    expect(result.schedule[5].isRestDay).toBe(true);
    expect(result.schedule[6].isRestDay).toBe(true);
    expect(result.preferredRestWeekdays).toEqual([2, 5, 6]);
  });

  test("pinning more days than default rest count adds extra rest", () => {
    // Build defaults to 1 rest day (Sun). Pin Mon, Tue, Wed → 3 rest days.
    const result = buildHabitSchedule("build", [], MON, [0, 1, 2]);
    expect(result.pinnedRestWeekdays).toEqual([0, 1, 2]);
    expect(result.schedule[0].isRestDay).toBe(true);
    expect(result.schedule[1].isRestDay).toBe(true);
    expect(result.schedule[2].isRestDay).toBe(true);
    // Sun would have been default rest; with no signal and pinned >= default,
    // it stays a workout because we cap at max(default, pinned.size) = 3.
    expect(result.schedule[6].isRestDay).toBe(false);
  });

  test("invalid pinned weekday indices are ignored", () => {
    const result = buildHabitSchedule("maintain", [], MON, [-1, 7, 2.5, 3]);
    expect(result.pinnedRestWeekdays).toEqual([3]);
    expect(result.schedule[3].isRestDay).toBe(true);
  });
});

describe("getControlModeTodaysWorkout (control paths)", () => {
  test("maintain returns rest day on default Wed when no signal", () => {
    // 2026-01-07 is a Wednesday → maintain default rest.
    const r = getControlModeTodaysWorkout(
      "maintain",
      "2026-01-01",
      "2026-01-07",
      {
        rank: "Capable",
        recentCompletions: [],
      },
    );
    expect(r.isRestDay).toBe(true);
  });

  test("build returns workout on Saturday with no signal (only Sunday is rest)", () => {
    // 2026-01-10 is a Saturday.
    const r = getControlModeTodaysWorkout("build", "2026-01-01", "2026-01-10", {
      rank: "Strong",
      recentCompletions: [],
    });
    expect(r.isRestDay).toBe(false);
    expect(r.workout.segments.length).toBeGreaterThan(0);
  });

  test("rebuild keeps Week 2 cycling behavior (no schedule field)", () => {
    const r = getControlModeTodaysWorkout(
      "rebuild",
      "2026-01-01",
      "2026-01-03",
    );
    expect(r.schedule).toBeUndefined();
    expect(r.preferredRestWeekdays).toBeUndefined();
  });

  test("precision returns scaled workout for Elite vs Rookie", () => {
    // 2026-01-05 is Monday → precision elevator session.
    const elite = getControlModeTodaysWorkout(
      "precision",
      "2026-01-01",
      "2026-01-05",
      { rank: "Elite", recentCompletions: [] },
    );
    const rookie = getControlModeTodaysWorkout(
      "precision",
      "2026-01-01",
      "2026-01-05",
      { rank: "Rookie", recentCompletions: [] },
    );
    expect(elite.isRestDay).toBe(false);
    expect(rookie.isRestDay).toBe(false);
    const eliteHold = elite.workout.segments.find(
      (s) => s.type === "elevator",
    )!.squeezeSeconds;
    const rookieHold = rookie.workout.segments.find(
      (s) => s.type === "elevator",
    )!.squeezeSeconds;
    expect(eliteHold).toBeGreaterThan(rookieHold);
  });
});

describe("Weak-area personalization", () => {
  test("detectWeakAreaType returns null with insufficient signal", () => {
    expect(detectWeakAreaType("build", {})).toBeNull();
    expect(detectWeakAreaType("build", { slowHolds: 2 })).toBeNull();
  });

  test("detectWeakAreaType picks the under-trained type for build path", () => {
    // Build covers slowHolds, quickFlicks, elevator, contractRelax (varies).
    // Heavy slowHolds + quickFlicks training, almost no contractRelax.
    const counts = {
      slowHolds: 6,
      quickFlicks: 5,
      contractRelax: 0,
      elevator: 4,
    };
    const result = detectWeakAreaType("build", counts);
    expect(result).toBe("contractRelax");
  });

  test("detectWeakAreaType returns null when training is balanced", () => {
    const counts = {
      slowHolds: 3,
      quickFlicks: 3,
      contractRelax: 3,
      elevator: 3,
    };
    expect(detectWeakAreaType("build", counts)).toBeNull();
  });

  test("pickWorkoutForType returns a template whose primary type matches", () => {
    for (const path of ["maintain", "build", "precision"] as const) {
      for (const make of PATH_LIBRARIES[path]) {
        const primary = getPrimaryExerciseType(make());
        if (!primary) continue;
        const tpl = pickWorkoutForType(path, primary);
        expect(tpl).not.toBeNull();
        expect(getPrimaryExerciseType(tpl!)).toBe(primary);
      }
    }
  });

  test("getControlModeTodaysWorkout swaps today's workout to weak area", () => {
    // 2026-01-05 Monday → build path Monday default = heavy strength
    // (primary slowHolds). With contractRelax under-trained, expect a swap.
    const r = getControlModeTodaysWorkout("build", "2026-01-01", "2026-01-05", {
      rank: "Strong",
      recentCompletions: [],
      recentSegmentTypeCounts: {
        slowHolds: 6,
        quickFlicks: 5,
        contractRelax: 0,
        elevator: 4,
      },
    });
    expect(r.isRestDay).toBe(false);
    expect(r.appliedWeakArea).toBe(true);
    expect(r.weakAreaType).toBe("contractRelax");
    expect(getPrimaryExerciseType(r.workout)).toBe("contractRelax");
  });

  test("getControlModeTodaysWorkout does not swap when balanced", () => {
    const r = getControlModeTodaysWorkout("build", "2026-01-01", "2026-01-05", {
      rank: "Strong",
      recentCompletions: [],
      recentSegmentTypeCounts: {
        slowHolds: 3,
        quickFlicks: 3,
        contractRelax: 3,
        elevator: 3,
      },
    });
    expect(r.appliedWeakArea).toBe(false);
  });

  test("getControlModeTodaysWorkout never swaps a rest day", () => {
    // Maintain default rest on Wed (2). 2026-01-07 Wed.
    const r = getControlModeTodaysWorkout(
      "maintain",
      "2026-01-01",
      "2026-01-07",
      {
        rank: "Strong",
        recentCompletions: [],
        recentSegmentTypeCounts: { slowHolds: 10, quickFlicks: 0 },
      },
    );
    expect(r.isRestDay).toBe(true);
    expect(r.appliedWeakArea).toBe(false);
  });

  test("getExerciseTypesIn returns distinct exercise types in order", () => {
    const tpl = PATH_LIBRARIES.precision[0]();
    const types = getExerciseTypesIn(tpl);
    expect(types.length).toBeGreaterThan(0);
    expect(new Set(types).size).toBe(types.length);
  });
});

describe("getWeekdayLabel", () => {
  test("Mon-first labels", () => {
    expect(getWeekdayLabel(0)).toBe("Mon");
    expect(getWeekdayLabel(6)).toBe("Sun");
  });
});

describe("Weekday-anchored scheduling for non-rebuild paths", () => {
  test("controlModeStartDate is ignored for daily selection (weekday anchors)", () => {
    // Same calendar date (Mon 2026-01-05) requested with two different
    // controlModeStartDates should produce the SAME workout slot, because
    // maintain/build/precision are weekday-anchored.
    const a = getControlModeTodaysWorkout("build", "2025-09-01", "2026-01-05", {
      rank: "Strong",
      recentCompletions: [],
    });
    const b = getControlModeTodaysWorkout("build", "2025-12-30", "2026-01-05", {
      rank: "Strong",
      recentCompletions: [],
    });
    expect(a.dayIndex).toBe(b.dayIndex);
    expect(a.workout.name).toBe(b.workout.name);
    expect(a.isRestDay).toBe(b.isRestDay);
  });

  test("dayIndex matches Mon-first weekday of the requested date", () => {
    // 2026-01-05 is a Monday → weekday index 0
    const monday = getControlModeTodaysWorkout(
      "maintain",
      "2026-01-01",
      "2026-01-05",
      { recentCompletions: [] },
    );
    expect(monday.dayIndex).toBe(0);

    // 2026-01-11 is a Sunday → weekday index 6
    const sunday = getControlModeTodaysWorkout(
      "maintain",
      "2026-01-01",
      "2026-01-11",
      { recentCompletions: [] },
    );
    expect(sunday.dayIndex).toBe(6);
  });
});
