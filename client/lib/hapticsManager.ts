import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { SegmentType } from '@/data/workoutProgram';
import { UserSettings } from '@/lib/storage';

type HapticIntensity = 'light' | 'medium' | 'heavy';

const getTapInterval = (segmentType: SegmentType, intensity: HapticIntensity): number => {
  const baseIntervalMap: Record<SegmentType, number> = {
    slowHolds: 500,
    quickFlicks: 120,
    elevator: 350,
    reverse: 400,
    breathing: 700,
    blockRest: 0,
    contractRelax: 300,
  };
  
  const baseInterval = baseIntervalMap[segmentType];

  const intensityMultiplier = {
    light: 1.3,
    medium: 1.0,
    heavy: 0.7,
  }[intensity];

  return Math.round(baseInterval * intensityMultiplier);
};

const getProgressBasedStyle = (
  progress: number,
  baseIntensity: HapticIntensity
): Haptics.ImpactFeedbackStyle => {
  if (progress < 0.33) {
    return Haptics.ImpactFeedbackStyle.Light;
  } else if (progress < 0.66) {
    return baseIntensity === 'light' 
      ? Haptics.ImpactFeedbackStyle.Light 
      : Haptics.ImpactFeedbackStyle.Medium;
  } else {
    switch (baseIntensity) {
      case 'light':
        return Haptics.ImpactFeedbackStyle.Medium;
      case 'medium':
        return Haptics.ImpactFeedbackStyle.Heavy;
      case 'heavy':
        return Haptics.ImpactFeedbackStyle.Heavy;
      default:
        return Haptics.ImpactFeedbackStyle.Heavy;
    }
  }
};

export class HapticPulseController {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private settings: UserSettings | null = null;
  private segmentType: SegmentType = 'slowHolds';
  private startTime: number = 0;
  private durationMs: number = 0;
  private rampSteps: number[] | undefined;

  start(
    segmentType: SegmentType, 
    settings: UserSettings, 
    durationSeconds: number = 5,
    rampSteps?: number[]
  ): void {
    if (!settings.hapticsEnabled || !hapticsManager.isSupported()) {
      return;
    }

    this.stop();
    
    this.settings = settings;
    this.segmentType = segmentType;
    this.isRunning = true;
    this.startTime = Date.now();
    this.durationMs = durationSeconds * 1000;
    this.rampSteps = rampSteps;
    
    if (segmentType === 'blockRest') {
      return;
    }

    const interval = getTapInterval(segmentType, settings.hapticIntensity);
    
    this.triggerProgressPulse();

    this.intervalId = setInterval(() => {
      if (this.isRunning) {
        this.triggerProgressPulse();
      }
    }, interval);
  }

  private calculateProgress(): number {
    if (this.durationMs <= 0) return 0;
    
    const elapsed = Date.now() - this.startTime;
    let progress = Math.min(elapsed / this.durationMs, 1);

    switch (this.segmentType) {
      case 'quickFlicks':
        return 1;

      case 'elevator':
        if (this.rampSteps && this.rampSteps.length > 0) {
          const stepDuration = this.durationMs / this.rampSteps.length;
          const currentStep = Math.floor(elapsed / stepDuration);
          const clampedStep = Math.min(currentStep, this.rampSteps.length - 1);
          return this.rampSteps[clampedStep];
        }
        return progress;

      case 'contractRelax':
        return Math.min(elapsed / (this.durationMs * 0.5), 1);

      case 'breathing':
        return progress * 0.65;

      case 'reverse':
      case 'slowHolds':
      default:
        return progress;
    }
  }

  private async triggerProgressPulse(): Promise<void> {
    if (!this.settings) return;
    
    try {
      const progress = this.calculateProgress();
      const style = getProgressBasedStyle(progress, this.settings.hapticIntensity);
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

  updateSegmentType(segmentType: SegmentType, durationSeconds: number = 5, rampSteps?: number[]): void {
    if (this.isRunning && this.settings) {
      this.start(segmentType, this.settings, durationSeconds, rampSteps);
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
