import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  cancelAnimation,
  interpolateColor,
} from 'react-native-reanimated';

import { SegmentType } from '@/data/workoutProgram';

interface PowerBarProps {
  phase: 'squeeze' | 'rest';
  segmentType: SegmentType;
  durationSeconds: number;
  isActive: boolean;
  height: number;
  width?: number;
  children?: React.ReactNode;
}

const POWER_BAR_LOW = '#C4B5FD';
const POWER_BAR_MID = '#8B5CF6';
const POWER_BAR_HIGH = '#6D28D9';
const TRACK_COLOR = 'rgba(139, 92, 246, 0.15)';

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

export function PowerBar({
  phase,
  segmentType,
  durationSeconds,
  isActive,
  height,
  width = 80,
  children,
}: PowerBarProps) {
  const progress = useSharedValue(0);

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
      progress.value = 0;
    }
  }, [phase, segmentType, durationSeconds, isActive, progress]);

  const animatedBarStyle = useAnimatedStyle(() => {
    const barColor = interpolateColor(
      progress.value,
      [0, 0.5, 1],
      [POWER_BAR_LOW, POWER_BAR_MID, POWER_BAR_HIGH]
    );
    
    return {
      height: `${progress.value * 100}%`,
      backgroundColor: barColor,
    };
  });

  return (
    <View style={styles.wrapper}>
      <View style={[styles.track, { height, width, borderRadius: width / 2 }]}>
        <Animated.View
          style={[
            styles.fill,
            { width, borderRadius: width / 2 },
            animatedBarStyle,
          ]}
        />
      </View>
      {children ? <View style={styles.content}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
  },
  track: {
    backgroundColor: TRACK_COLOR,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  fill: {
    position: 'absolute',
    left: 0,
    bottom: 0,
  },
  content: {
    marginTop: 24,
    alignItems: 'center',
  },
});
