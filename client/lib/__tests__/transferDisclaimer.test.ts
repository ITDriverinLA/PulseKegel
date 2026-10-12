import * as fs from "fs";
import * as path from "path";

jest.mock("react-native", () => ({ Platform: { OS: "ios" } }));
jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { extra: {} } },
}));

import {
  TRANSFER_DISCLAIMER,
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
    const disclaimerAt = screenSrc.indexOf("{TRANSFER_DISCLAIMER}");
    expect(sectionStart).toBeGreaterThan(-1);
    expect(sectionEnd).toBeGreaterThan(sectionStart);
    expect(disclaimerAt).toBeGreaterThan(sectionEnd);
    // Rendered exactly once, and not inside the conditional block.
    expect(screenSrc.split("{TRANSFER_DISCLAIMER}")).toHaveLength(2);
    expect(
      screenSrc.slice(sectionStart, sectionEnd).includes("Not medical advice"),
    ).toBe(false);
  });
});
