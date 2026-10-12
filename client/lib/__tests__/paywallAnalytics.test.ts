jest.mock("react-native", () => ({ Platform: { OS: "ios" } }));
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
jest.mock("expo-application", () => ({ nativeApplicationVersion: "2.2.3" }));
jest.mock("../query-client", () => ({
  getApiUrl: () => "https://example.test",
}));

import {
  trackDay1SoftPaywallDeferred,
  trackPaywallDismissed,
  trackPurchaseResult,
  trackSubscribeTapped,
} from "../analytics";
import { analyticsBatchSchema } from "../../../server/requestValidation";

describe("P4 paywall analytics trackers", () => {
  let bodies: { deviceId: string; events: { type: string; data: any }[] }[];

  beforeEach(() => {
    bodies = [];
    (global as unknown as { fetch: unknown }).fetch = jest.fn(
      async (_url: string, init: { body: string }) => {
        bodies.push(JSON.parse(init.body));
        return { status: 200, headers: { get: () => null } };
      },
    );
  });

  const flush = () => new Promise((r) => setTimeout(r, 20));

  it("sends payloads the server accepts, with source", async () => {
    trackPaywallDismissed({ source: "day1_soft", method: "not_now" });
    trackPaywallDismissed({ source: "settings", method: "close" });
    trackDay1SoftPaywallDeferred();
    trackSubscribeTapped({ source: "day1_soft", packageIdentifier: "annual" });
    trackPurchaseResult({ result: "completed", source: "day1_soft" });
    await flush();

    const events = bodies.map((b) => b.events[0]);
    expect(events.map((e) => e.type).sort()).toEqual(
      [
        "day1_soft_paywall_deferred",
        "paywall_dismissed",
        "paywall_dismissed",
        "purchase_completed",
        "subscribe_tapped",
      ].sort(),
    );
    expect(
      events.find((e) => e.type === "purchase_completed")?.data.source,
    ).toBe("day1_soft");
    expect(
      events
        .filter((e) => e.type === "paywall_dismissed")
        .map((e) => e.data.source)
        .sort(),
    ).toEqual(["day1_soft", "settings"]);
    for (const body of bodies) {
      expect(analyticsBatchSchema.safeParse(body).success).toBe(true);
    }
  });
});
