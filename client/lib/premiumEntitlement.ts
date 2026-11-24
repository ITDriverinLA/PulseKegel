/**
 * P9b.7 (decision 2): one named entitlement with a safety net.
 *
 * `PREMIUM_ENTITLEMENT_ID` is the RevenueCat entitlement that unlocks
 * PulseKegel. It is read from the RevenueCat dashboard during the decision-3
 * checklist and must be filled in before the 2.2.7 store submit. While it is
 * null, any active entitlement counts (today's behavior) and nothing is logged.
 *
 * Safety net: if the named entitlement is missing but another one is active,
 * the user still gets access and the caller logs `entitlement_mismatch`, so no
 * paying user is ever locked out by this change.
 */
export const PREMIUM_ENTITLEMENT_ID: string | null = null;

export type SubscriptionStatus = "none" | "trial" | "paid";
export type PeriodType = "TRIAL" | "INTRO" | "NORMAL" | "PREPAID";

type EntitlementLike = {
  identifier?: unknown;
  isSandbox?: unknown;
  periodType?: unknown;
};
export type CustomerInfoLike = {
  entitlements?: { active?: Record<string, EntitlementLike | undefined> };
};

export interface PremiumCheck {
  active: boolean;
  /** The entitlement that granted access (named one first). */
  entitlement?: EntitlementLike;
  /** Set when the named entitlement is missing but another is active. */
  mismatch?: { expected: string; activeIds: string[] };
}

export function checkPremium(
  info: CustomerInfoLike | null | undefined,
  expectedId: string | null = PREMIUM_ENTITLEMENT_ID,
): PremiumCheck {
  const active = info?.entitlements?.active ?? {};
  const ids = Object.keys(active).filter((id) => active[id]);
  if (ids.length === 0) return { active: false };
  if (!expectedId) return { active: true, entitlement: active[ids[0]] };
  if (active[expectedId]) {
    return { active: true, entitlement: active[expectedId] };
  }
  return {
    active: true,
    entitlement: active[ids[0]],
    mismatch: {
      expected: expectedId.slice(0, 150),
      activeIds: ids.slice(0, 5).map((id) => id.slice(0, 150)),
    },
  };
}

export function hasPremium(
  info: CustomerInfoLike | null | undefined,
  expectedId: string | null = PREMIUM_ENTITLEMENT_ID,
): boolean {
  return checkPremium(info, expectedId).active;
}

const PERIOD_TYPES: readonly string[] = ["TRIAL", "INTRO", "NORMAL", "PREPAID"];

/** RevenueCat periodType, normalized to the server enum (or undefined). */
export function normalizePeriodType(value: unknown): PeriodType | undefined {
  if (typeof value !== "string") return undefined;
  const upper = value.trim().toUpperCase();
  return PERIOD_TYPES.includes(upper) ? (upper as PeriodType) : undefined;
}

export function statusFromCheck(check: PremiumCheck): SubscriptionStatus {
  if (!check.active) return "none";
  return normalizePeriodType(check.entitlement?.periodType) === "TRIAL"
    ? "trial"
    : "paid";
}

/** Fields for `purchase_completed` (A4: a free-week start is never "paid"). */
export function completionFields(check: PremiumCheck): {
  periodType?: PeriodType;
  isTrial?: boolean;
  isSandbox?: boolean;
} {
  const periodType = normalizePeriodType(check.entitlement?.periodType);
  const out: {
    periodType?: PeriodType;
    isTrial?: boolean;
    isSandbox?: boolean;
  } = {};
  if (periodType) {
    out.periodType = periodType;
    out.isTrial = periodType === "TRIAL";
  }
  if (typeof check.entitlement?.isSandbox === "boolean") {
    out.isSandbox = check.entitlement.isSandbox;
  }
  return out;
}

/**
 * P9a.5: decide whether a status change is worth logging. With no stored
 * previous status (first run of 2.2.7), seed silently so an existing
 * subscriber isn't logged as a fresh none→paid.
 */
export function decideStatusChange(
  previous: SubscriptionStatus | null,
  next: SubscriptionStatus,
): { from: SubscriptionStatus; to: SubscriptionStatus } | null {
  if (previous === null || previous === next) return null;
  return { from: previous, to: next };
}

export function parseStoredStatus(value: unknown): SubscriptionStatus | null {
  return value === "none" || value === "trial" || value === "paid"
    ? value
    : null;
}
