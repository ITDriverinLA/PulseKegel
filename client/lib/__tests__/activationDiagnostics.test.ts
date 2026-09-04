jest.mock("react-native", () => ({
  Platform: { OS: "ios" },
  AppState: { currentState: "active" },
}));

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: {
    appOwnership: "standalone",
    executionEnvironment: "standalone",
    expoConfig: { extra: {} },
  },
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock("../analytics", () => ({
  trackFirstOpenPath: jest.fn(),
  trackPermissionPromptShown: jest.fn(),
  trackPermissionResult: jest.fn(),
}));

jest.mock("../storage", () => ({
  storage: {
    isOnboardingComplete: jest.fn(() => Promise.resolve(false)),
    hasCompletedFirstSession: jest.fn(() => Promise.resolve(false)),
  },
}));

import {
  getAttStatus,
  getBuildChannel,
  getLaunchType,
  markColdLaunch,
  markWarmResume,
} from "../activationDiagnostics";

describe("activation diagnostics", () => {
  it("starts cold and flips to warm on resume", () => {
    markColdLaunch();
    expect(getLaunchType()).toBe("cold");
    markWarmResume();
    expect(getLaunchType()).toBe("warm");
  });

  it("reports build channel when present", () => {
    expect(getBuildChannel()).toBe("production");
  });

  it("reports ATT unavailable without native module (no early prompt)", async () => {
    await expect(getAttStatus()).resolves.toBe("unavailable");
  });
});
