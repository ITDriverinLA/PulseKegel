import React, { useCallback, useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  Alert,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";

import { Spacing, BorderRadius } from "@/constants/theme";
import { ANIM_DURATION_CONTENT, ANIM_DELAY_SHORT } from "@/constants/animation";
import { useThemePreference } from "@/contexts/ThemePreferenceContext";
import {
  getTransferChecklistSteps,
  pickAndImportBackup,
  shareEncryptedBackup,
} from "@/lib/progressTransfer";
import {
  disableCloudSyncOptIn,
  enableCloudSyncOptIn,
  exchangeIdentityForSyncToken,
  getCloudSyncState,
  pullAndMergeIfOptedIn,
  pushProgressIfOptedIn,
  type CloudSyncState,
} from "@/lib/cloudSync";

/**
 * G1b — "Moving to a new phone?" checklist + Path A opt-in controls.
 * Coach-not-doctor copy only. Default remains local-only.
 */
export default function TransferChecklistScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { cp } = useThemePreference();
  const steps = getTransferChecklistSteps();

  const [passphrase, setPassphrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [syncState, setSyncState] = useState<CloudSyncState | null>(null);

  const refreshSync = useCallback(async () => {
    setSyncState(await getCloudSyncState());
  }, []);

  React.useEffect(() => {
    void refreshSync();
  }, [refreshSync]);

  const ensurePassphrase = (): boolean => {
    if (passphrase.trim().length < 4) {
      Alert.alert(
        "Passphrase needed",
        "Choose a passphrase of at least 4 characters to encrypt your backup.",
      );
      return false;
    }
    return true;
  };

  const handleExport = async () => {
    if (!ensurePassphrase()) return;
    setBusy(true);
    try {
      await shareEncryptedBackup(passphrase.trim());
      Alert.alert(
        "Backup ready",
        "Share the file via AirDrop or Files. Keep your passphrase — it is not stored in the cloud.",
      );
    } catch (e) {
      Alert.alert(
        "Export failed",
        e instanceof Error ? e.message : "Could not export backup",
      );
    } finally {
      setBusy(false);
    }
  };

  const handleImport = async () => {
    if (!ensurePassphrase()) return;
    setBusy(true);
    try {
      const result = await pickAndImportBackup(passphrase.trim(), {
        merge: true,
      });
      if (!result.ok) {
        if (result.blocked) {
          Alert.alert(
            "Empty backup",
            result.error + " Overwrite local progress?",
            [
              { text: "No (keep local)", style: "cancel" },
              {
                text: "Overwrite",
                style: "destructive",
                onPress: () => {
                  void (async () => {
                    const again = await pickAndImportBackup(passphrase.trim(), {
                      merge: true,
                      confirmEmptyOverwrite: true,
                    });
                    Alert.alert(
                      again.ok ? "Imported" : "Import failed",
                      again.ok
                        ? "Progress restored from backup."
                        : again.error,
                    );
                  })();
                },
              },
            ],
          );
        } else {
          Alert.alert("Import failed", result.error);
        }
        return;
      }
      Alert.alert(
        "Import complete",
        "Progress and settings restored. Network and account were not required.",
      );
    } finally {
      setBusy(false);
    }
  };

  const handleEnableCloud = () => {
    Alert.alert(
      "Save progress to cloud?",
      "PulseKegel can save your training progress and settings to our servers so you can restore them on a new phone after signing in with Apple or Google.\n\nStored: challenge progress, streaks, session history, settings, tips seen.\nNot stored: workout audio payloads, analytics device keys, OS permissions, passwords.\n\nDefault is local-only. You can turn this off anytime and delete the remote copy.",
      [
        { text: "Keep local-only", style: "cancel" },
        {
          text: "Enable cloud sync",
          onPress: () => {
            void (async () => {
              await enableCloudSyncOptIn({
                provider: Platform.OS === "ios" ? "apple" : "google",
              });
              // Auth requires Ashley-configured client IDs. Dev token path for labs:
              const provider = Platform.OS === "ios" ? "apple" : "google";
              const auth = await exchangeIdentityForSyncToken({
                provider,
                identityToken: `dev:pending-ashley-config`,
              });
              if (!auth.ok) {
                Alert.alert(
                  "Cloud sync enabled (local flag)",
                  "Opt-in saved. Sign-in needs Apple/Google client IDs (Ashley config). No progress was uploaded yet.",
                );
              } else {
                const pushed = await pushProgressIfOptedIn();
                Alert.alert(
                  "Cloud sync on",
                  pushed.ok && !("skipped" in pushed && pushed.skipped)
                    ? "Progress uploaded."
                    : "Signed in. Upload pending — check connection.",
                );
              }
              await refreshSync();
            })();
          },
        },
      ],
    );
  };

  const handleDisableCloud = () => {
    Alert.alert(
      "Turn off cloud sync?",
      "Uploads will stop. Delete the remote copy stored on our servers?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Stop uploads only",
          onPress: () => {
            void (async () => {
              await disableCloudSyncOptIn({ deleteRemote: false });
              await refreshSync();
            })();
          },
        },
        {
          text: "Stop & delete remote",
          style: "destructive",
          onPress: () => {
            void (async () => {
              const { remoteDeleted } = await disableCloudSyncOptIn({
                deleteRemote: true,
              });
              Alert.alert(
                "Cloud sync off",
                remoteDeleted
                  ? "Remote copy deleted."
                  : "Uploads stopped. Remote delete may need a prior sign-in.",
              );
              await refreshSync();
            })();
          },
        },
      ],
    );
  };

  const handlePull = async () => {
    setBusy(true);
    try {
      const result = await pullAndMergeIfOptedIn();
      if ("skipped" in result && result.skipped) {
        Alert.alert("Nothing to pull", `Skipped (${result.reason}).`);
      } else if (!result.ok) {
        Alert.alert("Pull failed", result.error);
      } else {
        Alert.alert(
          "Synced",
          result.conflict
            ? "Merged with conflict rules (union / LWW / tips OR)."
            : "Remote progress merged.",
        );
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: cp.background }]}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.md,
        paddingBottom: insets.bottom + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
    >
      <Animated.View entering={FadeInDown.duration(ANIM_DURATION_CONTENT)}>
        <Text style={[styles.lead, { color: cp.textSecondary }]}>
          Progress stays on this phone by default. Use a local encrypted backup
          to move phones without an account or network. Cloud sync is optional
          and off until you explicitly enable it.
        </Text>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.duration(ANIM_DURATION_CONTENT).delay(
          ANIM_DELAY_SHORT,
        )}
      >
        <Text style={[styles.sectionTitle, { color: cp.neonCyan }]}>
          LOCAL BACKUP (NO CLOUD)
        </Text>
        <View
          style={[
            styles.card,
            { backgroundColor: cp.cardBg, borderColor: cp.cardBorder },
          ]}
        >
          {steps.map((step, i) => (
            <View key={step.id}>
              {i > 0 && (
                <View style={[styles.divider, { backgroundColor: cp.divider }]} />
              )}
              <View style={styles.stepRow}>
                <Feather name="check-circle" size={18} color={cp.neonGreen} />
                <View style={styles.stepText}>
                  <Text style={[styles.stepTitle, { color: cp.text }]}>
                    {step.title}
                  </Text>
                  <Text style={[styles.stepDetail, { color: cp.textSecondary }]}>
                    {step.detail}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        <Text style={[styles.label, { color: cp.textSecondary }]}>
          Backup passphrase
        </Text>
        <TextInput
          value={passphrase}
          onChangeText={setPassphrase}
          secureTextEntry
          placeholder="Min 4 characters"
          placeholderTextColor={cp.textMuted}
          style={[
            styles.input,
            {
              color: cp.text,
              borderColor: cp.cardBorder,
              backgroundColor: cp.cardBg,
            },
          ]}
          autoCapitalize="none"
          autoCorrect={false}
          testID="input-backup-passphrase"
        />

        <Pressable
          onPress={handleExport}
          disabled={busy}
          style={[styles.primaryBtn, { backgroundColor: cp.neonGreen }]}
          testID="button-export-backup"
        >
          <Feather name="upload" size={18} color="#0a0a1a" />
          <Text style={styles.primaryBtnText}>Export & share backup</Text>
        </Pressable>

        <Pressable
          onPress={handleImport}
          disabled={busy}
          style={[
            styles.secondaryBtn,
            { borderColor: cp.neonCyan },
          ]}
          testID="button-import-backup"
        >
          <Feather name="download" size={18} color={cp.neonCyan} />
          <Text style={[styles.secondaryBtnText, { color: cp.neonCyan }]}>
            Import backup file
          </Text>
        </Pressable>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.duration(ANIM_DURATION_CONTENT).delay(120)}
      >
        <Text style={[styles.sectionTitle, { color: cp.neonCyan }]}>
          CLOUD SYNC (OPT-IN)
        </Text>
        <View
          style={[
            styles.card,
            { backgroundColor: cp.cardBg, borderColor: cp.cardBorder },
          ]}
        >
          <Text style={[styles.stepDetail, { color: cp.textSecondary }]}>
            Status:{" "}
            {syncState?.optIn
              ? `On (${syncState.provider})`
              : "Off — local-only (default)"}
          </Text>
          {!syncState?.optIn ? (
            <Pressable
              onPress={handleEnableCloud}
              style={styles.linkRow}
              testID="button-enable-cloud-sync"
            >
              <Feather name="cloud" size={18} color={cp.neonGreen} />
              <Text style={[styles.linkText, { color: cp.neonGreen }]}>
                Save progress to cloud…
              </Text>
            </Pressable>
          ) : (
            <>
              <Pressable onPress={handlePull} style={styles.linkRow}>
                <Feather name="refresh-cw" size={18} color={cp.neonCyan} />
                <Text style={[styles.linkText, { color: cp.neonCyan }]}>
                  Pull & merge from cloud
                </Text>
              </Pressable>
              <View style={[styles.divider, { backgroundColor: cp.divider }]} />
              <Pressable
                onPress={handleDisableCloud}
                style={styles.linkRow}
                testID="button-disable-cloud-sync"
              >
                <Feather name="cloud-off" size={18} color={cp.neonPink} />
                <Text style={[styles.linkText, { color: cp.neonPink }]}>
                  Turn off cloud sync…
                </Text>
              </Pressable>
            </>
          )}
        </View>
        <Text style={[styles.disclaimer, { color: cp.textMuted }]}>
          Not medical advice. Cloud sync stores training progress only — never
          diagnoses or health records. Apple/Google Sign-In client IDs are
          configured by the app owner.
        </Text>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  lead: { fontSize: 14, lineHeight: 20, marginBottom: Spacing.lg },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },
  card: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  stepRow: { flexDirection: "row", gap: Spacing.sm, paddingVertical: Spacing.sm },
  stepText: { flex: 1 },
  stepTitle: { fontSize: 15, fontWeight: "600", marginBottom: 4 },
  stepDetail: { fontSize: 13, lineHeight: 18 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 4 },
  label: { fontSize: 12, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    marginBottom: Spacing.md,
    fontSize: 16,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  primaryBtnText: { fontWeight: "700", color: "#0a0a1a", fontSize: 15 },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  secondaryBtnText: { fontWeight: "600", fontSize: 15 },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  linkText: { fontSize: 15, fontWeight: "600" },
  disclaimer: { fontSize: 11, lineHeight: 16, marginTop: Spacing.sm },
});
