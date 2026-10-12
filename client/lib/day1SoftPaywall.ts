/**
 * P4a: one-time, dismissible soft paywall shown right after the Day 1
 * celebration. Copy is Manager-cleared (Oct 12) — do not edit without a
 * claims check.
 */

export const DAY1_SOFT_HEADLINE = "Day 1, done. Here's the plan from here.";
export const DAY1_SOFT_BODY_REST =
  "PulseKegel can guide you past it with short daily sessions, haptic cues to help you keep your timing, and a plan that builds week to week. It stays on your phone, with no account needed.";
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
