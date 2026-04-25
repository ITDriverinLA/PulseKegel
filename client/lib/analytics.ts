import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import * as Application from "expo-application";
import { Platform } from "react-native";
import { getApiUrl } from "./query-client";

const DEVICE_ID_KEY = "pulsekegel_analytics_device_id";

async function getOrCreateDeviceId(): Promise<string> {
  try {
    if (Platform.OS === "web") {
      try {
        const stored =
          typeof localStorage !== "undefined"
            ? localStorage.getItem(DEVICE_ID_KEY)
            : null;
        if (stored) return stored;
        const uuid = Crypto.randomUUID();
        const hashed = await Crypto.digestStringAsync(
          Crypto.CryptoDigestAlgorithm.SHA256,
          uuid,
        );
        try {
          localStorage.setItem(DEVICE_ID_KEY, hashed);
        } catch {}
        return hashed;
      } catch {
        return "web-unknown";
      }
    }

    let deviceId = await SecureStore.getItemAsync(DEVICE_ID_KEY);
    if (!deviceId) {
      const uuid = Crypto.randomUUID();
      deviceId = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        uuid,
      );
      await SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId);
    }
    return deviceId;
  } catch {
    return "unknown";
  }
}

export function trackEvent(
  type: string,
  data?: Record<string, unknown>,
): void {
  (async () => {
    try {
      const deviceId = await getOrCreateDeviceId();
      const baseUrl = getApiUrl();
      const url = new URL("/api/analytics", baseUrl);
      const appVersion =
        Application.nativeApplicationVersion ?? "1.0.0";

      await fetch(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId,
          events: [
            {
              type,
              data: data ?? {},
              platform: Platform.OS,
              appVersion,
              occurredAt: new Date().toISOString(),
            },
          ],
        }),
      });
    } catch {
      // Silently swallow — analytics must never crash or block the app
    }
  })();
}

export function trackAppOpen(data: {
  programWeek?: number;
  streak?: number;
  totalSessions?: number;
  anatomyType?: string | null;
}): void {
  trackEvent("app_open", data as Record<string, unknown>);
}

export function trackSessionComplete(data: {
  durationMinutes?: number;
  workoutType?: string;
  weekNumber?: number;
}): void {
  trackEvent("session_complete", data as Record<string, unknown>);
}

export function trackOnboardingComplete(data: {
  anatomyType?: string | null;
}): void {
  trackEvent("onboarding_complete", data as Record<string, unknown>);
}
