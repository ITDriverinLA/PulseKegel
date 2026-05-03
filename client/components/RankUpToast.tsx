import React, { useEffect } from "react";
import { StyleSheet, View, Text, Pressable, Modal } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withTiming,
  withRepeat,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";

import { useThemePreference } from "@/contexts/ThemePreferenceContext";
import { Spacing } from "@/constants/theme";
import {
  ANIM_DELAY_MED,
  ANIM_DELAY_225,
  ANIM_DELAY_LONG,
  ANIM_DURATION_ZOOM,
  ANIM_DURATION_HOLD_PULSE_BOTTOM,
} from "@/constants/animation";
import { RankName, RANK_UP_MESSAGES } from "@/lib/controlScore";

interface Props {
  rank: RankName | null;
  onDismiss: () => void;
}

export function RankUpToast({ rank, onDismiss }: Props) {
  const { cp, isDarkMode } = useThemePreference();
  const iconScale = useSharedValue(0);
  const contentOpacity = useSharedValue(0);
  const glowPulse = useSharedValue(0);

  useEffect(() => {
    if (!rank) return;
    iconScale.value = 0;
    contentOpacity.value = 0;
    glowPulse.value = 0;
    iconScale.value = withDelay(
      ANIM_DELAY_MED,
      withSpring(1, { damping: 8, stiffness: 120 }),
    );
    contentOpacity.value = withDelay(
      ANIM_DELAY_225,
      withTiming(1, { duration: ANIM_DURATION_ZOOM }),
    );
    glowPulse.value = withDelay(
      ANIM_DELAY_LONG,
      withRepeat(
        withTiming(1, { duration: ANIM_DURATION_HOLD_PULSE_BOTTOM }),
        -1,
        true,
      ),
    );
  }, [rank, iconScale, contentOpacity, glowPulse]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
  }));
  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ translateY: (1 - contentOpacity.value) * 16 }],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.25 + glowPulse.value * 0.35,
    transform: [{ scale: 1 + glowPulse.value * 0.12 }],
  }));

  if (!rank) return null;
  const message = RANK_UP_MESSAGES[rank];
  const accent = rank === "Elite" ? cp.neonOrange : cp.neonCyan;
  const overlayBg = isDarkMode ? "rgba(5,5,15,0.92)" : "rgba(0,0,0,0.6)";
  const cardGradient = isDarkMode
    ? (["rgba(20,15,40,0.98)", "rgba(10,15,35,0.98)"] as const)
    : (["rgba(255,255,255,0.98)", "rgba(245,247,252,0.98)"] as const);
  const cardBorder = isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
  const titleColor = isDarkMode ? "#FFFFFF" : "#1a1a2e";
  const bodyColor = isDarkMode ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.6)";
  const labelColor = isDarkMode ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)";

  return (
    <Modal transparent animationType="fade" visible>
      <View style={[styles.overlay, { backgroundColor: overlayBg }]}>
        <View style={styles.modalContent}>
          <LinearGradient
            colors={cardGradient as unknown as [string, string, ...string[]]}
            style={[styles.card, { borderColor: cardBorder }]}
          >
            <Animated.View style={[styles.glowCircle, glowStyle]}>
              <View
                style={[
                  styles.glowInner,
                  { backgroundColor: accent, shadowColor: accent },
                ]}
              />
            </Animated.View>
            <Text style={[styles.label, { color: labelColor }]}>RANK UP</Text>
            <Animated.View style={[styles.iconOuter, iconStyle]}>
              <View
                style={[
                  styles.iconRing,
                  { borderColor: accent, shadowColor: accent },
                ]}
              >
                <View
                  style={[styles.iconBg, { backgroundColor: `${accent}18` }]}
                >
                  <Feather name="award" size={44} color={accent} />
                </View>
              </View>
            </Animated.View>
            <Animated.View style={[styles.textContent, contentStyle]}>
              <Text style={[styles.title, { color: titleColor }]}>
                {message.title}
              </Text>
              <Text style={[styles.body, { color: bodyColor }]}>
                {message.body}
              </Text>
            </Animated.View>
            <Animated.View style={[contentStyle, { width: "100%" }]}>
              <Pressable
                onPress={onDismiss}
                style={styles.buttonPressable}
                testID="button-dismiss-rank-up"
              >
                <LinearGradient
                  colors={[accent, `${accent}CC`]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.button}
                >
                  <Text style={styles.buttonText}>Continue</Text>
                </LinearGradient>
              </Pressable>
            </Animated.View>
            <View style={[styles.glowBar, { backgroundColor: accent }]} />
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
  },
  modalContent: { width: "100%", maxWidth: 340 },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    alignItems: "center",
    paddingTop: 36,
    paddingBottom: 28,
    paddingHorizontal: 28,
    overflow: "hidden",
  },
  glowCircle: {
    position: "absolute",
    top: -40,
    width: 200,
    height: 200,
    alignItems: "center",
    justifyContent: "center",
  },
  glowInner: {
    width: 140,
    height: 140,
    borderRadius: 70,
    opacity: 0.15,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 60,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 3,
    marginBottom: 20,
  },
  iconOuter: { marginBottom: 24 },
  iconRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2.5,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },
  iconBg: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  textContent: { alignItems: "center", marginBottom: 28 },
  title: {
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 10,
    textAlign: "center",
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  buttonPressable: { width: "100%" },
  button: {
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { fontSize: 16, fontWeight: "700", color: "#FFFFFF" },
  glowBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    opacity: 0.5,
  },
});
