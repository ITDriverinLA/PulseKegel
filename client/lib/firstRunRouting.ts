/**
 * Epic P2 — first-run routing helpers (onboarding → first session).
 *
 * Pure decision functions so the cold-open route map, onboarding resume,
 * post-onboarding auto-start, and Android back handling are identical on
 * iOS and Android and covered by unit tests (no React / native deps).
 */

export type FirstRunLandingRoute =
  | "onboarding"
  | "first_session_gate"
  | "main"
  | "force_update";

export interface FirstRunFlags {
  onboardingComplete: boolean;
  /** true once at least one session_complete was stored (total_sessions > 0). */
  hasFirstSession: boolean;
  needsUpdate?: boolean;
}

/**
 * P2a: a device with zero completed sessions never lands on full home — only
 * onboarding or the first-session gate. Same map on every platform.
 */
export function decideLandingRoute(flags: FirstRunFlags): FirstRunLandingRoute {
  if (flags.needsUpdate) return "force_update";
  if (!flags.onboardingComplete) return "onboarding";
  if (!flags.hasFirstSession) return "first_session_gate";
  return "main";
}

export interface OnboardingResumeInput {
  saved: { screenKey: string; index: number } | null;
  anatomy: string | null | undefined;
  keys: readonly string[];
  /** Screen that requires an anatomy choice before continuing. */
  anatomyKey?: string;
}

/**
 * P2b: resume onboarding at the step the user left. Never resume past the
 * anatomy step without an anatomy choice (otherwise the final CTA is a no-op).
 */
export function resolveOnboardingResume(input: OnboardingResumeInput): {
  index: number;
  resumed: boolean;
} {
  const { saved, anatomy, keys } = input;
  const anatomyKey = input.anatomyKey ?? "anatomy";
  if (!saved) return { index: 0, resumed: false };

  let idx = keys.indexOf(saved.screenKey);
  if (idx < 0) {
    idx =
      Number.isInteger(saved.index) &&
      saved.index >= 0 &&
      saved.index < keys.length
        ? saved.index
        : 0;
  }

  const anatomyIdx = keys.indexOf(anatomyKey);
  const hasAnatomy = anatomy === "male" || anatomy === "female";
  if (anatomyIdx >= 0 && idx > anatomyIdx && !hasAnatomy) {
    idx = anatomyIdx;
  }
  return { index: idx, resumed: idx > 0 };
}

export type GateSource = "post_onboarding" | "cold_open" | "resume";

/**
 * P2b: onboarding's final "Start Day 1" CTA goes straight into the Day-1
 * session — the gate only stays underneath as the landing spot if the user
 * leaves the player (resume) or on later cold opens.
 */
export function shouldAutoStartFirstSession(input: {
  pendingSource: GateSource | null;
  inProgress: boolean;
  completed: boolean;
  alreadyAutoStarted: boolean;
}): boolean {
  return (
    input.pendingSource === "post_onboarding" &&
    !input.inProgress &&
    !input.completed &&
    !input.alreadyAutoStarted
  );
}

/** P2c: Android back on onboarding steps back instead of leaving the app. */
export function onboardingBackAction(
  stepIndex: number,
): "previous_step" | "exit" {
  return stepIndex > 0 ? "previous_step" : "exit";
}

export const GATE_BACK_EXIT_WINDOW_MS = 2000;

/**
 * P2c: Android back on the first-session gate. First press is blocked (with a
 * hint); a second press inside the window lets Android background the app.
 * Back can never route to home — the gate is the root of its stack.
 */
export function gateBackAction(
  lastBlockedAtMs: number | null,
  nowMs: number,
  windowMs: number = GATE_BACK_EXIT_WINDOW_MS,
): "blocked" | "exit" {
  if (lastBlockedAtMs !== null && nowMs - lastBlockedAtMs <= windowMs) {
    return "exit";
  }
  return "blocked";
}
