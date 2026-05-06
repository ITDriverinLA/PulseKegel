import React, { useEffect } from "react";
import { View, Text, Image, StyleSheet, Dimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  Easing,
  FadeIn,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

const AnimatedPath = Animated.createAnimatedComponent(Path);

const SCREEN_WIDTH = Dimensions.get("window").width;
const LINE_WIDTH = Math.min(SCREEN_WIDTH - 64, 300);

// ECG/heartbeat path on a 300×60 canvas.
// Flat baseline → small pre-dip → sharp spike up → spike down → recovery bump → flat out.
const ECG_PATH =
  "M 0 30 L 55 30 L 67 37 L 82 4 L 95 56 L 108 24 L 118 30 L 300 30";

// Conservative overestimate of the path length so the full stroke is hidden at offset=PATH_LENGTH.
const PATH_LENGTH = 430;

const BG = "#0a0a1a";
const NEON = "#00FF88";
const NEON_GLOW = "#00FF8833";

export function LoadingScreen() {
  const dashOffset = useSharedValue(PATH_LENGTH);

  useEffect(() => {
    // Draw the line left-to-right (1 400 ms), pause briefly, then instantly reset and repeat.
    dashOffset.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 1400, easing: Easing.linear }),
        withDelay(300, withTiming(PATH_LENGTH, { duration: 16 })),
      ),
      -1,
    );
  }, []);

  const mainProps = useAnimatedProps(() => ({
    strokeDashoffset: dashOffset.value,
  }));

  const glowProps = useAnimatedProps(() => ({
    strokeDashoffset: dashOffset.value,
  }));

  return (
    <View style={styles.container}>
      <Animated.View entering={FadeIn.duration(350)} style={styles.content}>
        <Image
          source={require("../../assets/images/icon.png")}
          style={styles.icon}
          resizeMode="contain"
        />

        <Text style={styles.title}>PulseKegel</Text>

        <View style={styles.lineWrapper}>
          <Svg width={LINE_WIDTH} height={60} viewBox="0 0 300 60">
            {/* Wide, faint glow layer */}
            <AnimatedPath
              d={ECG_PATH}
              stroke={NEON}
              strokeWidth={10}
              strokeOpacity={0.15}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={PATH_LENGTH}
              animatedProps={glowProps}
            />
            {/* Medium glow layer */}
            <AnimatedPath
              d={ECG_PATH}
              stroke={NEON}
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
              stroke={NEON}
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
    backgroundColor: BG,
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
    color: "#ECEDEE",
    letterSpacing: 1,
  },
  lineWrapper: {
    marginTop: 8,
  },
});
