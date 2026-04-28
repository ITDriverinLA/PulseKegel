import * as Haptics from "expo-haptics";
import { Platform } from "react-native";
import { SegmentType } from "@/data/workoutProgram";
import { UserSettings } from "@/lib/storage";

type HapticIntensity = "light" | "medium" | "heavy";

interface PatternConfig {
  baseInterval: number;
  burstCount: number;
  burstGap: number;
  groupPause: number;
  progressiveSpeed: boolean;
  progressiveIntensity: boolean;
}

const PATTERN_CONFIGS: Record<SegmentType, PatternConfig> = {
  slowHolds: {
    baseInterval: 450,
    burstCount: 1,
    burstGap: 0,
    groupPause: 0,
    progressiveSpeed: false,
    progressiveIntensity: true,
  },
  quickFlicks: {
    baseInterval: 80,
    burstCount: 3,
    burstGap: 60,
    groupPause: 150,
    progressiveSpeed: false,
    progressiveIntensity: false,
  },
  elevator: {
    baseInterval: 350,
    burstCount: 2,
    burstGap: 80,
    groupPause: 300,
    progressiveSpeed: true,
    progressiveIntensity: true,
  },
  reverse: {
    baseInterval: 600,
    burstCount: 1,
    burstGap: 0,
    groupPause: 0,
    progressiveSpeed: false,
    progressiveIntensity: false,
  },
  breathing: {
    baseInterval: 900,
    burstCount: 1,
    burstGap: 0,
    groupPause: 0,
    progressiveSpeed: false,
    progressiveIntensity: false,
  },
  blockRest: {
    baseInterval: 0,
    burstCount: 0,
    burstGap: 0,
    groupPause: 0,
    progressiveSpeed: false,
    progressiveIntensity: false,
  },
  contractRelax: {
    baseInterval: 200,
    burstCount: 2,
    burstGap: 100,
    groupPause: 400,
    progressiveSpeed: false,
    progressiveIntensity: true,
  },
  getReady: {
    baseInterval: 0,
    burstCount: 0,
    burstGap: 0,
    groupPause: 0,
    progressiveSpeed: false,
    progressiveIntensity: false,
  },
};

const getIntensityMultiplier = (intensity: HapticIntensity): number => {
  return { light: 1.4, medium: 1.0, heavy: 0.7 }[intensity];
};

const getProgressBasedStyle = (
  progress: number,
  baseIntensity: HapticIntensity,
  segmentType: SegmentType,
): Haptics.ImpactFeedbackStyle => {
  if (segmentType === "reverse" || segmentType === "breathing") {
    return Haptics.ImpactFeedbackStyle.Light;
  }

  if (segmentType === "quickFlicks") {
    return baseIntensity === "heavy"
      ? Haptics.ImpactFeedbackStyle.Medium
      : Haptics.ImpactFeedbackStyle.Light;
  }

  if (progress < 0.33) {
    return Haptics.ImpactFeedbackStyle.Light;
  } else if (progress < 0.66) {
    return baseIntensity === "light"
      ? Haptics.ImpactFeedbackStyle.Light
      : Haptics.ImpactFeedbackStyle.Medium;
  } else {
    switch (baseIntensity) {
      case "light":
        return Haptics.ImpactFeedbackStyle.Medium;
      case "medium":
      case "heavy":
        return Haptics.ImpactFeedbackStyle.Heavy;
      default:
        return Haptics.ImpactFeedbackStyle.Heavy;
    }
  }
};

export class HapticPulseController {
  private mainTimeoutId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private settings: UserSettings | null = null;
  private segmentType: SegmentType = "slowHolds";
  private startTime: number = 0;
  private durationMs: number = 0;
  private rampSteps: number[] | undefined;
  private hasTriggeredPeakCue = false;
  private pulseCount = 0;

  start(
    segmentType: SegmentType,
    settings: UserSettings,
    durationSeconds: number = 5,
    rampSteps?: number[],
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
    this.hasTriggeredPeakCue = false;
    this.pulseCount = 0;

    if (segmentType === "blockRest" || segmentType === "breathing") {
      return;
    }

    this.triggerStartCue();

    setTimeout(() => {
      if (this.isRunning) {
        this.scheduleNextPattern();
      }
    }, 150);
  }

  private async triggerStartCue(): Promise<void> {
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } catch (error) {
      console.warn("Haptic start cue error:", error);
    }
  }

  private async triggerPeakCue(): Promise<void> {
    if (this.hasTriggeredPeakCue) return;
    this.hasTriggeredPeakCue = true;

    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      await new Promise((resolve) => setTimeout(resolve, 50));
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } catch (error) {
      console.warn("Haptic peak cue error:", error);
    }
  }

  private calculateProgress(): number {
    if (this.durationMs <= 0) return 0;

    const elapsed = Date.now() - this.startTime;
    let progress = Math.min(elapsed / this.durationMs, 1);

    switch (this.segmentType) {
      case "quickFlicks":
        return 1;

      case "elevator":
        if (this.rampSteps && this.rampSteps.length > 0) {
          const stepDuration = this.durationMs / this.rampSteps.length;
          const currentStep = Math.floor(elapsed / stepDuration);
          const clampedStep = Math.min(currentStep, this.rampSteps.length - 1);
          return this.rampSteps[clampedStep];
        }
        return progress;

      case "contractRelax":
        return Math.min(elapsed / (this.durationMs * 0.5), 1);

      case "breathing":
        return progress * 0.5;

      case "reverse":
        return 0.3;

      case "slowHolds":
      default:
        return progress;
    }
  }

  private async scheduleNextPattern(): Promise<void> {
    if (!this.isRunning || !this.settings) return;

    const config = PATTERN_CONFIGS[this.segmentType];
    const progress = this.calculateProgress();
    const intensityMultiplier = getIntensityMultiplier(
      this.settings.hapticIntensity,
    );

    if (
      progress >= 0.9 &&
      !this.hasTriggeredPeakCue &&
      this.segmentType !== "quickFlicks"
    ) {
      await this.triggerPeakCue();
    }

    let speedFactor = 1;
    if (config.progressiveSpeed) {
      speedFactor = 1 - progress * 0.4;
    }

    const style = getProgressBasedStyle(
      progress,
      this.settings.hapticIntensity,
      this.segmentType,
    );

    for (let i = 0; i < config.burstCount; i++) {
      if (!this.isRunning) return;

      try {
        await Haptics.impactAsync(style);
      } catch (error) {
        console.warn("Haptics pulse error:", error);
      }

      if (i < config.burstCount - 1 && config.burstGap > 0) {
        await new Promise((resolve) =>
          setTimeout(resolve, config.burstGap * speedFactor),
        );
      }
    }

    this.pulseCount++;

    if (!this.isRunning) return;

    let nextInterval = config.baseInterval * intensityMultiplier * speedFactor;

    if (config.groupPause > 0 && this.pulseCount % 3 === 0) {
      nextInterval += config.groupPause;
    }

    this.mainTimeoutId = setTimeout(() => {
      this.scheduleNextPattern();
    }, nextInterval);
  }

  stop(): void {
    this.isRunning = false;
    if (this.mainTimeoutId) {
      clearTimeout(this.mainTimeoutId);
      this.mainTimeoutId = null;
    }
  }

  async triggerTransitionCue(): Promise<void> {
    if (!this.settings?.hapticsEnabled || !hapticsManager.isSupported()) return;

    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await new Promise((resolve) => setTimeout(resolve, 80));
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.warn("Haptic transition cue error:", error);
    }
  }

  updateSegmentType(
    segmentType: SegmentType,
    durationSeconds: number = 5,
    rampSteps?: number[],
  ): void {
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
    return Platform.OS === "ios" || Platform.OS === "android";
  },

  async triggerComplete(settings: UserSettings): Promise<void> {
    if (!settings.hapticsEnabled || !this.isSupported()) return;

    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await new Promise((resolve) => setTimeout(resolve, 150));
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await new Promise((resolve) => setTimeout(resolve, 150));
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.warn("Haptics error:", error);
    }
  },

  async triggerSelection(): Promise<void> {
    if (!this.isSupported()) return;

    try {
      await Haptics.selectionAsync();
    } catch (error) {
      console.warn("Haptics error:", error);
    }
  },

  async triggerWarning(): Promise<void> {
    if (!this.isSupported()) return;

    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } catch (error) {
      console.warn("Haptics error:", error);
    }
  },

  async triggerError(): Promise<void> {
    if (!this.isSupported()) return;

    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } catch (error) {
      console.warn("Haptics error:", error);
    }
  },

  async triggerPhaseTransition(settings: UserSettings): Promise<void> {
    if (!settings.hapticsEnabled || !this.isSupported()) return;

    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await new Promise((resolve) => setTimeout(resolve, 100));
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (error) {
      console.warn("Haptics error:", error);
    }
  },
};
