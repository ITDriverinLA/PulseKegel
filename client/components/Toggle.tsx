import React from 'react';
import { StyleSheet, Pressable, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
  interpolateColor,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/ThemedText';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, BorderRadius } from '@/constants/theme';
import { hapticsManager } from '@/lib/hapticsManager';

interface ToggleProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  label?: string;
  disabled?: boolean;
}

const AnimatedView = Animated.createAnimatedComponent(View);

export function Toggle({ value, onValueChange, label, disabled = false }: ToggleProps) {
  const { theme, isDark } = useTheme();
  const toggleProgress = useSharedValue(value ? 1 : 0);

  React.useEffect(() => {
    toggleProgress.value = withSpring(value ? 1 : 0, {
      damping: 15,
      stiffness: 150,
    });
  }, [value, toggleProgress]);

  const trackStyle = useAnimatedStyle(() => {
    const backgroundColor = interpolateColor(
      toggleProgress.value,
      [0, 1],
      [isDark ? '#555' : '#D1D5DB', theme.primary]
    );
    return { backgroundColor };
  });

  const thumbStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateX: withSpring(value ? 22 : 2, {
            damping: 15,
            stiffness: 150,
          }),
        },
      ],
    };
  });

  const handlePress = async () => {
    if (disabled) return;
    await hapticsManager.triggerSelection();
    onValueChange(!value);
  };

  return (
    <Pressable
      onPress={handlePress}
      style={[styles.container, disabled && styles.disabled]}
      disabled={disabled}
    >
      {label ? (
        <ThemedText type="body" style={styles.label}>
          {label}
        </ThemedText>
      ) : null}
      <AnimatedView style={[styles.track, trackStyle]}>
        <AnimatedView style={[styles.thumb, thumbStyle]} />
      </AnimatedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    flex: 1,
    marginRight: Spacing.md,
  },
  track: {
    width: 50,
    height: 28,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
  },
  thumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
});
