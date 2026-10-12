import { openSettingsTab } from "../rootNavigation";

// Stand-in root stack (RN7 semantics): navigate() only resolves routes the
// stack owns; nested tab names are reachable only via { screen } on "Main".
function makeRootStack() {
  const tabs = ["TodayTab", "ProgressTab", "SettingsTab"];
  let activeTab = "TodayTab";
  const nav = {
    navigate: (name: string, params?: { screen?: string }) => {
      if (!["Main", "Paywall"].includes(name)) {
        throw new Error(`root stack has no route "${name}"`);
      }
      if (name === "Main" && params?.screen) {
        if (!tabs.includes(params.screen)) throw new Error(params.screen);
        activeTab = params.screen;
      }
    },
  };
  return { nav, active: () => activeTab };
}

describe("root-stack Settings navigation (Epic E Open Settings)", () => {
  it("reaches SettingsTab through Main", () => {
    const root = makeRootStack();
    openSettingsTab(root.nav);
    expect(root.active()).toBe("SettingsTab");
  });

  it("documents that a bare nested tab name is not a root route", () => {
    const root = makeRootStack();
    expect(() => root.nav.navigate("SettingsTab")).toThrow();
  });
});
