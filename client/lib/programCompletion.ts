import {
  workoutProgram,
  type Week,
  type DayTemplate,
} from "../data/workoutProgram";
import { todayDateString } from "./controlScore";

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

const CONTROL_MODE_SOURCE_WEEK: Record<ControlModePath, number> = {
  maintain: 11,
  build: 9,
  precision: 5,
  rebuild: 2,
};

export function getControlModeTodaysWorkout(
  path: ControlModePath,
  controlModeStartDate: string,
  todayStr: string = todayDateString(),
): { week: Week; dayIndex: number; workout: DayTemplate; isRestDay: boolean } {
  const sourceWeekNum = CONTROL_MODE_SOURCE_WEEK[path];
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
