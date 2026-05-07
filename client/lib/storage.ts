import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  isRestDayForDate,
  getWorkoutCompletionsForWeek,
  getScheduledDaysForWeek,
} from "@/data/workoutProgram";
import { BADGE_DEFINITIONS, type EarnedBadge } from "@/data/badges";
import {
  RankName,
  RANKS,
  addDays,
  calculateDecayForIdleDay,
  calculateSessionGain,
  clampScore,
  getCompletedDaysInLast7,
  getRankForScore,
  todayDateString,
} from "./controlScore";
import {
  type UserProgramProgress,
  type ControlModePath,
  type ProgramPhase,
  defaultProgramProgress,
  evaluateTwelveWeekCompletion,
  isTwelveWeekWindowComplete,
  CONTROL_MODE_WEEKLY_TARGET,
  type TwelveWeekEvaluation,
} from "./programCompletion";

const RANKS_ORDER: RankName[] = RANKS.map((r) => r.name);

const STORAGE_KEYS = {
  COMPLETED_DATES: "pulsekegel_completed_dates",
  REST_DATES: "pulsekegel_rest_dates",
  TOTAL_SESSIONS: "pulsekegel_total_sessions",
  TOTAL_MINUTES: "pulsekegel_total_minutes",
  SETTINGS: "pulsekegel_settings",
  ONBOARDING_COMPLETE: "pulsekegel_onboarding_complete",
  PROGRAM_START_DATE: "pulsekegel_program_start_date",
  LAST_WEEKLY_REVIEW: "pulsekegel_last_weekly_review",
  REVIEW_HISTORY: "pulsekegel_review_history",
  EARNED_BADGES: "pulsekegel_earned_badges",
  AUDIO_SETTINGS: "pulsekegel_audio_settings",
  LAST_WEEK_COMPLETE_TRACKED: "pulsekegel_last_week_complete_tracked",
  CHALLENGE_OPTIONAL_DATES: "pulsekegel_challenge_optional_dates",
  CHALLENGE_CALIBRATION: "pulsekegel_challenge_calibration",
  WEEKLY_CALIBRATION: "pulsekegel_weekly_calibration",
  WEEKLY_CALIBRATION_PROMPTED: "pulsekegel_weekly_calibration_prompted",
  CONTROL_SCORE_STATE: "pulsekegel_control_score_state",
  RANKS_NOTIFIED: "pulsekegel_ranks_notified",
  BACK_ON_TRACK_PENDING: "pulsekegel_back_on_track_pending",
  PENDING_RANK_UP: "pulsekegel_pending_rank_up",
  PROGRAM_PROGRESS: "pulsekegel_program_progress",
  SEGMENT_TYPE_HISTORY: "pulsekegel_segment_type_history",
};

export interface SegmentTypeHistoryEntry {
  date: string;
  types: string[];
}

export interface ControlScoreState {
  controlScore: number;
  currentRank: RankName;
  currentStreak: number;
  idleDays: number;
  lastSessionDate: string | null;
  lastScoreUpdateDate: string | null;
  highestRankAchieved: RankName;
  highestScoreAchieved: number;
  eliteAchieved: boolean;
  scoreHistory: { date: string; score: number }[];
  backfilled: boolean;
}

const defaultControlScoreState: ControlScoreState = {
  controlScore: 0,
  currentRank: "Rookie",
  currentStreak: 0,
  idleDays: 0,
  lastSessionDate: null,
  lastScoreUpdateDate: null,
  highestRankAchieved: "Rookie",
  highestScoreAchieved: 0,
  eliteAchieved: false,
  scoreHistory: [],
  backfilled: false,
};

const pushHistory = (
  history: { date: string; score: number }[],
  date: string,
  score: number,
): { date: string; score: number }[] => {
  const next = [...history.filter((h) => h.date !== date), { date, score }];
  return next.slice(-30);
};

const sessionDatesOnly = (completed: string[], rest: string[]): string[] => {
  const restSet = new Set(rest);
  return completed.filter((d) => !restSet.has(d));
};

const replaySessionsForBackfill = (
  sortedDates: string[],
  today: string,
): ControlScoreState => {
  const state: ControlScoreState = {
    ...defaultControlScoreState,
    backfilled: true,
  };
  if (sortedDates.length === 0) {
    state.lastScoreUpdateDate = today;
    return state;
  }
  const uniqueSet = new Set<string>();
  let cursor = sortedDates[0];
  for (const d of sortedDates) {
    if (d > today) break;
    while (cursor < d) {
      cursor = addDays(cursor, 1);
      if (cursor === d) break;
      if (!uniqueSet.has(cursor)) {
        state.currentStreak = 0;
        state.idleDays += 1;
        state.controlScore = clampScore(
          state.controlScore - calculateDecayForIdleDay(state.idleDays),
        );
      }
    }
    if (uniqueSet.has(d)) continue;
    uniqueSet.add(d);
    const yesterday = addDays(d, -1);
    state.currentStreak = uniqueSet.has(yesterday)
      ? state.currentStreak + 1
      : 1;
    state.idleDays = 0;
    const rolling = getCompletedDaysInLast7(uniqueSet, d);
    state.controlScore = clampScore(
      state.controlScore + calculateSessionGain(state.currentStreak, rolling),
    );
    state.lastSessionDate = d;
    if (state.controlScore > state.highestScoreAchieved) {
      state.highestScoreAchieved = state.controlScore;
      state.highestRankAchieved = getRankForScore(state.controlScore);
    }
    if (state.controlScore >= 850) state.eliteAchieved = true;
    cursor = d;
  }
  const tailEnd = addDays(today, -1);
  while (cursor < tailEnd) {
    cursor = addDays(cursor, 1);
    if (!uniqueSet.has(cursor)) {
      state.currentStreak = 0;
      state.idleDays += 1;
      state.controlScore = clampScore(
        state.controlScore - calculateDecayForIdleDay(state.idleDays),
      );
    } else {
      state.idleDays = 0;
    }
  }
  if (uniqueSet.has(today)) {
    state.idleDays = 0;
  }
  state.currentRank = getRankForScore(state.controlScore);
  state.lastScoreUpdateDate = today;
  state.scoreHistory = pushHistory([], today, state.controlScore);
  return state;
};

export type CalibrationLevel = "easy" | "okay" | "tooHard";
export type DifficultyPath = "accelerated" | "standard" | "gentle";

const levelToPath = (level: CalibrationLevel): DifficultyPath =>
  level === "easy"
    ? "accelerated"
    : level === "tooHard"
      ? "gentle"
      : "standard";

export interface WeeklyReviewEntry {
  weekNumber: number;
  daysWorkedOut: number;
  totalMinutes: number;
  message: string;
  date: string;
}

export type AnatomyType = "male" | "female" | null;

export interface UserSettings {
  hapticsEnabled: boolean;
  hapticIntensity: "light" | "medium" | "heavy";
  restCueStyle: "none" | "light" | "normal";
  highContrastMode: boolean;
  largeTextMode: boolean;
  recoveryMode: boolean;
  restDuration: number;
  blockRestDuration: number;
  cooldownEnabled: boolean;
  anatomyType: AnatomyType;
  userName: string;
  darkMode: boolean;
  reminderEnabled: boolean;
  reminderTime: string;
}

export const defaultSettings: UserSettings = {
  hapticsEnabled: true,
  hapticIntensity: "medium",
  restCueStyle: "light",
  highContrastMode: false,
  largeTextMode: false,
  recoveryMode: false,
  restDuration: 5,
  blockRestDuration: 25,
  cooldownEnabled: true,
  anatomyType: null,
  userName: "",
  darkMode: true,
  reminderEnabled: false,
  reminderTime: "08:00",
};

export interface UserProgress {
  completedDates: string[];
  totalSessions: number;
  totalMinutes: number;
  currentStreak: number;
  longestStreak: number;
  lastCompletedDate: string | null;
}

const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const calculateStreak = (completedDates: string[]): number => {
  if (completedDates.length === 0) return 0;

  const sortedDates = [...completedDates].sort().reverse();
  const today = formatDate(new Date());
  const yesterday = formatDate(new Date(Date.now() - 86400000));

  if (sortedDates[0] !== today && sortedDates[0] !== yesterday) {
    return 0;
  }

  let streak = 1;
  for (let i = 1; i < sortedDates.length; i++) {
    const currentDate = new Date(sortedDates[i - 1]);
    const prevDate = new Date(sortedDates[i]);
    const diffDays = Math.floor(
      (currentDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (diffDays === 1) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
};

let scoreWriteQueue: Promise<unknown> = Promise.resolve();
const runScoreSerialized = <T>(fn: () => Promise<T>): Promise<T> => {
  const next = scoreWriteQueue.then(fn, fn);
  scoreWriteQueue = next.catch(() => undefined);
  return next;
};

export const storage = {
  async getCompletedDates(): Promise<string[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.COMPLETED_DATES);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  async addCompletedDate(date: string, minutes: number): Promise<void> {
    try {
      const dates = await this.getCompletedDates();
      if (!dates.includes(date)) {
        dates.push(date);
        await AsyncStorage.setItem(
          STORAGE_KEYS.COMPLETED_DATES,
          JSON.stringify(dates),
        );
      }

      const totalSessions = await this.getTotalSessions();
      await AsyncStorage.setItem(
        STORAGE_KEYS.TOTAL_SESSIONS,
        String(totalSessions + 1),
      );

      const totalMinutes = await this.getTotalMinutes();
      await AsyncStorage.setItem(
        STORAGE_KEYS.TOTAL_MINUTES,
        String(totalMinutes + minutes),
      );
    } catch (error) {
      console.error("Error saving completed date:", error);
    }
  },

  async getSegmentTypeHistory(): Promise<SegmentTypeHistoryEntry[]> {
    try {
      const data = await AsyncStorage.getItem(
        STORAGE_KEYS.SEGMENT_TYPE_HISTORY,
      );
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  async addSegmentTypeHistoryEntry(
    date: string,
    types: string[],
  ): Promise<void> {
    try {
      const history = await this.getSegmentTypeHistory();
      history.push({ date, types });
      // Keep last 60 entries to bound storage.
      const trimmed = history.slice(-60);
      await AsyncStorage.setItem(
        STORAGE_KEYS.SEGMENT_TYPE_HISTORY,
        JSON.stringify(trimmed),
      );
    } catch (error) {
      console.error("Error saving segment type history:", error);
    }
  },

  async getRecentSegmentTypeCounts(
    todayStr: string,
    lookbackDays: number = 14,
  ): Promise<Record<string, number>> {
    const history = await this.getSegmentTypeHistory();
    const [y, m, d] = todayStr.split("-").map(Number);
    const cutoff = new Date(y, m - 1, d);
    cutoff.setDate(cutoff.getDate() - lookbackDays);
    const cutoffStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, "0")}-${String(cutoff.getDate()).padStart(2, "0")}`;
    const counts: Record<string, number> = {};
    for (const entry of history) {
      if (entry.date < cutoffStr || entry.date >= todayStr) continue;
      for (const t of entry.types) {
        counts[t] = (counts[t] ?? 0) + 1;
      }
    }
    return counts;
  },

  async getTotalSessions(): Promise<number> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.TOTAL_SESSIONS);
      return data ? parseInt(data, 10) : 0;
    } catch {
      return 0;
    }
  },

  async getTotalMinutes(): Promise<number> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.TOTAL_MINUTES);
      return data ? parseInt(data, 10) : 0;
    } catch {
      return 0;
    }
  },

  async getProgress(): Promise<UserProgress> {
    const completedDates = await this.getCompletedDates();
    const totalSessions = await this.getTotalSessions();
    const totalMinutes = await this.getTotalMinutes();
    const currentStreak = calculateStreak(completedDates);

    const sortedDates = [...completedDates].sort().reverse();

    let longestStreak = currentStreak;
    let tempStreak = 1;
    for (let i = 1; i < sortedDates.length; i++) {
      const currentDate = new Date(sortedDates[i - 1]);
      const prevDate = new Date(sortedDates[i]);
      const diffDays = Math.floor(
        (currentDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (diffDays === 1) {
        tempStreak++;
        longestStreak = Math.max(longestStreak, tempStreak);
      } else {
        tempStreak = 1;
      }
    }

    return {
      completedDates,
      totalSessions,
      totalMinutes,
      currentStreak,
      longestStreak,
      lastCompletedDate: sortedDates[0] || null,
    };
  },

  async getRestDates(): Promise<string[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.REST_DATES);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  async markRestDay(date: string): Promise<void> {
    try {
      const dates = await this.getCompletedDates();
      if (!dates.includes(date)) {
        dates.push(date);
        await AsyncStorage.setItem(
          STORAGE_KEYS.COMPLETED_DATES,
          JSON.stringify(dates),
        );
      }
      const restDates = await this.getRestDates();
      if (!restDates.includes(date)) {
        restDates.push(date);
        await AsyncStorage.setItem(
          STORAGE_KEYS.REST_DATES,
          JSON.stringify(restDates),
        );
      }
    } catch (error) {
      console.error("Error marking rest day:", error);
    }
  },

  async backfillRestDays(programStartDate: string | null): Promise<boolean> {
    if (!programStartDate) return false;

    const completedDates = await this.getCompletedDates();
    const restDates = await this.getRestDates();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const start = new Date(programStartDate);
    start.setHours(0, 0, 0, 0);

    let changed = false;
    const current = new Date(start);

    while (current < today) {
      const dateStr = formatDate(current);
      if (isRestDayForDate(current, programStartDate)) {
        if (!completedDates.includes(dateStr)) {
          completedDates.push(dateStr);
          changed = true;
        }
        if (!restDates.includes(dateStr)) {
          restDates.push(dateStr);
          changed = true;
        }
      }
      current.setDate(current.getDate() + 1);
    }

    if (changed) {
      await AsyncStorage.setItem(
        STORAGE_KEYS.COMPLETED_DATES,
        JSON.stringify(completedDates),
      );
      await AsyncStorage.setItem(
        STORAGE_KEYS.REST_DATES,
        JSON.stringify(restDates),
      );
    }

    return changed;
  },

  async getSettings(): Promise<UserSettings> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.SETTINGS);
      return data
        ? { ...defaultSettings, ...JSON.parse(data) }
        : defaultSettings;
    } catch {
      return defaultSettings;
    }
  },

  async saveSettings(settings: Partial<UserSettings>): Promise<void> {
    try {
      const current = await this.getSettings();
      const updated = { ...current, ...settings };
      await AsyncStorage.setItem(
        STORAGE_KEYS.SETTINGS,
        JSON.stringify(updated),
      );
    } catch (error) {
      console.error("Error saving settings:", error);
    }
  },

  async isOnboardingComplete(): Promise<boolean> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING_COMPLETE);
      return data === "true";
    } catch {
      return false;
    }
  },

  async setOnboardingComplete(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ONBOARDING_COMPLETE, "true");
    } catch (error) {
      console.error("Error saving onboarding state:", error);
    }
  },

  async getProgramStartDate(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.PROGRAM_START_DATE);
    } catch {
      return null;
    }
  },

  async setProgramStartDate(date: string): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.PROGRAM_START_DATE, date);
    } catch (error) {
      console.error("Error saving program start date:", error);
    }
  },

  async clearAllData(
    opts: { preserveHighestRank?: boolean } = {},
  ): Promise<void> {
    try {
      let highestRank: RankName = "Rookie";
      let highestScore = 0;
      let elite = false;
      if (opts.preserveHighestRank) {
        const existing = await this.getControlScoreState();
        highestRank = existing.highestRankAchieved;
        highestScore = existing.highestScoreAchieved;
        elite = existing.eliteAchieved;
      }
      await AsyncStorage.multiRemove(Object.values(STORAGE_KEYS));
      if (opts.preserveHighestRank) {
        const fresh: ControlScoreState = {
          ...defaultControlScoreState,
          highestRankAchieved: highestRank,
          highestScoreAchieved: highestScore,
          eliteAchieved: elite,
          lastScoreUpdateDate: todayDateString(),
          backfilled: true,
        };
        await AsyncStorage.setItem(
          STORAGE_KEYS.CONTROL_SCORE_STATE,
          JSON.stringify(fresh),
        );
      }
    } catch (error) {
      console.error("Error clearing data:", error);
    }
  },

  async getLastWeeklyReview(): Promise<number | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.LAST_WEEKLY_REVIEW);
      return data ? parseInt(data) : null;
    } catch {
      return null;
    }
  },

  async setLastWeeklyReview(weekNumber: number): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.LAST_WEEKLY_REVIEW,
        weekNumber.toString(),
      );
    } catch (error) {
      console.error("Error saving last weekly review:", error);
    }
  },

  async getLastWeekCompleteTracked(): Promise<number | null> {
    try {
      const data = await AsyncStorage.getItem(
        STORAGE_KEYS.LAST_WEEK_COMPLETE_TRACKED,
      );
      return data ? parseInt(data) : null;
    } catch {
      return null;
    }
  },

  async setLastWeekCompleteTracked(weekNumber: number): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.LAST_WEEK_COMPLETE_TRACKED,
        weekNumber.toString(),
      );
    } catch (error) {
      console.error("Error saving last week complete tracked:", error);
    }
  },

  async shouldShowWeeklyReview(
    completedDates: string[],
    programStartDate: string | null,
  ): Promise<{ show: boolean; weekNumber: number; daysWorkedOut: number }> {
    if (!programStartDate || completedDates.length === 0) {
      return { show: false, weekNumber: 0, daysWorkedOut: 0 };
    }

    const toDateStr = (d: Date) => d.toISOString().split("T")[0];
    const startParts = programStartDate.split("-").map(Number);
    const startDate = new Date(startParts[0], startParts[1] - 1, startParts[2]);

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const daysSinceStart = Math.floor(
      (today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    const completedWeeks = Math.floor(daysSinceStart / 7);

    const lastReviewedWeek = await this.getLastWeeklyReview();

    if (
      completedWeeks >= 1 &&
      (lastReviewedWeek === null || completedWeeks > lastReviewedWeek)
    ) {
      const weekToReview = lastReviewedWeek === null ? 1 : lastReviewedWeek + 1;

      const weekStart = new Date(startDate);
      weekStart.setDate(weekStart.getDate() + (weekToReview - 1) * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      const weekStartStr = toDateStr(weekStart);
      const weekEndStr = toDateStr(weekEnd);

      const daysWorkedOut = completedDates.filter((dateStr) => {
        return dateStr >= weekStartStr && dateStr <= weekEndStr;
      }).length;

      return { show: true, weekNumber: weekToReview, daysWorkedOut };
    }

    const currentWeek = completedWeeks + 1;
    return { show: false, weekNumber: currentWeek, daysWorkedOut: 0 };
  },

  async getWeeklyReviewDataForWeek(
    weekNumber: number,
    completedDates: string[],
    programStartDate: string,
  ): Promise<{ daysWorkedOut: number; totalMinutes: number }> {
    const startParts = programStartDate.split("-").map(Number);
    const startDate = new Date(startParts[0], startParts[1] - 1, startParts[2]);
    const toDateStr = (d: Date) => d.toISOString().split("T")[0];

    const weekStart = new Date(startDate);
    weekStart.setDate(weekStart.getDate() + (weekNumber - 1) * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const weekStartStr = toDateStr(weekStart);
    const weekEndStr = toDateStr(weekEnd);

    const daysWorkedOut = completedDates.filter((dateStr) => {
      return dateStr >= weekStartStr && dateStr <= weekEndStr;
    }).length;

    return { daysWorkedOut, totalMinutes: 0 };
  },

  async getMissedWeeklyReviews(
    completedDates: string[],
    programStartDate: string | null,
  ): Promise<number[]> {
    if (!programStartDate || completedDates.length === 0) return [];

    const startParts = programStartDate.split("-").map(Number);
    const startDate = new Date(startParts[0], startParts[1] - 1, startParts[2]);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const daysSinceStart = Math.floor(
      (today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    const completedWeeks = Math.floor(daysSinceStart / 7);

    const lastReviewedWeek = await this.getLastWeeklyReview();
    const startFrom = (lastReviewedWeek || 0) + 1;

    const missed: number[] = [];
    for (let w = startFrom; w <= completedWeeks; w++) {
      missed.push(w);
    }
    return missed;
  },

  async saveWeeklyReviewToHistory(entry: WeeklyReviewEntry): Promise<void> {
    try {
      const history = await this.getReviewHistory();
      const existingIndex = history.findIndex(
        (h) => h.weekNumber === entry.weekNumber,
      );
      if (existingIndex >= 0) {
        history[existingIndex] = entry;
      } else {
        history.push(entry);
      }
      history.sort((a, b) => a.weekNumber - b.weekNumber);
      await AsyncStorage.setItem(
        STORAGE_KEYS.REVIEW_HISTORY,
        JSON.stringify(history),
      );
    } catch (error) {
      console.error("Error saving review history:", error);
    }
  },

  async getReviewHistory(): Promise<WeeklyReviewEntry[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.REVIEW_HISTORY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  async getEarnedBadges(): Promise<EarnedBadge[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.EARNED_BADGES);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  async earnBadge(badgeId: string): Promise<void> {
    try {
      const badges = await this.getEarnedBadges();
      if (badges.some((b) => b.badgeId === badgeId)) return;
      const now = new Date();
      const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      badges.push({ badgeId, earnedDate: date });
      await AsyncStorage.setItem(
        STORAGE_KEYS.EARNED_BADGES,
        JSON.stringify(badges),
      );
    } catch (error) {
      console.error("Error earning badge:", error);
    }
  },

  async checkAndAwardBadges(): Promise<string[]> {
    const [progress, earnedBadges, programStartDate] = await Promise.all([
      this.getProgress(),
      this.getEarnedBadges(),
      this.getProgramStartDate(),
    ]);

    const earnedIds = new Set(earnedBadges.map((b) => b.badgeId));
    const newBadgeIds: string[] = [];

    for (const badge of BADGE_DEFINITIONS) {
      if (earnedIds.has(badge.id)) continue;

      let earned = false;

      switch (badge.criteria.type) {
        case "sessions":
          earned = progress.totalSessions >= badge.criteria.value;
          break;
        case "streak":
          earned =
            progress.currentStreak >= badge.criteria.value ||
            progress.longestStreak >= badge.criteria.value;
          break;
        case "minutes":
          earned = progress.totalMinutes >= badge.criteria.value;
          break;
        case "phase": {
          if (programStartDate) {
            const startParts = programStartDate.split("-").map(Number);
            const start = new Date(
              startParts[0],
              startParts[1] - 1,
              startParts[2],
            );
            const now = new Date();
            const today = new Date(
              now.getFullYear(),
              now.getMonth(),
              now.getDate(),
            );
            const daysSinceStart = Math.floor(
              (today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
            );
            const completedWeeks = Math.floor(daysSinceStart / 7);
            earned =
              completedWeeks >= badge.criteria.value &&
              progress.completedDates.length > 0;
          }
          break;
        }
        case "program_complete": {
          if (programStartDate) {
            const startParts = programStartDate.split("-").map(Number);
            const start = new Date(
              startParts[0],
              startParts[1] - 1,
              startParts[2],
            );
            const now = new Date();
            const today = new Date(
              now.getFullYear(),
              now.getMonth(),
              now.getDate(),
            );
            const daysSinceStart = Math.floor(
              (today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
            );
            const completedWeeks = Math.floor(daysSinceStart / 7);
            earned = completedWeeks >= 12 && progress.completedDates.length > 0;
          }
          break;
        }
        case "perfect_week": {
          if (programStartDate && progress.completedDates.length > 0) {
            const startParts = programStartDate.split("-").map(Number);
            const start = new Date(
              startParts[0],
              startParts[1] - 1,
              startParts[2],
            );
            const now = new Date();
            const today = new Date(
              now.getFullYear(),
              now.getMonth(),
              now.getDate(),
            );
            const daysSinceStart = Math.floor(
              (today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
            );
            const completedWeeks = Math.floor(daysSinceStart / 7);

            for (let w = 0; w < completedWeeks; w++) {
              let scheduledDays = 0;
              let completedScheduled = 0;
              for (let d = 0; d < 7; d++) {
                const dayDate = new Date(start);
                dayDate.setDate(dayDate.getDate() + w * 7 + d);
                const dateStr = formatDate(dayDate);
                const isRest = isRestDayForDate(dayDate, programStartDate);
                if (!isRest) {
                  scheduledDays++;
                  if (progress.completedDates.includes(dateStr)) {
                    completedScheduled++;
                  }
                }
              }
              if (scheduledDays > 0 && completedScheduled === scheduledDays) {
                earned = true;
                break;
              }
            }
          }
          break;
        }
      }

      if (earned) {
        await this.earnBadge(badge.id);
        newBadgeIds.push(badge.id);
      }
    }

    return newBadgeIds;
  },

  async getAudioSettings(): Promise<Record<string, unknown>> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.AUDIO_SETTINGS);
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  },

  async saveAudioSettings(settings: Record<string, unknown>): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.AUDIO_SETTINGS,
        JSON.stringify(settings),
      );
    } catch (error) {
      console.error("Error saving audio settings:", error);
    }
  },

  async getChallengeOptionalDates(): Promise<string[]> {
    try {
      const data = await AsyncStorage.getItem(
        STORAGE_KEYS.CHALLENGE_OPTIONAL_DATES,
      );
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  async markChallengeOptionalSession(date: string): Promise<void> {
    try {
      const dates = await this.getChallengeOptionalDates();
      if (!dates.includes(date)) {
        dates.push(date);
        await AsyncStorage.setItem(
          STORAGE_KEYS.CHALLENGE_OPTIONAL_DATES,
          JSON.stringify(dates),
        );
      }
    } catch (error) {
      console.error("Error marking challenge optional session:", error);
    }
  },

  async getChallengeStats(): Promise<{
    completedCoreSessions: number;
    totalCoreSessions: number;
    completedOptionalSessions: number;
  }> {
    const [completedDates, programStartDate, optionalDates] = await Promise.all(
      [
        this.getCompletedDates(),
        this.getProgramStartDate(),
        this.getChallengeOptionalDates(),
      ],
    );

    const totalCoreSessions: number = getScheduledDaysForWeek(1);

    if (!programStartDate) {
      return {
        completedCoreSessions: 0,
        totalCoreSessions,
        completedOptionalSessions: 0,
      };
    }

    const completedCoreSessions: number = getWorkoutCompletionsForWeek(
      completedDates,
      1,
      programStartDate,
    );

    return {
      completedCoreSessions,
      totalCoreSessions,
      completedOptionalSessions: optionalDates.length,
    };
  },

  async resetChallengeProgress(): Promise<void> {
    try {
      const today = new Date().toISOString();
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.COMPLETED_DATES,
        STORAGE_KEYS.REST_DATES,
        STORAGE_KEYS.PROGRAM_START_DATE,
        STORAGE_KEYS.CHALLENGE_OPTIONAL_DATES,
        STORAGE_KEYS.LAST_WEEKLY_REVIEW,
        STORAGE_KEYS.LAST_WEEK_COMPLETE_TRACKED,
        STORAGE_KEYS.REVIEW_HISTORY,
        STORAGE_KEYS.CHALLENGE_CALIBRATION,
        STORAGE_KEYS.WEEKLY_CALIBRATION,
        STORAGE_KEYS.WEEKLY_CALIBRATION_PROMPTED,
        "pulsekegel_challenge_shown",
      ]);
      await AsyncStorage.setItem("pulsekegel_install_date", today);
    } catch (error) {
      console.error("Error resetting challenge progress:", error);
    }
  },

  async getCalibrationState(): Promise<{
    calibrationLevel: "easy" | "okay" | "tooHard" | null;
    difficultyPath: "accelerated" | "standard" | "gentle" | null;
    calibrationCompleted: boolean;
  }> {
    try {
      const data = await AsyncStorage.getItem(
        STORAGE_KEYS.CHALLENGE_CALIBRATION,
      );
      if (!data) {
        return {
          calibrationLevel: null,
          difficultyPath: null,
          calibrationCompleted: false,
        };
      }
      return JSON.parse(data);
    } catch {
      return {
        calibrationLevel: null,
        difficultyPath: null,
        calibrationCompleted: false,
      };
    }
  },

  async clearCalibrationState(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.CHALLENGE_CALIBRATION);
    } catch (error) {
      console.error("Error clearing calibration state:", error);
    }
  },

  async setCalibrationState(level: "easy" | "okay" | "tooHard"): Promise<void> {
    try {
      const difficultyPath = levelToPath(level);
      const state = {
        calibrationLevel: level,
        difficultyPath,
        calibrationCompleted: true,
      };
      await AsyncStorage.setItem(
        STORAGE_KEYS.CHALLENGE_CALIBRATION,
        JSON.stringify(state),
      );
    } catch (error) {
      console.error("Error saving calibration state:", error);
    }
  },

  async getWeeklyCalibrationLevels(): Promise<
    Record<number, CalibrationLevel>
  > {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.WEEKLY_CALIBRATION);
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  },

  async setWeeklyCalibrationLevel(
    weekNumber: number,
    level: CalibrationLevel,
  ): Promise<void> {
    try {
      const levels = await this.getWeeklyCalibrationLevels();
      levels[weekNumber] = level;
      await AsyncStorage.setItem(
        STORAGE_KEYS.WEEKLY_CALIBRATION,
        JSON.stringify(levels),
      );
    } catch (error) {
      console.error("Error saving weekly calibration:", error);
    }
  },

  async getDifficultyPathForWeek(weekNumber: number): Promise<DifficultyPath> {
    if (weekNumber <= 1) {
      const initial = await this.getCalibrationState();
      return initial.difficultyPath ?? "standard";
    }
    const levels = await this.getWeeklyCalibrationLevels();
    const prev = levels[weekNumber - 1];
    if (prev) return levelToPath(prev);
    return "standard";
  },

  async getWeeklyCalibrationPromptedWeeks(): Promise<number[]> {
    try {
      const data = await AsyncStorage.getItem(
        STORAGE_KEYS.WEEKLY_CALIBRATION_PROMPTED,
      );
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  async markWeeklyCalibrationPrompted(weekNumber: number): Promise<void> {
    try {
      const weeks = await this.getWeeklyCalibrationPromptedWeeks();
      if (!weeks.includes(weekNumber)) {
        weeks.push(weekNumber);
        await AsyncStorage.setItem(
          STORAGE_KEYS.WEEKLY_CALIBRATION_PROMPTED,
          JSON.stringify(weeks),
        );
      }
    } catch (error) {
      console.error("Error marking weekly calibration prompted:", error);
    }
  },

  async getControlScoreState(): Promise<ControlScoreState> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.CONTROL_SCORE_STATE);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<ControlScoreState>;
        return { ...defaultControlScoreState, ...parsed };
      }
      const sessionDates = await this.getSessionCompletedDates();
      const today = todayDateString();
      const sorted = [...sessionDates].filter(Boolean).sort();
      const backfilled = replaySessionsForBackfill(sorted, today);
      await AsyncStorage.setItem(
        STORAGE_KEYS.CONTROL_SCORE_STATE,
        JSON.stringify(backfilled),
      );
      return backfilled;
    } catch {
      return { ...defaultControlScoreState };
    }
  },

  async saveControlScoreState(state: ControlScoreState): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.CONTROL_SCORE_STATE,
        JSON.stringify(state),
      );
    } catch (error) {
      console.error("Error saving control score state:", error);
    }
  },

  async getSessionCompletedDates(): Promise<string[]> {
    const [completed, rest] = await Promise.all([
      this.getCompletedDates(),
      this.getRestDates(),
    ]);
    return sessionDatesOnly(completed, rest);
  },

  async applyDailyDecay(
    today: string = todayDateString(),
  ): Promise<ControlScoreState> {
    return runScoreSerialized(() => this._applyDailyDecayUnsafe(today));
  },

  async _applyDailyDecayUnsafe(
    today: string = todayDateString(),
  ): Promise<ControlScoreState> {
    const state = await this.getControlScoreState();
    if (!state.lastScoreUpdateDate) {
      state.lastScoreUpdateDate = today;
      await this.saveControlScoreState(state);
      return state;
    }
    if (state.lastScoreUpdateDate >= today) {
      return state;
    }
    const sessionDates = await this.getSessionCompletedDates();
    const completedSet = new Set(sessionDates);
    const yesterday = addDays(today, -1);
    let cursor = state.lastScoreUpdateDate;
    while (cursor < yesterday) {
      cursor = addDays(cursor, 1);
      if (completedSet.has(cursor)) {
        state.idleDays = 0;
      } else {
        if (state.currentStreak > 0) state.currentStreak = 0;
        state.idleDays += 1;
        state.controlScore = clampScore(
          state.controlScore - calculateDecayForIdleDay(state.idleDays),
        );
      }
    }
    // The while loop processes days from lastScoreUpdateDate+1 up to (but not including)
    // yesterday — so when lastScoreUpdateDate = yesterday the loop doesn't execute and
    // yesterday's completed session is never checked. Explicitly correct that here.
    if (completedSet.has(yesterday)) {
      state.idleDays = 0;
    }
    if (completedSet.has(today)) {
      state.idleDays = 0;
    }
    state.currentRank = getRankForScore(state.controlScore);
    state.lastScoreUpdateDate = today;
    state.scoreHistory = pushHistory(
      state.scoreHistory,
      today,
      state.controlScore,
    );
    await this.saveControlScoreState(state);
    return state;
  },

  async completeSessionForScore(today: string = todayDateString()): Promise<{
    state: ControlScoreState;
    rankUp: RankName | null;
    backOnTrack: boolean;
    gain: number;
  }> {
    return runScoreSerialized(() => this._completeSessionForScoreUnsafe(today));
  },

  async _completeSessionForScoreUnsafe(
    today: string = todayDateString(),
  ): Promise<{
    state: ControlScoreState;
    rankUp: RankName | null;
    backOnTrack: boolean;
    gain: number;
  }> {
    const state = await this.getControlScoreState();
    const sessionDates = await this.getSessionCompletedDates();
    const completedSet = new Set(sessionDates);
    if (state.lastSessionDate === today) {
      return { state, rankUp: null, backOnTrack: false, gain: 0 };
    }
    if (state.lastScoreUpdateDate < today) {
      const yesterday = addDays(today, -1);
      let cursor = state.lastScoreUpdateDate;
      while (cursor < yesterday) {
        cursor = addDays(cursor, 1);
        if (cursor !== today && completedSet.has(cursor)) {
          state.idleDays = 0;
        } else {
          if (state.currentStreak > 0) state.currentStreak = 0;
          state.idleDays += 1;
          state.controlScore = clampScore(
            state.controlScore - calculateDecayForIdleDay(state.idleDays),
          );
        }
      }
      state.currentRank = getRankForScore(state.controlScore);
    }
    const previousRank = state.currentRank;
    const wasInactive = state.idleDays >= 3;
    const prevDay = addDays(today, -1);
    state.currentStreak = completedSet.has(prevDay)
      ? state.currentStreak + 1
      : 1;
    state.idleDays = 0;
    completedSet.add(today);
    const rolling = getCompletedDaysInLast7(completedSet, today);
    const gain = calculateSessionGain(state.currentStreak, rolling);
    state.controlScore = clampScore(state.controlScore + gain);
    state.currentRank = getRankForScore(state.controlScore);
    state.lastSessionDate = today;
    state.lastScoreUpdateDate = today;
    if (state.controlScore > state.highestScoreAchieved) {
      state.highestScoreAchieved = state.controlScore;
      state.highestRankAchieved = getRankForScore(state.controlScore);
    }
    if (state.controlScore >= 850) state.eliteAchieved = true;
    state.scoreHistory = pushHistory(
      state.scoreHistory,
      today,
      state.controlScore,
    );
    await this.saveControlScoreState(state);
    let rankUp: RankName | null = null;
    if (
      state.currentRank !== previousRank &&
      RANKS_ORDER.indexOf(state.currentRank) > RANKS_ORDER.indexOf(previousRank)
    ) {
      const notified = await this.getRanksNotified();
      if (!notified.includes(state.currentRank)) {
        rankUp = state.currentRank;
        await AsyncStorage.setItem(
          STORAGE_KEYS.PENDING_RANK_UP,
          state.currentRank,
        );
      }
    }
    if (wasInactive) {
      await AsyncStorage.setItem(STORAGE_KEYS.BACK_ON_TRACK_PENDING, "1");
    }
    return { state, rankUp, backOnTrack: wasInactive, gain };
  },

  async consumePendingRankUp(): Promise<RankName | null> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_RANK_UP);
      if (!raw) return null;
      await AsyncStorage.removeItem(STORAGE_KEYS.PENDING_RANK_UP);
      return raw as RankName;
    } catch {
      return null;
    }
  },

  async getRanksNotified(): Promise<RankName[]> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.RANKS_NOTIFIED);
      return raw ? (JSON.parse(raw) as RankName[]) : [];
    } catch {
      return [];
    }
  },

  async markRankNotified(rank: RankName): Promise<void> {
    try {
      const list = await this.getRanksNotified();
      if (!list.includes(rank)) {
        list.push(rank);
        await AsyncStorage.setItem(
          STORAGE_KEYS.RANKS_NOTIFIED,
          JSON.stringify(list),
        );
      }
    } catch (error) {
      console.error("Error marking rank notified:", error);
    }
  },

  async consumeBackOnTrackPending(): Promise<boolean> {
    try {
      const raw = await AsyncStorage.getItem(
        STORAGE_KEYS.BACK_ON_TRACK_PENDING,
      );
      if (raw === "1") {
        await AsyncStorage.removeItem(STORAGE_KEYS.BACK_ON_TRACK_PENDING);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  async getProgramProgress(): Promise<UserProgramProgress> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.PROGRAM_PROGRESS);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<UserProgramProgress>;
        return { ...defaultProgramProgress, ...parsed };
      }
      // Lazy-init for legacy users: default to twelve_week_program (anchored
      // to programStartDate when present). Reserve seven_day_challenge for
      // users with an explicit in-progress challenge signal — namely a
      // partial calibration record that exists but is not yet completed.
      const [startDate, calibRaw] = await Promise.all([
        this.getProgramStartDate(),
        AsyncStorage.getItem(STORAGE_KEYS.CHALLENGE_CALIBRATION),
      ]);
      let phase: ProgramPhase = "twelve_week_program";
      if (calibRaw) {
        try {
          const calib = JSON.parse(calibRaw) as {
            calibrationCompleted?: boolean;
          };
          if (!calib.calibrationCompleted) phase = "seven_day_challenge";
        } catch {
          // ignore parse errors and stick with the default
        }
      }
      const fresh: UserProgramProgress = {
        ...defaultProgramProgress,
        phase,
        twelveWeekStartDate: startDate ?? null,
      };
      await AsyncStorage.setItem(
        STORAGE_KEYS.PROGRAM_PROGRESS,
        JSON.stringify(fresh),
      );
      return fresh;
    } catch {
      return { ...defaultProgramProgress };
    }
  },

  async saveProgramProgress(progress: UserProgramProgress): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.PROGRAM_PROGRESS,
        JSON.stringify(progress),
      );
    } catch (error) {
      console.error("Error saving program progress:", error);
    }
  },

  async setControlModePinnedRestWeekdays(
    weekdays: number[],
  ): Promise<UserProgramProgress> {
    const prev = await this.getProgramProgress();
    const cleaned = Array.from(
      new Set(weekdays.filter((i) => Number.isInteger(i) && i >= 0 && i <= 6)),
    ).sort((a, b) => a - b);
    const next: UserProgramProgress = {
      ...prev,
      controlModePinnedRestWeekdays: cleaned,
    };
    await this.saveProgramProgress(next);
    return next;
  },

  async evaluateAndStoreCompletionTier(): Promise<TwelveWeekEvaluation | null> {
    const progress = await this.getProgramProgress();
    if (!progress.twelveWeekStartDate) return null;
    const [completedDates, restDates] = await Promise.all([
      this.getCompletedDates(),
      this.getRestDates(),
    ]);
    const evaluation = evaluateTwelveWeekCompletion(
      completedDates,
      restDates,
      progress.twelveWeekStartDate,
    );
    const completionDate =
      progress.twelveWeekCompletionDate ?? todayDateString();
    if (
      progress.completionTier !== evaluation.tier ||
      progress.twelveWeekCompletionDate !== completionDate
    ) {
      await this.saveProgramProgress({
        ...progress,
        completionTier: evaluation.tier,
        twelveWeekCompletionDate: completionDate,
      });
    }
    return evaluation;
  },

  async shouldShowProgramCompletion(
    today: string = todayDateString(),
  ): Promise<boolean> {
    const progress = await this.getProgramProgress();
    if (progress.phase !== "twelve_week_program") return false;
    if (!progress.twelveWeekStartDate) return false;
    if (progress.twelveWeekDecisionDate) return false;
    // Window passed: today >= start + 84 days.
    if (isTwelveWeekWindowComplete(progress.twelveWeekStartDate, today)) {
      return true;
    }
    // Immediate trigger: Week 12 Day 7 (start + 83 days) is today AND today's
    // session has been completed.
    const day84 = addDays(progress.twelveWeekStartDate, 83);
    if (today >= day84) {
      const completed = await this.getCompletedDates();
      if (completed.includes(today)) return true;
    }
    return false;
  },

  async _clearWorkoutSessionKeys(): Promise<void> {
    // NOTE: TOTAL_SESSIONS and TOTAL_MINUTES are intentionally preserved here
    // so lifetime totals carry across 12-week restart paths.
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.COMPLETED_DATES,
      STORAGE_KEYS.REST_DATES,
      STORAGE_KEYS.LAST_WEEKLY_REVIEW,
      STORAGE_KEYS.LAST_WEEK_COMPLETE_TRACKED,
      STORAGE_KEYS.REVIEW_HISTORY,
      STORAGE_KEYS.CHALLENGE_OPTIONAL_DATES,
      STORAGE_KEYS.WEEKLY_CALIBRATION,
      STORAGE_KEYS.WEEKLY_CALIBRATION_PROMPTED,
    ]);
  },

  async restartTwelveWeekProgram(
    today: string = todayDateString(),
  ): Promise<void> {
    const prev = await this.getProgramProgress();
    await this._clearWorkoutSessionKeys();
    // Intentionally NOT resetting CONTROL_SCORE_STATE: the spec requires
    // preserving controlScore, currentRank, highestRank, highestScore, and
    // eliteAchieved across restarts so users carry their progression forward.
    await this.setProgramStartDate(today);
    await this.saveProgramProgress({
      ...defaultProgramProgress,
      phase: "twelve_week_program",
      twelveWeekStartDate: today,
      currentWeek: 1,
      currentDay: 1,
      currentChallengeDay: null,
      controlModeUnlocked: prev.controlModeUnlocked,
      lifetimeProgramsCompleted: prev.lifetimeProgramsCompleted + 1,
    });
  },

  async restartFromWeekFive(today: string = todayDateString()): Promise<void> {
    const prev = await this.getProgramProgress();
    await this._clearWorkoutSessionKeys();
    // Backdate program start so today falls on day 28 (start of week 5).
    // Control score state is preserved across the restart.
    const start = addDays(today, -28);
    await this.setProgramStartDate(start);
    await this.saveProgramProgress({
      ...defaultProgramProgress,
      phase: "twelve_week_program",
      twelveWeekStartDate: start,
      currentWeek: 5,
      currentDay: 1,
      currentChallengeDay: null,
      controlModeUnlocked: prev.controlModeUnlocked,
      lifetimeProgramsCompleted: prev.lifetimeProgramsCompleted,
    });
  },

  async restartSevenDayCalibration(
    today: string = todayDateString(),
  ): Promise<void> {
    const prev = await this.getProgramProgress();
    await this._clearWorkoutSessionKeys();
    await AsyncStorage.removeItem(STORAGE_KEYS.CHALLENGE_CALIBRATION);
    // Control score state is preserved across the restart.
    await this.setProgramStartDate(today);
    await this.saveProgramProgress({
      ...defaultProgramProgress,
      phase: "seven_day_challenge",
      twelveWeekStartDate: today,
      currentWeek: null,
      currentDay: null,
      currentChallengeDay: 1,
      controlModeUnlocked: prev.controlModeUnlocked,
      lifetimeProgramsCompleted: prev.lifetimeProgramsCompleted,
    });
  },

  async switchToControlMode(
    path: ControlModePath,
    today: string = todayDateString(),
  ): Promise<void> {
    const prev = await this.getProgramProgress();
    const incrementedLifetime =
      prev.phase === "twelve_week_program" && prev.completionTier === "strong"
        ? prev.lifetimeProgramsCompleted + 1
        : prev.lifetimeProgramsCompleted;
    await this.saveProgramProgress({
      ...prev,
      phase: "control_mode",
      controlModePath: path,
      controlModeStartDate: today,
      twelveWeekDecisionDate: today,
      controlModeUnlocked: true,
      weeklyTarget: CONTROL_MODE_WEEKLY_TARGET[path],
      currentWeek: null,
      currentDay: null,
      currentChallengeDay: null,
      lifetimeProgramsCompleted: incrementedLifetime,
    });
  },

  async resetControlScore(preserveHighest: boolean = false): Promise<void> {
    try {
      let highestRank: RankName = "Rookie";
      let highestScore = 0;
      let elite = false;
      if (preserveHighest) {
        const existing = await this.getControlScoreState();
        highestRank = existing.highestRankAchieved;
        highestScore = existing.highestScoreAchieved;
        elite = existing.eliteAchieved;
      }
      const fresh: ControlScoreState = {
        ...defaultControlScoreState,
        highestRankAchieved: highestRank,
        highestScoreAchieved: highestScore,
        eliteAchieved: elite,
        lastScoreUpdateDate: todayDateString(),
        backfilled: true,
      };
      await AsyncStorage.setItem(
        STORAGE_KEYS.CONTROL_SCORE_STATE,
        JSON.stringify(fresh),
      );
      await AsyncStorage.removeItem(STORAGE_KEYS.RANKS_NOTIFIED);
      await AsyncStorage.removeItem(STORAGE_KEYS.BACK_ON_TRACK_PENDING);
      await AsyncStorage.removeItem(STORAGE_KEYS.PENDING_RANK_UP);
    } catch (error) {
      console.error("Error resetting control score:", error);
    }
  },
};
