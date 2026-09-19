/**
 * Path A — Apple / Google identity acquisition for cloud sync.
 * Fail closed when client IDs are missing. Never uses a shared lab subject.
 */

import { Platform } from "react-native";
import Constants from "expo-constants";

export type CloudAuthProvider = "apple" | "google";

type ExtraConfig = {
  appleClientId?: string;
  googleClientId?: string;
  EXPO_PUBLIC_APPLE_CLIENT_ID?: string;
  EXPO_PUBLIC_GOOGLE_CLIENT_ID?: string;
};

function readExtra(): ExtraConfig {
  const extra = (Constants.expoConfig?.extra ?? {}) as ExtraConfig;
  return extra;
}

/** Public client IDs (bundle / EAS secrets → EXPO_PUBLIC_*). */
export function getCloudAuthClientIds(): {
  apple: string;
  google: string;
} {
  const extra = readExtra();
  const apple =
    (typeof process !== "undefined" &&
      process.env?.EXPO_PUBLIC_APPLE_CLIENT_ID) ||
    extra.EXPO_PUBLIC_APPLE_CLIENT_ID ||
    extra.appleClientId ||
    "";
  const google =
    (typeof process !== "undefined" &&
      process.env?.EXPO_PUBLIC_GOOGLE_CLIENT_ID) ||
    extra.EXPO_PUBLIC_GOOGLE_CLIENT_ID ||
    extra.googleClientId ||
    "";
  return {
    apple: String(apple).trim(),
    google: String(google).trim(),
  };
}

export function preferredCloudAuthProvider(): CloudAuthProvider {
  return Platform.OS === "ios" ? "apple" : "google";
}

/** True when the platform's Sign-In client ID is configured. */
export function isCloudSignInConfigured(
  provider: CloudAuthProvider = preferredCloudAuthProvider(),
): boolean {
  const ids = getCloudAuthClientIds();
  return provider === "apple" ? Boolean(ids.apple) : Boolean(ids.google);
}

export function cloudSignInUnavailableReason(
  provider: CloudAuthProvider = preferredCloudAuthProvider(),
): string | null {
  if (isCloudSignInConfigured(provider)) return null;
  return provider === "apple"
    ? "Apple Sign-In is not configured yet (missing EXPO_PUBLIC_APPLE_CLIENT_ID). Cloud sync stays off — use a local encrypted backup instead."
    : "Google Sign-In is not configured yet (missing EXPO_PUBLIC_GOOGLE_CLIENT_ID). Cloud sync stays off — use a local encrypted backup instead.";
}

export type ObtainIdentityResult =
  | { ok: true; provider: CloudAuthProvider; identityToken: string }
  | { ok: false; error: string; configured: boolean };

/**
 * Obtain a real Apple/Google identity token for `/api/sync/auth`.
 * Does not emit shared pending-* subjects. Requires client IDs + native modules.
 */
export async function obtainCloudIdentityToken(
  provider: CloudAuthProvider = preferredCloudAuthProvider(),
): Promise<ObtainIdentityResult> {
  const reason = cloudSignInUnavailableReason(provider);
  if (reason) {
    return { ok: false, error: reason, configured: false };
  }

  if (provider === "apple") {
    try {
      // Optional peer — present after Expo Apple Auth is linked in a store build.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const AppleAuthentication = require("expo-apple-authentication") as {
        signInAsync: (opts: {
          requestedScopes: unknown[];
        }) => Promise<{ identityToken: string | null }>;
        AppleAuthenticationScope: { FULL_NAME: unknown; EMAIL: unknown };
        isAvailableAsync: () => Promise<boolean>;
      };
      const available = await AppleAuthentication.isAvailableAsync();
      if (!available) {
        return {
          ok: false,
          error: "Apple Sign-In is not available on this device.",
          configured: true,
        };
      }
      const cred = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!cred.identityToken) {
        return {
          ok: false,
          error: "Apple Sign-In did not return an identity token.",
          configured: true,
        };
      }
      return {
        ok: true,
        provider: "apple",
        identityToken: cred.identityToken,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Apple Sign-In failed";
      if (/Cannot find module|not found/i.test(msg)) {
        return {
          ok: false,
          error:
            "Apple Sign-In module is not installed in this build. Use a local encrypted backup, or rebuild with expo-apple-authentication.",
          configured: true,
        };
      }
      return { ok: false, error: msg, configured: true };
    }
  }

  // Google: require an ID token from a linked Google Sign-In module when present.
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Google = require("expo-auth-session/providers/google") as {
      useIdTokenAuthRequest?: unknown;
    };
    void Google;
    return {
      ok: false,
      error:
        "Google Sign-In UI is not wired in this build yet. Use a local encrypted backup, or complete Google Auth Session wiring with EXPO_PUBLIC_GOOGLE_CLIENT_ID.",
      configured: true,
    };
  } catch {
    return {
      ok: false,
      error:
        "Google Sign-In is not available in this build. Use a local encrypted backup instead.",
      configured: true,
    };
  }
}
