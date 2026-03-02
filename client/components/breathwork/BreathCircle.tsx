import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
  cancelAnimation,
  interpolateColor,
  SharedValue,
} from 'react-native-reanimated';
import Svg, { Rect } from 'react-native-svg';
import { BreathPhase, getBreathworkColors } from '@/constants/breathworkModes';
import { useTheme } from '@/hooks/useTheme';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

const BAR_COUNT = 13;
const BAR_WIDTH = 10;
const BAR_GAP = 6;
const MAX_HEIGHT = 160;
const MIN_HEIGHT = 16;
const CORNER_RADIUS = 5;
const GLOW_EXTEND = 6;

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

interface BreathBarProps {
  index: number;
  progress: SharedValue<number>;
  pulse: SharedValue<number>;
  centerFactor: number;
  phaseSeed: number;
  barColorDim: string;
  barColorBright: string;
  glowColor: string;
  isGlow: boolean;
}

function BreathBar({
  index, progress, pulse, centerFactor, phaseSeed,
  barColorDim, barColorBright, glowColor, isGlow,
}: BreathBarProps) {
  const barX = X_OFFSET + index * (BAR_WIDTH + BAR_GAP);

  const animatedProps = useAnimatedProps(() => {
    const p = progress.value;
    const pulseWave = Math.sin(pulse.value * Math.PI * 2 + phaseSeed);
    const holdPulse = 1 + pulseWave * 0.04 * (1 - Math.abs(p - 0.5) * 0.4);

    const heightFactor = centerFactor * 0.85 + 0.15;
    const rawHeight = MIN_HEIGHT + (MAX_HEIGHT - MIN_HEIGHT) * heightFactor * p * holdPulse;
    const height = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, rawHeight));

    const y = CENTER_Y - height / 2;

    const x = isGlow ? barX - GLOW_EXTEND / 2 : barX;
    const w = isGlow ? BAR_WIDTH + GLOW_EXTEND : BAR_WIDTH;
    const rx = isGlow ? CORNER_RADIUS + 2 : CORNER_RADIUS;

    const baseOpacity = isGlow
      ? (0.08 + p * 0.25) * (0.7 + centerFactor * 0.3) * (0.9 + pulseWave * 0.1)
      : (0.35 + p * 0.65) * (0.6 + centerFactor * 0.4);
    const opacity = Math.min(1, baseOpacity);

    const fill = isGlow
      ? glowColor
      : interpolateColor(p, [0, 1], [barColorDim, barColorBright]);

    return { x, y, width: w, height, rx, ry: rx, opacity, fill };
  });

  return <AnimatedRect animatedProps={animatedProps} />;
}

interface BreathCircleProps {
  phase: BreathPhase;
  phaseDuration: number;
  isPaused?: boolean;
}

export default function BreathCircle({ phase, phaseDuration, isPaused }: BreathCircleProps) {
  const { isDark } = useTheme();
  const colors = getBreathworkColors(isDark);

  const progress = useSharedValue(0);
  const pulse = useSharedValue(0);

  useEffect(() => {
    return () => {
      cancelAnimation(progress);
      cancelAnimation(pulse);
    };
  }, []);

  useEffect(() => {
    cancelAnimation(progress);
    cancelAnimation(pulse);

    if (isPaused) {
      return;
    }

    pulse.value = withRepeat(
      withTiming(pulse.value + 1, { duration: 2400, easing: Easing.linear }),
      -1,
      false,
    );

    const dur = phaseDuration * 1000;

    switch (phase) {
      case 'inhale':
      case 'sigh_inhale':
        progress.value = withTiming(1, {
          duration: dur,
          easing: Easing.inOut(Easing.quad),
        });
        break;

      case 'hold_top':
        progress.value = 1;
        progress.value = withRepeat(
          withSequence(
            withTiming(0.96, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
            withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
          ),
          -1,
          true,
        );
        break;

      case 'exhale':
      case 'sigh_exhale':
        progress.value = withTiming(0, {
          duration: dur,
          easing: Easing.inOut(Easing.quad),
        });
        break;

      case 'hold_bottom':
        progress.value = 0;
        progress.value = withRepeat(
          withSequence(
            withTiming(0.06, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
            withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
          ),
          -1,
          true,
        );
        break;
    }
  }, [phase, phaseDuration, isPaused]);

  const barColorDim = isDark ? colors.streamDim : colors.circleActive;
  const barColorBright = isDark ? colors.circleActive : colors.circleActive;
  const glowColor = isDark ? colors.glowActive : colors.glowActive;

  return (
    <View style={styles.container}>
      <Svg width={SVG_WIDTH} height={SVG_HEIGHT} viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}>
        {BAR_PROFILES.map((bar, i) => (
          <BreathBar
            key={`glow-${i}`}
            index={i}
            progress={progress}
            pulse={pulse}
            centerFactor={bar.centerFactor}
            phaseSeed={bar.phaseSeed}
            barColorDim={barColorDim}
            barColorBright={barColorBright}
            glowColor={glowColor}
            isGlow={true}
          />
        ))}
        {BAR_PROFILES.map((bar, i) => (
          <BreathBar
            key={`bar-${i}`}
            index={i}
            progress={progress}
            pulse={pulse}
            centerFactor={bar.centerFactor}
            phaseSeed={bar.phaseSeed}
            barColorDim={barColorDim}
            barColorBright={barColorBright}
            glowColor={glowColor}
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
    alignItems: 'center',
    justifyContent: 'center',
  },
});
