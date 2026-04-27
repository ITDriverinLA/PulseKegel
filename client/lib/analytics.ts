import * as Crypto from "expo-crypto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Application from "expo-application";
import { Platform } from "react-native";
import { getApiUrl } from "./query-client";

const DEVICE_ID_KEY = "pulsekegel_analytics_device_id";

// Module-level set: tracks event types already sent this JS runtime session.
// app_open is guarded here so StrictMode double-mounts and same-session
// app re-opens don't produce duplicate rows.
const SESSION_SENT = new Set<string>();
const ONCE_PER_SESSION_EVENTS = new Set(["app_open"]);

async function getOrCreateDeviceId(): Promise<string> {
  try {
    let deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (!deviceId) {
      const uuid = Crypto.randomUUID();
      deviceId = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        uuid,
      );
      await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
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
  if (ONCE_PER_SESSION_EVENTS.has(type)) {
    if (SESSION_SENT.has(type)) return;
    SESSION_SENT.add(type);
  }
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
  dayNumber?: number;
}): void {
  trackEvent("session_complete", data as Record<string, unknown>);
}

export function trackOnboardingComplete(data: {
  anatomyType?: string | null;
}): void {
  trackEvent("onboarding_complete", data as Record<string, unknown>);
}

export function trackWeekComplete(data: {
  weekNumber: number;
  daysWorkedOut: number;
  scheduledDays: number;
}): void {
  trackEvent("week_complete", data as Record<string, unknown>);
}

export function trackChallengeResult(data: {
  result: "not_started" | "first_step" | "partial" | "complete" | "strong_finish";
  completedCoreSessions: number;
  totalCoreSessions: number;
  completedOptionalSessions: number;
}): void {
  trackEvent("challenge_result_viewed", data as Record<string, unknown>);
}
