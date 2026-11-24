/**
 * P9 paywall copy. Every string here passed Keg's claims check as written
 * (Nov 23, 2026, SPEC-P9-purchases-APPROVED-2026-11-23.md, "Draft copy for
 * Keg"). Do not edit without a new claims check.
 */

export interface UnavailableCopy {
  title: string;
  body: string;
  retry: string;
  dismiss: string;
}

export const PAYWALL_RETRY = "Retry";
export const PAYWALL_NOT_NOW = "Not now";

export const BILLING_NOT_ALLOWED_ANDROID: UnavailableCopy = {
  title: "Purchases aren't available right now",
  body: "Google Play isn't allowing purchases on this device or account. Check that you're signed in to the Play Store and have a payment method set up, then tap Retry.",
  retry: PAYWALL_RETRY,
  dismiss: PAYWALL_NOT_NOW,
};

export const BILLING_NOT_ALLOWED_IOS: UnavailableCopy = {
  title: "Purchases are turned off on this device",
  body: "Check Settings › Screen Time › Content & Privacy Restrictions, then tap Retry.",
  retry: PAYWALL_RETRY,
  dismiss: PAYWALL_NOT_NOW,
};

export const CANT_LOAD_SUBSCRIPTION: UnavailableCopy = {
  title: "Can't load the subscription right now",
  body: "Check your connection and tap Retry.",
  retry: PAYWALL_RETRY,
  dismiss: PAYWALL_NOT_NOW,
};

export const PAYWALL_LOADING_PRICE = "Loading price…";

export const PAYMENT_PENDING_NOTE =
  "Your payment is pending. PulseKegel unlocks as soon as the store confirms it.";

export const ENTITLEMENT_CONFIRMING_NOTE =
  "We're still confirming your purchase. Tap Restore Purchases in a minute.";

export const RESTORE_UNREACHABLE_TITLE = "Couldn't reach the store";
export const RESTORE_UNREACHABLE_BODY =
  "Check your connection and store sign-in, then try again.";

export const FREE_WEEK_CTA = "Start your free week";

export function freeWeekPriceLine(priceString: string): string {
  return `7 days free, then ${priceString}/year. Cancel anytime in your store settings.`;
}

/** Unchanged CTAs (for reference; price always from the store). */
export function subscribeCta(priceString: string): string {
  return `Subscribe — ${priceString}/year`;
}

export function continueTrainingCta(priceString: string): string {
  return `Continue My Training — ${priceString}/year`;
}
