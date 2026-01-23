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

export const hapticsManager = {
  isSupported(): boolean {
    return Platform.OS === 'ios' || Platform.OS === 'android';
  },

  async triggerSqueeze(settings: UserSettings): Promise<void> {
    if (!settings.hapticsEnabled || !this.isSupported()) return;

    try {
      await Haptics.impactAsync(getImpactStyle(settings.hapticIntensity));
      
      if (settings.hapticIntensity === 'heavy') {
        await new Promise(resolve => setTimeout(resolve, 50));
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }
    } catch (error) {
      console.warn('Haptics error:', error);
    }
  },

  async triggerRest(settings: UserSettings): Promise<void> {
    if (!settings.hapticsEnabled || !this.isSupported()) return;
    if (settings.restCueStyle === 'none') return;

    try {
      if (settings.restCueStyle === 'light') {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } else {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.warn('Haptics error:', error);
    }
  },

  async triggerQuickFlick(settings: UserSettings): Promise<void> {
    if (!settings.hapticsEnabled || !this.isSupported()) return;

    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.warn('Haptics error:', error);
    }
  },

  async triggerElevatorStep(
    settings: UserSettings,
    step: number,
    totalSteps: number
  ): Promise<void> {
    if (!settings.hapticsEnabled || !this.isSupported()) return;

    try {
      const intensity = step / totalSteps;
      
      if (intensity <= 0.33) {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } else if (intensity <= 0.66) {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } else {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }
    } catch (error) {
      console.warn('Haptics error:', error);
    }
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

  async triggerSegmentTypeHaptic(
    segmentType: SegmentType,
    phase: 'squeeze' | 'rest',
    settings: UserSettings
  ): Promise<void> {
    if (!settings.hapticsEnabled || !this.isSupported()) return;

    if (phase === 'rest') {
      await this.triggerRest(settings);
      return;
    }

    switch (segmentType) {
      case 'quickFlicks':
        await this.triggerQuickFlick(settings);
        break;
      case 'elevator':
      case 'reverse':
        await this.triggerSqueeze(settings);
        break;
      case 'slowHolds':
      case 'breathing':
      default:
        await this.triggerSqueeze(settings);
        break;
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
