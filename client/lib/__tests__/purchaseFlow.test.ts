import {
  createCustomerInfoApplier,
  loadOfferingsWith,
  runPurchase,
  runRestore,
  shouldRefreshOnForeground,
  pickOfferingPackages,
  type PackageLike,
} from "../purchaseFlow";
import { __resetPurchaseContextForTests } from "../purchaseContext";
import type { PurchaseContext } from "../purchaseContext";
import { analyticsBatchSchema } from "../../../server/requestValidation";

jest.mock("react-native", () => ({
  Platform: { OS: "android" },
  Dimensions: { get: () => ({ width: 400, height: 800 }) },
}));
jest.mock("expo-device", () => ({
  isDevice: true,
  modelId: "Pixel 9",
  modelName: "Pixel 9",
}));
jest.mock("expo-constants", () => ({ __esModule: true, default: {} }));
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => "a".repeat(64)),
    setItem: jest.fn(async () => undefined),
  },
}));
jest.mock("expo-crypto", () => ({
  randomUUID: () => "uuid-1",
  CryptoDigestAlgorithm: { SHA256: "SHA-256" },
  digestStringAsync: async (_a: string, v: string) => `hash-${v}`,
}));
jest.mock("expo-application", () => ({
  nativeApplicationVersion: "2.2.7",
  getAppleStoreEnvironmentAsync: async () => "production",
}));
jest.mock("../query-client", () => ({
  getApiUrl: () => "https://example.test",
}));

type Sent = { type: string; data: Record<string, unknown> };
let sent: Sent[];
let rawBodies: unknown[];

const flush = () => new Promise((r) => setTimeout(r, 20));

beforeEach(() => {
  __resetPurchaseContextForTests();
  sent = [];
  rawBodies = [];
  (global as unknown as { fetch: unknown }).fetch = jest.fn(
    async (_url: string, init: { body: string }) => {
      const body = JSON.parse(init.body);
      rawBodies.push(body);
      sent.push(body.events[0]);
      return { status: 200, headers: { get: () => null } };
    },
  );
});

afterEach(async () => {
  await flush();
  // Every payload this flow sends must pass the live server schema (A8 too:
  // one unknown field would drop the whole batch).
  for (const body of rawBodies) {
    const parsed = analyticsBatchSchema.safeParse(body);
    if (!parsed.success) {
      throw new Error(
        `server rejected ${JSON.stringify(body)}: ${parsed.error.message}`,
      );
    }
  }
});

const CTX: PurchaseContext = { store: "play_store", buildEnv: "production" };
const getContext = async () => CTX;

const pkg: PackageLike = {
  identifier: "$rc_annual",
  packageType: "ANNUAL",
  product: {
    identifier: "pulsekegel_premium_v2:1yr-pulsekegel",
    priceString: "$4.99",
  },
  presentedOfferingContext: { offeringIdentifier: "default" },
};

const offering = (id: string, pkgs: PackageLike[]) => ({
  identifier: id,
  availablePackages: pkgs,
});

const rcError = (code: string, extra: object = {}) =>
  Object.assign(new Error(`rc error ${code}`), {
    code,
    userInfo: { readableErrorCode: `CODE_${code}` },
    ...extra,
  });

const types = () => sent.map((e) => e.type);

describe("P9b.2 offerings loader", () => {
  it("never calls getOfferings while unconfigured; retries configure once (A11)", async () => {
    const getOfferings = jest.fn();
    const configure = jest.fn(async () => false);
    const r = await loadOfferingsWith("paywall_retry", {
      isConfigured: async () => false,
      configure,
      getOfferings,
      getContext,
    });
    await flush();
    expect(r).toEqual({
      ok: false,
      reason: "not_configured",
      errorCode: "not_configured",
    });
    expect(configure).toHaveBeenCalledTimes(1);
    expect(getOfferings).not.toHaveBeenCalled();
    expect(sent).toEqual([
      {
        ...sent[0],
        type: "offerings_failed",
        data: {
          surface: "paywall_retry",
          configured: false,
          store: "play_store",
          buildEnv: "production",
          reason: "not_configured",
        },
      },
    ]);
  });

  it("recovers when the second configure works", async () => {
    let configured = false;
    const r = await loadOfferingsWith("paywall_retry", {
      isConfigured: async () => configured,
      configure: async () => (configured = true),
      getOfferings: async () => ({
        current: offering("default", [pkg]),
        all: {},
      }),
      getContext,
    });
    expect(r).toEqual({ ok: true, packages: [pkg], offeringId: "default" });
  });

  it("Android rc_3 on getOfferings is logged with its code (fetch_error)", async () => {
    const r = await loadOfferingsWith("launch", {
      isConfigured: async () => true,
      configure: async () => true,
      getOfferings: async () => {
        throw rcError("3");
      },
      getContext,
    });
    await flush();
    expect(r).toMatchObject({
      ok: false,
      reason: "fetch_error",
      errorCode: "rc_3",
      rcCode: 3,
      readableErrorCode: "CODE_3",
    });
    expect(sent[0].type).toBe("offerings_failed");
    expect(sent[0].data).toEqual({
      surface: "launch",
      configured: true,
      store: "play_store",
      buildEnv: "production",
      rcCode: 3,
      readableErrorCode: "CODE_3",
      errorMessage: "rc error 3",
      reason: "fetch_error",
    });
  });

  it("logs offering_fallback_used when current is missing or empty", async () => {
    const r = await loadOfferingsWith("launch", {
      isConfigured: async () => true,
      configure: async () => true,
      getOfferings: async () => ({
        current: offering("default", []),
        all: { default: offering("default", []), v1: offering("v1", [pkg]) },
      }),
      getContext,
    });
    await flush();
    expect(r).toMatchObject({ ok: true, offeringId: "v1" });
    expect(sent.map((e) => [e.type, e.data])).toEqual([
      [
        "offering_fallback_used",
        { offeringId: "v1", reason: "current_empty", surface: "launch" },
      ],
    ]);
  });

  it("empty reasons keep today's H3 codes", () => {
    expect(pickOfferingPackages({ current: null, all: {} }).emptyReason).toBe(
      "no_offerings",
    );
    expect(
      pickOfferingPackages({ current: null, all: { a: offering("a", []) } })
        .emptyReason,
    ).toBe("no_current_offering");
    expect(
      pickOfferingPackages({
        current: offering("a", []),
        all: { a: offering("a", []) },
      }).emptyReason,
    ).toBe("current_offering_empty");
    expect(
      pickOfferingPackages({ current: null, all: { a: offering("a", [pkg]) } })
        .fallback,
    ).toEqual({ offeringId: "a", reason: "no_current" });
  });

  it("empty offering logs offerings_failed with the reason", async () => {
    const r = await loadOfferingsWith("paywall_retry", {
      isConfigured: async () => true,
      configure: async () => true,
      getOfferings: async () => ({ current: null, all: {} }),
      getContext,
    });
    await flush();
    expect(r).toEqual({
      ok: false,
      reason: "no_offerings",
      errorCode: "no_offerings",
    });
    expect(sent[0].data.reason).toBe("no_offerings");
  });
});

function applier(expected: string | null = "premium") {
  let stored: string | null = "none";
  const subscribed: boolean[] = [];
  const a = createCustomerInfoApplier({
    setSubscribed: (s) => subscribed.push(s),
    loadStoredStatus: async () => stored as "none" | null,
    saveStatus: async (s) => {
      stored = s;
    },
    getContext,
    expectedEntitlementId: expected,
  });
  return {
    a,
    subscribed,
    getStored: () => stored,
    setStored: (s: string | null) => (stored = s),
  };
}

const info = (active: Record<string, object>) => ({ entitlements: { active } });
const TRIAL = info({ premium: { periodType: "TRIAL", isSandbox: true } });

describe("P9 purchase flow", () => {
  it("free-week start: started → completed with periodType/isTrial (A4)", async () => {
    const { a } = applier();
    const r = await runPurchase(pkg, "day1_soft", {
      isConfigured: async () => true,
      purchasePackage: async () => ({ customerInfo: TRIAL }),
      refreshCustomerInfo: jest.fn(),
      applyCustomerInfo: a.apply,
      getContext,
    });
    await a.idle();
    await flush();
    expect(r).toBe("success");
    const purchaseEvents = sent.filter((e) => e.type.startsWith("purchase_"));
    expect(purchaseEvents.map((e) => e.type)).toEqual([
      "purchase_started",
      "purchase_completed",
    ]);
    expect(purchaseEvents[1].data).toEqual({
      result: "completed",
      packageIdentifier: "$rc_annual",
      productIdentifier: "pulsekegel_premium_v2:1yr-pulsekegel",
      offeringId: "default",
      store: "play_store",
      buildEnv: "production",
      source: "day1_soft",
      periodType: "TRIAL",
      isTrial: true,
      isSandbox: true,
    });
    expect(types()).toContain("subscription_status_changed");
  });

  it("refreshes once and recovers (recoveredAfterRefresh)", async () => {
    const { a } = applier();
    const refresh = jest.fn(async () =>
      info({ premium: { periodType: "NORMAL" } }),
    );
    const r = await runPurchase(pkg, "settings", {
      isConfigured: async () => true,
      purchasePackage: async () => ({ customerInfo: info({}) }),
      refreshCustomerInfo: refresh,
      applyCustomerInfo: a.apply,
      getContext,
    });
    await flush();
    expect(r).toBe("success");
    expect(refresh).toHaveBeenCalledTimes(1);
    const done = sent.find((e) => e.type === "purchase_completed")!;
    expect(done.data).toMatchObject({
      recoveredAfterRefresh: true,
      isTrial: false,
    });
  });

  it("still missing → only purchase_entitlement_missing, never purchase_failed (A5, Rev L5)", async () => {
    const { a } = applier();
    const r = await runPurchase(pkg, "settings", {
      isConfigured: async () => true,
      purchasePackage: async () => ({ customerInfo: info({}) }),
      refreshCustomerInfo: async () => info({}),
      applyCustomerInfo: a.apply,
      getContext,
    });
    await flush();
    expect(r).toBe("confirming");
    expect(types()).not.toContain("purchase_failed");
    expect(sent.filter((e) => e.data.result === "entitlement_missing")).toEqual(
      [],
    );
    const missing = sent.filter(
      (e) => e.type === "purchase_entitlement_missing",
    );
    expect(missing).toHaveLength(1);
    expect(missing[0].data).toEqual({
      packageIdentifier: "$rc_annual",
      productIdentifier: "pulsekegel_premium_v2:1yr-pulsekegel",
      offeringId: "default",
      refreshed: true,
      store: "play_store",
      buildEnv: "production",
    });
  });

  it("refresh that throws still ends as entitlement_missing (refreshed:false)", async () => {
    const { a } = applier();
    const r = await runPurchase(pkg, undefined, {
      isConfigured: async () => true,
      purchasePackage: async () => ({ customerInfo: info({}) }),
      refreshCustomerInfo: async () => {
        throw new Error("offline");
      },
      applyCustomerInfo: a.apply,
      getContext,
    });
    await flush();
    expect(r).toBe("confirming");
    expect(types()).toEqual([
      "purchase_started",
      "purchase_entitlement_missing",
    ]);
    expect(sent[1].data.refreshed).toBe(false);
  });

  it("rc 20 → pending, logged as purchase_failed rcCode 20", async () => {
    const { a } = applier();
    const r = await runPurchase(pkg, "workout_gate", {
      isConfigured: async () => true,
      purchasePackage: async () => {
        throw rcError("20");
      },
      refreshCustomerInfo: jest.fn(),
      applyCustomerInfo: a.apply,
      getContext,
    });
    await flush();
    expect(r).toBe("pending");
    const failed = sent.find((e) => e.type === "purchase_failed")!;
    expect(failed.data).toMatchObject({
      rcCode: 20,
      errorCode: "20",
      readableErrorCode: "CODE_20",
    });
  });

  it("rc 3 on purchase → not_allowed", async () => {
    const { a } = applier();
    const r = await runPurchase(pkg, "workout_gate", {
      isConfigured: async () => true,
      purchasePackage: async () => {
        throw rcError("3");
      },
      refreshCustomerInfo: jest.fn(),
      applyCustomerInfo: a.apply,
      getContext,
    });
    expect(r).toBe("not_allowed");
  });

  it("other errors → failed with error fields (A2)", async () => {
    const { a } = applier();
    const r = await runPurchase(pkg, "workout_gate", {
      isConfigured: async () => true,
      purchasePackage: async () => {
        throw rcError("23");
      },
      refreshCustomerInfo: jest.fn(),
      applyCustomerInfo: a.apply,
      getContext,
    });
    await flush();
    expect(r).toBe("failed");
    expect(sent.find((e) => e.type === "purchase_failed")!.data).toEqual({
      result: "failed",
      packageIdentifier: "$rc_annual",
      productIdentifier: "pulsekegel_premium_v2:1yr-pulsekegel",
      offeringId: "default",
      store: "play_store",
      buildEnv: "production",
      source: "workout_gate",
      errorCode: "23",
      rcCode: 23,
      readableErrorCode: "CODE_23",
      errorMessage: "rc error 23",
    });
  });

  it("cancel → purchase_cancelled with userCancelled", async () => {
    const { a } = applier();
    const r = await runPurchase(pkg, "settings", {
      isConfigured: async () => true,
      purchasePackage: async () => {
        throw rcError("1", { userCancelled: true });
      },
      refreshCustomerInfo: jest.fn(),
      applyCustomerInfo: a.apply,
      getContext,
    });
    await flush();
    expect(r).toBe("cancelled");
    expect(
      sent.find((e) => e.type === "purchase_cancelled")!.data,
    ).toMatchObject({
      userCancelled: true,
      rcCode: 1,
    });
  });

  it("unconfigured SDK → purchase_unavailable not_configured, no purchase call", async () => {
    const { a } = applier();
    const purchase = jest.fn();
    const r = await runPurchase(pkg, "settings", {
      isConfigured: async () => false,
      purchasePackage: purchase,
      refreshCustomerInfo: jest.fn(),
      applyCustomerInfo: a.apply,
      getContext,
    });
    await flush();
    expect(r).toBe("unavailable");
    expect(purchase).not.toHaveBeenCalled();
    expect(sent[0]).toMatchObject({
      type: "purchase_unavailable",
      data: { errorCode: "not_configured", store: "play_store" },
    });
  });
});

describe("P9b.8 restore", () => {
  const base = { configure: async () => false, getContext };

  it("unconfigured → restore_failed reason not_configured, error outcome", async () => {
    const { a } = applier();
    const r = await runRestore({
      ...base,
      isConfigured: async () => false,
      restorePurchases: jest.fn(),
      applyCustomerInfo: a.apply,
    });
    await flush();
    expect(r).toBe("error");
    expect(sent[0]).toMatchObject({
      type: "restore_failed",
      data: {
        result: "failed",
        reason: "not_configured",
        store: "play_store",
        buildEnv: "production",
      },
    });
  });

  it("store error → error (not 'not found'), with error fields", async () => {
    const { a } = applier();
    const r = await runRestore({
      ...base,
      isConfigured: async () => true,
      restorePurchases: async () => {
        throw rcError("10");
      },
      applyCustomerInfo: a.apply,
    });
    await flush();
    expect(r).toBe("error");
    expect(types()).toEqual(["restore_started", "restore_failed"]);
    expect(sent[1].data).toMatchObject({ errorCode: "10", rcCode: 10 });
  });

  it("nothing active → not_found; active → restored", async () => {
    const { a } = applier();
    expect(
      await runRestore({
        ...base,
        isConfigured: async () => true,
        restorePurchases: async () => info({}),
        applyCustomerInfo: a.apply,
      }),
    ).toBe("not_found");
    expect(
      await runRestore({
        ...base,
        isConfigured: async () => true,
        restorePurchases: async () =>
          info({ premium: { periodType: "NORMAL", isSandbox: false } }),
        applyCustomerInfo: a.apply,
      }),
    ).toBe("restored");
    await a.idle();
    await flush();
    expect(types()).toEqual([
      "restore_started",
      "restore_not_found",
      "restore_started",
      "restore_completed",
      "subscription_status_changed",
    ]);
    expect(sent[3].data).toMatchObject({
      isSandbox: false,
      periodType: "NORMAL",
      isTrial: false,
    });
  });
});

describe("P9b.5 / decision 2 CustomerInfo applier", () => {
  it("logs subscription_status_changed once per real change (A12)", async () => {
    const { a, subscribed, getStored } = applier();
    a.apply(TRIAL); // listener
    a.apply(TRIAL); // foreground refresh, same status
    await a.idle();
    a.apply(info({ premium: { periodType: "NORMAL", isSandbox: true } }));
    await a.idle();
    await flush();
    const changes = sent.filter(
      (e) => e.type === "subscription_status_changed",
    );
    expect(changes.map((e) => e.data)).toEqual([
      {
        from: "none",
        to: "trial",
        store: "play_store",
        periodType: "TRIAL",
        isSandbox: true,
      },
      {
        from: "trial",
        to: "paid",
        store: "play_store",
        periodType: "NORMAL",
        isSandbox: true,
      },
    ]);
    expect(subscribed).toEqual([true, true, true]);
    expect(getStored()).toBe("paid");
  });

  it("first run seeds silently (existing subscriber isn't a new none→paid)", async () => {
    const { a, setStored, getStored } = applier();
    setStored(null);
    a.apply(info({ premium: { periodType: "NORMAL" } }));
    await a.idle();
    await flush();
    expect(types()).toEqual([]);
    expect(getStored()).toBe("paid");
  });

  it("mismatch keeps access and logs entitlement_mismatch once", async () => {
    const { a, subscribed } = applier("premium");
    a.apply(info({ pro: {} }));
    a.apply(info({ pro: {} }));
    await a.idle();
    await flush();
    expect(subscribed).toEqual([true, true]);
    const mm = sent.filter((e) => e.type === "entitlement_mismatch");
    expect(mm.map((e) => e.data)).toEqual([
      { expected: "premium", activeIds: ["pro"] },
    ]);
  });
});

describe("P9b.5 foreground throttle", () => {
  it("at most once per 60 s", () => {
    expect(shouldRefreshOnForeground(null, 1000)).toBe(true);
    expect(shouldRefreshOnForeground(1000, 30_000)).toBe(false);
    expect(shouldRefreshOnForeground(1000, 61_000)).toBe(true);
  });
});
