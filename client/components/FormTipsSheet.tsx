import React from "react";
import { StyleSheet, View, Modal, Pressable, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { useThemePreference } from "@/contexts/ThemePreferenceContext";
import { Spacing, BorderRadius } from "@/constants/theme";

interface FormTipsSheetProps {
  visible: boolean;
  onClose: () => void;
}

const tips = [
  {
    icon: "wind" as const,
    title: "Breathe Normally",
    description:
      "Don't hold your breath during exercises. Keep breathing steadily throughout.",
  },
  {
    icon: "x-circle" as const,
    title: "Isolate the Muscles",
    description:
      "Avoid squeezing your glutes, thighs, or abdominal muscles. Focus only on the pelvic floor.",
  },
  {
    icon: "refresh-cw" as const,
    title: "Full Relaxation Matters",
    description:
      "Complete relaxation between squeezes is just as important as the squeeze itself.",
  },
  {
    icon: "alert-triangle" as const,
    title: "Don't Practice While Urinating",
    description:
      "Never practice these exercises by stopping urine midstream. This can lead to bladder issues.",
  },
  {
    icon: "clock" as const,
    title: "Be Patient",
    description:
      "Results take time. Most people notice improvements after 4-6 weeks of consistent practice.",
  },
];

export function FormTipsSheet({ visible, onClose }: FormTipsSheetProps) {
  const { cp, isDarkMode } = useThemePreference();
  const insets = useSafeAreaInsets();

  const sheetBg = isDarkMode ? "#1a1a2e" : "#ffffff";
  const cardBg = isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)";
  const iconBg = isDarkMode ? `${cp.neonGreen}20` : `${cp.neonGreen}15`;
  const accentColor = cp.neonGreen;
  const handleColor = isDarkMode ? "rgba(255,255,255,0.2)" : "#D1D5DB";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: sheetBg,
              paddingBottom: insets.bottom + Spacing.xl,
            },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: handleColor }]} />

          <View style={styles.header}>
            <ThemedText type="h3" style={{ color: cp.text }}>
              Form Tips
            </ThemedText>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Feather name="x" size={24} color={cp.text} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {tips.map((tip, index) => (
              <View
                key={index}
                style={[styles.tipCard, { backgroundColor: cardBg }]}
              >
                <View style={[styles.tipIcon, { backgroundColor: iconBg }]}>
                  <Feather name={tip.icon} size={20} color={accentColor} />
                </View>
                <View style={styles.tipContent}>
                  <ThemedText
                    type="body"
                    style={[styles.tipTitle, { color: cp.text }]}
                  >
                    {tip.title}
                  </ThemedText>
                  <ThemedText
                    type="small"
                    style={[styles.tipDescription, { color: cp.textSecondary }]}
                  >
                    {tip.description}
                  </ThemedText>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  sheet: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.xl,
    maxHeight: "80%",
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: Spacing.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.lg,
  },
  closeButton: {
    padding: Spacing.xs,
  },
  scrollContent: {
    paddingBottom: Spacing.md,
  },
  tipCard: {
    flexDirection: "row",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  tipIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  tipContent: {
    flex: 1,
  },
  tipTitle: {
    fontWeight: "600",
    marginBottom: Spacing.xs,
  },
  tipDescription: {
    lineHeight: 20,
  },
});
