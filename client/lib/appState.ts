import type { AppStateStatus } from "react-native";

export function didAppBecomeActive(
  previousState: AppStateStatus,
  nextState: AppStateStatus,
): boolean {
  return /inactive|background/.test(previousState) && nextState === "active";
}
