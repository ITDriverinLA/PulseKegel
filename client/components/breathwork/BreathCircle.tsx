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
import { BreathPhase, getBreathworkColors } from '@/constants/breathworkModes';
import { useTheme } from '@/hooks/useTheme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const CORE_RADIUS = 55;
const SVG_SIZE = 340;
const CENTER = SVG_SIZE / 2;

const ENERGY_MIN = 72;
const ENERGY_MAX = 155;

const RING_CONFIGS = [
  { count: 12, speed: 10000, direction: 1, dotSize: 3.0, opacityBase: 0.8 },
  { count: 9, speed: 15000, direction: -1, dotSize: 3.8, opacityBase: 0.6 },
  { count: 6, speed: 22000, direction: 1, dotSize: 2.6, opacityBase: 0.4 },
];

interface EnergyDotProps {
  index: number;
  count: number;
  rotation: SharedValue<number>;
  energyRadius: SharedValue<number>;
  energyProgress: SharedValue<number>;
  baseDotSize: number;
  baseOpacity: number;
  jitterOffset: number;
  colorDim: string;
  colorBright: string;
}

function EnergyDot({
  index, count, rotation, energyRadius, energyProgress,
  baseDotSize, baseOpacity, jitterOffset, colorDim, colorBright,
}: EnergyDotProps) {
  const animatedProps = useAnimatedProps(() => {
    const angle = ((index / count) * Math.PI * 2) + (rotation.value * Math.PI / 180);
    const orbitR = energyRadius.value + jitterOffset;
    const cx = CENTER + Math.cos(angle) * orbitR;
    const cy = CENTER + Math.sin(angle) * orbitR;

    const spread = (energyRadius.value - ENERGY_MIN) / (ENERGY_MAX - ENERGY_MIN);
    const dotR = baseDotSize * (1 + spread * 1.2);
    const opacity = baseOpacity * (0.4 + spread * 0.6);

    const fill = interpolateColor(
      energyProgress.value,
      [0, 1],
      [colorDim, colorBright],
    );

    return { cx, cy, r: dotR, opacity, fill };
  });

  return <AnimatedCircle animatedProps={animatedProps} />;
}

interface BreathCircleProps {
  phase: BreathPhase;
  phaseDuration: number;
  isPaused?: boolean;
}

export default function BreathCircle({ phase, phaseDuration, isPaused }: BreathCircleProps) {
  const { isDark } = useTheme();
  const colors = getBreathworkColors(isDark);

  const coreRadius = useSharedValue(CORE_RADIUS);
  const energyRadius = useSharedValue(ENERGY_MIN);
  const energyProgress = useSharedValue(0);

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
      cancelAnimation(coreRadius);
      cancelAnimation(energyRadius);
      cancelAnimation(energyProgress);
    };
  }, []);

  useEffect(() => {
    cancelAnimation(coreRadius);
    cancelAnimation(energyRadius);
    cancelAnimation(energyProgress);

    if (isPaused) {
      rotations.forEach(r => cancelAnimation(r));
      return;
    }

    const dur = phaseDuration * 1000;

    switch (phase) {
      case 'inhale':
      case 'sigh_inhale':
        coreRadius.value = CORE_RADIUS;
        energyRadius.value = withTiming(ENERGY_MIN, {
          duration: dur,
          easing: Easing.inOut(Easing.quad),
        });
        energyProgress.value = withTiming(0, {
          duration: dur,
          easing: Easing.inOut(Easing.quad),
        });
        RING_CONFIGS.forEach((ring, i) => {
          cancelAnimation(rotations[i]);
          rotations[i].value = withRepeat(
            withTiming(rotations[i].value + 360 * ring.direction, {
              duration: ring.speed,
              easing: Easing.linear,
            }),
            -1,
            false,
          );
        });
        break;

      case 'hold_top':
        energyRadius.value = ENERGY_MIN;
        energyProgress.value = 0;
        coreRadius.value = withRepeat(
          withSequence(
            withTiming(CORE_RADIUS + 3, { duration: 900, easing: Easing.inOut(Easing.ease) }),
            withTiming(CORE_RADIUS - 3, { duration: 900, easing: Easing.inOut(Easing.ease) }),
          ),
          -1,
          true,
        );
        RING_CONFIGS.forEach((ring, i) => {
          cancelAnimation(rotations[i]);
          rotations[i].value = withRepeat(
            withTiming(rotations[i].value + 360 * ring.direction, {
              duration: ring.speed * 2.5,
              easing: Easing.linear,
            }),
            -1,
            false,
          );
        });
        break;

      case 'exhale':
      case 'sigh_exhale':
        coreRadius.value = CORE_RADIUS;
        energyRadius.value = withTiming(ENERGY_MAX, {
          duration: dur,
          easing: Easing.inOut(Easing.quad),
        });
        energyProgress.value = withTiming(1, {
          duration: dur,
          easing: Easing.inOut(Easing.quad),
        });
        RING_CONFIGS.forEach((ring, i) => {
          cancelAnimation(rotations[i]);
          rotations[i].value = withRepeat(
            withTiming(rotations[i].value + 360 * ring.direction, {
              duration: ring.speed * 0.7,
              easing: Easing.linear,
            }),
            -1,
            false,
          );
        });
        break;

      case 'hold_bottom':
        energyRadius.value = ENERGY_MAX;
        energyProgress.value = 1;
        coreRadius.value = CORE_RADIUS;
        RING_CONFIGS.forEach((ring, i) => {
          cancelAnimation(rotations[i]);
          rotations[i].value = withRepeat(
            withTiming(rotations[i].value + 360 * ring.direction, {
              duration: ring.speed * 3,
              easing: Easing.linear,
            }),
            -1,
            false,
          );
        });
        break;
    }
  }, [phase, phaseDuration, isPaused]);

  const dotConfigs = useMemo(() => {
    const configs: Array<{
      ringIndex: number;
      dotIndex: number;
      count: number;
      baseDotSize: number;
      baseOpacity: number;
      jitterOffset: number;
    }> = [];

    RING_CONFIGS.forEach((ring, ri) => {
      for (let di = 0; di < ring.count; di++) {
        const jitter = Math.sin(di * 2.7 + ri * 1.3) * 8;
        configs.push({
          ringIndex: ri,
          dotIndex: di,
          count: ring.count,
          baseDotSize: ring.dotSize + Math.sin(di * 1.5) * 0.5,
          baseOpacity: ring.opacityBase + Math.cos(di * 2.1) * 0.08,
          jitterOffset: jitter,
        });
      }
    });
    return configs;
  }, []);

  const coreProps = useAnimatedProps(() => {
    const fill = interpolateColor(
      energyProgress.value,
      [0, 1],
      [colors.circleActive, colors.circleRest],
    );
    return { r: coreRadius.value, fill };
  });

  const coreGlowProps = useAnimatedProps(() => {
    const fill = interpolateColor(
      energyProgress.value,
      [0, 1],
      [colors.glowActive, colors.glowRest],
    );
    return {
      r: coreRadius.value + 10,
      fill,
      opacity: 0.35 - 0.15 * energyProgress.value,
    };
  });

  const coreOuterGlowProps = useAnimatedProps(() => {
    const fill = interpolateColor(
      energyProgress.value,
      [0, 1],
      [colors.glowActive, colors.glowRest],
    );
    return {
      r: coreRadius.value + 22,
      fill,
      opacity: 0.12 - 0.05 * energyProgress.value,
    };
  });

  return (
    <View style={styles.container}>
      <Svg width={SVG_SIZE} height={SVG_SIZE} viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}>
        <AnimatedCircle cx={CENTER} cy={CENTER} animatedProps={coreOuterGlowProps} />
        <AnimatedCircle cx={CENTER} cy={CENTER} animatedProps={coreGlowProps} />
        <AnimatedCircle cx={CENTER} cy={CENTER} opacity={0.95} animatedProps={coreProps} />
        {dotConfigs.map((cfg, i) => (
          <EnergyDot
            key={i}
            index={cfg.dotIndex}
            count={cfg.count}
            rotation={rotations[cfg.ringIndex]}
            energyRadius={energyRadius}
            energyProgress={energyProgress}
            baseDotSize={cfg.baseDotSize}
            baseOpacity={cfg.baseOpacity}
            jitterOffset={cfg.jitterOffset}
            colorDim={colors.dotDim}
            colorBright={colors.dotBright}
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
