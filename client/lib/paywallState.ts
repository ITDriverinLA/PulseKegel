/**
 * P9b.1 / P9b.3 / P9b.6: what the paywall's price block and CTA show.
 * Pure so the state machine can be unit-tested per platform.
 */
import {
  BILLING_NOT_ALLOWED_ANDROID,
  BILLING_NOT_ALLOWED_IOS,
  CANT_LOAD_SUBSCRIPTION,
  type UnavailableCopy,
} from "@/constants/paywallCopy";
import { RC_PURCHASE_NOT_ALLOWED } from "./purchaseErrors";
import type { PackageLike } from "./purchaseFlow";

export interface PaywallFailure {
  /** RevenueCat code when it gave one. */
  rcCode?: number;
  /** Our reason or legacy code (not_configured, no_offerings, rc_3, …). */
  code: string;
}

export type PaywallView =
  | { kind: "loading" }
  | { kind: "priced" }
  | {
      kind: "unavailable";
      variant: "not_allowed" | "generic";
      /** Logged on Retry as `paywall_retry_tapped.code`. */
      code: string | number;
    };

/**
 * - packages → priced (the real store price)
 * - a known failure → unavailable (code 3 gets the billing-not-allowed copy)
 * - otherwise → loading (launch load or the paywall's own load in flight)
 * Never a hardcoded price (A10).
 */
export function derivePaywallView(input: {
  hasPackages: boolean;
  failure: PaywallFailure | null;
}): PaywallView {
  if (input.failure) {
    return {
      kind: "unavailable",
      variant:
        input.failure.rcCode === RC_PURCHASE_NOT_ALLOWED
          ? "not_allowed"
          : "generic",
      code: input.failure.rcCode ?? input.failure.code,
    };
  }
  if (input.hasPackages) return { kind: "priced" };
  return { kind: "loading" };
}

export function unavailableCopyFor(
  variant: "not_allowed" | "generic",
  os: string,
): UnavailableCopy {
  if (variant === "not_allowed") {
    if (os === "android") return BILLING_NOT_ALLOWED_ANDROID;
    if (os === "ios") return BILLING_NOT_ALLOWED_IOS;
  }
  return CANT_LOAD_SUBSCRIPTION;
}

/** Load offerings on paywall mount only if there's nothing to show yet. */
export function shouldLoadOnMount(input: {
  hasPackages: boolean;
  contextLoading: boolean;
  alreadyLoading: boolean;
}): boolean {
  return !input.hasPackages && !input.contextLoading && !input.alreadyLoading;
}

// ---------------------------------------------------------------------------
// Free-week disclosure (P9b.6). The approved copy says "7 days free", so it
// only shows when the store's free trial is exactly one week.

function isOneWeek(
  unit: string | undefined,
  units: number | undefined,
  iso: string | undefined,
): boolean {
  const u = (unit ?? "").toUpperCase();
  if (u === "WEEK" && units === 1) return true;
  if (u === "DAY" && units === 7) return true;
  const i = (iso ?? "").toUpperCase();
  return i === "P1W" || i === "P7D";
}

export const IOS_INTRO_ELIGIBLE = 2; // INTRO_ELIGIBILITY_STATUS_ELIGIBLE

/** iOS: store reports a one-week $0 intro price on this product. */
export function iosHasFreeWeekIntro(
  product: PackageLike["product"] | null | undefined,
): boolean {
  const intro = product?.introPrice;
  if (!intro || intro.price !== 0) return false;
  if (typeof intro.cycles === "number" && intro.cycles !== 1) return false;
  return isOneWeek(intro.periodUnit, intro.periodNumberOfUnits, intro.period);
}

export function freeWeekEligible(input: {
  os: string;
  product: PackageLike["product"] | null | undefined;
  /** iOS only: checkTrialOrIntroductoryPriceEligibility status. */
  iosEligibilityStatus?: number | null;
}): boolean {
  const { os, product } = input;
  if (!product) return false;
  if (os === "ios") {
    return (
      iosHasFreeWeekIntro(product) &&
      input.iosEligibilityStatus === IOS_INTRO_ELIGIBLE
    );
  }
  if (os === "android") {
    const period = product.defaultOption?.freePhase?.billingPeriod;
    if (!product.defaultOption?.freePhase) return false;
    return isOneWeek(period?.unit, period?.value, period?.iso8601);
  }
  return false;
}
