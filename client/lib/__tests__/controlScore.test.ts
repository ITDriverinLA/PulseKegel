import {
  RANKS,
  addDays,
  calculateDecayForIdleDay,
  calculateSessionGain,
  clampScore,
  getCompletedDaysInLast7,
  getNextRank,
  getPointsToNextRank,
  getRankBandProgress,
  getRankForScore,
  getTrend,
} from "../controlScore";

describe("clampScore", () => {
  it("floors negatives at 0", () => {
    expect(clampScore(-50)).toBe(0);
  });
  it("caps at 1000", () => {
    expect(clampScore(2000)).toBe(1000);
  });
  it("rounds floats", () => {
    expect(clampScore(42.7)).toBe(43);
  });
  it("treats NaN as 0", () => {
    expect(clampScore(Number.NaN)).toBe(0);
  });
});

describe("addDays", () => {
  it("moves forward across month boundary", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
  });
  it("moves backward across month boundary", () => {
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("getRankForScore - all 9 rank boundary transitions", () => {
  const cases: [number, string][] = [
    [0, "Rookie"],
    [24, "Rookie"],
    [25, "Novice"],
    [79, "Novice"],
    [80, "Apprentice"],
    [169, "Apprentice"],
    [170, "Journeyman"],
    [289, "Journeyman"],
    [290, "Capable"],
    [429, "Capable"],
    [430, "Controlled"],
    [579, "Controlled"],
    [580, "Strong"],
    [709, "Strong"],
    [710, "Advanced"],
    [849, "Advanced"],
    [850, "Elite"],
    [1000, "Elite"],
  ];
  it.each(cases)("score %i -> %s", (score, rank) => {
    expect(getRankForScore(score)).toBe(rank);
  });
});

describe("getNextRank / getPointsToNextRank", () => {
  it("Elite has no next rank", () => {
    expect(getNextRank("Elite")).toBeNull();
  });
  it("Rookie -> Novice", () => {
    expect(getNextRank("Rookie")?.name).toBe("Novice");
  });
  it("points from 0 to next rank = 25", () => {
    expect(getPointsToNextRank(0)).toBe(25);
  });
  it("points from 24 to next rank = 1", () => {
    expect(getPointsToNextRank(24)).toBe(1);
  });
  it("points to next at Elite = 0", () => {
    expect(getPointsToNextRank(900)).toBe(0);
  });
});

describe("getRankBandProgress", () => {
  it("returns 1 at the Elite (terminal) rank", () => {
    expect(getRankBandProgress(900)).toBe(1);
  });
  it("returns 0 at the bottom of a band", () => {
    expect(getRankBandProgress(0)).toBe(0);
  });
  it("returns ~0.5 at the middle of a band", () => {
    const p = getRankBandProgress(12);
    expect(p).toBeGreaterThan(0.4);
    expect(p).toBeLessThan(0.6);
  });
  it("returns ~1 just before the next rank threshold", () => {
    expect(getRankBandProgress(24)).toBeCloseTo(24 / 25, 5);
  });
});

describe("calculateDecayForIdleDay - tier transitions at days 3 and 8", () => {
  it("days 1 and 2 are grace (0)", () => {
    expect(calculateDecayForIdleDay(1)).toBe(0);
    expect(calculateDecayForIdleDay(2)).toBe(0);
  });
  it("day 3 is the first decay tier (-3)", () => {
    expect(calculateDecayForIdleDay(3)).toBe(3);
  });
  it("day 7 is still in the first decay tier (-3)", () => {
    expect(calculateDecayForIdleDay(7)).toBe(3);
  });
  it("day 8 jumps to the second decay tier (-5)", () => {
    expect(calculateDecayForIdleDay(8)).toBe(5);
  });
  it("very long idle stays at the second decay tier (-5)", () => {
    expect(calculateDecayForIdleDay(30)).toBe(5);
  });
});

describe("calculateSessionGain - streak and rolling thresholds", () => {
  it("base gain with no bonuses = 2", () => {
    expect(calculateSessionGain(0, 0)).toBe(2);
    expect(calculateSessionGain(1, 1)).toBe(2);
  });
  it("crossing streak 3 adds +1 (=3)", () => {
    expect(calculateSessionGain(2, 1)).toBe(2);
    expect(calculateSessionGain(3, 1)).toBe(3);
  });
  it("crossing streak 7 adds another +1 (=4)", () => {
    expect(calculateSessionGain(6, 1)).toBe(3);
    expect(calculateSessionGain(7, 1)).toBe(4);
  });
  it("crossing rolling 5/7 adds +3", () => {
    expect(calculateSessionGain(1, 4)).toBe(2);
    expect(calculateSessionGain(1, 5)).toBe(5);
    expect(calculateSessionGain(1, 6)).toBe(5);
  });
  it("crossing rolling 7/7 adds another +3 but is capped at 7", () => {
    expect(calculateSessionGain(1, 7)).toBe(7);
  });
  it("total gain is capped at 7 even when all bonuses stack", () => {
    expect(calculateSessionGain(7, 7)).toBe(7);
    expect(calculateSessionGain(30, 7)).toBe(7);
  });
});

describe("getCompletedDaysInLast7", () => {
  it("counts dates within the 7-day inclusive window", () => {
    const set = new Set<string>([
      "2026-05-03",
      "2026-05-02",
      "2026-05-01",
      "2026-04-29",
      "2026-04-28",
      "2026-04-27",
    ]);
    expect(getCompletedDaysInLast7(set, "2026-05-03")).toBe(6);
  });
  it("ignores dates outside the window", () => {
    expect(getCompletedDaysInLast7(new Set(["2026-04-25"]), "2026-05-03")).toBe(
      0,
    );
  });
  it("returns 0 for an empty set", () => {
    expect(getCompletedDaysInLast7(new Set(), "2026-05-03")).toBe(0);
  });
});

describe("getTrend", () => {
  it("returns 'gaining' when score moved up by >= 2", () => {
    expect(
      getTrend(
        [
          { date: "2026-04-29", score: 100 },
          { date: "2026-04-30", score: 102 },
        ],
        110,
        "2026-05-03",
      ),
    ).toBe("gaining");
  });
  it("returns 'slipping' when score dropped by >= 2", () => {
    expect(
      getTrend([{ date: "2026-04-29", score: 100 }], 95, "2026-05-03"),
    ).toBe("slipping");
  });
  it("returns 'holding' for movement within +/- 1", () => {
    expect(
      getTrend([{ date: "2026-04-29", score: 100 }], 101, "2026-05-03"),
    ).toBe("holding");
    expect(
      getTrend([{ date: "2026-04-29", score: 100 }], 99, "2026-05-03"),
    ).toBe("holding");
  });
  it("returns 'holding' on empty history", () => {
    expect(getTrend([], 50, "2026-05-03")).toBe("holding");
  });
  it("falls back to oldest entry when no entry is >= 3 days old", () => {
    // history only contains a recent point (1 day ago) - baseline falls back to history[0]
    expect(
      getTrend([{ date: "2026-05-02", score: 50 }], 60, "2026-05-03"),
    ).toBe("gaining");
  });
});

describe("RANKS table integrity", () => {
  it("has exactly 9 ranks", () => {
    expect(RANKS).toHaveLength(9);
  });
  it("starts at Rookie and ends at Elite", () => {
    expect(RANKS[0].name).toBe("Rookie");
    expect(RANKS[RANKS.length - 1].name).toBe("Elite");
  });
  it("rank bands are contiguous (each band's max + 1 == next band's min)", () => {
    for (let i = 0; i < RANKS.length - 1; i++) {
      expect(RANKS[i].max + 1).toBe(RANKS[i + 1].min);
    }
  });
});

describe("decay simulation - integration of calculateDecayForIdleDay over time", () => {
  function simulateDecay(
    startScore: number,
    lastUpdateDate: string,
    today: string,
    sessionDates: string[],
  ): { score: number; idleDays: number } {
    const completedSet = new Set(sessionDates);
    const yesterday = addDays(today, -1);
    let cursor = lastUpdateDate;
    let score = startScore;
    let idleDays = 0;
    while (cursor < yesterday) {
      cursor = addDays(cursor, 1);
      if (completedSet.has(cursor)) {
        idleDays = 0;
      } else {
        idleDays += 1;
        score = clampScore(score - calculateDecayForIdleDay(idleDays));
      }
    }
    if (completedSet.has(today)) idleDays = 0;
    return { score, idleDays };
  }

  it("one missed day stays in grace (no decay)", () => {
    expect(
      simulateDecay(100, "2026-05-01", "2026-05-03", ["2026-05-01"]),
    ).toEqual({ score: 100, idleDays: 1 });
  });
  it("two elapsed missed days still in grace", () => {
    expect(
      simulateDecay(100, "2026-05-01", "2026-05-04", ["2026-05-01"]),
    ).toEqual({ score: 100, idleDays: 2 });
  });
  it("first decay hit is exactly -3 on day 3", () => {
    expect(
      simulateDecay(100, "2026-05-01", "2026-05-05", ["2026-05-01"]),
    ).toEqual({ score: 97, idleDays: 3 });
  });
  it("seven elapsed missed days = 5 decay days at -3 each = -15", () => {
    expect(
      simulateDecay(100, "2026-05-01", "2026-05-09", ["2026-05-01"]),
    ).toEqual({ score: 85, idleDays: 7 });
  });
  it("eight elapsed missed days = -15 (days 3-7) + -5 (day 8) = -20", () => {
    expect(
      simulateDecay(100, "2026-05-01", "2026-05-10", ["2026-05-01"]),
    ).toEqual({ score: 80, idleDays: 8 });
  });
  it("completing today resets idleDays to 0 even after a gap", () => {
    expect(
      simulateDecay(100, "2026-05-01", "2026-05-05", [
        "2026-05-01",
        "2026-05-05",
      ]),
    ).toEqual({ score: 97, idleDays: 0 });
  });
});
