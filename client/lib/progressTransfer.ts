/**
 * Path B — Local encrypted backup export/import (phone-to-phone, no cloud).
 * Works offline / no account (OP2).
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform, Share } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import {
  PROGRESS_TRANSFER_SCHEMA_VERSION,
  type ProgressTransferPayload,
  type TransferProgress,
  type TransferSettings,
  mergeTransferPayloads,
  pruneInProgressSession,
  validateTransferPayload,
} from "@shared/progressTransfer";
import { storage, defaultSettings, type UserSettings } from "./storage";
import {
  decryptBackupPayload,
  encryptBackupPayload,
  looksLikeEncryptedBackup,
} from "./backupCrypto";
import { trackEvent } from "./analytics";

const BACKUP_FILENAME = "pulsekegel-progress-backup.pkb";

/** Keys intentionally excluded from backup (analytics, ephemeral, secrets). */
const EXCLUDED_KEY_PREFIXES = [
  "pulsekegel_analytics_",
  "pulsekegel_cloud_sync_token",
];

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function readString(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function buildTransferPayload(): Promise<ProgressTransferPayload> {
  const [
    settings,
    audio,
    completed,
    rest,
    workoutRaw,
    totalSessions,
    totalMinutes,
    programStart,
    onboardingComplete,
    firstCelebrated,
    programProgress,
    controlScore,
    badges,
    reviews,
    calibration,
    optionalDates,
    daysStarted,
    daysCompleted,
    dayViewed,
    segmentHistory,
    ranksNotified,
    tipSeen,
    stepIndex,
    sessionId,
    inProgressFlag,
  ] = await Promise.all([
    storage.getSettings(),
    storage.getAudioSettings(),
    storage.getCompletedDates(),
    storage.getRestDates(),
    readString("pulsekegel_workout_dates"),
    storage.getTotalSessions(),
    storage.getTotalMinutes(),
    storage.getProgramStartDate(),
    storage.isOnboardingComplete(),
    storage.hasCelebratedFirstSession(),
    storage.getProgramProgress(),
    storage.getControlScoreState(),
    storage.getEarnedBadges(),
    storage.getReviewHistory(),
    readJson<Record<string, unknown> | null>(
      "pulsekegel_challenge_calibration",
      null,
    ),
    storage.getChallengeOptionalDates(),
    readJson("pulsekegel_challenge_days_started", null),
    readJson("pulsekegel_challenge_days_completed", null),
    readJson("pulsekegel_challenge_day_viewed", null),
    storage.getSegmentTypeHistory(),
    readJson("pulsekegel_ranks_notified", null),
    storage.hasSettingsTipSeen(),
    storage.getFirstSessionStepIndex(),
    storage.getFirstSessionId(),
    storage.isFirstSessionInProgress(),
  ]);

  let workoutDates: string[] = [];
  if (workoutRaw) {
    try {
      workoutDates = JSON.parse(workoutRaw) as string[];
    } catch {
      workoutDates = [];
    }
  }

  let inProgress = null;
  if (inProgressFlag && sessionId && stepIndex !== null) {
    inProgress = pruneInProgressSession({
      step_index: stepIndex,
      session_id: sessionId,
      updated_at: new Date().toISOString(),
    });
  }

  const progress: TransferProgress = {
    completed_dates: completed,
    workout_dates: workoutDates,
    rest_dates: rest,
    total_sessions: totalSessions,
    total_minutes: totalMinutes,
    program_start_date: programStart,
    onboarding_complete: onboardingComplete,
    first_session_celebrated: firstCelebrated,
    program_progress: programProgress as unknown as Record<string, unknown>,
    control_score_state: controlScore as unknown as Record<string, unknown>,
    earned_badges: badges,
    review_history: reviews,
    challenge_calibration: calibration,
    challenge_optional_dates: optionalDates,
    challenge_days_started: daysStarted,
    challenge_days_completed: daysCompleted,
    challenge_day_viewed: dayViewed,
    segment_type_history: segmentHistory,
    ranks_notified: ranksNotified,
  };

  return {
    schema_version: PROGRESS_TRANSFER_SCHEMA_VERSION,
    exported_at: new Date().toISOString(),
    progress,
    settings: settings as TransferSettings,
    audio_settings: audio,
    in_progress_session: inProgress,
    tips_seen: { settings_tip_seen: tipSeen },
    purchases_cache: {},
  };
}

export async function applyTransferPayload(
  payload: ProgressTransferPayload,
  opts: { merge?: boolean; confirmEmptyOverwrite?: boolean } = {},
): Promise<{ applied: ProgressTransferPayload; blocked?: boolean }> {
  const validated = validateTransferPayload(payload);
  if (!validated.ok) {
    throw new Error(validated.error);
  }

  let toApply = validated.payload;
  toApply = {
    ...toApply,
    in_progress_session: pruneInProgressSession(toApply.in_progress_session),
  };

  if (opts.merge) {
    const local = await buildTransferPayload();
    const result = mergeTransferPayloads(local, toApply, {
      confirmEmptyOverwrite: opts.confirmEmptyOverwrite,
    });
    if (result.emptyOverwriteRequiresConfirm) {
      return { applied: local, blocked: true };
    }
    toApply = result.merged;
  }

  const p = toApply.progress;
  await AsyncStorage.setItem(
    "pulsekegel_completed_dates",
    JSON.stringify(p.completed_dates),
  );
  await AsyncStorage.setItem(
    "pulsekegel_workout_dates",
    JSON.stringify(p.workout_dates),
  );
  await AsyncStorage.setItem(
    "pulsekegel_rest_dates",
    JSON.stringify(p.rest_dates),
  );
  await AsyncStorage.setItem(
    "pulsekegel_total_sessions",
    String(p.total_sessions),
  );
  await AsyncStorage.setItem(
    "pulsekegel_total_minutes",
    String(p.total_minutes),
  );

  if (p.program_start_date) {
    await storage.setProgramStartDate(p.program_start_date);
  }
  if (p.onboarding_complete) {
    await storage.setOnboardingComplete();
  }
  if (p.first_session_celebrated) {
    await storage.markFirstSessionCelebrated();
  }
  if (p.program_progress) {
    await storage.saveProgramProgress(p.program_progress as never);
  }
  if (p.control_score_state) {
    await AsyncStorage.setItem(
      "pulsekegel_control_score_state",
      JSON.stringify(p.control_score_state),
    );
  }
  if (p.earned_badges?.length) {
    await AsyncStorage.setItem(
      "pulsekegel_earned_badges",
      JSON.stringify(p.earned_badges),
    );
  }
  if (p.review_history?.length) {
    await AsyncStorage.setItem(
      "pulsekegel_review_history",
      JSON.stringify(p.review_history),
    );
  }
  if (p.challenge_calibration) {
    await AsyncStorage.setItem(
      "pulsekegel_challenge_calibration",
      JSON.stringify(p.challenge_calibration),
    );
  }
  await AsyncStorage.setItem(
    "pulsekegel_challenge_optional_dates",
    JSON.stringify(p.challenge_optional_dates ?? []),
  );
  if (p.challenge_days_started != null) {
    await AsyncStorage.setItem(
      "pulsekegel_challenge_days_started",
      JSON.stringify(p.challenge_days_started),
    );
  }
  if (p.challenge_days_completed != null) {
    await AsyncStorage.setItem(
      "pulsekegel_challenge_days_completed",
      JSON.stringify(p.challenge_days_completed),
    );
  }
  if (p.challenge_day_viewed != null) {
    await AsyncStorage.setItem(
      "pulsekegel_challenge_day_viewed",
      JSON.stringify(p.challenge_day_viewed),
    );
  }
  if (p.segment_type_history?.length) {
    await AsyncStorage.setItem(
      "pulsekegel_segment_type_history",
      JSON.stringify(p.segment_type_history),
    );
  }
  if (p.ranks_notified != null) {
    await AsyncStorage.setItem(
      "pulsekegel_ranks_notified",
      JSON.stringify(p.ranks_notified),
    );
  }

  const settings: UserSettings = {
    ...defaultSettings,
    ...toApply.settings,
  };
  await storage.saveSettings(settings);
  if (toApply.audio_settings && Object.keys(toApply.audio_settings).length) {
    await storage.saveAudioSettings(toApply.audio_settings);
  }
  if (toApply.tips_seen.settings_tip_seen) {
    await storage.markSettingsTipSeen();
  }

  if (toApply.in_progress_session) {
    await storage.setFirstSessionId(toApply.in_progress_session.session_id);
    await storage.setFirstSessionInProgress(
      true,
      0,
      toApply.in_progress_session.step_index,
    );
  }

  return { applied: toApply };
}

export async function exportEncryptedBackup(passphrase: string): Promise<{
  envelope: string;
  fileUri: string | null;
}> {
  trackEvent("transfer_flow_started", { path: "local_export" });
  const payload = await buildTransferPayload();
  const envelope = await encryptBackupPayload(
    JSON.stringify(payload),
    passphrase,
    PROGRESS_TRANSFER_SCHEMA_VERSION,
  );

  let fileUri: string | null = null;
  try {
    const base =
      FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? null;
    if (base) {
      fileUri = `${base}${BACKUP_FILENAME}`;
      await FileSystem.writeAsStringAsync(fileUri, envelope, {
        encoding: FileSystem.EncodingType.UTF8,
      });
    }
  } catch {
    fileUri = null;
  }

  return { envelope, fileUri };
}

export async function shareEncryptedBackup(passphrase: string): Promise<void> {
  const { envelope, fileUri } = await exportEncryptedBackup(passphrase);

  if (fileUri && (await Sharing.isAvailableAsync())) {
    await Sharing.shareAsync(fileUri, {
      mimeType: "application/json",
      dialogTitle: "Share PulseKegel backup",
      UTI: "public.json",
    });
    trackEvent("transfer_flow_completed", { path: "local_export_file" });
    return;
  }

  await Share.share(
    Platform.OS === "ios"
      ? { message: envelope }
      : { message: envelope, title: BACKUP_FILENAME },
  );
  trackEvent("transfer_flow_completed", {
    path: fileUri ? "local_export_share_fallback" : "local_export_text",
  });
}

export async function pickAndImportBackup(
  passphrase: string,
  opts: { merge?: boolean; confirmEmptyOverwrite?: boolean } = {},
): Promise<{ ok: true } | { ok: false; error: string; blocked?: boolean }> {
  trackEvent("transfer_flow_started", { path: "local_import" });
  try {
    const picked = await DocumentPicker.getDocumentAsync({
      type: ["application/json", "text/plain", "*/*"],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (picked.canceled || !picked.assets?.[0]?.uri) {
      trackEvent("transfer_flow_fallback_backup", { reason: "cancelled" });
      return { ok: false, error: "Import cancelled" };
    }
    const uri = picked.assets[0].uri;
    const text = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    return importBackupText(text, passphrase, opts);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Import failed";
    trackEvent("transfer_flow_fallback_backup", { reason: "error" });
    return { ok: false, error: msg };
  }
}

export async function importBackupText(
  text: string,
  passphrase: string,
  opts: { merge?: boolean; confirmEmptyOverwrite?: boolean } = {},
): Promise<{ ok: true } | { ok: false; error: string; blocked?: boolean }> {
  try {
    let jsonText = text.trim();
    if (looksLikeEncryptedBackup(jsonText)) {
      jsonText = await decryptBackupPayload(jsonText, passphrase);
    } else if (passphrase) {
      // Allow plaintext JSON for recovery tooling, but prefer encrypted.
    }
    const parsed = JSON.parse(jsonText) as unknown;
    const validated = validateTransferPayload(parsed);
    if (!validated.ok) {
      trackEvent("transfer_flow_fallback_backup", { reason: "invalid_schema" });
      return { ok: false, error: validated.error };
    }
    const result = await applyTransferPayload(validated.payload, opts);
    if (result.blocked) {
      trackEvent("transfer_flow_fallback_backup", {
        reason: "empty_overwrite_blocked",
      });
      return {
        ok: false,
        error:
          "Incoming backup is empty. Confirm overwrite to replace local progress.",
        blocked: true,
      };
    }
    trackEvent("transfer_flow_completed", { path: "local_import" });
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Import failed";
    trackEvent("transfer_flow_fallback_backup", { reason: "decrypt_or_parse" });
    return { ok: false, error: msg };
  }
}

/** Used by checklist UI — does not touch network. */
export function getTransferChecklistSteps(): {
  id: string;
  title: string;
  detail: string;
}[] {
  return [
    {
      id: "export",
      title: "1. Export encrypted backup on this phone",
      detail:
        "Choose a passphrase you will remember. Your progress stays on-device until you share the file.",
    },
    {
      id: "share",
      title: "2. AirDrop / Files / share the backup file",
      detail:
        "Send pulsekegel-progress-backup.pkb to your new phone. No account or cloud required.",
    },
    {
      id: "import",
      title: "3. Import on the new phone (network optional)",
      detail:
        "Open Settings → Moving to a new phone? → Import. Enter the same passphrase. Works offline.",
    },
    {
      id: "verify",
      title: "4. Verify progress & settings",
      detail:
        "Check challenge day, streaks, and settings. Purchases restore via App Store / Play.",
    },
  ];
}

// Silence unused — kept for future audit tooling.
void EXCLUDED_KEY_PREFIXES;
