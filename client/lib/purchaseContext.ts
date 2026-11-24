/**
 * P9a.1: shared purchase context, computed once per launch and cached.
 *
 * - `store`: which store sells the subscription on this platform.
 * - `buildEnv`: how this build was installed, so test devices (Simulator,
 *   TestFlight, Xcode, dev, Expo Go) can be left out of purchase metrics.
 * - `isSandbox`: from RevenueCat's active entitlements, once CustomerInfo is
 *   known. This is the only signal that catches Play license testers.
 *
 * Values match the enums the server accepts (server/requestValidation.ts).
 */
import * as Application from "expo-application";
import Constants from "expo-constants";
import * as Device from "expo-device";
import { Platform } from "react-native";

export type PurchaseStore = "app_store" | "play_store" | "none";
export type BuildEnv =
  | "simulator"
  | "dev"
  | "expo_go"
  | "testflight"
  | "xcode"
  | "production"
  | "unknown";

export interface PurchaseContext {
  store: PurchaseStore;
  buildEnv: BuildEnv;
  isSandbox?: boolean;
}

export function getPurchaseStore(os: string = Platform.OS): PurchaseStore {
  if (os === "ios") return "app_store";
  if (os === "android") return "play_store";
  return "none";
}

function isDevBuild(): boolean {
  return typeof __DEV__ !== "undefined" && __DEV__ === true;
}

/** Classify the build. Never throws; any failure gives "unknown". */
export async function detectBuildEnv(): Promise<BuildEnv> {
  try {
    if (Device.isDevice === false) return "simulator";
    if (isDevBuild()) return "dev";
    if (Constants.appOwnership === "expo") return "expo_go";
    if (Platform.OS === "ios") {
      const env = await Application.getAppleStoreEnvironmentAsync();
      if (env === "sandbox") return "testflight";
      if (env === "xcode") return "xcode";
    }
    return "production";
  } catch {
    return "unknown";
  }
}

let buildEnvPromise: Promise<BuildEnv> | null = null;
let knownSandbox: boolean | undefined;

export function getBuildEnv(): Promise<BuildEnv> {
  if (!buildEnvPromise) buildEnvPromise = detectBuildEnv();
  return buildEnvPromise;
}

type EntitlementLike = { isSandbox?: unknown };
type CustomerInfoLike = {
  entitlements?: { active?: Record<string, EntitlementLike | undefined> };
};

/**
 * `true` if any active entitlement is a sandbox purchase, `false` if there
 * are active entitlements and none is sandbox, absent when nothing is active.
 */
export function sandboxFromCustomerInfo(
  info: CustomerInfoLike | null | undefined,
): boolean | undefined {
  const active = Object.values(info?.entitlements?.active ?? {});
  if (active.length === 0) return undefined;
  return active.some((e) => e?.isSandbox === true);
}

/** Remember the sandbox flag from the latest CustomerInfo (if it has one). */
export function noteCustomerInfoForContext(
  info: CustomerInfoLike | null | undefined,
): void {
  const sandbox = sandboxFromCustomerInfo(info);
  if (sandbox !== undefined) knownSandbox = sandbox;
}

export async function getPurchaseContext(): Promise<PurchaseContext> {
  const buildEnv = await getBuildEnv();
  const ctx: PurchaseContext = { store: getPurchaseStore(), buildEnv };
  if (knownSandbox !== undefined) ctx.isSandbox = knownSandbox;
  return ctx;
}

/** Test-only: clear the per-launch cache. */
export function __resetPurchaseContextForTests(): void {
  buildEnvPromise = null;
  knownSandbox = undefined;
}
