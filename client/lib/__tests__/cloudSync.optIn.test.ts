import AsyncStorage from "@react-native-async-storage/async-storage";

jest.mock("react-native", () => ({
  Platform: { OS: "ios" },
}));

jest.mock("@react-native-async-storage/async-storage", () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn((k: string) =>
        Promise.resolve(store.has(k) ? (store.get(k) as string) : null),
      ),
      setItem: jest.fn((k: string, v: string) => {
        store.set(k, v);
        return Promise.resolve();
      }),
      removeItem: jest.fn((k: string) => {
        store.delete(k);
        return Promise.resolve();
      }),
      multiRemove: jest.fn((keys: string[]) => {
        keys.forEach((k) => store.delete(k));
        return Promise.resolve();
      }),
      clear: jest.fn(() => {
        store.clear();
        return Promise.resolve();
      }),
      __store: store,
    },
  };
});

jest.mock("../analytics", () => ({
  trackEvent: jest.fn(),
}));

jest.mock("../query-client", () => ({
  getApiUrl: () => "https://example.test/",
}));

jest.mock("../progressTransfer", () => ({
  buildTransferPayload: jest.fn(),
  applyTransferPayload: jest.fn(),
}));

import {
  canUploadProgress,
  enableCloudSyncOptIn,
  isCloudSyncOptedIn,
  pushProgressIfOptedIn,
  setCloudAuthSession,
  _resetCloudSyncPrefsForTests,
} from "../cloudSync";

const store = (AsyncStorage as unknown as { __store: Map<string, string> })
  .__store;

beforeEach(async () => {
  store.clear();
  jest.clearAllMocks();
  await _resetCloudSyncPrefsForTests();
  global.fetch = jest.fn();
});

describe("cloud sync opt-in gate (OP1)", () => {
  it("defaults to opted-out — fresh install never uploads", async () => {
    expect(await isCloudSyncOptedIn()).toBe(false);
    expect(await canUploadProgress()).toBe(false);
    const result = await pushProgressIfOptedIn();
    expect(result).toEqual({
      ok: true,
      skipped: true,
      reason: "opt_in_off",
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("still does not upload after opt-in until auth token exists", async () => {
    await enableCloudSyncOptIn({ provider: "apple" });
    expect(await isCloudSyncOptedIn()).toBe(true);
    expect(await canUploadProgress()).toBe(false);
    const result = await pushProgressIfOptedIn();
    expect(result).toEqual({
      ok: true,
      skipped: true,
      reason: "no_auth",
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("refuses setCloudAuthSession without opt-in", async () => {
    await expect(
      setCloudAuthSession({
        accountId: "a1",
        token: "t1",
        provider: "apple",
      }),
    ).rejects.toThrow(/opt-in required/i);
  });

  it("uploads only when opted in AND authenticated", async () => {
    const { buildTransferPayload } = require("../progressTransfer");
    buildTransferPayload.mockResolvedValue({
      schema_version: 1,
      exported_at: new Date().toISOString(),
      progress: { completed_dates: [], total_sessions: 0 },
      settings: {},
    });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    });

    await enableCloudSyncOptIn({ provider: "apple" });
    await setCloudAuthSession({
      accountId: "a1",
      token: "secret-token",
      provider: "apple",
    });
    expect(await canUploadProgress()).toBe(true);
    const result = await pushProgressIfOptedIn();
    expect(result).toEqual({ ok: true });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(String(url)).toContain("/api/sync/push");
    expect(init.headers.Authorization).toBe("Bearer secret-token");
  });
});
