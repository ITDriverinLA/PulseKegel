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
import Svg, { Circle, Ellipse } from 'react-native-svg';
import { BreathPhase, getBreathworkColors } from '@/constants/breathworkModes';
import { useTheme } from '@/hooks/useTheme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);

const CORE_RADIUS = 50;
const SVG_SIZE = 360;
const CENTER = SVG_SIZE / 2;

const ENERGY_MIN = 62;
const ENERGY_MAX = 165;

const RING_CONFIGS = [
  { count: 14, speed: 8000, direction: 1, streamLen: 14, streamWidth: 3.5, opacityBase: 0.85, trailCount: 3 },
  { count: 10, speed: 12000, direction: -1, streamLen: 18, streamWidth: 3.0, opacityBase: 0.65, trailCount: 2 },
  { count: 7, speed: 18000, direction: 1, streamLen: 22, streamWidth: 2.5, opacityBase: 0.5, trailCount: 2 },
  { count: 5, speed: 25000, direction: -1, streamLen: 16, streamWidth: 2.0, opacityBase: 0.35, trailCount: 1 },
];

interface PlasmaStreamProps {
  index: number;
  count: number;
  rotation: SharedValue<number>;
  energyRadius: SharedValue<number>;
  energyProgress: SharedValue<number>;
  streamLen: number;
  streamWidth: number;
  baseOpacity: number;
  radiusOffset: number;
  trailIndex: number;
  colorDim: string;
  colorBright: string;
}

function PlasmaStream({
  index, count, rotation, energyRadius, energyProgress,
  streamLen, streamWidth, baseOpacity, radiusOffset, trailIndex,
  colorDim, colorBright,
}: PlasmaStreamProps) {
  const animatedProps = useAnimatedProps(() => {
    const angle = ((index / count) * Math.PI * 2) + (rotation.value * Math.PI / 180);
    const orbitR = energyRadius.value + radiusOffset;
    const cx = CENTER + Math.cos(angle) * orbitR;
    const cy = CENTER + Math.sin(angle) * orbitR;

    const spread = (energyRadius.value - ENERGY_MIN) / (ENERGY_MAX - ENERGY_MIN);

    const tangentAngle = angle + Math.PI / 2;
    const rxVal = streamLen * (0.6 + spread * 0.8) * (1 - trailIndex * 0.15);
    const ryVal = streamWidth * (0.5 + spread * 0.6) * (1 - trailIndex * 0.1);

    const trailFade = 1 - trailIndex * 0.3;
    const opacity = baseOpacity * (0.25 + spread * 0.75) * trailFade;

    const fill = interpolateColor(
      energyProgress.value,
      [0, 1],
      [colorDim, colorBright],
    );

    const rotateDeg = (tangentAngle * 180) / Math.PI;

    return {
      cx, cy,
      rx: rxVal,
      ry: ryVal,
      opacity,
      fill,
      rotation: rotateDeg,
      originX: cx,
      originY: cy,
    };
  });

  return <AnimatedEllipse animatedProps={animatedProps} />;
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
  const rotation3 = useSharedValue(0);
  const rotations = [rotation0, rotation1, rotation2, rotation3];

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
              duration: ring.speed * 0.6,
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

  const streamConfigs = useMemo(() => {
    const configs: Array<{
      ringIndex: number;
      streamIndex: number;
      count: number;
      streamLen: number;
      streamWidth: number;
      baseOpacity: number;
      radiusOffset: number;
      trailIndex: number;
      colorLayer: number;
    }> = [];

    RING_CONFIGS.forEach((ring, ri) => {
      for (let si = 0; si < ring.count; si++) {
        for (let ti = 0; ti < ring.trailCount; ti++) {
          const radialJitter = Math.sin(si * 3.1 + ri * 2.3) * 6;
          const trailOffset = ti * (ring.streamLen * 0.3);
          configs.push({
            ringIndex: ri,
            streamIndex: si,
            count: ring.count,
            streamLen: ring.streamLen + Math.sin(si * 1.7) * 3,
            streamWidth: ring.streamWidth + Math.cos(si * 2.3) * 0.4,
            baseOpacity: ring.opacityBase + Math.cos(si * 2.1) * 0.06,
            radiusOffset: radialJitter + trailOffset,
            trailIndex: ti,
            colorLayer: ri % 2,
          });
        }
      }
    });
    return configs;
  }, []);

  const coreProps = useAnimatedProps(() => {
    const coreOpacity = 0.92 - energyProgress.value * 0.84;
    const fill = interpolateColor(
      energyProgress.value,
      [0, 0.5, 1],
      [colors.circleActive, colors.circleActive, colors.circleRest],
    );
    return { r: coreRadius.value, fill, opacity: coreOpacity };
  });

  const coreGlowProps = useAnimatedProps(() => {
    const glowOpacity = (0.4 - energyProgress.value * 0.35);
    const fill = interpolateColor(
      energyProgress.value,
      [0, 1],
      [colors.glowActive, colors.glowRest],
    );
    return {
      r: coreRadius.value + 12,
      fill,
      opacity: glowOpacity,
    };
  });

  const coreOuterGlowProps = useAnimatedProps(() => {
    const glowOpacity = (0.2 - energyProgress.value * 0.17);
    const fill = interpolateColor(
      energyProgress.value,
      [0, 1],
      [colors.glowActive, colors.glowRest],
    );
    return {
      r: coreRadius.value + 26,
      fill,
      opacity: glowOpacity,
    };
  });

  const coreRimProps = useAnimatedProps(() => {
    const rimOpacity = 0.6 - energyProgress.value * 0.45;
    return {
      r: coreRadius.value + 2,
      opacity: rimOpacity,
    };
  });

  return (
    <View style={styles.container}>
      <Svg width={SVG_SIZE} height={SVG_SIZE} viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}>
        <AnimatedCircle cx={CENTER} cy={CENTER} animatedProps={coreOuterGlowProps} />
        <AnimatedCircle cx={CENTER} cy={CENTER} animatedProps={coreGlowProps} />
        <AnimatedCircle
          cx={CENTER}
          cy={CENTER}
          animatedProps={coreRimProps}
          fill="none"
          stroke={colors.streamMid}
          strokeWidth={1.5}
        />
        <AnimatedCircle cx={CENTER} cy={CENTER} animatedProps={coreProps} />
        {streamConfigs.map((cfg, i) => (
          <PlasmaStream
            key={i}
            index={cfg.streamIndex}
            count={cfg.count}
            rotation={rotations[cfg.ringIndex]}
            energyRadius={energyRadius}
            energyProgress={energyProgress}
            streamLen={cfg.streamLen}
            streamWidth={cfg.streamWidth}
            baseOpacity={cfg.baseOpacity}
            radiusOffset={cfg.radiusOffset}
            trailIndex={cfg.trailIndex}
            colorDim={cfg.colorLayer === 0 ? colors.streamDim : colors.dotDim}
            colorBright={cfg.colorLayer === 0 ? colors.streamBright : colors.streamMid}
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
