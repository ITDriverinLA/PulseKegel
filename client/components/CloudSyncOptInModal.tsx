import React from "react";
import { Modal, View, Text, Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { Spacing, BorderRadius } from "@/constants/theme";
import { useThemePreference } from "@/contexts/ThemePreferenceContext";

type Props = {
  visible: boolean;
  onEnable: () => void;
  onDismiss: () => void;
};

/**
 * Soft prompt after first-session complete. Dismiss = stay local-only (OP1/OP4).
 */
export function CloudSyncOptInModal({ visible, onEnable, onDismiss }: Props) {
  const { cp, isDarkMode } = useThemePreference();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        <View style={[styles.container, { borderColor: `${cp.neonCyan}4D` }]}>
          <LinearGradient
            colors={
              isDarkMode
                ? ["#1a1a2e", "#16213e", "#0f0f23"]
                : ["#fff", "#f8f9fb", "#f0f2f7"]
            }
            style={styles.gradient}
          >
            <View
              style={[styles.iconWrap, { backgroundColor: `${cp.neonCyan}26` }]}
            >
              <Feather name="cloud" size={40} color={cp.neonCyan} />
            </View>
            <Text style={[styles.title, { color: cp.text }]}>
              Save progress to cloud?
            </Text>
            <Text style={[styles.body, { color: cp.textSecondary }]}>
              Optional. By default PulseKegel keeps progress only on this phone.
              Enabling stores training progress and settings on our servers so
              you can restore after sign-in on a new device.
              {"\n\n"}
              You can use a local encrypted backup instead (Settings → Moving to
              a new phone?) with no account required.
            </Text>
            <Pressable
              onPress={onEnable}
              style={[styles.primary, { backgroundColor: cp.neonGreen }]}
              testID="button-cloud-optin-enable"
            >
              <Text style={styles.primaryText}>Save progress to cloud…</Text>
            </Pressable>
            <Pressable
              onPress={onDismiss}
              style={styles.secondary}
              testID="button-cloud-optin-dismiss"
            >
              <Text style={[styles.secondaryText, { color: cp.textSecondary }]}>
                Keep local-only
              </Text>
            </Pressable>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    padding: Spacing.lg,
  },
  container: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  gradient: { padding: Spacing.lg },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  body: { fontSize: 14, lineHeight: 20, marginBottom: Spacing.lg },
  primary: {
    paddingVertical: 14,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  primaryText: { fontWeight: "700", color: "#0a0a1a", fontSize: 15 },
  secondary: { paddingVertical: 12, alignItems: "center" },
  secondaryText: { fontSize: 14, fontWeight: "600" },
});
