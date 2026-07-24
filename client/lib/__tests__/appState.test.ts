import { didAppBecomeActive } from "@/lib/appState";

describe("didAppBecomeActive", () => {
  it.each(["background", "inactive"] as const)(
    "detects a return from %s",
    (previousState) => {
      expect(didAppBecomeActive(previousState, "active")).toBe(true);
    },
  );

  it("does not treat an active-to-active notification as a resume", () => {
    expect(didAppBecomeActive("active", "active")).toBe(false);
  });

  it("does not reload while the app is moving to the background", () => {
    expect(didAppBecomeActive("active", "background")).toBe(false);
  });
});
