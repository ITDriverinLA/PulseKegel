import React, { useEffect } from 'react';
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
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { BreathPhase, BREATHWORK_COLORS } from '@/constants/breathworkModes';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const MIN_RADIUS = 80;
const MAX_RADIUS = 120;
const GLOW_OFFSET = 12;

interface BreathCircleProps {
  phase: BreathPhase;
  phaseDuration: number;
  isPaused?: boolean;
}

export default function BreathCircle({ phase, phaseDuration, isPaused }: BreathCircleProps) {
  const radius = useSharedValue(MIN_RADIUS);
  const colorProgress = useSharedValue(0);

  useEffect(() => {
    if (isPaused) return;

    cancelAnimation(radius);
    cancelAnimation(colorProgress);

    switch (phase) {
      case 'inhale':
      case 'sigh_inhale':
        colorProgress.value = 0;
        radius.value = withTiming(MAX_RADIUS, {
          duration: phaseDuration * 1000,
          easing: Easing.inOut(Easing.ease),
        });
        colorProgress.value = withTiming(1, {
          duration: phaseDuration * 1000,
          easing: Easing.inOut(Easing.ease),
        });
        break;

      case 'hold_top':
        colorProgress.value = 1;
        radius.value = withRepeat(
          withSequence(
            withTiming(MAX_RADIUS + 4, { duration: 800, easing: Easing.linear }),
            withTiming(MAX_RADIUS - 4, { duration: 800, easing: Easing.linear }),
          ),
          -1,
          true,
        );
        break;

      case 'exhale':
      case 'sigh_exhale':
        colorProgress.value = 1;
        radius.value = withTiming(MIN_RADIUS, {
          duration: phaseDuration * 1000,
          easing: Easing.inOut(Easing.ease),
        });
        colorProgress.value = withTiming(0, {
          duration: phaseDuration * 1000,
          easing: Easing.inOut(Easing.ease),
        });
        break;

      case 'hold_bottom':
        colorProgress.value = 0;
        radius.value = withRepeat(
          withSequence(
            withTiming(MIN_RADIUS + 2, { duration: 1000, easing: Easing.linear }),
            withTiming(MIN_RADIUS - 2, { duration: 1000, easing: Easing.linear }),
          ),
          -1,
          true,
        );
        break;
    }
  }, [phase, phaseDuration, isPaused]);

  const innerCircleProps = useAnimatedProps(() => {
    const fill = interpolateColor(
      colorProgress.value,
      [0, 1],
      [BREATHWORK_COLORS.circle_exhale, BREATHWORK_COLORS.circle_inhale],
    );
    return {
      r: radius.value,
      fill,
    };
  });

  const glowCircleProps = useAnimatedProps(() => {
    const fill = interpolateColor(
      colorProgress.value,
      [0, 1],
      [BREATHWORK_COLORS.circle_hold_bottom, BREATHWORK_COLORS.circle_hold_top],
    );
    return {
      r: radius.value + GLOW_OFFSET,
      fill,
    };
  });

  return (
    <View style={styles.container}>
      <Svg width={300} height={300} viewBox="0 0 300 300">
        <AnimatedCircle
          cx={150}
          cy={150}
          opacity={0.25}
          animatedProps={glowCircleProps}
        />
        <AnimatedCircle
          cx={150}
          cy={150}
          opacity={0.9}
          animatedProps={innerCircleProps}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 300,
    height: 300,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
