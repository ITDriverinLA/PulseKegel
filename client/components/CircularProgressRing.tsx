import React, { useEffect, useRef } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withTiming,
  withSequence,
  withDelay,
  cancelAnimation,
  interpolateColor,
  useAnimatedStyle,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";

import { SegmentType } from "@/data/workoutProgram";
import { useThemePreference } from "@/contexts/ThemePreferenceContext";
import {
  ANIM_DURATION_MICRO,
  ANIM_DURATION_PROGRESS_DRAIN,
  ANIM_EASING_LINEAR,
  ANIM_EASING_DRAIN,
  ANIM_EASING_PROGRESS,
} from "@/constants/animation";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface CircularProgressRingProps {
  phase: "squeeze" | "rest";
  segmentType: SegmentType;
  durationSeconds: number;
  isActive: boolean;
  size: number;
  strokeWidth?: number;
  rampSteps?: number[];
  children?: React.ReactNode;
}

const TRACK_COLOR = "rgba(0, 0, 0, 0.06)";

export function CircularProgressRing({
  phase,
  segmentType,
  durationSeconds,
  isActive,
  size,
  strokeWidth = 14,
  rampSteps,
  children,
}: CircularProgressRingProps) {
  const { cp } = useThemePreference();
  const progress = useSharedValue(0);
  const phaseKeyRef = useRef(0);

  // Squeeze phase: neonGreen (low) → neonCyan (full); rest phase: neonGreen
  const squeezeColorLow = cp.neonGreen;
  const squeezeColorHigh = cp.neonCyan;

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  useEffect(() => {
    if (!isActive) {
      cancelAnimation(progress);
      return;
    }

    phaseKeyRef.current += 1;

    if (phase === "squeeze") {
      const durationMs = durationSeconds * 1000;
      progress.value = 0;

      switch (segmentType) {
        case "quickFlicks":
          progress.value = withTiming(1, {
            duration: ANIM_DURATION_MICRO,
            easing: ANIM_EASING_DRAIN,
          });
          break;

        case "elevator":
          if (rampSteps && rampSteps.length > 0) {
            const stepDuration = durationMs / rampSteps.length;
            let animation = withTiming(rampSteps[0], {
              duration: stepDuration * 0.25,
              easing: ANIM_EASING_DRAIN,
            });

            for (let i = 1; i < rampSteps.length; i++) {
              const targetValue = i === rampSteps.length - 1 ? 1 : rampSteps[i];
              animation = withSequence(
                animation,
                withDelay(
                  stepDuration * 0.75,
                  withTiming(targetValue, {
                    duration: stepDuration * 0.25,
                    easing: ANIM_EASING_DRAIN,
                  }),
                ),
              );
            }
            progress.value = animation;
          } else {
            progress.value = withTiming(1, {
              duration: durationMs,
              easing: ANIM_EASING_LINEAR,
            });
          }
          break;

        case "contractRelax":
          progress.value = withTiming(1, {
            duration: Math.min(durationMs * 0.5, 500),
            easing: ANIM_EASING_DRAIN,
          });
          break;

        case "breathing":
        case "blockRest":
          progress.value = 0;
          break;

        case "reverse":
        case "slowHolds":
        default:
          progress.value = withTiming(1, {
            duration: durationMs * 0.95,
            easing: ANIM_EASING_PROGRESS,
          });
          break;
      }
    } else {
      cancelAnimation(progress);
      progress.value = withTiming(0, {
        duration: ANIM_DURATION_PROGRESS_DRAIN,
        easing: ANIM_EASING_DRAIN,
      });
    }
  }, [phase, segmentType, durationSeconds, isActive, progress, rampSteps]);

  const animatedProps = useAnimatedProps(() => {
    const strokeDashoffset = circumference * (1 - progress.value);
    return {
      strokeDashoffset,
      stroke: interpolateColor(
        progress.value,
        [0, 1],
        [squeezeColorLow, squeezeColorHigh],
      ),
    };
  });

  const glowStyle = useAnimatedStyle(() => {
    return {
      shadowOpacity: progress.value > 0 ? 0.4 : 0,
      shadowRadius: 12 + progress.value * 8,
      shadowColor: interpolateColor(
        progress.value,
        [0, 1],
        [squeezeColorLow, squeezeColorHigh],
      ),
    };
  });

  return (
    <Animated.View
      style={[styles.container, { width: size, height: size }, glowStyle]}
    >
      <Svg width={size} height={size} style={styles.svg}>
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={TRACK_COLOR}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <AnimatedCircle
          cx={center}
          cy={center}
          r={radius}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
          transform={`rotate(-90 ${center} ${center})`}
        />
      </Svg>
      <View style={styles.childrenContainer}>{children}</View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 0 },
  },
  svg: {
    position: "absolute",
  },
  childrenContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
});
