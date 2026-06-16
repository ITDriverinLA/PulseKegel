import React, { useEffect, useRef } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSequence,
  withDelay,
  cancelAnimation,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";

import { SegmentType } from "@/data/workoutProgram";
import { useThemePreference } from "@/contexts/ThemePreferenceContext";
import {
  ANIM_DURATION_MICRO,
  ANIM_DURATION_PROGRESS_DRAIN,
  ANIM_EASING_LINEAR,
  ANIM_EASING_DRAIN,
  ANIM_EASING_PROGRESS,
} from "@/constants/animation";

interface PowerBarProps {
  phase: "squeeze" | "rest";
  segmentType: SegmentType;
  durationSeconds: number;
  isActive: boolean;
  height: number;
  width?: number;
  rampSteps?: number[];
}

const SEGMENT_COUNT = 15;
const SEGMENT_GAP = 3;

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function buildSegmentColors(
  neonGreen: string,
  neonCyan: string,
  neonPink: string,
): string[] {
  return [
    neonGreen,
    neonGreen,
    neonGreen,
    neonGreen,
    neonGreen,
    neonGreen,
    neonCyan,
    neonCyan,
    neonCyan,
    neonCyan,
    neonCyan,
    neonPink,
    neonPink,
    neonPink,
    neonPink,
  ];
}

function buildSegmentGlowColors(
  neonGreen: string,
  neonCyan: string,
  neonPink: string,
): string[] {
  return [
    hexToRgba(neonGreen, 0.6),
    hexToRgba(neonGreen, 0.6),
    hexToRgba(neonGreen, 0.6),
    hexToRgba(neonGreen, 0.6),
    hexToRgba(neonGreen, 0.6),
    hexToRgba(neonGreen, 0.6),
    hexToRgba(neonCyan, 0.6),
    hexToRgba(neonCyan, 0.6),
    hexToRgba(neonCyan, 0.6),
    hexToRgba(neonCyan, 0.6),
    hexToRgba(neonCyan, 0.6),
    hexToRgba(neonPink, 0.6),
    hexToRgba(neonPink, 0.6),
    hexToRgba(neonPink, 0.6),
    hexToRgba(neonPink, 0.6),
  ];
}

function PowerBarSegment({
  index,
  progress,
  segmentHeight,
  width,
  inactiveColor,
  segmentColors,
  segmentGlowColors,
}: {
  index: number;
  progress: { value: number };
  segmentHeight: number;
  width: number;
  inactiveColor: string;
  segmentColors: string[];
  segmentGlowColors: string[];
}) {
  const threshold = (index + 0.5) / SEGMENT_COUNT;

  const animatedStyle = useAnimatedStyle(() => {
    const isLit = progress.value >= threshold;
    return {
      backgroundColor: isLit ? segmentColors[index] : inactiveColor,
      shadowColor: isLit ? segmentGlowColors[index] : "transparent",
      shadowOpacity: isLit ? 1 : 0,
      shadowRadius: isLit ? 12 : 0,
      shadowOffset: { width: 0, height: 0 },
      transform: [{ scale: isLit ? 1.02 : 1 }],
    };
  });

  return (
    <Animated.View
      style={[
        styles.segment,
        {
          height: segmentHeight,
          width: width - 24,
          borderRadius: 3,
        },
        animatedStyle,
      ]}
    />
  );
}

export function PowerBar({
  phase,
  segmentType,
  durationSeconds,
  isActive,
  height,
  width = 140,
  rampSteps,
}: PowerBarProps) {
  const { isDarkMode, cp } = useThemePreference();
  const progress = useSharedValue(0);
  const segmentHeight =
    (height - (SEGMENT_COUNT - 1) * SEGMENT_GAP - 32) / SEGMENT_COUNT;
  const phaseKeyRef = useRef(0);

  const segmentColors = buildSegmentColors(
    cp.neonGreen,
    cp.neonCyan,
    cp.neonPink,
  );
  const segmentGlowColors = buildSegmentGlowColors(
    cp.neonGreen,
    cp.neonCyan,
    cp.neonPink,
  );

  const inactiveColor = isDarkMode
    ? "rgba(20, 20, 30, 0.9)"
    : "rgba(200, 205, 218, 0.6)";
  const outerBezelColors = isDarkMode
    ? (["#1a1a2e", "#16213e", "#0f0f23"] as const)
    : (["#d8dce6", "#cdd2de", "#c4c9d6"] as const);
  const innerBezelColors = isDarkMode
    ? (["#0a0a14", "#0d0d1a", "#050510"] as const)
    : (["#e8ecf2", "#e2e6ee", "#dde1ea"] as const);
  const outerBorderColor = isDarkMode ? "#2a2a4a" : "#b8bdd0";
  const bezelRingBorderColor = isDarkMode ? "#3a3a5a" : "#c8cdd8";
  const bezelRingBg = isDarkMode ? "#1a1a2e" : "#d4d8e2";
  const innerBorderColor = isDarkMode ? "#1a1a2e" : "#cdd2de";

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
          progress.value = withTiming(1.05, {
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
              const targetValue =
                i === rampSteps.length - 1 ? 1.05 : rampSteps[i];
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
            progress.value = withTiming(1.05, {
              duration: durationMs,
              easing: ANIM_EASING_LINEAR,
            });
          }
          break;

        case "contractRelax":
          progress.value = withTiming(1.05, {
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
          progress.value = withTiming(1.05, {
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

  const segments = [];
  for (let i = SEGMENT_COUNT - 1; i >= 0; i--) {
    segments.push(
      <PowerBarSegment
        key={i}
        index={i}
        progress={progress}
        segmentHeight={segmentHeight}
        width={width}
        inactiveColor={inactiveColor}
        segmentColors={segmentColors}
        segmentGlowColors={segmentGlowColors}
      />,
    );
  }

  return (
    <View style={[styles.container, { height, width }]}>
      <LinearGradient
        colors={outerBezelColors as unknown as [string, string, ...string[]]}
        style={[styles.outerBezel, { borderColor: outerBorderColor }]}
      >
        <View
          style={[
            styles.bezelRing,
            { borderColor: bezelRingBorderColor, backgroundColor: bezelRingBg },
          ]}
        >
          <LinearGradient
            colors={
              innerBezelColors as unknown as [string, string, ...string[]]
            }
            style={[styles.innerBezel, { borderColor: innerBorderColor }]}
          >
            <View style={styles.segmentsContainer}>{segments}</View>
          </LinearGradient>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  outerBezel: {
    flex: 1,
    width: "100%",
    borderRadius: 16,
    padding: 4,
    borderWidth: 2,
  },
  bezelRing: {
    flex: 1,
    borderRadius: 12,
    padding: 3,
    borderWidth: 1,
  },
  innerBezel: {
    flex: 1,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  segmentsContainer: {
    flex: 1,
    gap: SEGMENT_GAP,
    justifyContent: "space-between",
  },
  segment: {
    alignSelf: "center",
  },
});
