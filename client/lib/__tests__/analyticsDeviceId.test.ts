jest.mock("react-native", () => ({ Platform: { OS: "android" } }));

const store: Record<string, string> = {};
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (k: string) => {
      await new Promise((r) => setTimeout(r, 5));
      return store[k] ?? null;
    }),
    setItem: jest.fn(async (k: string, v: string) => {
      await new Promise((r) => setTimeout(r, 5));
      store[k] = v;
    }),
  },
}));

let uuidCounter = 0;
jest.mock("expo-crypto", () => ({
  randomUUID: () => `uuid-${++uuidCounter}`,
  CryptoDigestAlgorithm: { SHA256: "SHA-256" },
  digestStringAsync: async (_alg: string, v: string) => `hash-${v}`,
}));

jest.mock("expo-application", () => ({ nativeApplicationVersion: "2.2.1" }));
jest.mock("../query-client", () => ({
  getApiUrl: () => "https://example.test",
}));

import { trackEvent, __resetDeviceIdForTests } from "../analytics";

describe("P2.3 analytics device id", () => {
  it("concurrent first-launch events share one device id", async () => {
    __resetDeviceIdForTests();
    const bodies: string[] = [];
    (global as unknown as { fetch: unknown }).fetch = jest.fn(
      async (_url: string, init: { body: string }) => {
        bodies.push(init.body);
        return { status: 200, headers: { get: () => null } };
      },
    );

    trackEvent("first_open_path", { landing_route: "onboarding" });
    trackEvent("onboarding_screen_viewed", { screen_key: "welcome" });
    trackEvent("app_open", {});

    await new Promise((r) => setTimeout(r, 60));
    const ids = new Set(bodies.map((b) => JSON.parse(b).deviceId));
    expect(bodies).toHaveLength(3);
    expect(ids.size).toBe(1);
  });
});
