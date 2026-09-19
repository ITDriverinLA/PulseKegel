/**
 * Path A — Opt-in-gated cloud / iCloud-style sync plumbing.
 * HARD CONSTRAINT: ZERO progress writes to server until explicit opt-in (OP1).
 * Default OFF. Fresh install never uploads until opt-in.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import {
  mergeTransferPayloads,
  validateTransferPayload,
} from "@shared/progressTransfer";
import { getApiUrl } from "./query-client";
import { trackEvent } from "./analytics";
import {
  applyTransferPayload,
  buildTransferPayload,
} from "./progressTransfer";

const KEYS = {
  OPT_IN: "pulsekegel_cloud_sync_opt_in",
  PROMPT_DISMISSED: "pulsekegel_cloud_sync_prompt_dismissed",
  ACCOUNT_ID: "pulsekegel_cloud_sync_account_id",
  /** Session token after auth — never include in backup/analytics. */
  TOKEN: "pulsekegel_cloud_sync_token",
  PROVIDER: "pulsekegel_cloud_sync_provider",
  LAST_PULL_AT: "pulsekegel_cloud_sync_last_pull",
  LAST_PUSH_AT: "pulsekegel_cloud_sync_last_push",
  REMOTE_DELETED: "pulsekegel_cloud_sync_remote_deleted",
} as const;

export type CloudSyncProvider = "apple" | "google" | "none";

export type CloudSyncState = {
  optIn: boolean;
  promptDismissed: boolean;
  accountId: string | null;
  provider: CloudSyncProvider;
  lastPullAt: string | null;
  lastPushAt: string | null;
};

async function getFlag(key: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(key)) === "true";
  } catch {
    return false;
  }
}

export async function getCloudSyncState(): Promise<CloudSyncState> {
  const [optIn, promptDismissed, accountId, provider, lastPullAt, lastPushAt] =
    await Promise.all([
      getFlag(KEYS.OPT_IN),
      getFlag(KEYS.PROMPT_DISMISSED),
      AsyncStorage.getItem(KEYS.ACCOUNT_ID),
      AsyncStorage.getItem(KEYS.PROVIDER),
      AsyncStorage.getItem(KEYS.LAST_PULL_AT),
      AsyncStorage.getItem(KEYS.LAST_PUSH_AT),
    ]);
  const p =
    provider === "apple" || provider === "google" ? provider : "none";
  return {
    optIn,
    promptDismissed,
    accountId,
    provider: p,
    lastPullAt,
    lastPushAt,
  };
}

/** OP1: default false — never treat missing key as opted in. */
export async function isCloudSyncOptedIn(): Promise<boolean> {
  return getFlag(KEYS.OPT_IN);
}

/**
 * Affirmative opt-in (OP4). Auth + uploads only after this returns true path.
 * Does not itself upload — caller must then authenticate and push.
 */
export async function enableCloudSyncOptIn(meta?: {
  provider?: CloudSyncProvider;
}): Promise<void> {
  await AsyncStorage.setItem(KEYS.OPT_IN, "true");
  if (meta?.provider && meta.provider !== "none") {
    await AsyncStorage.setItem(KEYS.PROVIDER, meta.provider);
  }
  trackEvent("sync_enabled", {
    provider: meta?.provider ?? "none",
    platform: Platform.OS,
  });
}

/**
 * OP3: opt-out stops uploads; optionally delete remote copy.
 */
export async function disableCloudSyncOptIn(opts?: {
  deleteRemote?: boolean;
}): Promise<{ remoteDeleted: boolean }> {
  await AsyncStorage.setItem(KEYS.OPT_IN, "false");
  let remoteDeleted = false;
  if (opts?.deleteRemote) {
    remoteDeleted = await deleteRemoteCopy();
  }
  await AsyncStorage.multiRemove([
    KEYS.TOKEN,
    KEYS.ACCOUNT_ID,
    KEYS.LAST_PULL_AT,
    KEYS.LAST_PUSH_AT,
  ]);
  return { remoteDeleted };
}

export async function dismissCloudSyncPrompt(): Promise<void> {
  await AsyncStorage.setItem(KEYS.PROMPT_DISMISSED, "true");
}

export async function shouldShowCloudSyncPrompt(): Promise<boolean> {
  const [optIn, dismissed, celebrated] = await Promise.all([
    isCloudSyncOptedIn(),
    getFlag(KEYS.PROMPT_DISMISSED),
    AsyncStorage.getItem("pulsekegel_first_session_celebrated"),
  ]);
  if (optIn || dismissed) return false;
  return celebrated === "true";
}

export async function setCloudAuthSession(params: {
  accountId: string;
  token: string;
  provider: CloudSyncProvider;
}): Promise<void> {
  const optedIn = await isCloudSyncOptedIn();
  if (!optedIn) {
    throw new Error("Cloud auth refused: opt-in required (OP1)");
  }
  await AsyncStorage.setItem(KEYS.ACCOUNT_ID, params.accountId);
  await AsyncStorage.setItem(KEYS.TOKEN, params.token);
  await AsyncStorage.setItem(KEYS.PROVIDER, params.provider);
}

async function getAuthHeaders(): Promise<HeadersInit | null> {
  const optedIn = await isCloudSyncOptedIn();
  if (!optedIn) return null;
  const token = await AsyncStorage.getItem(KEYS.TOKEN);
  if (!token) return null;
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

/**
 * Gate: returns false and never hits network when opt-in is off (OP1).
 */
export async function canUploadProgress(): Promise<boolean> {
  if (!(await isCloudSyncOptedIn())) return false;
  const token = await AsyncStorage.getItem(KEYS.TOKEN);
  return Boolean(token);
}

export async function pushProgressIfOptedIn(): Promise<
  | { ok: true; skipped?: false }
  | { ok: true; skipped: true; reason: "opt_in_off" | "no_auth" }
  | { ok: false; error: string }
> {
  if (!(await isCloudSyncOptedIn())) {
    return { ok: true, skipped: true, reason: "opt_in_off" };
  }
  const headers = await getAuthHeaders();
  if (!headers) {
    return { ok: true, skipped: true, reason: "no_auth" };
  }
  try {
    const payload = await buildTransferPayload();
    const baseUrl = getApiUrl();
    const res = await fetch(new URL("/api/sync/push", baseUrl).toString(), {
      method: "POST",
      headers,
      body: JSON.stringify({ payload }),
    });
    if (!res.ok) {
      trackEvent("sync_error", { phase: "push", status: res.status });
      return { ok: false, error: `Push failed (${res.status})` };
    }
    await AsyncStorage.setItem(KEYS.LAST_PUSH_AT, new Date().toISOString());
    trackEvent("sync_push_ok", {});
    return { ok: true };
  } catch (e) {
    trackEvent("sync_error", { phase: "push" });
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Push failed",
    };
  }
}

export async function pullAndMergeIfOptedIn(opts?: {
  confirmEmptyOverwrite?: boolean;
}): Promise<
  | { ok: true; skipped?: false; conflict?: boolean }
  | { ok: true; skipped: true; reason: "opt_in_off" | "no_auth" | "no_remote" }
  | { ok: false; error: string; blocked?: boolean }
> {
  if (!(await isCloudSyncOptedIn())) {
    return { ok: true, skipped: true, reason: "opt_in_off" };
  }
  const headers = await getAuthHeaders();
  if (!headers) {
    return { ok: true, skipped: true, reason: "no_auth" };
  }
  try {
    const baseUrl = getApiUrl();
    const res = await fetch(new URL("/api/sync/pull", baseUrl).toString(), {
      method: "GET",
      headers,
    });
    if (res.status === 404) {
      return { ok: true, skipped: true, reason: "no_remote" };
    }
    if (!res.ok) {
      trackEvent("sync_error", { phase: "pull", status: res.status });
      return { ok: false, error: `Pull failed (${res.status})` };
    }
    const body = (await res.json()) as { payload?: unknown };
    const validated = validateTransferPayload(body.payload);
    if (!validated.ok) {
      trackEvent("sync_error", { phase: "pull_validate" });
      return { ok: false, error: validated.error };
    }
    const local = await buildTransferPayload();
    const merged = mergeTransferPayloads(local, validated.payload, {
      confirmEmptyOverwrite: opts?.confirmEmptyOverwrite,
    });
    if (merged.emptyOverwriteRequiresConfirm) {
      trackEvent("sync_conflict", { kind: "empty_overwrite_blocked" });
      return {
        ok: false,
        error: "Remote copy is empty; confirm to overwrite local progress.",
        blocked: true,
      };
    }
    if (merged.conflicts.some((c) => c !== "none")) {
      trackEvent("sync_conflict", {
        kinds: merged.conflicts.filter((c) => c !== "none"),
      });
    }
    await applyTransferPayload(merged.merged, { merge: false });
    await AsyncStorage.setItem(KEYS.LAST_PULL_AT, new Date().toISOString());
    trackEvent("sync_pull_ok", {});
    return {
      ok: true,
      conflict: merged.conflicts.some((c) => c !== "none"),
    };
  } catch (e) {
    trackEvent("sync_error", { phase: "pull" });
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Pull failed",
    };
  }
}

async function deleteRemoteCopy(): Promise<boolean> {
  const headers = await getAuthHeaders();
  // If already opted out token may still be present briefly — read raw token.
  const token = await AsyncStorage.getItem(KEYS.TOKEN);
  if (!token && !headers) return false;
  try {
    const baseUrl = getApiUrl();
    const res = await fetch(new URL("/api/sync/delete", baseUrl).toString(), {
      method: "DELETE",
      headers: headers ?? {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
    if (res.ok) {
      await AsyncStorage.setItem(KEYS.REMOTE_DELETED, "true");
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Exchange Apple/Google identity token for sync session.
 * Requires opt-in first. Client IDs are Ashley config (see docs).
 */
export async function exchangeIdentityForSyncToken(params: {
  provider: "apple" | "google";
  identityToken: string;
}): Promise<{ ok: true; accountId: string } | { ok: false; error: string }> {
  if (!(await isCloudSyncOptedIn())) {
    return { ok: false, error: "Opt-in required before auth (OP1)" };
  }
  try {
    const baseUrl = getApiUrl();
    const res = await fetch(new URL("/api/sync/auth", baseUrl).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: params.provider,
        identityToken: params.identityToken,
      }),
    });
    if (!res.ok) {
      trackEvent("sync_error", { phase: "auth", status: res.status });
      return { ok: false, error: `Auth failed (${res.status})` };
    }
    const data = (await res.json()) as {
      accountId: string;
      accessToken: string;
    };
    await setCloudAuthSession({
      accountId: data.accountId,
      token: data.accessToken,
      provider: params.provider,
    });
    return { ok: true, accountId: data.accountId };
  } catch (e) {
    trackEvent("sync_error", { phase: "auth" });
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Auth failed",
    };
  }
}

/** Test helper — clears sync prefs without touching progress. */
export async function _resetCloudSyncPrefsForTests(): Promise<void> {
  await AsyncStorage.multiRemove(Object.values(KEYS));
}
