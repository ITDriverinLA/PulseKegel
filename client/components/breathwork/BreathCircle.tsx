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
import { BreathPhase } from '@/constants/breathworkModes';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const MIN_RADIUS = 80;
const MAX_RADIUS = 120;
const SVG_SIZE = 340;
const CENTER = SVG_SIZE / 2;

const COLORS = {
  circleRest: '#0F3443',
  circleActive: '#00D4E8',
  glowRest: '#163B4E',
  glowActive: '#7EEAF6',
  dotDim: '#2E8B9A',
  dotBright: '#00FFEA',
};

const RING_CONFIGS = [
  { count: 8, orbitScale: 1.14, speed: 11000, direction: 1, dotSize: 3.2, opacityBase: 0.75 },
  { count: 6, orbitScale: 1.28, speed: 16000, direction: -1, dotSize: 4.0, opacityBase: 0.55 },
  { count: 4, orbitScale: 1.42, speed: 23000, direction: 1, dotSize: 2.8, opacityBase: 0.38 },
];

interface OrbitDotProps {
  index: number;
  count: number;
  rotation: SharedValue<number>;
  circleRadius: SharedValue<number>;
  colorProgress: SharedValue<number>;
  orbitScale: number;
  dotRadius: number;
  baseOpacity: number;
  jitterScale: number;
}

function OrbitDot({
  index, count, rotation, circleRadius, colorProgress,
  orbitScale, dotRadius, baseOpacity, jitterScale,
}: OrbitDotProps) {
  const animatedProps = useAnimatedProps(() => {
    const angle = ((index / count) * Math.PI * 2) + (rotation.value * Math.PI / 180);
    const orbitR = circleRadius.value * orbitScale * jitterScale;
    const cx = CENTER + Math.cos(angle) * orbitR;
    const cy = CENTER + Math.sin(angle) * orbitR;
    const opacity = baseOpacity * (0.5 + 0.5 * colorProgress.value);
    const fill = interpolateColor(
      colorProgress.value,
      [0, 1],
      [COLORS.dotDim, COLORS.dotBright],
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
          easing: Easing.out(Easing.quad),
        });
        colorProgress.value = withTiming(1, {
          duration: phaseDuration * 1000,
          easing: Easing.out(Easing.quad),
        });
        break;

      case 'hold_top':
        colorProgress.value = 1;
        radius.value = withRepeat(
          withSequence(
            withTiming(MAX_RADIUS + 4, { duration: 800, easing: Easing.inOut(Easing.ease) }),
            withTiming(MAX_RADIUS - 4, { duration: 800, easing: Easing.inOut(Easing.ease) }),
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
          easing: Easing.out(Easing.quad),
        });
        colorProgress.value = withTiming(0, {
          duration: phaseDuration * 1000,
          easing: Easing.out(Easing.quad),
        });
        break;

      case 'hold_bottom':
        colorProgress.value = 0;
        radius.value = withRepeat(
          withSequence(
            withTiming(MIN_RADIUS + 2, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
            withTiming(MIN_RADIUS - 2, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
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
      orbitScale: number;
      dotRadius: number;
      baseOpacity: number;
      jitterScale: number;
    }> = [];

    RING_CONFIGS.forEach((ring, ri) => {
      for (let di = 0; di < ring.count; di++) {
        const jitter = 1.0 + Math.sin(di * 2.7 + ri * 1.3) * 0.04;
        configs.push({
          ringIndex: ri,
          dotIndex: di,
          count: ring.count,
          orbitScale: ring.orbitScale,
          dotRadius: ring.dotSize + Math.sin(di * 1.5) * 0.6,
          baseOpacity: ring.opacityBase + Math.cos(di * 2.1) * 0.08,
          jitterScale: jitter,
        });
      }
    });
    return configs;
  }, []);

  const innerCircleProps = useAnimatedProps(() => {
    const fill = interpolateColor(
      colorProgress.value,
      [0, 1],
      [COLORS.circleRest, COLORS.circleActive],
    );
    return { r: radius.value, fill };
  });

  const glowCircleProps = useAnimatedProps(() => {
    const fill = interpolateColor(
      colorProgress.value,
      [0, 1],
      [COLORS.glowRest, COLORS.glowActive],
    );
    return {
      r: radius.value + 14,
      fill,
      opacity: 0.18 + 0.12 * colorProgress.value,
    };
  });

  const outerGlowProps = useAnimatedProps(() => {
    const fill = interpolateColor(
      colorProgress.value,
      [0, 1],
      [COLORS.glowRest, COLORS.glowActive],
    );
    return {
      r: radius.value + 30,
      fill,
      opacity: 0.06 + 0.08 * colorProgress.value,
    };
  });

  return (
    <View style={styles.container}>
      <Svg width={SVG_SIZE} height={SVG_SIZE} viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}>
        <AnimatedCircle cx={CENTER} cy={CENTER} animatedProps={outerGlowProps} />
        <AnimatedCircle cx={CENTER} cy={CENTER} animatedProps={glowCircleProps} />
        <AnimatedCircle cx={CENTER} cy={CENTER} opacity={0.9} animatedProps={innerCircleProps} />
        {dotConfigs.map((cfg, i) => (
          <OrbitDot
            key={i}
            index={cfg.dotIndex}
            count={cfg.count}
            rotation={rotations[cfg.ringIndex]}
            circleRadius={radius}
            colorProgress={colorProgress}
            orbitScale={cfg.orbitScale}
            dotRadius={cfg.dotRadius}
            baseOpacity={cfg.baseOpacity}
            jitterScale={cfg.jitterScale}
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
