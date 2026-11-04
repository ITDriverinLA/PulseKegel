import React from "react";
import {
  StyleSheet,
  View,
  Pressable,
  ScrollView,
  Text,
  PixelRatio,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { ThemedText } from "@/components/ThemedText";
import { useThemePreference } from "@/contexts/ThemePreferenceContext";
import { useAccessibility } from "@/contexts/AccessibilityContext";
import { Spacing, BorderRadius } from "@/constants/theme";
import { contentInsets, readableColumn } from "@/lib/windowLayout";
import { day1HowtoCopy, day1HowtoLayout } from "@/lib/day1Howto";
import type { AnatomyType } from "@/lib/storage";

interface Day1HowtoCardProps {
  anatomyType: AnatomyType;
  onContinue: () => void;
  onSkip: () => void;
  onClose: () => void;
  onMoreTips: () => void;
}

export function Day1HowtoCard({
  anatomyType,
  onContinue,
  onSkip,
  onClose,
  onMoreTips,
}: Day1HowtoCardProps) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { cp, isDarkMode } = useThemePreference();
  const { fontScale, largeText, highContrast, colors } = useAccessibility();
  const osFontScale =
    typeof PixelRatio.getFontScale === "function"
      ? PixelRatio.getFontScale()
      : 1;
  const layout = day1HowtoLayout({
    width,
    height,
    fontScale: Math.max(fontScale, osFontScale),
    largeText,
  });
  const copy = day1HowtoCopy(anatomyType);
  const textScale = largeText ? fontScale : 1;
  const bodySize = (layout.compact ? 15 : 16) * textScale;
  const headlineSize = (layout.compact ? 26 : 30) * textScale;
  const textColor = highContrast ? colors.text : cp.text;
  const secondaryColor = highContrast ? colors.textSecondary : cp.textSecondary;
  const maxMultiplier = layout.scrollBody ? 1.8 : 1.15;

  const body = (
    <View style={styles.copyBlock}>
      <Text
        maxFontSizeMultiplier={maxMultiplier}
        style={[
          styles.headline,
          {
            color: textColor,
            fontSize: headlineSize,
            lineHeight: headlineSize + 6,
          },
        ]}
      >
        {copy.headline}
      </Text>
      {copy.lines.map((line) => (
        <Text
          key={line}
          maxFontSizeMultiplier={maxMultiplier}
          style={[
            styles.line,
            {
              color: secondaryColor,
              fontSize: bodySize,
              lineHeight: bodySize + 6,
              marginTop: layout.compact ? Spacing.sm : Spacing.md,
            },
          ]}
        >
          {line}
        </Text>
      ))}
      <Pressable
        onPress={onMoreTips}
        accessibilityRole="button"
        accessibilityLabel={copy.moreTipsLabel}
        testID="button-howto-more-tips"
        style={styles.tipsLink}
      >
        <Feather name="help-circle" size={16} color={cp.neonCyan} />
        <ThemedText
          type="body"
          maxFontSizeMultiplier={maxMultiplier}
          style={{
            color: cp.neonCyan,
            marginLeft: Spacing.xs,
            fontSize: bodySize,
          }}
        >
          {copy.moreTipsLabel}
        </ThemedText>
      </Pressable>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: cp.bg }]}>
      <LinearGradient
        colors={cp.gradient as unknown as [string, string, ...string[]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[
          styles.content,
          contentInsets(insets, {
            top: Spacing.lg,
            bottom: Spacing.lg,
            horizontal: Spacing.xl,
          }),
        ]}
      >
        <View style={styles.header}>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
            testID="button-howto-close"
            style={styles.headerButton}
          >
            <Feather name="x" size={24} color={textColor} />
          </Pressable>
          <View style={{ flex: 1 }} />
          <Pressable
            onPress={onMoreTips}
            accessibilityRole="button"
            accessibilityLabel={copy.moreTipsLabel}
            testID="button-howto-help"
            style={styles.headerButton}
          >
            <Feather name="help-circle" size={24} color={textColor} />
          </Pressable>
        </View>

        {layout.scrollBody ? (
          <ScrollView
            style={styles.bodyScroll}
            contentContainerStyle={styles.bodyScrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {body}
          </ScrollView>
        ) : (
          <View style={styles.bodyFixed}>{body}</View>
        )}

        <View style={styles.actions}>
          <Pressable
            onPress={onContinue}
            accessibilityRole="button"
            accessibilityLabel={copy.continueLabel}
            testID="button-howto-continue"
            style={styles.primaryPress}
          >
            <LinearGradient
              colors={[cp.neonGreen, isDarkMode ? "#00CC66" : "#00994D"]}
              style={styles.primaryButton}
            >
              <Text
                maxFontSizeMultiplier={maxMultiplier}
                style={[styles.primaryLabel, { fontSize: 17 * textScale }]}
              >
                {copy.continueLabel}
              </Text>
            </LinearGradient>
          </Pressable>
          <Pressable
            onPress={onSkip}
            accessibilityRole="button"
            accessibilityLabel={copy.skipLabel}
            testID="button-howto-skip"
            style={[styles.secondaryButton, { borderColor: cp.cardBorder }]}
          >
            <Text
              maxFontSizeMultiplier={maxMultiplier}
              style={[
                styles.secondaryLabel,
                { color: textColor, fontSize: 16 * textScale },
              ]}
            >
              {copy.skipLabel}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    ...readableColumn,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  bodyFixed: {
    flex: 1,
    justifyContent: "center",
  },
  bodyScroll: {
    flex: 1,
  },
  bodyScrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingVertical: Spacing.md,
  },
  copyBlock: {
    width: "100%",
  },
  headline: {
    fontWeight: "800",
  },
  line: {
    fontWeight: "500",
  },
  tipsLink: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginTop: Spacing.lg,
    minHeight: 44,
  },
  actions: {
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  primaryPress: {
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  primaryButton: {
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  primaryLabel: {
    color: "#000",
    fontWeight: "700",
    textAlign: "center",
  },
  secondaryButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  secondaryLabel: {
    fontWeight: "600",
    textAlign: "center",
  },
});
