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
import Svg, { Circle } from 'react-native-svg';
import { BreathPhase, BREATHWORK_COLORS } from '@/constants/breathworkModes';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const MIN_RADIUS = 80;
const MAX_RADIUS = 120;
const SVG_SIZE = 340;
const CENTER = SVG_SIZE / 2;

const RING_CONFIGS = [
  { count: 10, offsetBase: 10, speed: 12000, direction: 1, dotSize: 2.5, opacityBase: 0.6 },
  { count: 7, offsetBase: 24, speed: 18000, direction: -1, dotSize: 3.5, opacityBase: 0.4 },
  { count: 5, offsetBase: 40, speed: 26000, direction: 1, dotSize: 2, opacityBase: 0.28 },
];

interface OrbitDotProps {
  index: number;
  count: number;
  rotation: SharedValue<number>;
  circleRadius: SharedValue<number>;
  colorProgress: SharedValue<number>;
  orbitOffset: number;
  dotRadius: number;
  baseOpacity: number;
  jitterOffset: number;
}

function OrbitDotSimple({
  index, count, rotation, circleRadius, colorProgress,
  orbitOffset, dotRadius, baseOpacity, jitterOffset,
}: OrbitDotProps) {
  const animatedProps = useAnimatedProps(() => {
    const angle = ((index / count) * Math.PI * 2) + (rotation.value * Math.PI / 180);
    const orbitR = circleRadius.value + orbitOffset + jitterOffset;
    const cx = CENTER + Math.cos(angle) * orbitR;
    const cy = CENTER + Math.sin(angle) * orbitR;
    const opacity = baseOpacity * (0.4 + 0.6 * colorProgress.value);
    const fill = interpolateColor(
      colorProgress.value,
      [0, 1],
      ['#1A6B75', '#00E5FF'],
    );
    return { cx, cy, r: dotRadius, opacity, fill };
  });

  return <AnimatedCircle animatedProps={animatedProps} />;
}

interface BreathCircleProps {
  phase: BreathPhase;
  phaseDuration: number;
  isPaused?: boolean;
}

export default function BreathCircle({ phase, phaseDuration, isPaused }: BreathCircleProps) {
  const radius = useSharedValue(MIN_RADIUS);
  const colorProgress = useSharedValue(0);

  const rotation0 = useSharedValue(0);
  const rotation1 = useSharedValue(0);
  const rotation2 = useSharedValue(0);
  const rotations = [rotation0, rotation1, rotation2];

  useEffect(() => {
    RING_CONFIGS.forEach((ring, i) => {
      rotations[i].value = 0;
      rotations[i].value = withRepeat(
        withTiming(360 * ring.direction, {
          duration: ring.speed,
          easing: Easing.linear,
        }),
        -1,
        false,
      );
    });
    return () => {
      rotations.forEach(r => cancelAnimation(r));
    };
  }, []);

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

  const dotConfigs = useMemo(() => {
    const configs: Array<{
      ringIndex: number;
      dotIndex: number;
      count: number;
      orbitOffset: number;
      dotRadius: number;
      baseOpacity: number;
      jitterOffset: number;
    }> = [];

    RING_CONFIGS.forEach((ring, ri) => {
      for (let di = 0; di < ring.count; di++) {
        const jitter = Math.sin(di * 2.7 + ri * 1.3) * 6;
        configs.push({
          ringIndex: ri,
          dotIndex: di,
          count: ring.count,
          orbitOffset: ring.offsetBase,
          dotRadius: ring.dotSize + Math.sin(di * 1.5) * 0.8,
          baseOpacity: ring.opacityBase + Math.cos(di * 2.1) * 0.1,
          jitterOffset: jitter,
        });
      }
    });
    return configs;
  }, []);

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
      r: radius.value + 14,
      fill,
    };
  });

  const outerGlowProps = useAnimatedProps(() => {
    const fill = interpolateColor(
      colorProgress.value,
      [0, 1],
      [BREATHWORK_COLORS.circle_hold_bottom, BREATHWORK_COLORS.circle_hold_top],
    );
    return {
      r: radius.value + 28,
      fill,
      opacity: 0.08 + 0.07 * colorProgress.value,
    };
  });

  return (
    <View style={styles.container}>
      <Svg width={SVG_SIZE} height={SVG_SIZE} viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}>
        <AnimatedCircle cx={CENTER} cy={CENTER} animatedProps={outerGlowProps} />
        <AnimatedCircle cx={CENTER} cy={CENTER} opacity={0.2} animatedProps={glowCircleProps} />
        <AnimatedCircle cx={CENTER} cy={CENTER} opacity={0.9} animatedProps={innerCircleProps} />
        {dotConfigs.map((cfg, i) => (
          <OrbitDotSimple
            key={i}
            index={cfg.dotIndex}
            count={cfg.count}
            rotation={rotations[cfg.ringIndex]}
            circleRadius={radius}
            colorProgress={colorProgress}
            orbitOffset={cfg.orbitOffset}
            dotRadius={cfg.dotRadius}
            baseOpacity={cfg.baseOpacity}
            jitterOffset={cfg.jitterOffset}
          />
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: SVG_SIZE,
    height: SVG_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
