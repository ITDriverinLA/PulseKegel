import type { AppStateStatus } from "react-native";

export type SessionAppAction = "ignore" | "suspend" | "resume";

/**
 * Fold/unfold on iPhone Duo (and Control Center) passes through `inactive`
 * while the session stays in the foreground. JS timers, audio, and haptics
 * keep running, so that transition must not suspend the session or write
 * Day-1 in-progress / abandon state.
 *
 * Only `background` suspends the session. iOS then returns
 * `background → inactive → active`, so a suspend stays latched until the next
 * `active` and the engine can catch up.
 */
export function reduceSessionAppState(
  previous: AppStateStatus,
  next: AppStateStatus,
  suspended: boolean,
): { suspended: boolean; action: SessionAppAction } {
  if (next === "background") {
    if (previous === "background" || suspended) {
      return { suspended: true, action: "ignore" };
    }
    return { suspended: true, action: "suspend" };
  }

  if (next === "active" && (suspended || previous === "background")) {
    return { suspended: false, action: "resume" };
  }

  return { suspended, action: "ignore" };
}
