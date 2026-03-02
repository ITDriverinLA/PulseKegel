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
import Svg, { Circle, Ellipse, Line } from 'react-native-svg';
import { BreathPhase, getBreathworkColors } from '@/constants/breathworkModes';
import { useTheme } from '@/hooks/useTheme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);
const AnimatedLine = Animated.createAnimatedComponent(Line);

const CORE_RADIUS = 50;
const SVG_SIZE = 360;
const CENTER = SVG_SIZE / 2;

const ENERGY_MIN = 62;
const ENERGY_MAX = 165;

const RING_CONFIGS = [
  { count: 12, speed: 8000, direction: 1, streamLen: 16, streamWidth: 4.5, opacityBase: 0.95, trailCount: 2 },
  { count: 9, speed: 13000, direction: -1, streamLen: 20, streamWidth: 4.0, opacityBase: 0.85, trailCount: 2 },
  { count: 6, speed: 19000, direction: 1, streamLen: 24, streamWidth: 3.5, opacityBase: 0.75, trailCount: 1 },
  { count: 4, speed: 26000, direction: -1, streamLen: 18, streamWidth: 3.0, opacityBase: 0.65, trailCount: 1 },
];

const COLOR_KEYS: Array<{ dim: string; bright: string }> = [
  { dim: 'plasma1Dim', bright: 'plasma1Bright' },
  { dim: 'plasma2Dim', bright: 'plasma2Bright' },
  { dim: 'plasma3Dim', bright: 'plasma3Bright' },
  { dim: 'plasma4Dim', bright: 'plasma4Bright' },
];

interface PlasmaStreamProps {
  index: number;
  count: number;
  rotation: SharedValue<number>;
  energyRadius: SharedValue<number>;
  energyProgress: SharedValue<number>;
  pulse: SharedValue<number>;
  flow: SharedValue<number>;
  streamLen: number;
  streamWidth: number;
  baseOpacity: number;
  radiusOffset: number;
  trailIndex: number;
  pulseSeed: number;
  colorDim: string;
  colorBright: string;
}

function PlasmaStream({
  index, count, rotation, energyRadius, energyProgress, pulse, flow,
  streamLen, streamWidth, baseOpacity, radiusOffset, trailIndex, pulseSeed,
  colorDim, colorBright,
}: PlasmaStreamProps) {
  const animatedProps = useAnimatedProps(() => {
    const angle = ((index / count) * Math.PI * 2) + (rotation.value * Math.PI / 180);

    const pulseWave = Math.sin(pulse.value * Math.PI * 2 + pulseSeed);
    const pulseScale = 1 + pulseWave * 0.18;
    const pulseRadial = pulseWave * 4;

    const flowPhase = flow.value * Math.PI * 2;
    const flowWaveA = Math.sin(flowPhase * 1.3 + pulseSeed * 2.1);
    const flowWaveB = Math.cos(flowPhase * 0.7 + pulseSeed * 1.4);
    const flowRadial = flowWaveA * 6;
    const flowStretch = 1 + flowWaveB * 0.25;
    const flowSquash = 1 + flowWaveA * 0.3;
    const flowAngleWobble = flowWaveB * 0.15;

    const orbitR = energyRadius.value + radiusOffset + pulseRadial + flowRadial;
    const cx = CENTER + Math.cos(angle) * orbitR;
    const cy = CENTER + Math.sin(angle) * orbitR;

    const spread = (energyRadius.value - ENERGY_MIN) / (ENERGY_MAX - ENERGY_MIN);

    const tangentAngle = angle + Math.PI / 2 + flowAngleWobble;
    const rxVal = streamLen * (0.5 + spread * 0.9) * (1 - trailIndex * 0.15) * pulseScale * flowStretch;
    const ryVal = streamWidth * (0.4 + spread * 0.7) * (1 - trailIndex * 0.1) * (2 - pulseScale) * flowSquash;

    const trailFade = 1 - trailIndex * 0.25;
    const flowOpacityWave = 0.85 + flowWaveA * 0.15;
    const pulseOpacity = 0.8 + pulseWave * 0.2;
    const opacity = Math.min(1, baseOpacity * (0.5 + spread * 0.5) * trailFade * pulseOpacity * flowOpacityWave);

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

interface PlasmaBoltProps {
  index: number;
  count: number;
  rotation: SharedValue<number>;
  energyRadius: SharedValue<number>;
  energyProgress: SharedValue<number>;
  pulse: SharedValue<number>;
  flow: SharedValue<number>;
  jitterSeed: number;
  writheSeedA: number;
  writheSeedB: number;
  colorDim: string;
  colorBright: string;
}

function PlasmaBolt({
  index, count, rotation, energyRadius, energyProgress, pulse, flow,
  jitterSeed, writheSeedA, writheSeedB, colorDim, colorBright,
}: PlasmaBoltProps) {
  const animatedProps = useAnimatedProps(() => {
    const baseAngle = ((index / count) * Math.PI * 2) + (rotation.value * Math.PI / 180);

    const flowPhase = flow.value * Math.PI * 2;
    const flowWaveA = Math.sin(flowPhase * 2.1 + writheSeedA * 1.3);
    const flowWaveB = Math.cos(flowPhase * 1.7 + writheSeedB * 0.9);

    const writheA = Math.sin(pulse.value * Math.PI * 2 * 3.7 + writheSeedA) * 0.12;
    const writheB = Math.cos(pulse.value * Math.PI * 2 * 2.3 + writheSeedB) * 0.08;
    const flowWrithe = flowWaveA * 0.08 + flowWaveB * 0.05;
    const angle = baseAngle + writheA + writheB + flowWrithe;

    const pulseWave = Math.sin(pulse.value * Math.PI * 2 + jitterSeed);
    const endJitter = pulseWave * 8 + flowWaveB * 5;
    const endR = energyRadius.value + jitterSeed + endJitter;
    const startR = CORE_RADIUS + 4 + flowWaveA * 2;

    const x1 = CENTER + Math.cos(angle + writheB * 0.5) * startR;
    const y1 = CENTER + Math.sin(angle + writheB * 0.5) * startR;
    const x2 = CENTER + Math.cos(angle) * endR;
    const y2 = CENTER + Math.sin(angle) * endR;

    const spread = (energyRadius.value - ENERGY_MIN) / (ENERGY_MAX - ENERGY_MIN);
    const flowOpacity = 0.85 + flowWaveA * 0.15;
    const pulseOpacity = 0.8 + pulseWave * 0.2;
    const opacity = Math.min(1, (0.4 + spread * 0.5) * pulseOpacity * flowOpacity);

    const stroke = interpolateColor(
      energyProgress.value,
      [0, 1],
      [colorDim, colorBright],
    );

    const strokeWidth = (1.0 + spread * 1.5) * (0.8 + pulseWave * 0.4) * (0.9 + flowWaveB * 0.2);

    return { x1, y1, x2, y2, opacity, stroke, strokeWidth };
  });

  return <AnimatedLine animatedProps={animatedProps} />;
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
  const energyRadius = useSharedValue(ENERGY_MAX);
  const energyProgress = useSharedValue(1);
  const pulse = useSharedValue(0);
  const flow = useSharedValue(0);

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

    pulse.value = 0;
    pulse.value = withRepeat(
      withTiming(1, { duration: 1800, easing: Easing.linear }),
      -1,
      false,
    );

    flow.value = 0;
    flow.value = withRepeat(
      withTiming(1, { duration: 3200, easing: Easing.linear }),
      -1,
      false,
    );

    return () => {
      rotations.forEach(r => cancelAnimation(r));
      cancelAnimation(coreRadius);
      cancelAnimation(energyRadius);
      cancelAnimation(energyProgress);
      cancelAnimation(pulse);
      cancelAnimation(flow);
    };
  }, []);

  useEffect(() => {
    cancelAnimation(coreRadius);
    cancelAnimation(energyRadius);
    cancelAnimation(energyProgress);

    if (isPaused) {
      rotations.forEach(r => cancelAnimation(r));
      cancelAnimation(pulse);
      cancelAnimation(flow);
      return;
    }

    pulse.value = withRepeat(
      withTiming(pulse.value + 1, { duration: 1800, easing: Easing.linear }),
      -1,
      false,
    );

    flow.value = withRepeat(
      withTiming(flow.value + 1, { duration: 3200, easing: Easing.linear }),
      -1,
      false,
    );

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
      colorIndex: number;
      pulseSeed: number;
    }> = [];

    RING_CONFIGS.forEach((ring, ri) => {
      for (let si = 0; si < ring.count; si++) {
        for (let ti = 0; ti < ring.trailCount; ti++) {
          const radialJitter = Math.sin(si * 3.1 + ri * 2.3) * 6;
          const trailOffset = ti * (ring.streamLen * 0.25);
          configs.push({
            ringIndex: ri,
            streamIndex: si,
            count: ring.count,
            streamLen: ring.streamLen + Math.sin(si * 1.7) * 3,
            streamWidth: ring.streamWidth + Math.cos(si * 2.3) * 0.4,
            baseOpacity: ring.opacityBase + Math.cos(si * 2.1) * 0.06,
            radiusOffset: radialJitter + trailOffset,
            trailIndex: ti,
            colorIndex: (ri + si) % 4,
            pulseSeed: si * 1.37 + ri * 2.91 + ti * 0.73,
          });
        }
      }
    });
    return configs;
  }, []);

  const boltConfigs = useMemo(() => {
    const configs: Array<{
      ringIndex: number;
      boltIndex: number;
      count: number;
      jitterSeed: number;
      writheSeedA: number;
      writheSeedB: number;
      colorIndex: number;
    }> = [];

    RING_CONFIGS.forEach((ring, ri) => {
      const boltCount = Math.max(3, Math.floor(ring.count * 0.5));
      for (let bi = 0; bi < boltCount; bi++) {
        configs.push({
          ringIndex: ri,
          boltIndex: bi,
          count: boltCount,
          jitterSeed: Math.sin(bi * 4.7 + ri * 1.9) * 10,
          writheSeedA: bi * 2.31 + ri * 5.17,
          writheSeedB: bi * 3.79 + ri * 1.43,
          colorIndex: (ri + bi) % 4,
        });
      }
    });
    return configs;
  }, []);

  const colorPairs = useMemo(() => {
    return COLOR_KEYS.map(ck => ({
      dim: (colors as any)[ck.dim] as string,
      bright: (colors as any)[ck.bright] as string,
    }));
  }, [colors]);

  const coreProps = useAnimatedProps(() => {
    const coreOpacity = 0.92 - energyProgress.value * 0.84;
    const fill = interpolateColor(
      energyProgress.value,
      [0, 0.5, 1],
      [colors.circleActive, colors.circleActive, colors.circleRest],
    );
    return { r: coreRadius.value, fill, opacity: coreOpacity };
  });

  const coreSheenProps = useAnimatedProps(() => {
    const sheenPulse = Math.sin(pulse.value * Math.PI * 2);
    const sheenOpacity = (0.4 + sheenPulse * 0.15) * (1 - energyProgress.value * 0.7);
    return {
      cx: CENTER - 12,
      cy: CENTER - 14,
      r: coreRadius.value * 0.45,
      opacity: sheenOpacity,
    };
  });

  const coreGlowProps = useAnimatedProps(() => {
    const glowPulse = Math.sin(pulse.value * Math.PI * 2 + 1.2);
    const glowOpacity = (0.55 - energyProgress.value * 0.4) * (0.85 + glowPulse * 0.15);
    const fill = interpolateColor(
      energyProgress.value,
      [0, 1],
      [colors.glowActive, colors.glowRest],
    );
    return {
      r: coreRadius.value + 14,
      fill,
      opacity: glowOpacity,
    };
  });

  const coreOuterGlowProps = useAnimatedProps(() => {
    const glowPulse = Math.sin(pulse.value * Math.PI * 2 + 2.4);
    const glowOpacity = (0.35 - energyProgress.value * 0.25) * (0.9 + glowPulse * 0.1);
    const fill = interpolateColor(
      energyProgress.value,
      [0, 1],
      [colors.glowActive, colors.glowRest],
    );
    return {
      r: coreRadius.value + 28,
      fill,
      opacity: glowOpacity,
    };
  });

  const coreRimProps = useAnimatedProps(() => {
    const rimPulse = Math.sin(pulse.value * Math.PI * 2 + 0.5);
    const rimOpacity = (0.75 - energyProgress.value * 0.5) * (0.8 + rimPulse * 0.2);
    const rimStroke = interpolateColor(
      energyProgress.value,
      [0, 1],
      [colors.circleActive, colors.circleRest],
    );
    return {
      r: coreRadius.value + 2,
      opacity: rimOpacity,
      stroke: rimStroke,
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
          strokeWidth={2.5}
        />
        <AnimatedCircle cx={CENTER} cy={CENTER} animatedProps={coreProps} />
        <AnimatedCircle
          animatedProps={coreSheenProps}
          fill={colors.coreSheenLight}
        />

        {boltConfigs.map((cfg, i) => (
          <PlasmaBolt
            key={`bolt-${i}`}
            index={cfg.boltIndex}
            count={cfg.count}
            rotation={rotations[cfg.ringIndex]}
            energyRadius={energyRadius}
            energyProgress={energyProgress}
            pulse={pulse}
            flow={flow}
            jitterSeed={cfg.jitterSeed}
            writheSeedA={cfg.writheSeedA}
            writheSeedB={cfg.writheSeedB}
            colorDim={colors.boltDim}
            colorBright={colors.boltBright}
          />
        ))}

        {streamConfigs.map((cfg, i) => (
          <PlasmaStream
            key={`stream-${i}`}
            index={cfg.streamIndex}
            count={cfg.count}
            rotation={rotations[cfg.ringIndex]}
            energyRadius={energyRadius}
            energyProgress={energyProgress}
            pulse={pulse}
            flow={flow}
            streamLen={cfg.streamLen}
            streamWidth={cfg.streamWidth}
            baseOpacity={cfg.baseOpacity}
            radiusOffset={cfg.radiusOffset}
            trailIndex={cfg.trailIndex}
            pulseSeed={cfg.pulseSeed}
            colorDim={colorPairs[cfg.colorIndex].dim}
            colorBright={colorPairs[cfg.colorIndex].bright}
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
