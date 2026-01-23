import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEYS = {
  COMPLETED_DATES: 'pulsekegel_completed_dates',
  TOTAL_SESSIONS: 'pulsekegel_total_sessions',
  TOTAL_MINUTES: 'pulsekegel_total_minutes',
  SETTINGS: 'pulsekegel_settings',
  ONBOARDING_COMPLETE: 'pulsekegel_onboarding_complete',
  PROGRAM_START_DATE: 'pulsekegel_program_start_date',
};

export interface UserSettings {
  hapticsEnabled: boolean;
  hapticIntensity: 'light' | 'medium' | 'heavy';
  restCueStyle: 'none' | 'light' | 'normal';
  highContrastMode: boolean;
  largeTextMode: boolean;
  recoveryMode: boolean;
}

export const defaultSettings: UserSettings = {
  hapticsEnabled: true,
  hapticIntensity: 'medium',
  restCueStyle: 'light',
  highContrastMode: false,
  largeTextMode: false,
  recoveryMode: false,
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
  return date.toISOString().split('T')[0];
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
};
