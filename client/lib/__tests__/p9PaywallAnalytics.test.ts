import {
  trackPaywallRetryTapped,
  trackPaywallViewed,
  trackPurchaseResult,
  trackSubscribeTapped,
} from "../analytics";
import { analyticsBatchSchema } from "../../../server/requestValidation";

jest.mock("react-native", () => ({
  Platform: { OS: "android" },
  Dimensions: { get: () => ({ width: 400, height: 800 }) },
}));
jest.mock("expo-device", () => ({ modelId: "Pixel 9", modelName: "Pixel 9" }));
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
jest.mock("expo-application", () => ({ nativeApplicationVersion: "2.2.7" }));
jest.mock("../query-client", () => ({
  getApiUrl: () => "https://example.test",
}));

describe("P9 paywall trackers match the live server schema", () => {
  it("paywall_viewed (store/buildEnv), subscribe_tapped (hasPackages), retry, unavailable", async () => {
    const bodies: unknown[] = [];
    (global as unknown as { fetch: unknown }).fetch = jest.fn(
      async (_u: string, init: { body: string }) => {
        bodies.push(JSON.parse(init.body));
        return { status: 200, headers: { get: () => null } };
      },
    );
    trackPaywallViewed({
      source: "workout_gate",
      trialDaysRemaining: 0,
      store: "play_store",
      buildEnv: "production",
    });
    trackSubscribeTapped({ source: "workout_gate", hasPackages: false });
    trackSubscribeTapped({
      source: "settings",
      packageIdentifier: "$rc_annual",
      productIdentifier: "pulsekegel_premium_v2:1yr-pulsekegel",
      displayedPrice: "$4.99",
      hasPackages: true,
    });
    trackPaywallRetryTapped({ code: 3 });
    trackPaywallRetryTapped({ code: "no_offerings" });
    trackPurchaseResult({
      result: "unavailable",
      source: "workout_gate",
      errorCode: "rc_3",
      store: "play_store",
      buildEnv: "production",
      rcCode: 3,
      readableErrorCode: "PURCHASE_NOT_ALLOWED",
      errorMessage: "The device or user is not allowed to make the purchase.",
    });
    await new Promise((r) => setTimeout(r, 20));
    expect(bodies).toHaveLength(6);
    for (const body of bodies) {
      const parsed = analyticsBatchSchema.safeParse(body);
      expect(parsed.success).toBe(true);
    }
  });
});
