const mockPlatform = { OS: "ios" as string };
const mockDevice = { isDevice: true as boolean | null };
const mockConstants = { appOwnership: null as string | null };
const mockStoreEnv = jest.fn(async (): Promise<string | null> => "production");

jest.mock("react-native", () => ({ Platform: mockPlatform }));
jest.mock("expo-device", () => mockDevice);
jest.mock("expo-constants", () => ({
  __esModule: true,
  default: mockConstants,
}));
jest.mock("expo-application", () => ({
  getAppleStoreEnvironmentAsync: () => mockStoreEnv(),
}));

import {
  __resetPurchaseContextForTests,
  detectBuildEnv,
  getBuildEnv,
  getPurchaseContext,
  getPurchaseStore,
  noteCustomerInfoForContext,
  sandboxFromCustomerInfo,
} from "../purchaseContext";

const g = global as unknown as { __DEV__?: boolean };

beforeEach(() => {
  __resetPurchaseContextForTests();
  mockPlatform.OS = "ios";
  mockDevice.isDevice = true;
  mockConstants.appOwnership = null;
  mockStoreEnv.mockReset();
  mockStoreEnv.mockImplementation(async () => "production");
  g.__DEV__ = false;
});

describe("P9a.1 store", () => {
  it("maps platforms to the server's store enum", () => {
    expect(getPurchaseStore("ios")).toBe("app_store");
    expect(getPurchaseStore("android")).toBe("play_store");
    expect(getPurchaseStore("web")).toBe("none");
  });
});

describe("P9a.1 buildEnv", () => {
  it("simulator / emulator wins", async () => {
    mockDevice.isDevice = false;
    g.__DEV__ = true;
    expect(await detectBuildEnv()).toBe("simulator");
  });
  it("dev build", async () => {
    g.__DEV__ = true;
    expect(await detectBuildEnv()).toBe("dev");
  });
  it("Expo Go", async () => {
    mockConstants.appOwnership = "expo";
    expect(await detectBuildEnv()).toBe("expo_go");
  });
  it("TestFlight = sandbox store environment", async () => {
    mockStoreEnv.mockImplementation(async () => "sandbox");
    expect(await detectBuildEnv()).toBe("testflight");
  });
  it("Xcode install", async () => {
    mockStoreEnv.mockImplementation(async () => "xcode");
    expect(await detectBuildEnv()).toBe("xcode");
  });
  it("App Store production", async () => {
    expect(await detectBuildEnv()).toBe("production");
  });
  it("Android production never asks Apple", async () => {
    mockPlatform.OS = "android";
    expect(await detectBuildEnv()).toBe("production");
    expect(mockStoreEnv).not.toHaveBeenCalled();
  });
  it("web doesn't crash", async () => {
    mockPlatform.OS = "web";
    expect(await detectBuildEnv()).toBe("production");
  });
  it("unknown when a call throws", async () => {
    mockStoreEnv.mockImplementation(async () => {
      throw new Error("boom");
    });
    expect(await detectBuildEnv()).toBe("unknown");
  });
  it("is computed once per launch and cached", async () => {
    mockStoreEnv.mockImplementation(async () => "sandbox");
    expect(await getBuildEnv()).toBe("testflight");
    mockStoreEnv.mockImplementation(async () => "production");
    expect(await getBuildEnv()).toBe("testflight");
    expect(mockStoreEnv).toHaveBeenCalledTimes(1);
  });
});

describe("P9a.1 isSandbox", () => {
  it("absent until CustomerInfo has an active entitlement", async () => {
    expect(sandboxFromCustomerInfo({ entitlements: { active: {} } })).toBe(
      undefined,
    );
    noteCustomerInfoForContext({ entitlements: { active: {} } });
    expect((await getPurchaseContext()).isSandbox).toBeUndefined();
  });
  it("true if any active entitlement is sandbox", async () => {
    noteCustomerInfoForContext({
      entitlements: {
        active: { a: { isSandbox: false }, b: { isSandbox: true } },
      },
    });
    expect(await getPurchaseContext()).toEqual({
      store: "app_store",
      buildEnv: "production",
      isSandbox: true,
    });
  });
  it("false for production entitlements", () => {
    expect(
      sandboxFromCustomerInfo({
        entitlements: { active: { a: { isSandbox: false } } },
      }),
    ).toBe(false);
  });
});
