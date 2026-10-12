jest.mock("react-native", () => ({
  Platform: { OS: "ios" },
}));

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { extra: {} } },
}));

import {
  cloudSignInUnavailableReason,
  isCloudSignInConfigured,
  obtainCloudIdentityToken,
  shouldShowCloudSyncSection,
} from "../cloudAuth";

describe("cloudAuth fail-closed", () => {
  const prevApple = process.env.EXPO_PUBLIC_APPLE_CLIENT_ID;
  const prevGoogle = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;

  afterEach(() => {
    if (prevApple === undefined) delete process.env.EXPO_PUBLIC_APPLE_CLIENT_ID;
    else process.env.EXPO_PUBLIC_APPLE_CLIENT_ID = prevApple;
    if (prevGoogle === undefined)
      delete process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
    else process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID = prevGoogle;
  });

  it("disables cloud sign-in when client IDs are missing", () => {
    delete process.env.EXPO_PUBLIC_APPLE_CLIENT_ID;
    delete process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
    expect(isCloudSignInConfigured("apple")).toBe(false);
    expect(cloudSignInUnavailableReason("apple")).toMatch(/not configured/i);
  });

  it("never returns a shared pending-ashley identity token", async () => {
    delete process.env.EXPO_PUBLIC_APPLE_CLIENT_ID;
    const result = await obtainCloudIdentityToken("apple");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.configured).toBe(false);
      expect(JSON.stringify(result)).not.toMatch(/pending-ashley/);
    }
  });

  it("reports configured when EXPO_PUBLIC_APPLE_CLIENT_ID is set", () => {
    process.env.EXPO_PUBLIC_APPLE_CLIENT_ID = "com.example.apple";
    expect(isCloudSignInConfigured("apple")).toBe(true);
    expect(cloudSignInUnavailableReason("apple")).toBeNull();
  });
});

describe("G1-fix shouldShowCloudSyncSection", () => {
  const prevApple = process.env.EXPO_PUBLIC_APPLE_CLIENT_ID;
  afterEach(() => {
    if (prevApple === undefined) delete process.env.EXPO_PUBLIC_APPLE_CLIENT_ID;
    else process.env.EXPO_PUBLIC_APPLE_CLIENT_ID = prevApple;
  });

  it("hides the section when Sign-In is not configured", () => {
    expect(
      shouldShowCloudSyncSection({ signInConfigured: false, optedIn: false }),
    ).toBe(false);
  });

  it("shows the section when Sign-In is configured", () => {
    expect(
      shouldShowCloudSyncSection({ signInConfigured: true, optedIn: false }),
    ).toBe(true);
    expect(
      shouldShowCloudSyncSection({ signInConfigured: true, optedIn: true }),
    ).toBe(true);
  });

  it("keeps the off switch for an already opted-in device", () => {
    expect(
      shouldShowCloudSyncSection({ signInConfigured: false, optedIn: true }),
    ).toBe(true);
  });

  it("is hidden for a store build with no client ID", () => {
    delete process.env.EXPO_PUBLIC_APPLE_CLIENT_ID;
    expect(
      shouldShowCloudSyncSection({
        signInConfigured: isCloudSignInConfigured("apple"),
        optedIn: false,
      }),
    ).toBe(false);
  });

  it("is shown once the client ID is configured", () => {
    process.env.EXPO_PUBLIC_APPLE_CLIENT_ID = "com.pulsekegel.signin";
    expect(
      shouldShowCloudSyncSection({
        signInConfigured: isCloudSignInConfigured("apple"),
        optedIn: false,
      }),
    ).toBe(true);
  });
});
