/**
 * P4a: one-time, dismissible soft paywall shown right after the Day 1
 * celebration. Copy is Manager-cleared (Oct 12) — do not edit without a
 * claims check.
 */

export const DAY1_SOFT_HEADLINE = "Day 1, done. Here's the plan from here.";
export const DAY1_SOFT_BODY_REST =
  "PulseKegel can guide you past it with short daily sessions, haptic cues to help you keep your timing, and a plan that builds week to week. It stays on your phone by default, with no account needed.";
export const DAY1_SOFT_CTA = "Keep my plan going";
export const DAY1_SOFT_DISMISS = "Not now";

export function buildDay1SoftBody(
  trialDaysRemaining: number,
  isTrialActive: boolean,
): string {
  const days = Math.floor(Number(trialDaysRemaining));
  if (!isTrialActive || !Number.isFinite(days) || days <= 0) {
    return DAY1_SOFT_BODY_REST;
  }
  const unit = days === 1 ? "day" : "days";
  return `You've got ${days} ${unit} left in your free week. ${DAY1_SOFT_BODY_REST}`;
}

export type Day1SoftPaywallDecision = "show" | "wait" | "drop" | "none";

/**
 * Decide what to do with a queued Day 1 soft paywall when the main app
 * gains focus.
 * - "none": nothing queued (or already shown).
 * - "drop": subscribed — clear the queue, never show.
 * - "wait": not now (subscription still loading, or the Settings tip's
 *   "Open Settings" took this launch — defer to the next cold open so the
 *   tip and paywall never stack).
 * - "show": present the paywall.
 */
export function decideDay1SoftPaywall(input: {
  pending: boolean;
  shown: boolean;
  isSubscribed: boolean;
  subscriptionLoading: boolean;
  deferredThisLaunch: boolean;
}): Day1SoftPaywallDecision {
  if (!input.pending || input.shown) return "none";
  if (input.subscriptionLoading) return "wait";
  if (input.isSubscribed) return "drop";
  if (input.deferredThisLaunch) return "wait";
  return "show";
}

// In-memory: true once Settings was auto-opened this launch.
let deferredThisLaunch = false;
export function deferDay1SoftPaywallThisLaunch(): void {
  deferredThisLaunch = true;
}
export function isDay1SoftPaywallDeferredThisLaunch(): boolean {
  return deferredThisLaunch;
}
export function __resetDay1SoftPaywallLaunchState(): void {
  deferredThisLaunch = false;
}

// Guard: once the soft paywall has been presented this launch, never again
// (protects against overlapping focus runs before the flag is persisted).
let presentedThisLaunch = false;
export function __resetDay1SoftPaywallPresented(): void {
  presentedThisLaunch = false;
}

export interface Day1SoftPaywallTriggerDeps {
  storage: {
    getDay1SoftPaywallState(): Promise<{ pending: boolean; shown: boolean }>;
    clearDay1SoftPaywallPending(): Promise<void>;
  };
  /** Root-stack navigate; must reach the root "Paywall" route. */
  navigateToPaywall: () => void;
  isSubscribed: boolean;
  subscriptionLoading: boolean;
  isCancelled: () => boolean;
}

/**
 * P4a trigger (run on main-tab focus). Only navigates; never persists the
 * shown-once flag (see recordPaywallView), so a cancelled or failed run
 * can't burn the one-shot.
 */
export async function runDay1SoftPaywallTrigger(
  deps: Day1SoftPaywallTriggerDeps,
): Promise<Day1SoftPaywallDecision> {
  if (presentedThisLaunch) return "none";
  const state = await deps.storage.getDay1SoftPaywallState();
  if (deps.isCancelled()) return "none";
  const decision = decideDay1SoftPaywall({
    ...state,
    isSubscribed: deps.isSubscribed,
    subscriptionLoading: deps.subscriptionLoading,
    deferredThisLaunch: isDay1SoftPaywallDeferredThisLaunch(),
  });
  if (decision === "drop") {
    await deps.storage.clearDay1SoftPaywallPending();
  } else if (decision === "show") {
    if (presentedThisLaunch) return "none";
    presentedThisLaunch = true;
    // The shown-once flag is persisted by PaywallScreen when it actually
    // renders (recordPaywallView), so a failed navigation stays eligible
    // for the next cold open. The in-memory guard prevents double nav.
    deps.navigateToPaywall();
  }
  return decision;
}

/**
 * P4a/L1: the single place a paywall view is recorded. For day1_soft the
 * shown-once flag and the paywall_viewed event always land together.
 */
export async function recordPaywallView(
  data: {
    source: import("./analytics").PaywallSource;
    trialDaysRemaining: number;
    completedCoreSessions?: number;
    totalCoreSessions?: number;
  },
  deps: {
    trackPaywallViewed: (d: typeof data) => void;
    markDay1SoftPaywallShown: () => Promise<void>;
  },
): Promise<void> {
  if (data.source === "day1_soft") {
    try {
      await deps.markDay1SoftPaywallShown();
    } catch (error) {
      // A storage failure must never drop paywall_viewed.
      console.warn("[PulseKegel] Failed to persist day1_soft shown:", error);
    }
  }
  deps.trackPaywallViewed(data);
}
