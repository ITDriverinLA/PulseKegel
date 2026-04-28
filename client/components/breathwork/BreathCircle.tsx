import React, { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  withRepeat,
  withSequence,
  cancelAnimation,
  interpolateColor,
  SharedValue,
} from "react-native-reanimated";
import Svg, { Rect } from "react-native-svg";
import { BreathPhase } from "@/constants/breathworkModes";
import { useTheme } from "@/hooks/useTheme";
import {
  ANIM_DURATION_PULSE,
  ANIM_DURATION_COLOR_CYCLE,
  ANIM_DURATION_HOLD_PULSE,
  ANIM_DURATION_HOLD_PULSE_BOTTOM,
  ANIM_EASING_LINEAR,
  ANIM_EASING_BREATH,
  ANIM_EASING_PULSE,
} from "@/constants/animation";

const AnimatedRect = Animated.createAnimatedComponent(Rect);

const BAR_COUNT = 13;
const BAR_WIDTH = 10;
const BAR_GAP = 6;
const MAX_HEIGHT = 160;
const MIN_HEIGHT = 16;
const CORNER_RADIUS = 5;
const GLOW_EXTEND = 10;

const TOTAL_WIDTH = BAR_COUNT * BAR_WIDTH + (BAR_COUNT - 1) * BAR_GAP;
const SVG_HEIGHT = MAX_HEIGHT + 60;
const SVG_WIDTH = TOTAL_WIDTH + GLOW_EXTEND * 2 + 20;
const CENTER_Y = SVG_HEIGHT / 2;
const X_OFFSET = (SVG_WIDTH - TOTAL_WIDTH) / 2;

const CENTER_INDEX = (BAR_COUNT - 1) / 2;

const BAR_PROFILES = Array.from({ length: BAR_COUNT }, (_, i) => {
  const dist = Math.abs(i - CENTER_INDEX) / CENTER_INDEX;
  const centerFactor = 1 - dist * dist;
  const phaseSeed = i * 0.47 + 1.23;
  return { centerFactor, phaseSeed };
});

const CYCLE_STOPS = [0, 0.2, 0.4, 0.6, 0.8, 1.0];

const DARK_BRIGHT = [
  "#00FFFF",
  "#00FF88",
  "#C084FC",
  "#FF3366",
  "#FCD34D",
  "#00FFFF",
];
const DARK_DIM = [
  "#0891B2",
  "#10B981",
  "#7C3AED",
  "#DB2777",
  "#D97706",
  "#0891B2",
];
const DARK_GLOW = [
  "#67E8F9",
  "#6EE7B7",
  "#D8B4FE",
  "#FDA4AF",
  "#FDE68A",
  "#67E8F9",
];

const LIGHT_BRIGHT = [
  "#0097A7",
  "#43A047",
  "#AB47BC",
  "#E91E63",
  "#F57C00",
  "#0097A7",
];
const LIGHT_DIM = [
  "#26A69A",
  "#66BB6A",
  "#9C27B0",
  "#EC407A",
  "#FB8C00",
  "#26A69A",
];
const LIGHT_GLOW = [
  "#B2DFDB",
  "#C8E6C9",
  "#E1BEE7",
  "#F8BBD0",
  "#FFE0B2",
  "#B2DFDB",
];

interface BreathBarProps {
  index: number;
  progress: SharedValue<number>;
  pulse: SharedValue<number>;
  colorCycle: SharedValue<number>;
  centerFactor: number;
  phaseSeed: number;
  brightPalette: string[];
  dimPalette: string[];
  glowPalette: string[];
  isGlow: boolean;
}

function BreathBar({
  index,
  progress,
  pulse,
  colorCycle,
  centerFactor,
  phaseSeed,
  brightPalette,
  dimPalette,
  glowPalette,
  isGlow,
}: BreathBarProps) {
  const barX = X_OFFSET + index * (BAR_WIDTH + BAR_GAP);

  const animatedProps = useAnimatedProps(() => {
    const p = progress.value;
    const c = colorCycle.value % 1;
    const pulseWave = Math.sin(pulse.value * Math.PI * 2 + phaseSeed);
    const holdPulse = 1 + pulseWave * 0.04 * (1 - Math.abs(p - 0.5) * 0.4);

    const heightFactor = centerFactor * 0.85 + 0.15;
    const rawHeight =
      MIN_HEIGHT + (MAX_HEIGHT - MIN_HEIGHT) * heightFactor * p * holdPulse;
    const height = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, rawHeight));

    const y = CENTER_Y - height / 2;

    const x = isGlow ? barX - GLOW_EXTEND / 2 : barX;
    const w = isGlow ? BAR_WIDTH + GLOW_EXTEND : BAR_WIDTH;
    const rx = isGlow ? CORNER_RADIUS + 2 : CORNER_RADIUS;

    const baseOpacity = isGlow
      ? (0.2 + p * 0.45) *
        (0.75 + centerFactor * 0.25) *
        (0.9 + pulseWave * 0.1)
      : (0.55 + p * 0.45) * (0.65 + centerFactor * 0.35);
    const opacity = Math.min(1, baseOpacity);

    const currentBright = interpolateColor(c, CYCLE_STOPS, brightPalette);
    const currentDim = interpolateColor(c, CYCLE_STOPS, dimPalette);
    const currentGlow = interpolateColor(c, CYCLE_STOPS, glowPalette);

    const fill = isGlow
      ? currentGlow
      : interpolateColor(p, [0, 1], [currentDim, currentBright]);

    return { x, y, width: w, height, rx, ry: rx, opacity, fill };
  });

  return <AnimatedRect animatedProps={animatedProps} />;
}

interface BreathCircleProps {
  phase: BreathPhase;
  phaseDuration: number;
  isPaused?: boolean;
}

export default function BreathCircle({
  phase,
  phaseDuration,
  isPaused,
}: BreathCircleProps) {
  const { isDark } = useTheme();

  const brightPalette = isDark ? DARK_BRIGHT : LIGHT_BRIGHT;
  const dimPalette = isDark ? DARK_DIM : LIGHT_DIM;
  const glowPalette = isDark ? DARK_GLOW : LIGHT_GLOW;

  const progress = useSharedValue(0);
  const pulse = useSharedValue(0);
  const colorCycle = useSharedValue(0);

  useEffect(() => {
    return () => {
      cancelAnimation(progress);
      cancelAnimation(pulse);
      cancelAnimation(colorCycle);
    };
  }, [progress, pulse, colorCycle]);

  useEffect(() => {
    cancelAnimation(progress);
    cancelAnimation(pulse);
    cancelAnimation(colorCycle);

    if (isPaused) {
      return;
    }

    pulse.value = withRepeat(
      withTiming(pulse.value + 1, {
        duration: ANIM_DURATION_PULSE,
        easing: ANIM_EASING_LINEAR,
      }),
      -1,
      false,
    );

    colorCycle.value = 0;
    colorCycle.value = withRepeat(
      withTiming(1, {
        duration: ANIM_DURATION_COLOR_CYCLE,
        easing: ANIM_EASING_LINEAR,
      }),
      -1,
      false,
    );

    const dur = phaseDuration * 1000;

    switch (phase) {
      case "inhale":
      case "sigh_inhale":
        progress.value = withTiming(1, {
          duration: dur,
          easing: ANIM_EASING_BREATH,
        });
        break;

      case "hold_top":
        progress.value = 1;
        progress.value = withRepeat(
          withSequence(
            withTiming(0.96, {
              duration: ANIM_DURATION_HOLD_PULSE,
              easing: ANIM_EASING_PULSE,
            }),
            withTiming(1, {
              duration: ANIM_DURATION_HOLD_PULSE,
              easing: ANIM_EASING_PULSE,
            }),
          ),
          -1,
          true,
        );
        break;

      case "exhale":
      case "sigh_exhale":
        progress.value = withTiming(0, {
          duration: dur,
          easing: ANIM_EASING_BREATH,
        });
        break;

      case "hold_bottom":
        progress.value = 0;
        progress.value = withRepeat(
          withSequence(
            withTiming(0.06, {
              duration: ANIM_DURATION_HOLD_PULSE_BOTTOM,
              easing: ANIM_EASING_PULSE,
            }),
            withTiming(0, {
              duration: ANIM_DURATION_HOLD_PULSE_BOTTOM,
              easing: ANIM_EASING_PULSE,
            }),
          ),
          -1,
          true,
        );
        break;
    }
  }, [phase, phaseDuration, isPaused, colorCycle, progress, pulse]);

  return (
    <View style={styles.container}>
      <Svg
        width={SVG_WIDTH}
        height={SVG_HEIGHT}
        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
      >
        {BAR_PROFILES.map((bar, i) => (
          <BreathBar
            key={`glow-${i}`}
            index={i}
            progress={progress}
            pulse={pulse}
            colorCycle={colorCycle}
            centerFactor={bar.centerFactor}
            phaseSeed={bar.phaseSeed}
            brightPalette={brightPalette}
            dimPalette={dimPalette}
            glowPalette={glowPalette}
            isGlow={true}
          />
        ))}
        {BAR_PROFILES.map((bar, i) => (
          <BreathBar
            key={`bar-${i}`}
            index={i}
            progress={progress}
            pulse={pulse}
            colorCycle={colorCycle}
            centerFactor={bar.centerFactor}
            phaseSeed={bar.phaseSeed}
            brightPalette={brightPalette}
            dimPalette={dimPalette}
            glowPalette={glowPalette}
            isGlow={false}
          />
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: SVG_WIDTH,
    height: SVG_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
});
