import React, { useEffect, useState } from "react";
import { StyleSheet, View, Text, Pressable, Modal } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  withRepeat,
  withSpring,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";

import { getBadgeById } from "@/data/badges";
import { useThemePreference } from "@/contexts/ThemePreferenceContext";
import { useAudio } from "@/contexts/AudioContext";
import { Spacing } from "@/constants/theme";
import {
  ANIM_DURATION_MICRO,
  ANIM_DURATION_MICRO_SETTLE,
  ANIM_DURATION_BADGE_APPEAR,
  ANIM_DURATION_BADGE_SHIMMER,
  ANIM_DURATION_BADGE_GLOW,
  ANIM_EASING_PULSE,
  ANIM_DELAY_MED,
  ANIM_DELAY_LONG,
  ANIM_DELAY_XL,
  ANIM_DELAY_2XL,
} from "@/constants/animation";

interface BadgeToastProps {
  badgeIds: string[];
  onDismiss: () => void;
}

export function BadgeToast({ badgeIds, onDismiss }: BadgeToastProps) {
  const { isDarkMode } = useThemePreference();
  const { playSfx } = useAudio();
  const [currentIndex, setCurrentIndex] = useState(0);

  const iconScale = useSharedValue(0);
  const iconRotate = useSharedValue(0);
  const contentOpacity = useSharedValue(0);
  const shimmer = useSharedValue(0);
  const glowPulse = useSharedValue(0);

  const currentBadge =
    badgeIds.length > 0 ? getBadgeById(badgeIds[currentIndex]) : undefined;
  const hasMore = currentIndex < badgeIds.length - 1;

  useEffect(() => {
    if (!currentBadge) return;

    playSfx("badge");

    iconScale.value = 0;
    iconRotate.value = 0;
    contentOpacity.value = 0;
    shimmer.value = 0;
    glowPulse.value = 0;

    iconScale.value = withDelay(
      ANIM_DELAY_MED,
      withSpring(1, { damping: 8, stiffness: 120 }),
    );
    iconRotate.value = withDelay(
      ANIM_DELAY_MED,
      withSequence(
        withTiming(-10, { duration: ANIM_DURATION_MICRO }),
        withTiming(10, { duration: ANIM_DURATION_MICRO }),
        withTiming(0, { duration: ANIM_DURATION_MICRO_SETTLE }),
      ),
    );
    contentOpacity.value = withDelay(
      ANIM_DELAY_2XL,
      withTiming(1, { duration: ANIM_DURATION_BADGE_APPEAR }),
    );
    shimmer.value = withDelay(
      ANIM_DELAY_LONG,
      withRepeat(
        withTiming(1, {
          duration: ANIM_DURATION_BADGE_SHIMMER,
          easing: ANIM_EASING_PULSE,
        }),
        -1,
        true,
      ),
    );
    glowPulse.value = withDelay(
      ANIM_DELAY_XL,
      withRepeat(
        withTiming(1, { duration: ANIM_DURATION_BADGE_GLOW }),
        -1,
        true,
      ),
    );
  }, [
    currentIndex,
    currentBadge,
    contentOpacity,
    glowPulse,
    iconRotate,
    iconScale,
    playSfx,
    shimmer,
  ]);

  const iconAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: iconScale.value },
      { rotate: `${iconRotate.value}deg` },
    ],
  }));

  const contentAnimatedStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ translateY: (1 - contentOpacity.value) * 20 }],
  }));

  const glowAnimatedStyle = useAnimatedStyle(() => ({
    opacity: 0.3 + glowPulse.value * 0.4,
    transform: [{ scale: 1 + glowPulse.value * 0.15 }],
  }));

  const handleNext = () => {
    if (hasMore) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      onDismiss();
    }
  };

  if (!currentBadge || badgeIds.length === 0) return null;

  const badgeColor = currentBadge.color;
  const overlayBg = isDarkMode ? "rgba(5, 5, 15, 0.92)" : "rgba(0, 0, 0, 0.6)";
  const cardGradient = isDarkMode
    ? (["rgba(20, 15, 40, 0.98)", "rgba(10, 15, 35, 0.98)"] as const)
    : (["rgba(255, 255, 255, 0.98)", "rgba(245, 247, 252, 0.98)"] as const);
  const cardBorder = isDarkMode ? `rgba(255,255,255,0.08)` : `rgba(0,0,0,0.08)`;
  const congratsColor = isDarkMode ? "#FFFFFF" : "#1a1a2e";
  const nameColor = badgeColor;
  const descColor = isDarkMode ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.6)";
  const labelColor = isDarkMode ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)";
  const buttonTextColor = "#FFFFFF";
  const counterColor = isDarkMode ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)";

  return (
    <Modal transparent animationType="fade" visible>
      <View style={[styles.overlay, { backgroundColor: overlayBg }]}>
        <View style={styles.modalContent}>
          <LinearGradient
            colors={cardGradient as unknown as [string, string, ...string[]]}
            style={[styles.card, { borderColor: cardBorder }]}
          >
            <Animated.View style={[styles.glowCircle, glowAnimatedStyle]}>
              <View
                style={[
                  styles.glowInner,
                  { backgroundColor: badgeColor, shadowColor: badgeColor },
                ]}
              />
            </Animated.View>

            <Text style={[styles.congratsLabel, { color: labelColor }]}>
              BADGE EARNED
            </Text>

            <Animated.View style={[styles.iconOuter, iconAnimatedStyle]}>
              <View
                style={[
                  styles.iconRing,
                  { borderColor: badgeColor, shadowColor: badgeColor },
                ]}
              >
                <View
                  style={[
                    styles.iconBg,
                    { backgroundColor: `${badgeColor}18` },
                  ]}
                >
                  <Feather
                    name={currentBadge.icon as any}
                    size={44}
                    color={badgeColor}
                  />
                </View>
              </View>
            </Animated.View>

            <Animated.View style={[styles.textContent, contentAnimatedStyle]}>
              <Text style={[styles.congratsText, { color: congratsColor }]}>
                Congratulations!
              </Text>
              <Text style={[styles.badgeName, { color: nameColor }]}>
                {currentBadge.name}
              </Text>
              <Text style={[styles.badgeDescription, { color: descColor }]}>
                {currentBadge.description}
              </Text>

              <View
                style={[
                  styles.categoryPill,
                  {
                    backgroundColor: `${badgeColor}15`,
                    borderColor: `${badgeColor}30`,
                  },
                ]}
              >
                <Text style={[styles.categoryText, { color: badgeColor }]}>
                  {currentBadge.category.charAt(0).toUpperCase() +
                    currentBadge.category.slice(1)}
                </Text>
              </View>
            </Animated.View>

            <Animated.View style={contentAnimatedStyle}>
              <Pressable onPress={handleNext} style={styles.buttonPressable}>
                <LinearGradient
                  colors={[badgeColor, `${badgeColor}CC`]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.button}
                >
                  <Text style={[styles.buttonText, { color: buttonTextColor }]}>
                    {hasMore ? "Next Badge" : "Continue"}
                  </Text>
                  {hasMore ? (
                    <Feather
                      name="arrow-right"
                      size={18}
                      color={buttonTextColor}
                    />
                  ) : null}
                </LinearGradient>
              </Pressable>

              {badgeIds.length > 1 ? (
                <Text style={[styles.counter, { color: counterColor }]}>
                  {currentIndex + 1} of {badgeIds.length} badges earned
                </Text>
              ) : null}
            </Animated.View>

            <View style={[styles.glowBar, { backgroundColor: badgeColor }]} />
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
  modalContent: {
    width: "100%",
    maxWidth: 340,
  },
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
  congratsLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 3,
    marginBottom: 20,
  },
  iconOuter: {
    marginBottom: 24,
  },
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
  textContent: {
    alignItems: "center",
    marginBottom: 28,
  },
  congratsText: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 8,
  },
  badgeName: {
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 10,
    textAlign: "center",
  },
  badgeDescription: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 14,
  },
  categoryPill: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  buttonPressable: {
    width: "100%",
  },
  button: {
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "700",
  },
  counter: {
    fontSize: 12,
    textAlign: "center",
    marginTop: 12,
  },
  glowBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    opacity: 0.5,
  },
});
