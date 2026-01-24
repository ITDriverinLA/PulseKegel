import React, { useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSpring,
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

const getDurationMultiplier = (segmentType: SegmentType): number => {
  switch (segmentType) {
    case 'quickFlicks':
      return 0.8;
    case 'slowHolds':
      return 1.0;
    case 'elevator':
      return 1.0;
    case 'reverse':
      return 1.0;
    case 'breathing':
      return 1.0;
    case 'blockRest':
      return 1.0;
    case 'contractRelax':
      return 0.9;
    default:
      return 1.0;
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
  const phaseKeyRef = useRef(`${phase}-${Date.now()}`);

  const minSize = size * 0.3;
  const maxSize = size;

  useEffect(() => {
    phaseKeyRef.current = `${phase}-${Date.now()}`;
    
    if (!isActive) {
      cancelAnimation(scale);
      return;
    }

    const multiplier = getDurationMultiplier(segmentType);
    const durationMs = durationSeconds * 1000 * multiplier;

    if (phase === 'squeeze') {
      scale.value = 0.3;
      scale.value = withTiming(1, { duration: durationMs });
    } else {
      scale.value = 1;
      scale.value = withTiming(0.3, { duration: durationMs });
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
  },
  innerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
