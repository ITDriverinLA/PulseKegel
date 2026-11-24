/**
 * P9 purchase flow logic, kept free of React and of the RevenueCat module so
 * it can be unit-tested. SubscriptionContext injects the RevenueCat calls.
 *
 * Every payload here is shaped to the strict server schemas in
 * server/requestValidation.ts (one unknown field drops the whole batch).
 */
import {
  trackEntitlementMismatch,
  trackOfferingFallbackUsed,
  trackOfferingsFailed,
  trackPurchaseEntitlementMissing,
  trackPurchaseResult,
  trackRestoreResult,
  trackSubscriptionStatusChanged,
  type OfferingsFailedReason,
  type OfferingsSurface,
  type PaywallSource,
} from "./analytics";
import {
  getPurchaseContext,
  noteCustomerInfoForContext,
  type PurchaseContext,
} from "./purchaseContext";
import {
  legacyOfferingsErrorCode,
  legacyPurchaseErrorCode,
  legacyRestoreErrorCode,
  purchaseErrorPayload,
  RC_PAYMENT_PENDING,
  RC_PURCHASE_NOT_ALLOWED,
  toPurchaseError,
} from "./purchaseErrors";
import {
  checkPremium,
  completionFields,
  decideStatusChange,
  normalizePeriodType,
  statusFromCheck,
  type CustomerInfoLike,
  type PremiumCheck,
  type SubscriptionStatus,
} from "./premiumEntitlement";

// ---------------------------------------------------------------------------
// Shapes (structural subsets of react-native-purchases types)

export interface PackageLike {
  identifier: string;
  packageType?: unknown;
  product: {
    identifier: string;
    priceString?: string;
    introPrice?: {
      price?: number;
      period?: string;
      periodUnit?: string;
      periodNumberOfUnits?: number;
      cycles?: number;
    } | null;
    defaultOption?: {
      freePhase?: {
        billingPeriod?: { unit?: string; value?: number; iso8601?: string };
      } | null;
    } | null;
  };
  presentedOfferingContext?: { offeringIdentifier?: string | null } | null;
}

export interface OfferingLike<P extends PackageLike = PackageLike> {
  identifier: string;
  availablePackages: P[];
}

export interface OfferingsLike<P extends PackageLike = PackageLike> {
  current: OfferingLike<P> | null;
  all: Record<string, OfferingLike<P>>;
}

// ---------------------------------------------------------------------------
// Small helpers

function bounded(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const v = value.trim().slice(0, max).trim();
  return v.length > 0 ? v : undefined;
}

export function packageIds(pkg: PackageLike | null | undefined): {
  packageIdentifier?: string;
  productIdentifier?: string;
  offeringId?: string;
} {
  if (!pkg) return {};
  const out: {
    packageIdentifier?: string;
    productIdentifier?: string;
    offeringId?: string;
  } = {};
  const packageIdentifier = bounded(pkg.identifier, 100);
  const productIdentifier = bounded(pkg.product?.identifier, 150);
  const offeringId = bounded(
    pkg.presentedOfferingContext?.offeringIdentifier,
    100,
  );
  if (packageIdentifier) out.packageIdentifier = packageIdentifier;
  if (productIdentifier) out.productIdentifier = productIdentifier;
  if (offeringId) out.offeringId = offeringId;
  return out;
}

/** The store's price string, if it's safe to show and log (A10). */
export function storePriceString(
  pkg: PackageLike | null | undefined,
): string | undefined {
  return bounded(pkg?.product?.priceString, 50);
}

function contextFields(ctx: PurchaseContext): PurchaseContext {
  const out: PurchaseContext = { store: ctx.store, buildEnv: ctx.buildEnv };
  if (ctx.isSandbox !== undefined) out.isSandbox = ctx.isSandbox;
  return out;
}

export function chooseAnnualPackage<P extends PackageLike>(
  pkgs: readonly P[],
): P | null {
  return (
    pkgs.find(
      (pkg) =>
        String(pkg.packageType).toLowerCase().includes("annual") ||
        pkg.identifier.toLowerCase().includes("annual") ||
        pkg.product.identifier.toLowerCase().includes("annual"),
    ) ??
    pkgs[0] ??
    null
  );
}

// ---------------------------------------------------------------------------
// Offerings (P9a.5, P9b.2)

export type EmptyOfferingsReason =
  | "no_offerings"
  | "no_current_offering"
  | "current_offering_empty";

export interface OfferingsPick<P extends PackageLike> {
  packages: P[];
  offeringId?: string;
  fallback?: { offeringId: string; reason: "no_current" | "current_empty" };
  emptyReason?: EmptyOfferingsReason;
}

/** Current offering first; otherwise the first other offering with packages. */
export function pickOfferingPackages<P extends PackageLike>(
  offerings: OfferingsLike<P>,
): OfferingsPick<P> {
  const current = offerings.current;
  if (current?.availablePackages?.length) {
    return {
      packages: current.availablePackages,
      offeringId: current.identifier,
    };
  }
  const all = Object.values(offerings.all ?? {});
  const other = all.find(
    (o) =>
      o?.availablePackages?.length > 0 &&
      (!current || o.identifier !== current.identifier),
  );
  if (other) {
    return {
      packages: other.availablePackages,
      offeringId: other.identifier,
      fallback: {
        offeringId: other.identifier,
        reason: current ? "current_empty" : "no_current",
      },
    };
  }
  return {
    packages: [],
    emptyReason: current
      ? "current_offering_empty"
      : all.length > 0
        ? "no_current_offering"
        : "no_offerings",
  };
}

export type OfferingsLoadResult<P extends PackageLike> =
  | { ok: true; packages: P[]; offeringId?: string }
  | {
      ok: false;
      reason: OfferingsFailedReason;
      /** Today's H3 `errorCode` format for `purchase_unavailable`. */
      errorCode: string;
      rcCode?: number;
      readableErrorCode?: string;
      errorMessage?: string;
    };

export interface OfferingsDeps<P extends PackageLike> {
  isConfigured: () => Promise<boolean>;
  /** Try `Purchases.configure` once more with the platform key. */
  configure: () => Promise<boolean>;
  getOfferings: () => Promise<OfferingsLike<P>>;
  getContext?: () => Promise<PurchaseContext>;
}

async function safeBool(fn: () => Promise<boolean>): Promise<boolean> {
  try {
    return (await fn()) === true;
  } catch {
    return false;
  }
}

/** Configured already, or configured after one more try (P9b.2). */
export async function ensureConfigured(deps: {
  isConfigured: () => Promise<boolean>;
  configure: () => Promise<boolean>;
}): Promise<boolean> {
  if (await safeBool(deps.isConfigured)) return true;
  await safeBool(deps.configure);
  return safeBool(deps.isConfigured);
}

/**
 * P9b.2 shared loader: never calls getOfferings while the SDK isn't
 * configured (A11), logs the fallback and every failure with its cause.
 */
export async function loadOfferingsWith<P extends PackageLike>(
  surface: OfferingsSurface,
  deps: OfferingsDeps<P>,
): Promise<OfferingsLoadResult<P>> {
  const getContext = deps.getContext ?? getPurchaseContext;
  const configured = await ensureConfigured(deps);
  const ctx = await getContext();
  if (!configured) {
    trackOfferingsFailed({
      surface,
      configured: false,
      store: ctx.store,
      buildEnv: ctx.buildEnv,
      reason: "not_configured",
    });
    return { ok: false, reason: "not_configured", errorCode: "not_configured" };
  }

  let offerings: OfferingsLike<P>;
  try {
    offerings = await deps.getOfferings();
  } catch (error) {
    const fields = toPurchaseError(error);
    const errorPart: {
      rcCode?: number;
      readableErrorCode?: string;
      errorMessage?: string;
    } = {};
    if (fields.rcCode !== undefined) errorPart.rcCode = fields.rcCode;
    if (fields.readableErrorCode) {
      errorPart.readableErrorCode = fields.readableErrorCode;
    }
    if (fields.errorMessage) errorPart.errorMessage = fields.errorMessage;
    trackOfferingsFailed({
      surface,
      configured: true,
      store: ctx.store,
      buildEnv: ctx.buildEnv,
      ...errorPart,
      reason: "fetch_error",
    });
    return {
      ok: false,
      reason: "fetch_error",
      errorCode: legacyOfferingsErrorCode(error),
      ...errorPart,
    };
  }

  const pick = pickOfferingPackages(offerings);
  if (pick.fallback) {
    const offeringId = bounded(pick.fallback.offeringId, 100);
    if (offeringId) {
      trackOfferingFallbackUsed({
        offeringId,
        reason: pick.fallback.reason,
        surface,
      });
    }
  }
  if (pick.packages.length === 0) {
    const reason = pick.emptyReason ?? "no_offerings";
    trackOfferingsFailed({
      surface,
      configured: true,
      store: ctx.store,
      buildEnv: ctx.buildEnv,
      reason,
    });
    return { ok: false, reason, errorCode: reason };
  }
  return { ok: true, packages: pick.packages, offeringId: pick.offeringId };
}

// ---------------------------------------------------------------------------
// CustomerInfo: one place that applies it (purchase, restore, launch,
// listener, foreground refresh) — P9b.5, P9b.7, P9a.5

export interface CustomerInfoApplierDeps {
  setSubscribed: (subscribed: boolean) => void;
  loadStoredStatus: () => Promise<SubscriptionStatus | null>;
  saveStatus: (status: SubscriptionStatus) => Promise<void>;
  getContext?: () => Promise<PurchaseContext>;
  expectedEntitlementId?: string | null;
}

export function createCustomerInfoApplier(deps: CustomerInfoApplierDeps) {
  const getContext = deps.getContext ?? getPurchaseContext;
  let lastStatus: SubscriptionStatus | null | undefined; // undefined = not loaded
  let chain: Promise<void> = Promise.resolve();
  const mismatchLogged = new Set<string>();

  function apply(info: CustomerInfoLike | null | undefined): PremiumCheck {
    const check =
      deps.expectedEntitlementId === undefined
        ? checkPremium(info)
        : checkPremium(info, deps.expectedEntitlementId);
    noteCustomerInfoForContext(info);
    deps.setSubscribed(check.active);

    if (check.mismatch) {
      const key = `${check.mismatch.expected}|${check.mismatch.activeIds.join(",")}`;
      if (!mismatchLogged.has(key)) {
        mismatchLogged.add(key);
        trackEntitlementMismatch(check.mismatch);
      }
    }

    const next = statusFromCheck(check);
    chain = chain
      .then(async () => {
        if (lastStatus === undefined) {
          try {
            lastStatus = await deps.loadStoredStatus();
          } catch {
            lastStatus = null;
          }
        }
        const change = decideStatusChange(lastStatus, next);
        if (lastStatus !== next) {
          lastStatus = next;
          try {
            await deps.saveStatus(next);
          } catch {
            // best-effort
          }
        }
        if (change) {
          const ctx = await getContext();
          const periodType = normalizePeriodType(check.entitlement?.periodType);
          const payload: Parameters<typeof trackSubscriptionStatusChanged>[0] =
            { from: change.from, to: change.to, store: ctx.store };
          if (periodType) payload.periodType = periodType;
          if (typeof check.entitlement?.isSandbox === "boolean") {
            payload.isSandbox = check.entitlement.isSandbox;
          }
          trackSubscriptionStatusChanged(payload);
        }
      })
      .catch(() => {});
    return check;
  }

  return {
    apply,
    /** Test helper: resolves once queued status writes/logs are done. */
    idle: () => chain,
  };
}

// ---------------------------------------------------------------------------
// Purchase (P9a.2/4/5, P9b.1/4)

export type PurchaseOutcome =
  | "success"
  | "cancelled"
  | "failed"
  | "unavailable"
  /** rcCode 3: store won't allow purchases on this device/account. */
  | "not_allowed"
  /** rcCode 20: payment pending; the listener unlocks later. */
  | "pending"
  /** Resolved, refreshed once, entitlement still missing. */
  | "confirming";

export interface PurchaseDeps<P extends PackageLike> {
  isConfigured: () => Promise<boolean>;
  purchasePackage: (pkg: P) => Promise<{ customerInfo: CustomerInfoLike }>;
  /** invalidateCustomerInfoCache() then getCustomerInfo(). */
  refreshCustomerInfo: () => Promise<CustomerInfoLike>;
  applyCustomerInfo: (info: CustomerInfoLike) => PremiumCheck;
  getContext?: () => Promise<PurchaseContext>;
}

export async function runPurchase<P extends PackageLike>(
  pkg: P,
  source: PaywallSource | undefined,
  deps: PurchaseDeps<P>,
): Promise<PurchaseOutcome> {
  const getContext = deps.getContext ?? getPurchaseContext;
  const ctx = await getContext();
  const ids = packageIds(pkg);
  const base = (): {
    packageIdentifier?: string;
    productIdentifier?: string;
    offeringId?: string;
    source?: PaywallSource;
  } & PurchaseContext => ({
    ...ids,
    ...contextFields(ctx),
    ...(source ? { source } : {}),
  });

  if (!(await safeBool(deps.isConfigured))) {
    trackPurchaseResult({
      result: "unavailable",
      ...base(),
      errorCode: "not_configured",
    });
    return "unavailable";
  }

  trackPurchaseResult({ result: "started", ...base() });

  let info: CustomerInfoLike;
  try {
    ({ customerInfo: info } = await deps.purchasePackage(pkg));
  } catch (error) {
    const fields = toPurchaseError(error);
    const payload = purchaseErrorPayload(error);
    if (fields.userCancelled) {
      trackPurchaseResult({ result: "cancelled", ...base(), ...payload });
      return "cancelled";
    }
    const errorCode = legacyPurchaseErrorCode(error);
    trackPurchaseResult({
      result: "failed",
      ...base(),
      ...(errorCode ? { errorCode } : {}),
      ...payload,
    });
    if (fields.rcCode === RC_PAYMENT_PENDING) return "pending";
    if (fields.rcCode === RC_PURCHASE_NOT_ALLOWED) return "not_allowed";
    return "failed";
  }

  const first = deps.applyCustomerInfo(info);
  if (first.active) {
    trackPurchaseResult({
      result: "completed",
      ...base(),
      ...completionFields(first),
    });
    return "success";
  }

  // P9b.4: refresh once before declaring failure.
  let refreshed = false;
  try {
    const fresh = await deps.refreshCustomerInfo();
    refreshed = true;
    const second = deps.applyCustomerInfo(fresh);
    if (second.active) {
      trackPurchaseResult({
        result: "completed",
        ...base(),
        ...completionFields(second),
        recoveredAfterRefresh: true,
      });
      return "success";
    }
  } catch {
    // fall through: still unconfirmed
  }

  // Rev L5: only the dedicated event, never also purchase_failed.
  const missing: Parameters<typeof trackPurchaseEntitlementMissing>[0] = {
    ...ids,
    refreshed,
    store: ctx.store,
    buildEnv: ctx.buildEnv,
  };
  if (ctx.isSandbox !== undefined) missing.isSandbox = ctx.isSandbox;
  trackPurchaseEntitlementMissing(missing);
  return "confirming";
}

// ---------------------------------------------------------------------------
// Restore (P9a.4, P9b.8)

export type RestoreOutcome = "restored" | "not_found" | "error";

export interface RestoreDeps {
  isConfigured: () => Promise<boolean>;
  configure: () => Promise<boolean>;
  restorePurchases: () => Promise<CustomerInfoLike>;
  applyCustomerInfo: (info: CustomerInfoLike) => PremiumCheck;
  getContext?: () => Promise<PurchaseContext>;
}

export async function runRestore(deps: RestoreDeps): Promise<RestoreOutcome> {
  const getContext = deps.getContext ?? getPurchaseContext;
  const configured = await ensureConfigured(deps);
  const ctx = await getContext();
  if (!configured) {
    trackRestoreResult({
      result: "failed",
      reason: "not_configured",
      ...contextFields(ctx),
    });
    return "error";
  }

  trackRestoreResult({ result: "started", ...contextFields(ctx) });
  let info: CustomerInfoLike;
  try {
    info = await deps.restorePurchases();
  } catch (error) {
    trackRestoreResult({
      result: "failed",
      errorCode: legacyRestoreErrorCode(error),
      ...contextFields(ctx),
      ...purchaseErrorPayload(error),
    });
    return "error";
  }
  const check = deps.applyCustomerInfo(info);
  const after = await getContext();
  if (check.active) {
    trackRestoreResult({
      result: "completed",
      ...contextFields(after),
      ...completionFields(check),
    });
    return "restored";
  }
  trackRestoreResult({ result: "not_found", ...contextFields(after) });
  return "not_found";
}

// ---------------------------------------------------------------------------
// Foreground refresh throttle (P9b.5)

export const FOREGROUND_REFRESH_MIN_MS = 60_000;

export function shouldRefreshOnForeground(
  lastRefreshMs: number | null,
  nowMs: number,
  minIntervalMs = FOREGROUND_REFRESH_MIN_MS,
): boolean {
  return lastRefreshMs === null || nowMs - lastRefreshMs >= minIntervalMs;
}
