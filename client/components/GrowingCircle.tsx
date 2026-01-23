import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSpring,
  withSequence,
  withRepeat,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';

import { SegmentType } from '@/data/workoutProgram';
import { useTheme } from '@/hooks/useTheme';

interface GrowingCircleProps {
  phase: 'squeeze' | 'rest';
  segmentType: SegmentType;
  durationSeconds: number;
  isActive: boolean;
  size: number;
  children?: React.ReactNode;
}

const getAnimationConfig = (segmentType: SegmentType, durationMs: number) => {
  switch (segmentType) {
    case 'quickFlicks':
      return {
        easing: Easing.out(Easing.quad),
        duration: durationMs,
      };
    case 'slowHolds':
      return {
        easing: Easing.inOut(Easing.sine),
        duration: durationMs,
      };
    case 'elevator':
      return {
        easing: Easing.steps(4, true),
        duration: durationMs,
      };
    case 'reverse':
      return {
        easing: Easing.steps(4, true),
        duration: durationMs,
      };
    case 'breathing':
      return {
        easing: Easing.inOut(Easing.ease),
        duration: durationMs,
      };
    default:
      return {
        easing: Easing.linear,
        duration: durationMs,
      };
  }
};

export function GrowingCircle({
  phase,
  segmentType,
  durationSeconds,
  isActive,
  size,
  children,
}: GrowingCircleProps) {
  const { theme } = useTheme();
  const scale = useSharedValue(0.3);
  const opacity = useSharedValue(1);

  const minSize = size * 0.3;
  const maxSize = size;

  useEffect(() => {
    if (!isActive) {
      cancelAnimation(scale);
      return;
    }

    const durationMs = durationSeconds * 1000;
    const config = getAnimationConfig(segmentType, durationMs);

    if (phase === 'squeeze') {
      scale.value = 0.3;
      scale.value = withTiming(1, {
        duration: config.duration,
        easing: config.easing,
      });
    } else {
      scale.value = 1;
      scale.value = withTiming(0.3, {
        duration: config.duration,
        easing: Easing.out(Easing.ease),
      });
    }
  }, [phase, segmentType, durationSeconds, isActive, scale]);

  useEffect(() => {
    opacity.value = withSpring(1, { damping: 15, stiffness: 150 });
  }, [phase, opacity]);

  const circleColor = phase === 'squeeze' ? theme.squeeze : theme.rest;

  const animatedCircleStyle = useAnimatedStyle(() => {
    const currentSize = minSize + (maxSize - minSize) * scale.value;
    return {
      width: currentSize,
      height: currentSize,
      borderRadius: currentSize / 2,
      opacity: opacity.value,
    };
  });

  const pulseRingStyle = useAnimatedStyle(() => {
    const currentSize = minSize + (maxSize - minSize) * scale.value;
    return {
      width: currentSize + 20,
      height: currentSize + 20,
      borderRadius: (currentSize + 20) / 2,
      opacity: 0.2 * opacity.value,
    };
  });

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Animated.View
        style={[
          styles.pulseRing,
          { backgroundColor: circleColor },
          pulseRingStyle,
        ]}
      />
      <Animated.View
        style={[
          styles.circle,
          { backgroundColor: circleColor },
          animatedCircleStyle,
        ]}
      >
        <View style={styles.innerContent}>
          {children}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  pulseRing: {
    position: 'absolute',
  },
  circle: {
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  innerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
