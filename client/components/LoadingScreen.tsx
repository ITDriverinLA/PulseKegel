import React, { useEffect } from "react";
import { View, Text, Image, StyleSheet, Dimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  FadeIn,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import {
  ANIM_EASING_LINEAR,
  ANIM_DURATION_HOLD_PULSE_BOTTOM,
  ANIM_DURATION_RESET_FAST,
  ANIM_DELAY_LONG,
  ANIM_DURATION_CONTENT,
} from "@/constants/animation";
import { useThemePreference } from "@/contexts/ThemePreferenceContext";

const AnimatedPath = Animated.createAnimatedComponent(Path);

const SCREEN_WIDTH = Dimensions.get("window").width;
const LINE_WIDTH = Math.min(SCREEN_WIDTH - 64, 300);

// ECG/heartbeat path on a 300×60 canvas.
// Flat baseline → small pre-dip → sharp spike up → spike down → recovery → flat out.
const ECG_PATH =
  "M 0 30 L 55 30 L 67 37 L 82 4 L 95 56 L 108 24 L 118 30 L 300 30";

// Conservative overestimate of total path length so the stroke is fully hidden at offset = PATH_LENGTH.
const PATH_LENGTH = 430;

export function LoadingScreen() {
  const { cp } = useThemePreference();
  const dashOffset = useSharedValue(PATH_LENGTH);

  useEffect(() => {
    // Draw the line left-to-right, pause briefly, then snap back and repeat.
    dashOffset.value = withRepeat(
      withSequence(
        withTiming(0, {
          duration: ANIM_DURATION_HOLD_PULSE_BOTTOM,
          easing: ANIM_EASING_LINEAR,
        }),
        withDelay(
          ANIM_DELAY_LONG,
          withTiming(PATH_LENGTH, { duration: ANIM_DURATION_RESET_FAST }),
        ),
      ),
      -1,
    );
  }, [dashOffset]);

  const mainProps = useAnimatedProps(() => ({
    strokeDashoffset: dashOffset.value,
  }));

  const glowProps = useAnimatedProps(() => ({
    strokeDashoffset: dashOffset.value,
  }));

  return (
    <View style={[styles.container, { backgroundColor: cp.bg }]}>
      <Animated.View
        entering={FadeIn.duration(ANIM_DURATION_CONTENT)}
        style={styles.content}
      >
        <Image
          source={require("../../assets/images/icon.png")}
          style={styles.icon}
          resizeMode="contain"
        />

        <Text style={[styles.title, { color: cp.text }]}>PulseKegel</Text>

        <View style={styles.lineWrapper}>
          <Svg width={LINE_WIDTH} height={60} viewBox="0 0 300 60">
            {/* Wide faint glow */}
            <AnimatedPath
              d={ECG_PATH}
              stroke={cp.neonCyan}
              strokeWidth={10}
              strokeOpacity={0.15}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={PATH_LENGTH}
              animatedProps={glowProps}
            />
            {/* Medium glow */}
            <AnimatedPath
              d={ECG_PATH}
              stroke={cp.neonCyan}
              strokeWidth={4}
              strokeOpacity={0.35}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={PATH_LENGTH}
              animatedProps={glowProps}
            />
            {/* Crisp main line */}
            <AnimatedPath
              d={ECG_PATH}
              stroke={cp.neonCyan}
              strokeWidth={2}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={PATH_LENGTH}
              animatedProps={mainProps}
            />
          </Svg>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    alignItems: "center",
    gap: 16,
  },
  icon: {
    width: 72,
    height: 72,
    borderRadius: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: 1,
  },
  lineWrapper: {
    marginTop: 8,
  },
});
