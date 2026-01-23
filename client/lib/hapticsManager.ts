import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { SegmentType } from '@/data/workoutProgram';
import { UserSettings } from '@/lib/storage';

type HapticIntensity = 'light' | 'medium' | 'heavy';

const getImpactStyle = (
  intensity: HapticIntensity
): Haptics.ImpactFeedbackStyle => {
  switch (intensity) {
    case 'light':
      return Haptics.ImpactFeedbackStyle.Light;
    case 'medium':
      return Haptics.ImpactFeedbackStyle.Medium;
    case 'heavy':
      return Haptics.ImpactFeedbackStyle.Heavy;
    default:
      return Haptics.ImpactFeedbackStyle.Medium;
  }
};

const getTapInterval = (segmentType: SegmentType, intensity: HapticIntensity): number => {
  const baseInterval = {
    slowHolds: 600,
    quickFlicks: 150,
    elevator: 400,
    reverse: 400,
    breathing: 800,
  }[segmentType];

  const intensityMultiplier = {
    light: 1.3,
    medium: 1.0,
    heavy: 0.7,
  }[intensity];

  return Math.round(baseInterval * intensityMultiplier);
};

const getHapticStyle = (
  segmentType: SegmentType,
  intensity: HapticIntensity
): Haptics.ImpactFeedbackStyle => {
  if (segmentType === 'quickFlicks') {
    return Haptics.ImpactFeedbackStyle.Light;
  }
  
  if (segmentType === 'breathing') {
    return intensity === 'heavy' 
      ? Haptics.ImpactFeedbackStyle.Medium 
      : Haptics.ImpactFeedbackStyle.Light;
  }

  return getImpactStyle(intensity);
};

export class HapticPulseController {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private settings: UserSettings | null = null;
  private segmentType: SegmentType = 'slowHolds';

  start(segmentType: SegmentType, settings: UserSettings): void {
    if (!settings.hapticsEnabled || !hapticsManager.isSupported()) {
      return;
    }

    this.stop();
    
    this.settings = settings;
    this.segmentType = segmentType;
    this.isRunning = true;

    const interval = getTapInterval(segmentType, settings.hapticIntensity);
    const style = getHapticStyle(segmentType, settings.hapticIntensity);

    this.triggerPulse(style);

    this.intervalId = setInterval(() => {
      if (this.isRunning) {
        this.triggerPulse(style);
      }
    }, interval);
  }

  private async triggerPulse(style: Haptics.ImpactFeedbackStyle): Promise<void> {
    try {
      await Haptics.impactAsync(style);
    } catch (error) {
      console.warn('Haptics pulse error:', error);
    }
  }

  stop(): void {
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  updateSegmentType(segmentType: SegmentType): void {
    if (this.isRunning && this.settings) {
      this.start(segmentType, this.settings);
    }
  }

  isActive(): boolean {
    return this.isRunning;
  }
}

export const hapticsManager = {
  isSupported(): boolean {
    return Platform.OS === 'ios' || Platform.OS === 'android';
  },

  async triggerComplete(settings: UserSettings): Promise<void> {
    if (!settings.hapticsEnabled || !this.isSupported()) return;

    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await new Promise(resolve => setTimeout(resolve, 200));
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.warn('Haptics error:', error);
    }
  },

  async triggerSelection(): Promise<void> {
    if (!this.isSupported()) return;
    
    try {
      await Haptics.selectionAsync();
    } catch (error) {
      console.warn('Haptics error:', error);
    }
  },

  async triggerWarning(): Promise<void> {
    if (!this.isSupported()) return;
    
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } catch (error) {
      console.warn('Haptics error:', error);
    }
  },

  async triggerError(): Promise<void> {
    if (!this.isSupported()) return;
    
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } catch (error) {
      console.warn('Haptics error:', error);
    }
  },
};
