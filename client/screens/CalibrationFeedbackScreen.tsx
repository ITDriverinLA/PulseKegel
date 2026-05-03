import React, { useState } from "react";
import { StyleSheet, View, Text, Pressable, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { storage } from "@/lib/storage";
import { useThemePreference } from "@/contexts/ThemePreferenceContext";
import { useAccessibility } from "@/contexts/AccessibilityContext";
import { Spacing, BorderRadius } from "@/constants/theme";
import {
  ANIM_DURATION_CONTENT,
  ANIM_DELAY_SHORT,
  ANIM_DELAY_MED,
  ANIM_DELAY_LONG,
} from "@/constants/animation";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteProps = RouteProp<RootStackParamList, "CalibrationFeedback">;
type CalibrationLevel = "easy" | "okay" | "tooHard";

interface Option {
  level: CalibrationLevel;
  label: string;
  icon: React.ComponentProps<typeof Feather>["name"];
  confirmation: string;
  weeklyConfirmation: string;
  accentKey: "neonGreen" | "neonCyan" | "neonPurple";
}

const OPTIONS: Option[] = [
  {
    level: "easy",
    label: "Easy",
    icon: "trending-up",
    confirmation:
      "Nice work. You're stronger than you think. Let's turn it up a little for the rest of the week.",
    weeklyConfirmation:
      "Strong week. We'll dial things up a notch so next week keeps challenging you.",
    accentKey: "neonGreen",
  },
  {
    level: "okay",
    label: "Okay",
    icon: "check-circle",
    confirmation:
      "Perfect. You're right where you should be. We'll keep going at this pace.",
    weeklyConfirmation:
      "Perfect. We'll keep next week at the same pace so you can keep building.",
    accentKey: "neonCyan",
  },
  {
    level: "tooHard",
    label: "Too hard",
    icon: "heart",
    confirmation:
      "Hey, that's awesome that you showed up and gave it a go. Don't worry at all. This is just calibration. We'll make it easier for you so you can build up properly.",
    weeklyConfirmation:
      "Thanks for being honest. We'll ease next week back so you can build up properly.",
    accentKey: "neonPurple",
  },
];

export default function CalibrationFeedbackScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const weekNumber = route.params?.weekNumber;
  const isWeekly = typeof weekNumber === "number" && weekNumber >= 1;
  const { cp, isDarkMode } = useThemePreference();
  const { fontScale } = useAccessibility();

  const [selected, setSelected] = useState<CalibrationLevel | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const selectedOption = OPTIONS.find((o) => o.level === selected) ?? null;

  const handleSelect = (level: CalibrationLevel) => {
    if (selected !== null) return;
    setSelected(level);
  };

  const handleContinue = async () => {
    if (!selected || isSaving) return;
    setIsSaving(true);
    if (isWeekly && weekNumber) {
      await storage.setWeeklyCalibrationLevel(weekNumber, selected);
    } else {
      await storage.setCalibrationState(selected);
    }
    navigation.goBack();
  };

  const accentColor = selectedOption
    ? cp[selectedOption.accentKey]
    : cp.neonGreen;

  return (
    <LinearGradient
      colors={cp.gradient as unknown as [string, string, ...string[]]}
      style={styles.container}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + Spacing.xl * 2,
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          entering={FadeInDown.duration(ANIM_DURATION_CONTENT).delay(
            ANIM_DELAY_SHORT,
          )}
          style={styles.header}
        >
          <View
            style={[
              styles.iconWrap,
              {
                backgroundColor: `${cp.neonGreen}20`,
                borderColor: `${cp.neonGreen}40`,
              },
            ]}
          >
            <Feather name="activity" size={36} color={cp.neonGreen} />
          </View>
          <Text
            style={[
              styles.eyebrow,
              { color: cp.neonGreen, fontSize: 11 * fontScale },
            ]}
          >
            {isWeekly ? `WEEK ${weekNumber} COMPLETE` : "CALIBRATION COMPLETE"}
          </Text>
          <Text
            style={[
              styles.heading,
              { color: cp.text, fontSize: 26 * fontScale },
            ]}
          >
            {isWeekly
              ? `How did Week ${weekNumber} feel overall?`
              : "How did that session feel?"}
          </Text>
          <Text
            style={[
              styles.subheading,
              { color: cp.textSecondary, fontSize: 15 * fontScale },
            ]}
          >
            {isWeekly
              ? "Your answer helps us tune the next week to your level."
              : "Your answer helps us personalise the rest of this week."}
          </Text>
        </Animated.View>

        {selected === null ? (
          <Animated.View
            entering={FadeInDown.duration(ANIM_DURATION_CONTENT).delay(
              ANIM_DELAY_MED,
            )}
            style={styles.optionsContainer}
          >
            {OPTIONS.map((option) => {
              const accent = cp[option.accentKey];
              return (
                <Pressable
                  key={option.level}
                  onPress={() => handleSelect(option.level)}
                  testID={`button-calibration-${option.level}`}
                  style={({ pressed }) => [
                    styles.optionCard,
                    {
                      backgroundColor: pressed
                        ? `${accent}20`
                        : isDarkMode
                          ? "rgba(255,255,255,0.05)"
                          : "rgba(255,255,255,0.85)",
                      borderColor: pressed ? `${accent}60` : `${accent}30`,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.optionIconWrap,
                      { backgroundColor: `${accent}20` },
                    ]}
                  >
                    <Feather name={option.icon} size={22} color={accent} />
                  </View>
                  <Text
                    style={[
                      styles.optionLabel,
                      { color: cp.text, fontSize: 18 * fontScale },
                    ]}
                  >
                    {option.label}
                  </Text>
                  <Feather
                    name="chevron-right"
                    size={20}
                    color={cp.textMuted}
                  />
                </Pressable>
              );
            })}
          </Animated.View>
        ) : (
          <Animated.View
            entering={FadeInUp.duration(ANIM_DURATION_CONTENT).delay(
              ANIM_DELAY_SHORT,
            )}
            style={styles.confirmationContainer}
          >
            <View
              style={[
                styles.selectedBadge,
                {
                  backgroundColor: `${accentColor}20`,
                  borderColor: `${accentColor}40`,
                },
              ]}
            >
              <Feather
                name={selectedOption!.icon}
                size={18}
                color={accentColor}
              />
              <Text
                style={[
                  styles.selectedBadgeText,
                  { color: accentColor, fontSize: 14 * fontScale },
                ]}
              >
                {selectedOption!.label}
              </Text>
            </View>

            <View
              style={[
                styles.confirmationCard,
                {
                  backgroundColor: isDarkMode
                    ? "rgba(26, 26, 46, 0.7)"
                    : "rgba(255,255,255,0.85)",
                  borderColor: `${accentColor}30`,
                },
              ]}
            >
              <Text
                style={[
                  styles.confirmationText,
                  { color: cp.textSecondary, fontSize: 16 * fontScale },
                ]}
              >
                {isWeekly
                  ? selectedOption!.weeklyConfirmation
                  : selectedOption!.confirmation}
              </Text>
            </View>
          </Animated.View>
        )}

        {selected !== null ? (
          <Animated.View
            entering={FadeInUp.duration(ANIM_DURATION_CONTENT).delay(
              ANIM_DELAY_LONG,
            )}
            style={styles.ctaContainer}
          >
            <Pressable
              onPress={handleContinue}
              disabled={isSaving}
              testID="button-calibration-continue"
              style={[
                styles.continueButton,
                { backgroundColor: accentColor, shadowColor: accentColor },
              ]}
            >
              <Feather name="arrow-right" size={20} color={cp.bg} />
              <Text
                style={[
                  styles.continueText,
                  { color: cp.bg, fontSize: 16 * fontScale },
                ]}
              >
                {isSaving ? "Saving..." : "Continue"}
              </Text>
            </Pressable>
          </Animated.View>
        ) : null}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.xl,
  },
  header: {
    alignItems: "center",
    gap: Spacing.md,
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  eyebrow: {
    fontWeight: "700",
    letterSpacing: 2,
    textAlign: "center",
  },
  heading: {
    fontWeight: "800",
    textAlign: "center",
    lineHeight: 34,
  },
  subheading: {
    textAlign: "center",
    lineHeight: 22,
  },
  optionsContainer: {
    gap: Spacing.md,
  },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  optionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  optionLabel: {
    flex: 1,
    fontWeight: "600",
  },
  confirmationContainer: {
    gap: Spacing.lg,
    alignItems: "center",
  },
  selectedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
  },
  selectedBadgeText: {
    fontWeight: "700",
  },
  confirmationCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.xl,
    width: "100%",
  },
  confirmationText: {
    lineHeight: 26,
    textAlign: "center",
  },
  ctaContainer: {
    paddingBottom: Spacing.md,
  },
  continueButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.lg,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  continueText: {
    fontWeight: "700",
  },
});
