import type { AppStateStatus } from "react-native";

const APP_STATES: readonly AppStateStatus[] = [
  "active",
  "background",
  "inactive",
  "unknown",
  "extension",
];

/**
 * React Native 0.88 types `AppState.currentState` as `string | null | undefined`
 * until the native value is published. Narrow it before storing or comparing.
 */
export function asAppState(state: string | null | undefined): AppStateStatus {
  if (state && (APP_STATES as readonly string[]).includes(state)) {
    return state as AppStateStatus;
  }
  return "unknown";
}

export function didAppBecomeActive(
  previousState: AppStateStatus,
  nextState: AppStateStatus,
): boolean {
  return /inactive|background/.test(previousState) && nextState === "active";
}
