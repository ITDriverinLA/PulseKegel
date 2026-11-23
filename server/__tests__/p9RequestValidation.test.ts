import { analyticsBatchSchema } from "../requestValidation";

const deviceId = "a".repeat(64);

function parse(
  type: string,
  data: Record<string, unknown>,
  extra: object = {},
) {
  return analyticsBatchSchema.safeParse({
    deviceId,
    events: [{ type, data, ...extra }],
  });
}

describe("P9 analytics validation", () => {
  it("still accepts 2.2.4–2.2.6 purchase and paywall payloads", () => {
    expect(
      parse("paywall_viewed", {
        source: "challenge_complete",
        trialDaysRemaining: 0,
        completedCoreSessions: 3,
        totalCoreSessions: 3,
      }).success,
    ).toBe(true);
    expect(
      parse("subscribe_tapped", {
        source: "settings",
        packageIdentifier: "$rc_annual",
        productIdentifier: "pulsekegel_premium_v2",
        displayedPrice: "$4.99",
      }).success,
    ).toBe(true);
    expect(
      parse("purchase_completed", {
        result: "completed",
        packageIdentifier: "$rc_annual",
        productIdentifier: "pulsekegel_premium_v2",
      }).success,
    ).toBe(true);
    expect(
      parse("purchase_unavailable", {
        result: "unavailable",
        errorCode: "rc_3",
      }).success,
    ).toBe(true);
    expect(
      parse("restore_failed", { result: "failed", errorCode: "10" }).success,
    ).toBe(true);
  });

  it("accepts new optional fields on existing purchase events", () => {
    const result = parse("purchase_completed", {
      result: "completed",
      packageIdentifier: "$rc_annual",
      productIdentifier: "pulsekegel_premium_v2",
      store: "app_store",
      buildEnv: "testflight",
      isSandbox: true,
      offeringId: "default",
      periodType: "TRIAL",
      isTrial: true,
      recoveredAfterRefresh: false,
    });
    expect(result.success).toBe(true);
  });

  it("accepts error fields on purchase_failed and restore_failed", () => {
    expect(
      parse("purchase_failed", {
        result: "failed",
        errorCode: "rc_3",
        rcCode: 3,
        readableErrorCode: "PURCHASE_NOT_ALLOWED",
        errorMessage: "The device or account is not allowed to make purchases.",
        store: "play_store",
        buildEnv: "production",
        userCancelled: false,
      }).success,
    ).toBe(true);
    expect(
      parse("restore_failed", {
        result: "failed",
        reason: "not_configured",
        rcCode: 0,
        readableErrorCode: "NOT_CONFIGURED",
        errorMessage: "Purchases is not configured",
        store: "app_store",
        buildEnv: "production",
      }).success,
    ).toBe(true);
  });

  it("accepts hasPackages on subscribe_tapped and store/buildEnv on paywall_viewed", () => {
    expect(
      parse("subscribe_tapped", {
        source: "day1_soft",
        hasPackages: false,
      }).success,
    ).toBe(true);
    expect(
      parse("paywall_viewed", {
        source: "settings",
        trialDaysRemaining: 4,
        store: "play_store",
        buildEnv: "production",
      }).success,
    ).toBe(true);
  });

  it("accepts the new P9 events", () => {
    expect(
      parse("offering_fallback_used", {
        offeringId: "default",
        reason: "no_current",
        surface: "launch",
      }).success,
    ).toBe(true);
    expect(
      parse("offerings_failed", {
        surface: "paywall_retry",
        configured: false,
        store: "play_store",
        buildEnv: "production",
        reason: "not_configured",
      }).success,
    ).toBe(true);
    expect(
      parse("purchase_entitlement_missing", {
        packageIdentifier: "$rc_annual",
        productIdentifier: "pulsekegel_premium_v2",
        offeringId: "default",
        refreshed: true,
        store: "app_store",
        buildEnv: "production",
        isSandbox: false,
      }).success,
    ).toBe(true);
    expect(
      parse("entitlement_mismatch", {
        expected: "premium",
        activeIds: ["legacy", "other"],
      }).success,
    ).toBe(true);
    expect(
      parse("subscription_status_changed", {
        from: "trial",
        to: "paid",
        periodType: "NORMAL",
        isSandbox: false,
        store: "app_store",
      }).success,
    ).toBe(true);
    expect(parse("paywall_retry_tapped", { code: "3" }).success).toBe(true);
    expect(parse("paywall_retry_tapped", { code: 3 }).success).toBe(true);
    expect(
      parse("purchase_started", {
        result: "entitlement_missing",
      }).success,
    ).toBe(true);
  });

  it("rejects bad enums and over-long strings", () => {
    expect(
      parse("purchase_completed", {
        result: "completed",
        store: "amazon",
      }).success,
    ).toBe(false);
    expect(
      parse("purchase_completed", {
        result: "completed",
        buildEnv: "staging",
      }).success,
    ).toBe(false);
    expect(
      parse("purchase_completed", {
        result: "completed",
        periodType: "trial",
      }).success,
    ).toBe(false);
    expect(
      parse("purchase_failed", {
        result: "failed",
        rcCode: 100,
      }).success,
    ).toBe(false);
    expect(
      parse("purchase_failed", {
        result: "failed",
        rcCode: -1,
      }).success,
    ).toBe(false);
    expect(
      parse("purchase_failed", {
        result: "failed",
        readableErrorCode: "E".repeat(65),
      }).success,
    ).toBe(false);
    expect(
      parse("purchase_failed", {
        result: "failed",
        errorMessage: "m".repeat(101),
      }).success,
    ).toBe(false);
    expect(
      parse("offering_fallback_used", {
        offeringId: "default",
        reason: "other",
        surface: "launch",
      }).success,
    ).toBe(false);
    expect(
      parse("entitlement_mismatch", {
        expected: "premium",
        activeIds: ["a", "b", "c", "d", "e", "f"],
      }).success,
    ).toBe(false);
    expect(
      parse("subscription_status_changed", {
        from: "sandbox",
        to: "paid",
      }).success,
    ).toBe(false);
    expect(
      parse("purchase_completed", {
        result: "completed",
        unexpected: true,
      }).success,
    ).toBe(false);
  });
});
