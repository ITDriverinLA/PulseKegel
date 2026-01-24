import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSpring,
  cancelAnimation,
} from 'react-native-reanimated';

import { SegmentType } from '@/data/workoutProgram';

interface PowerBarProps {
  phase: 'squeeze' | 'rest';
  segmentType: SegmentType;
  durationSeconds: number;
  isActive: boolean;
  height: number;
  width?: number;
}

const SEGMENT_COUNT = 12;
const SEGMENT_GAP = 4;

const SEGMENT_COLORS = [
  '#22C55E',
  '#22C55E',
  '#22C55E',
  '#22C55E',
  '#84CC16',
  '#84CC16',
  '#EAB308',
  '#EAB308',
  '#F97316',
  '#F97316',
  '#EF4444',
  '#EF4444',
];

const SEGMENT_INACTIVE = 'rgba(30, 30, 30, 0.8)';

const getDurationMultiplier = (segmentType: SegmentType): number => {
  switch (segmentType) {
    case 'quickFlicks':
      return 0.8;
    case 'contractRelax':
      return 0.9;
    default:
      return 1.0;
  }
};

function PowerBarSegment({ 
  index, 
  progress, 
  segmentHeight,
  width,
}: { 
  index: number; 
  progress: Animated.SharedValue<number>;
  segmentHeight: number;
  width: number;
}) {
  const threshold = (index + 1) / SEGMENT_COUNT;
  
  const animatedStyle = useAnimatedStyle(() => {
    const isLit = progress.value >= threshold;
    return {
      backgroundColor: isLit ? SEGMENT_COLORS[index] : SEGMENT_INACTIVE,
      shadowColor: isLit ? SEGMENT_COLORS[index] : 'transparent',
      shadowOpacity: isLit ? 0.8 : 0,
      shadowRadius: isLit ? 8 : 0,
      shadowOffset: { width: 0, height: 0 },
    };
  });

  return (
    <Animated.View
      style={[
        styles.segment,
        {
          height: segmentHeight,
          width: width - 16,
          borderRadius: 4,
        },
        animatedStyle,
      ]}
    />
  );
}

export function PowerBar({
  phase,
  segmentType,
  durationSeconds,
  isActive,
  height,
  width = 120,
}: PowerBarProps) {
  const progress = useSharedValue(0);
  const segmentHeight = (height - (SEGMENT_COUNT - 1) * SEGMENT_GAP - 16) / SEGMENT_COUNT;

  useEffect(() => {
    if (!isActive) {
      cancelAnimation(progress);
      return;
    }

    if (phase === 'squeeze') {
      const multiplier = getDurationMultiplier(segmentType);
      const durationMs = durationSeconds * 1000 * multiplier;
      progress.value = 0;
      progress.value = withTiming(1, { duration: durationMs });
    } else {
      cancelAnimation(progress);
      progress.value = withSpring(0, {
        damping: 20,
        stiffness: 300,
        mass: 0.5,
      });
    }
  }, [phase, segmentType, durationSeconds, isActive, progress]);

  const segments = [];
  for (let i = SEGMENT_COUNT - 1; i >= 0; i--) {
    segments.push(
      <PowerBarSegment
        key={i}
        index={i}
        progress={progress}
        segmentHeight={segmentHeight}
        width={width}
      />
    );
  }

  return (
    <View style={[styles.container, { height, width }]}>
      <View style={styles.bezel}>
        <View style={styles.innerBezel}>
          <View style={styles.segmentsContainer}>
            {segments}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  bezel: {
    flex: 1,
    width: '100%',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 4,
    borderWidth: 2,
    borderColor: '#333',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  innerBezel: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#222',
  },
  segmentsContainer: {
    flex: 1,
    gap: SEGMENT_GAP,
    justifyContent: 'space-between',
  },
  segment: {
    alignSelf: 'center',
  },
});
