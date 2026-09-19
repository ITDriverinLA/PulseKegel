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
