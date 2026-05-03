import {
  workoutProgram,
  type Week,
  type DayTemplate,
  type SegmentType,
} from "../data/workoutProgram";
import {
  buildHabitSchedule,
  scaleDayForRank,
  detectWeakAreaType,
  pickWorkoutForType,
  getPrimaryExerciseType,
  type ControlPath,
  type RankTier,
} from "../data/controlModeWorkouts";
import { todayDateString, type RankName } from "./controlScore";

export type ProgramPhase =
  | "seven_day_challenge"
  | "twelve_week_program"
  | "control_mode";

export type ControlModePath = "maintain" | "build" | "precision" | "rebuild";

export type CompletionTier = "strong" | "partial" | "low";

export interface UserProgramProgress {
  phase: ProgramPhase;
  twelveWeekStartDate: string | null;
  twelveWeekCompletionDate: string | null;
  twelveWeekDecisionDate: string | null;
  completionTier: CompletionTier | null;
  controlModePath: ControlModePath | null;
  controlModeStartDate: string | null;
  controlModeUnlocked: boolean;
  weeklyTarget: number | null;
  currentWeek: number | null;
  currentDay: number | null;
  currentChallengeDay: number | null;
  lifetimeProgramsCompleted: number;
}

export const defaultProgramProgress: UserProgramProgress = {
  phase: "twelve_week_program",
  twelveWeekStartDate: null,
  twelveWeekCompletionDate: null,
  twelveWeekDecisionDate: null,
  completionTier: null,
  controlModePath: null,
  controlModeStartDate: null,
  controlModeUnlocked: false,
  weeklyTarget: null,
  currentWeek: null,
  currentDay: null,
  currentChallengeDay: null,
  lifetimeProgramsCompleted: 0,
};

export const PROGRAM_LENGTH_DAYS = 84;
export const STRONG_THRESHOLD = 60;
export const PARTIAL_THRESHOLD = 35;

const formatLocal = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const parseLocal = (s: string): Date => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const addDaysISO = (date: string, days: number): string => {
  const dt = parseLocal(date);
  dt.setDate(dt.getDate() + days);
  return formatLocal(dt);
};

export function getCompletionTier(uniqueTrainingDays: number): CompletionTier {
  if (uniqueTrainingDays >= STRONG_THRESHOLD) return "strong";
  if (uniqueTrainingDays >= PARTIAL_THRESHOLD) return "partial";
  return "low";
}

export function getTwelveWeekEndDate(twelveWeekStartDate: string): string {
  return addDaysISO(twelveWeekStartDate, PROGRAM_LENGTH_DAYS);
}

export function isTwelveWeekWindowComplete(
  twelveWeekStartDate: string | null,
  todayStr: string = todayDateString(),
): boolean {
  if (!twelveWeekStartDate) return false;
  return todayStr >= getTwelveWeekEndDate(twelveWeekStartDate);
}

export interface TwelveWeekEvaluation {
  uniqueTrainingDays: number;
  tier: CompletionTier;
  windowEndDate: string;
}

export function evaluateTwelveWeekCompletion(
  completedDates: string[],
  restDates: string[],
  twelveWeekStartDate: string,
): TwelveWeekEvaluation {
  const endExclusive = getTwelveWeekEndDate(twelveWeekStartDate);
  const restSet = new Set(restDates);
  const trainingSet = new Set<string>();
  for (const d of completedDates) {
    if (!d) continue;
    if (restSet.has(d)) continue;
    if (d < twelveWeekStartDate) continue;
    if (d >= endExclusive) continue;
    trainingSet.add(d);
  }
  const uniqueTrainingDays = trainingSet.size;
  return {
    uniqueTrainingDays,
    tier: getCompletionTier(uniqueTrainingDays),
    windowEndDate: endExclusive,
  };
}

export const CONTROL_MODE_WEEKLY_TARGET: Record<ControlModePath, number> = {
  maintain: 4,
  build: 6,
  precision: 5,
  rebuild: 3,
};

export const CONTROL_MODE_TAGLINE: Record<ControlModePath, string> = {
  maintain: "Hold your gains with steady sessions",
  build: "Push toward Elite with peak training",
  precision: "Sharpen control with elevator and speed work",
  rebuild: "Three sessions a week to rebuild the habit",
};

export const CONTROL_MODE_LABEL: Record<ControlModePath, string> = {
  maintain: "Maintain",
  build: "Build",
  precision: "Precision",
  rebuild: "Rebuild",
};

// Rebuild keeps reusing Week 2 from the 12-week program. Maintain/Build/
// Precision now use dedicated content libraries from controlModeWorkouts.ts.
const CONTROL_MODE_SOURCE_WEEK: Record<"rebuild", number> = {
  rebuild: 2,
};

export interface ControlModeWorkoutOptions {
  rank?: RankName | RankTier;
  recentCompletions?: string[];
  recentSegmentTypeCounts?: Partial<Record<SegmentType, number>>;
}

export interface ControlModeWorkoutResult {
  week: Week;
  dayIndex: number;
  workout: DayTemplate;
  isRestDay: boolean;
  schedule?: { template: DayTemplate; isRestDay: boolean }[];
  preferredRestWeekdays?: number[];
  appliedHabits?: boolean;
  appliedWeakArea?: boolean;
  weakAreaType?: SegmentType | null;
}

function weekdayMonFirst(dateStr: string): number {
  const dt = parseLocal(dateStr);
  return (dt.getDay() + 6) % 7;
}

function synthesizeWeek(
  path: ControlModePath,
  schedule: { template: DayTemplate; isRestDay: boolean }[],
): Week {
  return {
    weekNumber: 0,
    phase: "Control",
    phaseDescription: `Control Mode · ${path}`,
    days: schedule.map((s) => s.template),
  };
}

export function getControlModeTodaysWorkout(
  path: ControlModePath,
  controlModeStartDate: string,
  todayStr: string = todayDateString(),
  options: ControlModeWorkoutOptions = {},
): ControlModeWorkoutResult {
  if (path === "rebuild") {
    const sourceWeekNum = CONTROL_MODE_SOURCE_WEEK.rebuild;
    const week =
      workoutProgram.weeks.find((w) => w.weekNumber === sourceWeekNum) ??
      workoutProgram.weeks[0];
    const start = parseLocal(controlModeStartDate);
    start.setHours(0, 0, 0, 0);
    const today = parseLocal(todayStr);
    today.setHours(0, 0, 0, 0);
    const daysSinceStart = Math.max(
      0,
      Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)),
    );
    const dayIndex = daysSinceStart % 7;
    const workout = week.days[dayIndex];
    return {
      week,
      dayIndex,
      workout,
      isRestDay: workout.isRestDay === true,
    };
  }

  const cp = path as ControlPath;
  const habit = buildHabitSchedule(
    cp,
    options.recentCompletions ?? [],
    todayStr,
  );
  const dayIndex = weekdayMonFirst(todayStr);
  let slot = habit.schedule[dayIndex];

  // Weak-area personalization: if there's enough segment-type signal and
  // today is not a rest day, swap today's workout for one that targets the
  // user's least-trained area.
  let appliedWeakArea = false;
  let weakAreaType: SegmentType | null = null;
  if (options.recentSegmentTypeCounts && !slot.isRestDay) {
    weakAreaType = detectWeakAreaType(cp, options.recentSegmentTypeCounts);
    if (weakAreaType) {
      const currentPrimary = getPrimaryExerciseType(slot.template);
      if (currentPrimary !== weakAreaType) {
        const swap = pickWorkoutForType(cp, weakAreaType);
        if (swap) {
          slot = { template: swap, isRestDay: false };
          appliedWeakArea = true;
        }
      }
    }
  }

  const workout =
    options.rank && !slot.isRestDay
      ? scaleDayForRank(slot.template, options.rank)
      : slot.template;
  const baseSchedule = habit.schedule.map((s, i) =>
    i === dayIndex ? slot : s,
  );
  const scaledSchedule = options.rank
    ? baseSchedule.map((s) =>
        s.isRestDay
          ? s
          : {
              template: scaleDayForRank(s.template, options.rank!),
              isRestDay: false,
            },
      )
    : baseSchedule;
  return {
    week: synthesizeWeek(path, scaledSchedule),
    dayIndex,
    workout,
    isRestDay: slot.isRestDay,
    schedule: scaledSchedule,
    preferredRestWeekdays: habit.preferredRestWeekdays,
    appliedHabits: habit.appliedHabits,
    appliedWeakArea,
    weakAreaType,
  };
}

export function getISOWeekStartDate(dateStr: string): string {
  const dt = parseLocal(dateStr);
  const day = dt.getDay();
  const diffToMonday = (day + 6) % 7;
  dt.setDate(dt.getDate() - diffToMonday);
  return formatLocal(dt);
}

export function getControlModeWeeklyCount(
  completedDates: string[],
  restDates: string[],
  todayStr: string = todayDateString(),
): number {
  const weekStart = getISOWeekStartDate(todayStr);
  const restSet = new Set(restDates);
  let count = 0;
  for (const d of completedDates) {
    if (restSet.has(d)) continue;
    if (d >= weekStart && d <= todayStr) count++;
  }
  return count;
}
