import {
  DayTemplate,
  Segment,
  SegmentType,
} from "./workoutProgram";
import type { RankName } from "@/lib/controlScore";

export type ControlPath = "maintain" | "build" | "precision";

export type RankTier = "foundation" | "building" | "strong" | "peak";

export const RANK_TO_TIER: Record<RankName, RankTier> = {
  Rookie: "foundation",
  Novice: "foundation",
  Apprentice: "building",
  Journeyman: "building",
  Capable: "building",
  Controlled: "strong",
  Strong: "strong",
  Advanced: "peak",
  Elite: "peak",
};

export interface RankScaling {
  reps: number;
  hold: number;
}

export const RANK_TIER_SCALING: Record<RankTier, RankScaling> = {
  foundation: { reps: 0.85, hold: 0.85 },
  building: { reps: 1.0, hold: 1.0 },
  strong: { reps: 1.15, hold: 1.15 },
  peak: { reps: 1.3, hold: 1.3 },
};

const seg = (
  id: string,
  name: string,
  instructions: string,
  sets: number,
  repsPerSet: number,
  squeezeSeconds: number,
  restSeconds: number,
  type: SegmentType,
  rampSteps?: number[],
): Segment => ({
  id,
  name,
  instructions,
  sets,
  repsPerSet,
  squeezeSeconds,
  restSeconds,
  type,
  rampSteps,
});

const getReady = (id: string): Segment =>
  seg(id, "Get Ready", "Prepare yourself for the workout", 1, 1, 0, 5, "getReady");

const blockRest = (id: string, secs: number = 20): Segment =>
  seg(
    id,
    "Block Rest",
    "Breathe deeply and fully relax",
    1,
    1,
    0,
    secs,
    "blockRest",
  );

const coolDown = (id: string, secs: number = 25): Segment =>
  seg(id, "Cool Down", "Relax and breathe deeply", 1, 1, 0, secs, "breathing");

const restDay = (id: string): DayTemplate => ({
  id,
  name: "Rest Day",
  dayType: "rest",
  segments: [],
  estimatedMinutes: 0,
  isRestDay: true,
});

const estimateMinutes = (segments: Segment[]): number => {
  const total = segments.reduce((sum, s) => {
    return sum + s.sets * s.repsPerSet * (s.squeezeSeconds + s.restSeconds);
  }, 0);
  return Math.max(1, Math.ceil(total / 60));
};

const day = (
  id: string,
  name: string,
  dayType: DayTemplate["dayType"],
  segments: Segment[],
): DayTemplate => ({
  id,
  name,
  dayType,
  segments,
  estimatedMinutes: estimateMinutes(segments),
});

// ----------------------------------------------------------------------------
// MAINTAIN CONTROL — 4 sessions / week, balanced strength + coordination.
// Default rest days: Wed (2), Sat (5), Sun (6) — Mon-first.
// ----------------------------------------------------------------------------

const maintainStrength = (): DayTemplate =>
  day("cm-maintain-strength", "Steady Strength", "strength", [
    getReady("cm-m-str-gr"),
    seg(
      "cm-m-str-slow",
      "Slow Holds",
      "Squeeze and hold, then fully release",
      3,
      8,
      6,
      6,
      "slowHolds",
    ),
    blockRest("cm-m-str-r1"),
    seg(
      "cm-m-str-flicks",
      "Quick Flicks",
      "Quick squeeze and release rhythm",
      1,
      18,
      1,
      1,
      "quickFlicks",
    ),
    blockRest("cm-m-str-r2"),
    seg(
      "cm-m-str-reverse",
      "Reverse Kegels",
      "Gently release tension downward",
      1,
      6,
      4,
      4,
      "reverse",
    ),
    coolDown("cm-m-str-cd"),
  ]);

const maintainCoordination = (): DayTemplate =>
  day("cm-maintain-coord", "Coordination Tune-Up", "coordination", [
    getReady("cm-m-coo-gr"),
    seg(
      "cm-m-coo-elev",
      "Elevator",
      "Step up tension: 25% to 50% to 75% to 100%",
      2,
      6,
      7,
      7,
      "elevator",
      [0.25, 0.5, 0.75, 1.0],
    ),
    blockRest("cm-m-coo-r1"),
    seg(
      "cm-m-coo-rev",
      "Reverse Kegels",
      "Drop tension and breathe",
      1,
      6,
      5,
      5,
      "reverse",
    ),
    blockRest("cm-m-coo-r2"),
    seg(
      "cm-m-coo-final",
      "Final Hold",
      "One strong hold to finish",
      1,
      1,
      12,
      5,
      "slowHolds",
    ),
    coolDown("cm-m-coo-cd"),
  ]);

const maintainSpeed = (): DayTemplate =>
  day("cm-maintain-speed", "Speed Refresh", "speed", [
    getReady("cm-m-spd-gr"),
    seg(
      "cm-m-spd-flicks",
      "Quick Flicks",
      "Sharp squeeze, full release",
      3,
      22,
      1,
      1,
      "quickFlicks",
    ),
    blockRest("cm-m-spd-r1"),
    seg(
      "cm-m-spd-cr",
      "Contract-Relax",
      "Short squeeze with longer relaxation",
      1,
      10,
      2,
      4,
      "contractRelax",
    ),
    coolDown("cm-m-spd-cd"),
  ]);

// ----------------------------------------------------------------------------
// BUILD STRENGTH — 6 sessions / week, push toward Elite.
// Default rest day: Sun (6). Mon-first.
// ----------------------------------------------------------------------------

const buildHeavyStrength = (variant: "a" | "b"): DayTemplate =>
  day(`cm-build-heavy-${variant}`, "Heavy Strength", "strength", [
    getReady(`cm-b-hs-${variant}-gr`),
    seg(
      `cm-b-hs-${variant}-slow`,
      "Heavy Slow Holds",
      "Maximum effort hold, then fully release",
      4,
      8,
      9,
      6,
      "slowHolds",
    ),
    blockRest(`cm-b-hs-${variant}-r1`, 25),
    seg(
      `cm-b-hs-${variant}-cr`,
      "Contract-Relax",
      "Short power squeeze, full release",
      2,
      10,
      3,
      4,
      "contractRelax",
    ),
    blockRest(`cm-b-hs-${variant}-r2`),
    seg(
      `cm-b-hs-${variant}-rev`,
      "Reverse Kegels",
      "Drop tension to recover",
      1,
      8,
      5,
      4,
      "reverse",
    ),
    coolDown(`cm-b-hs-${variant}-cd`),
  ]);

const buildContractRelax = (): DayTemplate =>
  day("cm-build-cr", "Power Pulses", "speed", [
    getReady("cm-b-cr-gr"),
    seg(
      "cm-b-cr-warm",
      "Warm Up",
      "Light pulses",
      1,
      8,
      2,
      2,
      "quickFlicks",
    ),
    blockRest("cm-b-cr-r1", 15),
    seg(
      "cm-b-cr-main",
      "Contract-Relax",
      "Hard pulse, complete release",
      3,
      12,
      2,
      4,
      "contractRelax",
    ),
    blockRest("cm-b-cr-r2"),
    seg(
      "cm-b-cr-flicks",
      "Quick Flicks",
      "Stay sharp",
      1,
      25,
      1,
      1,
      "quickFlicks",
    ),
    coolDown("cm-b-cr-cd"),
  ]);

const buildCoordination = (): DayTemplate =>
  day("cm-build-coord", "Power Coordination", "coordination", [
    getReady("cm-b-coo-gr"),
    seg(
      "cm-b-coo-elev",
      "Elevator",
      "Hold each step with full control",
      3,
      6,
      9,
      6,
      "elevator",
      [0.25, 0.5, 0.75, 1.0],
    ),
    blockRest("cm-b-coo-r1"),
    seg(
      "cm-b-coo-rev",
      "Reverse Kegels",
      "Recover before final push",
      2,
      5,
      5,
      5,
      "reverse",
    ),
    blockRest("cm-b-coo-r2"),
    seg(
      "cm-b-coo-final",
      "Peak Hold",
      "One maximum hold",
      1,
      1,
      18,
      5,
      "slowHolds",
    ),
    coolDown("cm-b-coo-cd"),
  ]);

const buildSpeed = (): DayTemplate =>
  day("cm-build-speed", "Speed Power", "speed", [
    getReady("cm-b-spd-gr"),
    seg(
      "cm-b-spd-flicks",
      "Quick Flicks",
      "Maximum tempo",
      4,
      30,
      1,
      1,
      "quickFlicks",
    ),
    blockRest("cm-b-spd-r1"),
    seg(
      "cm-b-spd-cr",
      "Contract-Relax",
      "Short squeeze with full release",
      2,
      14,
      2,
      4,
      "contractRelax",
    ),
    blockRest("cm-b-spd-r2"),
    seg(
      "cm-b-spd-slow",
      "Slow Holds",
      "Anchor with control",
      1,
      8,
      6,
      5,
      "slowHolds",
    ),
    coolDown("cm-b-spd-cd"),
  ]);

const buildEndurance = (): DayTemplate =>
  day("cm-build-endurance", "Endurance Push", "strength", [
    getReady("cm-b-end-gr"),
    seg(
      "cm-b-end-warm",
      "Warm Up",
      "Build up gently",
      1,
      6,
      4,
      3,
      "slowHolds",
    ),
    blockRest("cm-b-end-r1", 15),
    seg(
      "cm-b-end-long",
      "Long Holds",
      "Hold steady for endurance",
      3,
      4,
      14,
      12,
      "slowHolds",
    ),
    blockRest("cm-b-end-r2", 25),
    seg(
      "cm-b-end-sustain",
      "Sustained Squeeze",
      "Maintain steady pressure",
      2,
      3,
      16,
      12,
      "slowHolds",
    ),
    coolDown("cm-b-end-cd"),
  ]);

// ----------------------------------------------------------------------------
// PRECISION TRAINING — 5 sessions / week, elevator + reverse + speed control.
// Default rest days: Sat (5), Sun (6). Mon-first.
// ----------------------------------------------------------------------------

const precisionElevator = (): DayTemplate =>
  day("cm-precision-elevator", "Elevator Focus", "coordination", [
    getReady("cm-p-elv-gr"),
    seg(
      "cm-p-elv-warm",
      "Warm Up",
      "Light pulses to wake the muscle",
      1,
      6,
      2,
      2,
      "quickFlicks",
    ),
    blockRest("cm-p-elv-r1", 15),
    seg(
      "cm-p-elv-main",
      "Elevator",
      "25% to 50% to 75% to 100%, then step down",
      3,
      6,
      8,
      8,
      "elevator",
      [0.25, 0.5, 0.75, 1.0],
    ),
    blockRest("cm-p-elv-r2"),
    seg(
      "cm-p-elv-rev",
      "Reverse Kegels",
      "Release the floor downward",
      1,
      6,
      5,
      5,
      "reverse",
    ),
    coolDown("cm-p-elv-cd"),
  ]);

const precisionFlicks = (): DayTemplate =>
  day("cm-precision-flicks", "Quick Flick Precision", "speed", [
    getReady("cm-p-flk-gr"),
    seg(
      "cm-p-flk-main",
      "Quick Flicks",
      "Sharp on, sharp off",
      4,
      20,
      1,
      1,
      "quickFlicks",
    ),
    blockRest("cm-p-flk-r1"),
    seg(
      "cm-p-flk-cr",
      "Contract-Relax",
      "Crisp pulse, complete release",
      2,
      10,
      2,
      4,
      "contractRelax",
    ),
    coolDown("cm-p-flk-cd"),
  ]);

const precisionReverse = (): DayTemplate =>
  day("cm-precision-reverse", "Release Practice", "coordination", [
    getReady("cm-p-rev-gr"),
    seg(
      "cm-p-rev-aware",
      "Awareness",
      "Notice your resting tension",
      1,
      4,
      4,
      4,
      "slowHolds",
    ),
    blockRest("cm-p-rev-r1", 15),
    seg(
      "cm-p-rev-main",
      "Reverse Kegels",
      "Drop tension intentionally",
      3,
      8,
      6,
      6,
      "reverse",
    ),
    blockRest("cm-p-rev-r2"),
    seg(
      "cm-p-rev-elev",
      "Mini Elevator",
      "Two step elevator: 50% then 100%",
      2,
      5,
      6,
      5,
      "elevator",
      [0.5, 1.0],
    ),
    coolDown("cm-p-rev-cd"),
  ]);

const precisionCoord = (): DayTemplate =>
  day("cm-precision-coord", "Coordination Combo", "coordination", [
    getReady("cm-p-coo-gr"),
    seg(
      "cm-p-coo-elev",
      "Elevator",
      "Smooth transitions between levels",
      2,
      5,
      8,
      7,
      "elevator",
      [0.25, 0.5, 0.75, 1.0],
    ),
    blockRest("cm-p-coo-r1"),
    seg(
      "cm-p-coo-flicks",
      "Quick Flicks",
      "Crisp pulses for contrast",
      1,
      20,
      1,
      1,
      "quickFlicks",
    ),
    blockRest("cm-p-coo-r2"),
    seg(
      "cm-p-coo-rev",
      "Reverse Kegels",
      "Release between bursts",
      1,
      6,
      5,
      5,
      "reverse",
    ),
    coolDown("cm-p-coo-cd"),
  ]);

const precisionMixed = (): DayTemplate =>
  day("cm-precision-mixed", "Precision Mix", "alternate", [
    getReady("cm-p-mix-gr"),
    seg(
      "cm-p-mix-slow",
      "Slow Holds",
      "Anchor with control",
      2,
      6,
      7,
      6,
      "slowHolds",
    ),
    blockRest("cm-p-mix-r1"),
    seg(
      "cm-p-mix-elev",
      "Elevator",
      "Stepwise control",
      1,
      5,
      7,
      6,
      "elevator",
      [0.25, 0.5, 0.75, 1.0],
    ),
    blockRest("cm-p-mix-r2"),
    seg(
      "cm-p-mix-flicks",
      "Quick Flicks",
      "Sharp finish",
      1,
      18,
      1,
      1,
      "quickFlicks",
    ),
    coolDown("cm-p-mix-cd"),
  ]);

// ----------------------------------------------------------------------------
// Default 7-day schedules (Mon-first index 0..6).
// `null` = rest day.
// ----------------------------------------------------------------------------

export type DefaultSlot = (() => DayTemplate) | null;

export const DEFAULT_SCHEDULES: Record<ControlPath, DefaultSlot[]> = {
  // Mon Tue Wed Thu Fri Sat Sun  → 4 workouts, 3 rest
  maintain: [
    maintainStrength,
    maintainCoordination,
    null,
    maintainStrength,
    maintainSpeed,
    null,
    null,
  ],
  // Mon Tue Wed Thu Fri Sat Sun → 6 workouts, 1 rest
  build: [
    () => buildHeavyStrength("a"),
    buildContractRelax,
    buildCoordination,
    () => buildHeavyStrength("b"),
    buildSpeed,
    buildEndurance,
    null,
  ],
  // Mon Tue Wed Thu Fri Sat Sun → 5 workouts, 2 rest
  precision: [
    precisionElevator,
    precisionFlicks,
    precisionReverse,
    precisionCoord,
    precisionMixed,
    null,
    null,
  ],
};

// ----------------------------------------------------------------------------
// Rank-based intensity scaling.
// Scales `repsPerSet` and `squeezeSeconds` for non-rest exercise segments.
// ----------------------------------------------------------------------------

const SCALEABLE_TYPES: SegmentType[] = [
  "slowHolds",
  "quickFlicks",
  "elevator",
  "reverse",
  "contractRelax",
];

export function scaleDayForRank(
  template: DayTemplate,
  rankOrTier: RankName | RankTier,
): DayTemplate {
  if (template.isRestDay) return template;
  const tier: RankTier =
    rankOrTier in RANK_TIER_SCALING
      ? (rankOrTier as RankTier)
      : RANK_TO_TIER[rankOrTier as RankName];
  const scaling = RANK_TIER_SCALING[tier] ?? RANK_TIER_SCALING.building;
  if (scaling.reps === 1 && scaling.hold === 1) return template;

  const newSegments: Segment[] = template.segments.map((s) => {
    if (!SCALEABLE_TYPES.includes(s.type)) return s;
    const reps = Math.max(1, Math.round(s.repsPerSet * scaling.reps));
    const hold = Math.max(1, Math.round(s.squeezeSeconds * scaling.hold));
    return { ...s, repsPerSet: reps, squeezeSeconds: hold };
  });

  return {
    ...template,
    segments: newSegments,
    estimatedMinutes: estimateMinutes(newSegments),
  };
}

// ----------------------------------------------------------------------------
// Habit-aware scheduling.
// Returns a 7-day array (Mon-first) with rest days placed on the user's
// least-used weekdays (based on completion history of the last 14 days).
// Falls back to the default schedule when there isn't enough signal.
// ----------------------------------------------------------------------------

export interface ScheduledDay {
  template: DayTemplate;
  isRestDay: boolean;
}

export interface HabitScheduleResult {
  schedule: ScheduledDay[]; // length 7, Mon-first
  preferredRestWeekdays: number[]; // weekday indices (0=Mon) where rest fell
  appliedHabits: boolean; // false → fell back to default
}

function weekdayMonFirst(dateStr: string): number {
  // dateStr: YYYY-MM-DD
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return (dt.getDay() + 6) % 7;
}

const MIN_SIGNAL_COMPLETIONS = 3;
const HABIT_LOOKBACK_DAYS = 14;

function dateNDaysBefore(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - n);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function buildHabitSchedule(
  path: ControlPath,
  completedDates: string[],
  todayStr: string,
): HabitScheduleResult {
  const defaults = DEFAULT_SCHEDULES[path];
  const restCount = defaults.filter((s) => s === null).length;

  const lookbackStart = dateNDaysBefore(todayStr, HABIT_LOOKBACK_DAYS);
  const recent = completedDates.filter(
    (d) => d >= lookbackStart && d < todayStr,
  );
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (const d of recent) counts[weekdayMonFirst(d)]++;

  const totalSignal = counts.reduce((a, b) => a + b, 0);

  // Workouts in their natural order (used both for default and habit-mapped).
  const workouts: Array<() => DayTemplate> = defaults.filter(
    (s): s is () => DayTemplate => s !== null,
  );

  if (totalSignal < MIN_SIGNAL_COMPLETIONS) {
    const schedule: ScheduledDay[] = defaults.map((slot) =>
      slot === null
        ? { template: restDay(`cm-${path}-rest`), isRestDay: true }
        : { template: slot(), isRestDay: false },
    );
    const preferredRestWeekdays = defaults
      .map((s, i) => (s === null ? i : -1))
      .filter((i) => i >= 0);
    return {
      schedule,
      preferredRestWeekdays,
      appliedHabits: false,
    };
  }

  // Pick K least-used weekdays as rest. Tie-break by weekday index ascending
  // so output is deterministic.
  const indexed = counts.map((c, i) => ({ count: c, weekday: i }));
  indexed.sort((a, b) =>
    a.count !== b.count ? a.count - b.count : a.weekday - b.weekday,
  );
  const restWeekdays = new Set(
    indexed.slice(0, restCount).map((x) => x.weekday),
  );

  const schedule: ScheduledDay[] = [];
  let workoutIdx = 0;
  for (let i = 0; i < 7; i++) {
    if (restWeekdays.has(i)) {
      schedule.push({
        template: restDay(`cm-${path}-rest-${i}`),
        isRestDay: true,
      });
    } else {
      const make = workouts[workoutIdx % workouts.length];
      workoutIdx++;
      schedule.push({ template: make(), isRestDay: false });
    }
  }

  return {
    schedule,
    preferredRestWeekdays: Array.from(restWeekdays).sort((a, b) => a - b),
    appliedHabits: true,
  };
}

const WEEKDAY_LABEL_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function getWeekdayLabel(monFirstIndex: number): string {
  return WEEKDAY_LABEL_SHORT[((monFirstIndex % 7) + 7) % 7];
}
