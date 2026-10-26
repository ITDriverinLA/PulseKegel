import * as fs from "fs";
import * as path from "path";
import {
  DAY1_ONBOARDING_DURATION_LINE,
  DAY1_BACK_TOAST,
} from "@/constants/day1Copy";

const read = (f: string) =>
  fs.readFileSync(path.join(__dirname, "..", "..", f), "utf8");

describe("H2 Day 1 duration copy", () => {
  it("onboarding says about 2 minutes", () => {
    expect(DAY1_ONBOARDING_DURATION_LINE).toBe(
      "About 2 minutes. Private on your device.",
    );
  });
  it("Android back toast says about 2 minutes and does not teach an exit", () => {
    expect(DAY1_BACK_TOAST).toBe("Day 1 takes about 2 minutes.");
    expect(DAY1_BACK_TOAST.toLowerCase()).not.toContain("press back again");
  });
  it("screens use the shared copy and no stale durations remain", () => {
    const onboarding = read("screens/OnboardingScreen.tsx");
    const gate = read("screens/FirstSessionGateScreen.tsx");
    expect(onboarding).toContain("{DAY1_ONBOARDING_DURATION_LINE}");
    expect(gate).toContain("DAY1_BACK_TOAST,");
    for (const src of [onboarding, gate]) {
      expect(src).not.toMatch(/5[–-]8/);
      expect(src).not.toMatch(/about 5 minutes/i);
    }
  });
});
