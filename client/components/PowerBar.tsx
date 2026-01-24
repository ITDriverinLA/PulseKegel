import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';

import { SegmentType } from '@/data/workoutProgram';
import { BorderRadius } from '@/constants/theme';

interface PowerBarProps {
  phase: 'squeeze' | 'rest';
  segmentType: SegmentType;
  durationSeconds: number;
  isActive: boolean;
  width: number;
  height?: number;
  children?: React.ReactNode;
}

const POWER_BAR_COLOR = '#8B5CF6';
const TRACK_COLOR = 'rgba(139, 92, 246, 0.2)';

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
  width,
  height = 24,
  children,
}: PowerBarProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!isActive) {
      cancelAnimation(progress);
      return;
    }

    const multiplier = getDurationMultiplier(segmentType);
    const durationMs = durationSeconds * 1000 * multiplier;

    if (phase === 'squeeze') {
      progress.value = 0;
      progress.value = withTiming(1, { duration: durationMs });
    } else {
      progress.value = 1;
      progress.value = withTiming(0, { duration: durationMs });
    }
  }, [phase, segmentType, durationSeconds, isActive, progress]);

  const animatedBarStyle = useAnimatedStyle(() => {
    return {
      width: `${progress.value * 100}%`,
    };
  });

  return (
    <View style={styles.wrapper}>
      <View style={[styles.track, { width, height, borderRadius: height / 2 }]}>
        <Animated.View
          style={[
            styles.fill,
            { height, borderRadius: height / 2 },
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
  },
  fill: {
    backgroundColor: POWER_BAR_COLOR,
    position: 'absolute',
    left: 0,
    top: 0,
  },
  content: {
    marginTop: 24,
    alignItems: 'center',
  },
});
