import {
  DAY1_SOFT_BODY_REST,
  DAY1_SOFT_CTA,
  DAY1_SOFT_DISMISS,
  DAY1_SOFT_HEADLINE,
  __resetDay1SoftPaywallLaunchState,
  buildDay1SoftBody,
  decideDay1SoftPaywall,
  deferDay1SoftPaywallThisLaunch,
  isDay1SoftPaywallDeferredThisLaunch,
} from "../day1SoftPaywall";

describe("P4a Day 1 soft paywall copy", () => {
  it("uses the Manager-cleared copy exactly", () => {
    expect(DAY1_SOFT_HEADLINE).toBe("Day 1, done. Here's the plan from here.");
    expect(DAY1_SOFT_CTA).toBe("Keep my plan going");
    expect(DAY1_SOFT_DISMISS).toBe("Not now");
    expect(buildDay1SoftBody(6, true)).toBe(
      "You've got 6 days left in your free week. PulseKegel can guide you past it with short daily sessions, haptic cues to help you keep your timing, and a plan that builds week to week. It stays on your phone, with no account needed.",
    );
  });

  it("uses singular for 1 day and live counts otherwise", () => {
    expect(buildDay1SoftBody(1, true)).toMatch(/^You've got 1 day left in/);
    expect(buildDay1SoftBody(7, true)).toMatch(/^You've got 7 days left in/);
    expect(buildDay1SoftBody(5, true)).toMatch(/^You've got 5 days left in/);
  });

  it("drops the first sentence at 0, negative, or ended trial", () => {
    expect(buildDay1SoftBody(0, true)).toBe(DAY1_SOFT_BODY_REST);
    expect(buildDay1SoftBody(-2, true)).toBe(DAY1_SOFT_BODY_REST);
    expect(buildDay1SoftBody(4, false)).toBe(DAY1_SOFT_BODY_REST);
    expect(buildDay1SoftBody(NaN, true)).toBe(DAY1_SOFT_BODY_REST);
  });
});

describe("P4a Day 1 soft paywall decision", () => {
  const base = {
    pending: true,
    shown: false,
    isSubscribed: false,
    subscriptionLoading: false,
    deferredThisLaunch: false,
  };

  it("shows when queued and eligible", () => {
    expect(decideDay1SoftPaywall(base)).toBe("show");
  });
  it("never shows twice", () => {
    expect(decideDay1SoftPaywall({ ...base, shown: true })).toBe("none");
  });
  it("does nothing when not queued", () => {
    expect(decideDay1SoftPaywall({ ...base, pending: false })).toBe("none");
  });
  it("drops for subscribers", () => {
    expect(decideDay1SoftPaywall({ ...base, isSubscribed: true })).toBe("drop");
  });
  it("waits while subscription status loads", () => {
    expect(
      decideDay1SoftPaywall({
        ...base,
        isSubscribed: true,
        subscriptionLoading: true,
      }),
    ).toBe("wait");
  });
  it("waits for next cold open when Settings tip opened Settings", () => {
    expect(decideDay1SoftPaywall({ ...base, deferredThisLaunch: true })).toBe(
      "wait",
    );
  });
  it("tracks per-launch deferral in memory", () => {
    __resetDay1SoftPaywallLaunchState();
    expect(isDay1SoftPaywallDeferredThisLaunch()).toBe(false);
    deferDay1SoftPaywallThisLaunch();
    expect(isDay1SoftPaywallDeferredThisLaunch()).toBe(true);
    __resetDay1SoftPaywallLaunchState();
  });
});
