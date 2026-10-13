import * as fs from "fs";
import * as path from "path";

jest.mock("react-native", () => ({ Platform: { OS: "ios" } }));
jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { extra: {} } },
}));

import {
  TRANSFER_DISCLAIMER,
  transferDisclaimerText,
  isCloudSignInConfigured,
  shouldShowCloudSyncSection,
} from "../cloudAuth";

const screenSrc = fs.readFileSync(
  path.join(__dirname, "../../screens/TransferChecklistScreen.tsx"),
  "utf8",
);

describe("G1fix2 Transfer disclaimer", () => {
  it("keeps the Manager-cleared wording unchanged", () => {
    expect(TRANSFER_DISCLAIMER).toBe(
      "Not medical advice. Cloud sync stores training progress only — never diagnoses or health records. Apple/Google Sign-In client IDs are configured by the app owner.",
    );
  });

  it("renders outside the cloud section, so it shows when Sign-In isn't configured", () => {
    delete process.env.EXPO_PUBLIC_APPLE_CLIENT_ID;
    expect(
      shouldShowCloudSyncSection({
        signInConfigured: isCloudSignInConfigured(),
        optedIn: false,
      }),
    ).toBe(false);

    const sectionStart = screenSrc.indexOf("shouldShowCloudSyncSection({");
    const sectionEnd = screenSrc.indexOf(") : null}", sectionStart);
    const disclaimerAt = screenSrc.indexOf(
      "{transferDisclaimerText(isCloudSignInConfigured())}",
    );
    expect(sectionStart).toBeGreaterThan(-1);
    expect(sectionEnd).toBeGreaterThan(sectionStart);
    expect(disclaimerAt).toBeGreaterThan(sectionEnd);
    // Rendered exactly once, and not inside the conditional block.
    expect(
      screenSrc.split("{transferDisclaimerText(isCloudSignInConfigured())}"),
    ).toHaveLength(2);
    expect(
      screenSrc.slice(sectionStart, sectionEnd).includes("Not medical advice"),
    ).toBe(false);
  });

  it("G1fix4: footer is only 'Not medical advice.' without Sign-In", () => {
    delete process.env.EXPO_PUBLIC_APPLE_CLIENT_ID;
    const text = transferDisclaimerText(isCloudSignInConfigured());
    expect(text).toBe("Not medical advice.");
    expect(text).not.toMatch(/cloud|sign-in|client id/i);
  });

  it("G1fix4: full footer is kept when Sign-In is configured", () => {
    process.env.EXPO_PUBLIC_APPLE_CLIENT_ID = "com.pulsekegel.signin.test";
    expect(transferDisclaimerText(isCloudSignInConfigured())).toBe(
      TRANSFER_DISCLAIMER,
    );
    delete process.env.EXPO_PUBLIC_APPLE_CLIENT_ID;
  });
});
