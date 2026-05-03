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

let passed = 0;
let failed = 0;
const results: string[] = [];

function expect(label: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    passed++;
    results.push(`PASS  ${label}`);
  } else {
    failed++;
    results.push(
      `FAIL  ${label}\n      expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

expect("clampScore floors at 0", clampScore(-50), 0);
expect("clampScore caps at 1000", clampScore(2000), 1000);
expect("clampScore rounds", clampScore(42.7), 43);
expect("clampScore handles NaN", clampScore(Number.NaN), 0);

expect("addDays forward", addDays("2026-01-31", 1), "2026-02-01");
expect("addDays backward", addDays("2026-03-01", -1), "2026-02-28");

expect("rank for 0 = Rookie", getRankForScore(0), "Rookie");
expect("rank for 24 = Rookie", getRankForScore(24), "Rookie");
expect("rank for 25 = Novice", getRankForScore(25), "Novice");
expect("rank for 169 = Apprentice", getRankForScore(169), "Apprentice");
expect("rank for 170 = Journeyman", getRankForScore(170), "Journeyman");
expect("rank for 849 = Advanced", getRankForScore(849), "Advanced");
expect("rank for 850 = Elite", getRankForScore(850), "Elite");
expect("rank for 1000 = Elite", getRankForScore(1000), "Elite");

expect("nextRank Elite is null", getNextRank("Elite"), null);
expect(
  "nextRank Rookie is Novice",
  getNextRank("Rookie")?.name ?? null,
  "Novice",
);

expect("pointsToNext from 0 = 25", getPointsToNextRank(0), 25);
expect("pointsToNext from 24 = 1", getPointsToNextRank(24), 1);
expect("pointsToNext at Elite = 0", getPointsToNextRank(900), 0);

expect("bandProgress at Elite = 1", getRankBandProgress(900), 1);
expect("bandProgress at Rookie min = 0", getRankBandProgress(0), 0);

expect("decay days 1 = 0", calculateDecayForIdleDay(1), 0);
expect("decay days 2 = 0", calculateDecayForIdleDay(2), 0);
expect("decay days 3 = 3", calculateDecayForIdleDay(3), 3);
expect("decay days 7 = 3", calculateDecayForIdleDay(7), 3);
expect("decay days 8 = 5", calculateDecayForIdleDay(8), 5);
expect("decay days 30 = 5", calculateDecayForIdleDay(30), 5);

expect("gain base = 2", calculateSessionGain(1, 1), 2);
expect("gain at streak 3 = 3", calculateSessionGain(3, 1), 3);
expect("gain at streak 7 = 4", calculateSessionGain(7, 1), 4);
expect("gain rolling 5 of 7 = 5+2 (2+3)", calculateSessionGain(1, 5), 5);
expect("gain rolling 6 still 5/7 bonus", calculateSessionGain(1, 6), 5);
expect(
  "gain at 7 streak + 7 rolling capped at 7",
  calculateSessionGain(7, 7),
  7,
);
expect(
  "gain at 30 streak + 7 rolling capped at 7",
  calculateSessionGain(30, 7),
  7,
);

const set = new Set<string>([
  "2026-05-03",
  "2026-05-02",
  "2026-05-01",
  "2026-04-29",
  "2026-04-28",
  "2026-04-27",
]);
expect(
  "rolling7 counts last-7-day window inclusive",
  getCompletedDaysInLast7(set, "2026-05-03"),
  6,
);
expect(
  "rolling7 ignores out-of-window dates",
  getCompletedDaysInLast7(new Set(["2026-04-25"]), "2026-05-03"),
  0,
);

expect(
  "trend gaining when score moved up >= 2",
  getTrend(
    [
      { date: "2026-04-29", score: 100 },
      { date: "2026-04-30", score: 102 },
    ],
    110,
    "2026-05-03",
  ),
  "gaining",
);
expect(
  "trend slipping when score dropped >= 2",
  getTrend([{ date: "2026-04-29", score: 100 }], 95, "2026-05-03"),
  "slipping",
);
expect(
  "trend holding within +/- 1",
  getTrend([{ date: "2026-04-29", score: 100 }], 101, "2026-05-03"),
  "holding",
);
expect("trend with empty history", getTrend([], 50, "2026-05-03"), "holding");

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

expect(
  "decay scenario: open day after one missed day = no decay",
  simulateDecay(100, "2026-05-01", "2026-05-03", ["2026-05-01"]),
  { score: 100, idleDays: 1 },
);
expect(
  "decay scenario: open day 4 (last on day 1) -> only days 2,3 elapsed, both grace",
  simulateDecay(100, "2026-05-01", "2026-05-04", ["2026-05-01"]),
  { score: 100, idleDays: 2 },
);
expect(
  "decay scenario: open day 5 after skipping 3 days = -3 (day 3 only)",
  simulateDecay(100, "2026-05-01", "2026-05-05", ["2026-05-01"]),
  { score: 97, idleDays: 3 },
);
expect(
  "decay scenario: open day 9 after 7 elapsed missed days = -3*5 = -15",
  simulateDecay(100, "2026-05-01", "2026-05-09", ["2026-05-01"]),
  { score: 85, idleDays: 7 },
);
expect(
  "decay scenario: open day 10 after 8 elapsed missed days = -3*5 + -5 = -20",
  simulateDecay(100, "2026-05-01", "2026-05-10", ["2026-05-01"]),
  { score: 80, idleDays: 8 },
);
expect(
  "decay scenario: today is tomorrow of last update with session yesterday -> no decay",
  simulateDecay(100, "2026-05-02", "2026-05-03", ["2026-05-02"]),
  { score: 100, idleDays: 0 },
);
expect(
  "decay scenario: completing today resets idleDays even if past gap",
  simulateDecay(100, "2026-05-01", "2026-05-05", ["2026-05-01", "2026-05-05"]),
  { score: 97, idleDays: 0 },
);
expect(
  "decay scenario: same-day reopen is a no-op",
  simulateDecay(100, "2026-05-03", "2026-05-03", []),
  { score: 100, idleDays: 0 },
);
expect(
  "decay scenario: gap of 2 days -> still grace period",
  simulateDecay(100, "2026-05-01", "2026-05-03", []),
  { score: 100, idleDays: 1 },
);

expect("RANKS has 9 ranks", RANKS.length, 9);
expect("RANKS first is Rookie", RANKS[0].name, "Rookie");
expect("RANKS last is Elite", RANKS[RANKS.length - 1].name, "Elite");

console.log(results.join("\n"));
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
