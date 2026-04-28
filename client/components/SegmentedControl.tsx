import React, { useState } from "react";
import { StyleSheet, View, Pressable, LayoutChangeEvent } from "react-native";
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { hapticsManager } from "@/lib/hapticsManager";

interface SegmentedControlProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label?: string;
  labelColor?: string;
  trackColor?: string;
  indicatorColor?: string;
  textColor?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  labelColor,
  trackColor,
  indicatorColor,
  textColor,
}: SegmentedControlProps<T>) {
  const { theme, isDark } = useTheme();
  const [trackWidth, setTrackWidth] = useState(0);
  const selectedIndex = options.findIndex((o) => o.value === value);
  const indicatorPosition = useSharedValue(selectedIndex);

  React.useEffect(() => {
    indicatorPosition.value = withSpring(selectedIndex, {
      damping: 15,
      stiffness: 150,
    });
  }, [selectedIndex, indicatorPosition]);

  const optionWidth = trackWidth > 0 ? (trackWidth - 6) / options.length : 0;

  const indicatorStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateX: indicatorPosition.value * optionWidth,
        },
      ],
      width: optionWidth,
    };
  });

  const handlePress = async (optionValue: T) => {
    if (optionValue !== value) {
      await hapticsManager.triggerSelection();
      onChange(optionValue);
    }
  };

  const handleLayout = (event: LayoutChangeEvent) => {
    setTrackWidth(event.nativeEvent.layout.width);
  };

  return (
    <View style={styles.container}>
      {label ? (
        <ThemedText
          type="body"
          style={[styles.label, labelColor ? { color: labelColor } : undefined]}
        >
          {label}
        </ThemedText>
      ) : null}
      <View
        style={[
          styles.track,
          {
            backgroundColor:
              trackColor ||
              (isDark ? theme.backgroundSecondary : theme.backgroundDefault),
          },
        ]}
        onLayout={handleLayout}
      >
        {trackWidth > 0 ? (
          <Animated.View
            style={[
              styles.indicator,
              {
                backgroundColor:
                  indicatorColor ||
                  (isDark ? theme.backgroundTertiary : "#FFFFFF"),
              },
              indicatorStyle,
            ]}
          />
        ) : null}
        {options.map((option) => (
          <Pressable
            key={option.value}
            style={styles.option}
            onPress={() => handlePress(option.value)}
          >
            <ThemedText
              type="small"
              style={[
                styles.optionText,
                textColor ? { color: textColor } : undefined,
                option.value === value && { fontWeight: "600" },
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
    flexDirection: "row",
    borderRadius: BorderRadius.sm,
    padding: 3,
    position: "relative",
  },
  indicator: {
    position: "absolute",
    top: 3,
    bottom: 3,
    left: 3,
    borderRadius: BorderRadius.xs,
  },
  option: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  optionText: {
    textAlign: "center",
  },
});
