export type RankName =
  | "Rookie"
  | "Novice"
  | "Apprentice"
  | "Journeyman"
  | "Capable"
  | "Controlled"
  | "Strong"
  | "Advanced"
  | "Elite";

export interface RankBand {
  name: RankName;
  min: number;
  max: number;
}

export const RANKS: RankBand[] = [
  { name: "Rookie", min: 0, max: 24 },
  { name: "Novice", min: 25, max: 79 },
  { name: "Apprentice", min: 80, max: 169 },
  { name: "Journeyman", min: 170, max: 289 },
  { name: "Capable", min: 290, max: 429 },
  { name: "Controlled", min: 430, max: 579 },
  { name: "Strong", min: 580, max: 709 },
  { name: "Advanced", min: 710, max: 849 },
  { name: "Elite", min: 850, max: 1000 },
];

export const RANK_TIER_INDEX: Record<RankName, number> = RANKS.reduce(
  (acc, r, i) => {
    acc[r.name] = i;
    return acc;
  },
  {} as Record<RankName, number>,
);

export const RANK_UP_MESSAGES: Record<
  RankName,
  { title: string; body: string }
> = {
  Rookie: {
    title: "Rank up: Rookie",
    body: "Welcome to the journey. Every session counts.",
  },
  Novice: {
    title: "Rank up: Novice",
    body: "You're building control. Keep going.",
  },
  Apprentice: {
    title: "Rank up: Apprentice",
    body: "The fundamentals are clicking. Stay consistent.",
  },
  Journeyman: {
    title: "Rank up: Journeyman",
    body: "This is becoming a real habit.",
  },
  Capable: {
    title: "Rank up: Capable",
    body: "You can feel the difference. Keep training.",
  },
  Controlled: {
    title: "Rank up: Controlled",
    body: "You're not just squeezing. You're training control.",
  },
  Strong: {
    title: "Rank up: Strong",
    body: "Real strength is showing up. Don't ease off now.",
  },
  Advanced: {
    title: "Rank up: Advanced",
    body: "Few people make it this far. You're one of them.",
  },
  Elite: {
    title: "Elite unlocked.",
    body: "Six months of consistency changes the game.",
  },
};

export function clampScore(score: number): number {
  if (Number.isNaN(score)) return 0;
  return Math.max(0, Math.min(1000, Math.round(score)));
}

export function getRankForScore(score: number): RankName {
  const s = clampScore(score);
  for (let i = RANKS.length - 1; i >= 0; i--) {
    if (s >= RANKS[i].min) return RANKS[i].name;
  }
  return "Rookie";
}

export function getRankBand(rank: RankName): RankBand {
  return RANKS[RANK_TIER_INDEX[rank]];
}

export function getNextRank(rank: RankName): RankBand | null {
  const idx = RANK_TIER_INDEX[rank];
  if (idx >= RANKS.length - 1) return null;
  return RANKS[idx + 1];
}

export function getPointsToNextRank(score: number): number {
  const rank = getRankForScore(score);
  const next = getNextRank(rank);
  if (!next) return 0;
  return Math.max(0, next.min - clampScore(score));
}

export function getRankBandProgress(score: number): number {
  const rank = getRankForScore(score);
  const band = getRankBand(rank);
  const next = getNextRank(rank);
  if (!next) return 1;
  const span = next.min - band.min;
  if (span <= 0) return 1;
  const pos = clampScore(score) - band.min;
  return Math.max(0, Math.min(1, pos / span));
}

export function getCompletedDaysInLast7(
  uniqueSessionDates: Set<string>,
  today: string,
): number {
  let count = 0;
  for (let i = 0; i < 7; i++) {
    const d = addDays(today, -i);
    if (uniqueSessionDates.has(d)) count++;
  }
  return count;
}

export function calculateSessionGain(
  currentStreak: number,
  rolling7Count: number,
): number {
  let gain = 2;
  if (currentStreak >= 3) gain += 1;
  if (currentStreak >= 7) gain += 1;
  if (rolling7Count >= 5) gain += 3;
  if (rolling7Count >= 7) gain += 3;
  return Math.min(gain, 7);
}

export function estimateSessionsToNextRank(
  score: number,
  currentStreak: number,
): number | null {
  const rank = getRankForScore(score);
  const next = getNextRank(rank);
  if (!next) return null;
  const pointsNeeded = Math.max(0, next.min - clampScore(score));
  if (pointsNeeded === 0) return 0;
  const projectedStreak = Math.max(currentStreak, 0) + 1;
  const perSession = calculateSessionGain(projectedStreak, projectedStreak);
  return Math.max(1, Math.ceil(pointsNeeded / perSession));
}

export function calculateDecayForIdleDay(idleDays: number): number {
  if (idleDays <= 2) return 0;
  if (idleDays <= 7) return 3;
  return 5;
}

/**
 * Returns the number of calendar days from Date `a` to Date `b`, using local
 * date components (year/month/day) so that DST transitions — where two local
 * midnights are only 23 h apart — never cause an off-by-one error.
 *
 * Usage: dstSafeDaysBetween(start, target)  →  target_day − start_day in days
 */
export function dstSafeDaysBetween(a: Date, b: Date): number {
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((utcB - utcA) / 86400000);
}

export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function compareDates(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function todayDateString(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export type Trend = "gaining" | "holding" | "slipping";

export function getTrend(
  history: { date: string; score: number }[],
  currentScore: number,
  today: string,
): Trend {
  if (history.length === 0) return "holding";
  const target = addDays(today, -3);
  let baseline: number | null = null;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].date <= target) {
      baseline = history[i].score;
      break;
    }
  }
  if (baseline === null) baseline = history[0].score;
  const delta = currentScore - baseline;
  if (delta >= 2) return "gaining";
  if (delta <= -2) return "slipping";
  return "holding";
}
