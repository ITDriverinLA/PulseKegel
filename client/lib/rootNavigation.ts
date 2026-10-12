/**
 * Root-stack helpers. MainTabNavigator is the root stack's "Main" screen, so
 * its useNavigation() is the root stack. In React Navigation 7 a navigator
 * can't navigate straight into a nested child's screen by name, so tab
 * targets must go through "Main".
 */
export type MainTabName = "TodayTab" | "ProgressTab" | "SettingsTab";

export interface RootStackNavigateLike {
  navigate(name: "Main", params: { screen: MainTabName }): void;
}

export function openSettingsTab(rootNavigation: RootStackNavigateLike): void {
  rootNavigation.navigate("Main", { screen: "SettingsTab" });
}
