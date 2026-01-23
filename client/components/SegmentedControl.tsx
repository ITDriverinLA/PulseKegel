import React from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/ThemedText';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, BorderRadius } from '@/constants/theme';
import { hapticsManager } from '@/lib/hapticsManager';

interface SegmentedControlProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
}: SegmentedControlProps<T>) {
  const { theme, isDark } = useTheme();
  const selectedIndex = options.findIndex(o => o.value === value);
  const indicatorPosition = useSharedValue(selectedIndex);

  React.useEffect(() => {
    indicatorPosition.value = withSpring(selectedIndex, {
      damping: 15,
      stiffness: 150,
    });
  }, [selectedIndex, indicatorPosition]);

  const indicatorStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateX: indicatorPosition.value * (100 / options.length) + '%' as any,
        },
      ],
      width: `${100 / options.length}%`,
    };
  });

  const handlePress = async (optionValue: T) => {
    if (optionValue !== value) {
      await hapticsManager.triggerSelection();
      onChange(optionValue);
    }
  };

  return (
    <View style={styles.container}>
      {label ? (
        <ThemedText type="body" style={styles.label}>
          {label}
        </ThemedText>
      ) : null}
      <View
        style={[
          styles.track,
          { backgroundColor: isDark ? theme.backgroundSecondary : theme.backgroundDefault },
        ]}
      >
        <Animated.View
          style={[
            styles.indicator,
            { backgroundColor: isDark ? theme.backgroundTertiary : '#FFFFFF' },
            indicatorStyle,
          ]}
        />
        {options.map((option, index) => (
          <Pressable
            key={option.value}
            style={styles.option}
            onPress={() => handlePress(option.value)}
          >
            <ThemedText
              type="small"
              style={[
                styles.optionText,
                option.value === value && { fontWeight: '600' },
              ]}
            >
              {option.label}
            </ThemedText>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: Spacing.md,
  },
  label: {
    marginBottom: Spacing.sm,
  },
  track: {
    flexDirection: 'row',
    borderRadius: BorderRadius.sm,
    padding: 3,
    position: 'relative',
  },
  indicator: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    borderRadius: BorderRadius.xs,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  option: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  optionText: {
    textAlign: 'center',
  },
});
