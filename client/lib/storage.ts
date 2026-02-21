import AsyncStorage from '@react-native-async-storage/async-storage';
import { isRestDayForDate } from '@/data/workoutProgram';
import type { EarnedBadge } from '@/data/badges';

const STORAGE_KEYS = {
  COMPLETED_DATES: 'pulsekegel_completed_dates',
  REST_DATES: 'pulsekegel_rest_dates',
  TOTAL_SESSIONS: 'pulsekegel_total_sessions',
  TOTAL_MINUTES: 'pulsekegel_total_minutes',
  SETTINGS: 'pulsekegel_settings',
  ONBOARDING_COMPLETE: 'pulsekegel_onboarding_complete',
  PROGRAM_START_DATE: 'pulsekegel_program_start_date',
  LAST_WEEKLY_REVIEW: 'pulsekegel_last_weekly_review',
  REVIEW_HISTORY: 'pulsekegel_review_history',
  EARNED_BADGES: 'pulsekegel_earned_badges',
  AUDIO_SETTINGS: 'pulsekegel_audio_settings',
};

export interface WeeklyReviewEntry {
  weekNumber: number;
  daysWorkedOut: number;
  totalMinutes: number;
  message: string;
  date: string;
}

export type AnatomyType = 'male' | 'female' | null;

export interface UserSettings {
  hapticsEnabled: boolean;
  hapticIntensity: 'light' | 'medium' | 'heavy';
  restCueStyle: 'none' | 'light' | 'normal';
  highContrastMode: boolean;
  largeTextMode: boolean;
  recoveryMode: boolean;
  restDuration: number;
  blockRestDuration: number;
  cooldownEnabled: boolean;
  anatomyType: AnatomyType;
  userName: string;
  darkMode: boolean;
}

export const defaultSettings: UserSettings = {
  hapticsEnabled: true,
  hapticIntensity: 'medium',
  restCueStyle: 'light',
  highContrastMode: false,
  largeTextMode: false,
  recoveryMode: false,
  restDuration: 5,
  blockRestDuration: 25,
  cooldownEnabled: true,
  anatomyType: null,
  userName: '',
  darkMode: true,
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
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
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
      (currentDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    
    if (diffDays === 1) {
      streak++;
    } else {
      break;
    }
  }
  
  return streak;
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
          JSON.stringify(dates)
        );
      }
      
      const totalSessions = await this.getTotalSessions();
      await AsyncStorage.setItem(
        STORAGE_KEYS.TOTAL_SESSIONS,
        String(totalSessions + 1)
      );
      
      const totalMinutes = await this.getTotalMinutes();
      await AsyncStorage.setItem(
        STORAGE_KEYS.TOTAL_MINUTES,
        String(totalMinutes + minutes)
      );
    } catch (error) {
      console.error('Error saving completed date:', error);
    }
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
        (currentDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24)
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
          JSON.stringify(dates)
        );
      }
      const restDates = await this.getRestDates();
      if (!restDates.includes(date)) {
        restDates.push(date);
        await AsyncStorage.setItem(
          STORAGE_KEYS.REST_DATES,
          JSON.stringify(restDates)
        );
      }
    } catch (error) {
      console.error('Error marking rest day:', error);
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

    while (current <= today) {
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
        JSON.stringify(completedDates)
      );
      await AsyncStorage.setItem(
        STORAGE_KEYS.REST_DATES,
        JSON.stringify(restDates)
      );
    }

    return changed;
  },

  async getSettings(): Promise<UserSettings> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.SETTINGS);
      return data ? { ...defaultSettings, ...JSON.parse(data) } : defaultSettings;
    } catch {
      return defaultSettings;
    }
  },

  async saveSettings(settings: Partial<UserSettings>): Promise<void> {
    try {
      const current = await this.getSettings();
      const updated = { ...current, ...settings };
      await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  },

  async isOnboardingComplete(): Promise<boolean> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING_COMPLETE);
      return data === 'true';
    } catch {
      return false;
    }
  },

  async setOnboardingComplete(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ONBOARDING_COMPLETE, 'true');
    } catch (error) {
      console.error('Error saving onboarding state:', error);
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
      console.error('Error saving program start date:', error);
    }
  },

  async clearAllData(): Promise<void> {
    try {
      await AsyncStorage.multiRemove(Object.values(STORAGE_KEYS));
    } catch (error) {
      console.error('Error clearing data:', error);
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
      await AsyncStorage.setItem(STORAGE_KEYS.LAST_WEEKLY_REVIEW, weekNumber.toString());
    } catch (error) {
      console.error('Error saving last weekly review:', error);
    }
  },

  async shouldShowWeeklyReview(completedDates: string[], programStartDate: string | null): Promise<{ show: boolean; weekNumber: number; daysWorkedOut: number }> {
    if (!programStartDate || completedDates.length === 0) {
      return { show: false, weekNumber: 0, daysWorkedOut: 0 };
    }

    const toDateStr = (d: Date) => d.toISOString().split('T')[0];
    const startParts = programStartDate.split('-').map(Number);
    const startDate = new Date(startParts[0], startParts[1] - 1, startParts[2]);

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const daysSinceStart = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const completedWeeks = Math.floor(daysSinceStart / 7);

    const lastReviewedWeek = await this.getLastWeeklyReview();

    if (completedWeeks >= 1 && (lastReviewedWeek === null || completedWeeks > (lastReviewedWeek))) {
      const weekToReview = lastReviewedWeek === null ? 1 : lastReviewedWeek + 1;

      const weekStart = new Date(startDate);
      weekStart.setDate(weekStart.getDate() + (weekToReview - 1) * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      const weekStartStr = toDateStr(weekStart);
      const weekEndStr = toDateStr(weekEnd);

      const daysWorkedOut = completedDates.filter(dateStr => {
        return dateStr >= weekStartStr && dateStr <= weekEndStr;
      }).length;

      return { show: true, weekNumber: weekToReview, daysWorkedOut };
    }

    const currentWeek = completedWeeks + 1;
    return { show: false, weekNumber: currentWeek, daysWorkedOut: 0 };
  },

  async getWeeklyReviewDataForWeek(weekNumber: number, completedDates: string[], programStartDate: string): Promise<{ daysWorkedOut: number; totalMinutes: number }> {
    const startParts = programStartDate.split('-').map(Number);
    const startDate = new Date(startParts[0], startParts[1] - 1, startParts[2]);
    const toDateStr = (d: Date) => d.toISOString().split('T')[0];

    const weekStart = new Date(startDate);
    weekStart.setDate(weekStart.getDate() + (weekNumber - 1) * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const weekStartStr = toDateStr(weekStart);
    const weekEndStr = toDateStr(weekEnd);

    const daysWorkedOut = completedDates.filter(dateStr => {
      return dateStr >= weekStartStr && dateStr <= weekEndStr;
    }).length;

    return { daysWorkedOut, totalMinutes: 0 };
  },

  async getMissedWeeklyReviews(completedDates: string[], programStartDate: string | null): Promise<number[]> {
    if (!programStartDate || completedDates.length === 0) return [];

    const startParts = programStartDate.split('-').map(Number);
    const startDate = new Date(startParts[0], startParts[1] - 1, startParts[2]);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const daysSinceStart = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
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
      const existingIndex = history.findIndex(h => h.weekNumber === entry.weekNumber);
      if (existingIndex >= 0) {
        history[existingIndex] = entry;
      } else {
        history.push(entry);
      }
      history.sort((a, b) => a.weekNumber - b.weekNumber);
      await AsyncStorage.setItem(STORAGE_KEYS.REVIEW_HISTORY, JSON.stringify(history));
    } catch (error) {
      console.error('Error saving review history:', error);
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
      if (badges.some(b => b.badgeId === badgeId)) return;
      const now = new Date();
      const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      badges.push({ badgeId, earnedDate: date });
      await AsyncStorage.setItem(STORAGE_KEYS.EARNED_BADGES, JSON.stringify(badges));
    } catch (error) {
      console.error('Error earning badge:', error);
    }
  },

  async checkAndAwardBadges(): Promise<string[]> {
    const [progress, earnedBadges, programStartDate] = await Promise.all([
      this.getProgress(),
      this.getEarnedBadges(),
      this.getProgramStartDate(),
    ]);

    const earnedIds = new Set(earnedBadges.map(b => b.badgeId));
    const newBadgeIds: string[] = [];

    const { BADGE_DEFINITIONS } = require('@/data/badges');

    for (const badge of BADGE_DEFINITIONS) {
      if (earnedIds.has(badge.id)) continue;

      let earned = false;

      switch (badge.criteria.type) {
        case 'sessions':
          earned = progress.totalSessions >= badge.criteria.value;
          break;
        case 'streak':
          earned = progress.currentStreak >= badge.criteria.value ||
                   progress.longestStreak >= badge.criteria.value;
          break;
        case 'minutes':
          earned = progress.totalMinutes >= badge.criteria.value;
          break;
        case 'phase': {
          if (programStartDate) {
            const startParts = programStartDate.split('-').map(Number);
            const start = new Date(startParts[0], startParts[1] - 1, startParts[2]);
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const daysSinceStart = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
            const completedWeeks = Math.floor(daysSinceStart / 7);
            earned = completedWeeks >= badge.criteria.value && progress.completedDates.length > 0;
          }
          break;
        }
        case 'program_complete': {
          if (programStartDate) {
            const startParts = programStartDate.split('-').map(Number);
            const start = new Date(startParts[0], startParts[1] - 1, startParts[2]);
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const daysSinceStart = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
            const completedWeeks = Math.floor(daysSinceStart / 7);
            earned = completedWeeks >= 12 && progress.completedDates.length > 0;
          }
          break;
        }
        case 'perfect_week': {
          if (programStartDate && progress.completedDates.length > 0) {
            const startParts = programStartDate.split('-').map(Number);
            const start = new Date(startParts[0], startParts[1] - 1, startParts[2]);
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const daysSinceStart = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
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
      await AsyncStorage.setItem(STORAGE_KEYS.AUDIO_SETTINGS, JSON.stringify(settings));
    } catch (error) {
      console.error('Error saving audio settings:', error);
    }
  },
};
