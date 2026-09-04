/**
 * Epic D — iOS activation diagnostic helpers.
 *
 * Findings (2026-09-03 codebase):
 * - First-open path is already platform-unified via RootStackNavigator
 *   (onboarding → FirstSessionGate → main). No iOS-only storyboard/deep-link
 *   bypass to empty home.
 * - Push permission is only requested from Settings (behind the first-session
 *   gate) or post–Day-1 for the Day-2 nudge — never before first-session CTA.
 * - ATT is not currently prompted (no expo-tracking-transparency / no
 *   NSUserTrackingUsageDescription). We record att_status as unavailable and
 *   must not introduce an early ATT prompt that delays first session.
 * - All analytics events already carry platform + appVersion at the event root.
 *
 * Timing policy: defer ATT and other non-essential prompts until after
 * first session_complete (or post–Day-1 for push used by Epic C nudge).
 */
import Constants from "expo-constants";
import { AppState, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  trackFirstOpenPath,
  trackPermissionPromptShown,
  trackPermissionResult,
} from "./analytics";
import { storage } from "./storage";

const FIRST_OPEN_PATH_KEY = "pulsekegel_first_open_path_sent";
const COLD_LAUNCH_MARKED_KEY = "pulsekegel_js_session_launched";

export type LandingRoute =
  | "onboarding"
  | "first_session_gate"
  | "main"
  | "force_update";

export type LaunchType = "cold" | "warm";

let jsSessionLaunchType: LaunchType = "cold";
let coldMarkedThisRuntime = false;

/** Call once at app bootstrap to classify this JS runtime as cold. */
export function markColdLaunch(): void {
  if (coldMarkedThisRuntime) return;
  coldMarkedThisRuntime = true;
  jsSessionLaunchType = "cold";
}

/** Call when AppState returns to active after background/inactive. */
export function markWarmResume(): void {
  jsSessionLaunchType = "warm";
}

export function getLaunchType(): LaunchType {
  return jsSessionLaunchType;
}

export function getBuildChannel(): string | undefined {
  const ownership = Constants.appOwnership; // "expo" | "standalone" | "guest" | null
  const execution = Constants.executionEnvironment; // "storeClient" | "standalone" | "bare"
  const easChannel =
    (Constants.expoConfig?.extra as { eas?: { channel?: string } } | undefined)
      ?.eas?.channel ??
    (Constants as { easConfig?: { channel?: string } }).easConfig?.channel;

  if (typeof easChannel === "string" && easChannel.trim()) {
    return easChannel.trim();
  }
  if (ownership === "expo") return "expo-go";
  if (execution === "storeClient") return "store-client";
  if (ownership === "standalone" || execution === "standalone") {
    return "production";
  }
  if (ownership || execution) {
    return `${ownership ?? "unknown"}:${execution ?? "unknown"}`;
  }
  return undefined;
}

/**
 * ATT status without prompting. No native ATT module is wired; returns
 * unavailable so diagnostics still have a stable signal.
 */
export async function getAttStatus(): Promise<
  "not_determined" | "authorized" | "denied" | "restricted" | "unavailable"
> {
  if (Platform.OS !== "ios") return "unavailable";
  // Epic D: do not prompt here. Native ATT is not present in this build.
  return "unavailable";
}

/**
 * Intentionally a no-op prompt path. Spec requires deferring ATT until after
 * first session_complete; we also refuse to prompt when the native module /
 * usage description is absent so first-run cannot be blocked.
 */
export async function requestAttAfterFirstSessionIfEligible(
  surface: string,
): Promise<void> {
  if (Platform.OS !== "ios") return;
  const done = await storage.hasCompletedFirstSession();
  if (!done) return;

  const status = await getAttStatus();
  // Record diagnostic only — never show an OS ATT sheet from this helper until
  // a future build wires expo-tracking-transparency + usage description.
  trackPermissionPromptShown({
    type: "att",
    surface,
    status,
    deferred: true,
  });
  trackPermissionResult({
    type: "att",
    status: status === "unavailable" ? "unavailable" : status,
    surface,
    deferred: true,
  });
}

export async function emitFirstOpenPathOnce(
  landingRoute: LandingRoute,
): Promise<void> {
  try {
    const already = await AsyncStorage.getItem(FIRST_OPEN_PATH_KEY);
    if (already === "true") return;

    const onboardedAlready = await storage.isOnboardingComplete();
    const attStatus = await getAttStatus();
    const buildChannel = getBuildChannel();

    trackFirstOpenPath({
      landing_route: landingRoute,
      onboarded_already: onboardedAlready,
      launch_type: getLaunchType(),
      app_state: AppState.currentState,
      att_status: attStatus,
      ...(buildChannel ? { build_channel: buildChannel } : {}),
    });

    await AsyncStorage.setItem(FIRST_OPEN_PATH_KEY, "true");
    await AsyncStorage.setItem(COLD_LAUNCH_MARKED_KEY, "true");
  } catch {
    // Diagnostics must never block startup.
  }
}
