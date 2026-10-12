import {
  DAY1_SOFT_BODY_REST,
  DAY1_SOFT_CTA,
  DAY1_SOFT_DISMISS,
  DAY1_SOFT_HEADLINE,
  __resetDay1SoftPaywallLaunchState,
  __resetDay1SoftPaywallPresented,
  recordPaywallView,
  runDay1SoftPaywallTrigger,
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

describe("P4a runDay1SoftPaywallTrigger (H1/L1)", () => {
  // Minimal stand-in for the root stack: the Main screen's useNavigation()
  // is this navigator, and it owns the "Paywall" route.
  function makeRootStack() {
    const routes: { name: string; params?: unknown }[] = [{ name: "Main" }];
    const nav = {
      getParent: () => undefined,
      navigate: (name: string, params?: unknown) => {
        if (!["Main", "Paywall"].includes(name)) throw new Error(name);
        routes.push({ name, params });
      },
    };
    return { nav, routes };
  }
  function makeStorage(initial = { pending: true, shown: false }) {
    const state = { ...initial };
    const order: string[] = [];
    return {
      state,
      order,
      getDay1SoftPaywallState: jest.fn(async () => ({ ...state })),
      markDay1SoftPaywallShown: jest.fn(async () => {
        order.push("mark");
        state.shown = true;
        state.pending = false;
      }),
      clearDay1SoftPaywallPending: jest.fn(async () => {
        state.pending = false;
      }),
    };
  }

  beforeEach(() => {
    __resetDay1SoftPaywallLaunchState();
    __resetDay1SoftPaywallPresented();
  });

  it("navigates the root stack to Paywall with day1_soft without persisting the flag", async () => {
    const { nav, routes } = makeRootStack();
    const storage = makeStorage();
    const decision = await runDay1SoftPaywallTrigger({
      storage,
      navigateToPaywall: () => {
        storage.order.push("navigate");
        nav.navigate("Paywall", { source: "day1_soft" });
      },
      isSubscribed: false,
      subscriptionLoading: false,
      isCancelled: () => false,
    });
    expect(decision).toBe("show");
    expect(routes[routes.length - 1]).toEqual({
      name: "Paywall",
      params: { source: "day1_soft" },
    });
    // Flag is persisted by PaywallScreen on render, not by the trigger, so a
    // failed navigation leaves it eligible for the next cold open.
    expect(storage.order).toEqual(["navigate"]);
    expect(storage.state.shown).toBe(false);
    expect(storage.state.pending).toBe(true);
  });

  it("a cancelled focus run neither navigates nor burns the one-shot", async () => {
    const storage = makeStorage();
    const navigateToPaywall = jest.fn();
    await runDay1SoftPaywallTrigger({
      storage,
      navigateToPaywall,
      isSubscribed: false,
      subscriptionLoading: false,
      isCancelled: () => true,
    });
    expect(navigateToPaywall).not.toHaveBeenCalled();
    expect(storage.markDay1SoftPaywallShown).not.toHaveBeenCalled();
    expect(storage.state.pending).toBe(true);
  });

  it("overlapping focus runs present it only once", async () => {
    const storage = makeStorage();
    const navigateToPaywall = jest.fn();
    const deps = {
      storage,
      navigateToPaywall,
      isSubscribed: false,
      subscriptionLoading: false,
      isCancelled: () => false,
    };
    await Promise.all([
      runDay1SoftPaywallTrigger(deps),
      runDay1SoftPaywallTrigger(deps),
    ]);
    await runDay1SoftPaywallTrigger(deps);
    expect(navigateToPaywall).toHaveBeenCalledTimes(1);
  });

  it("drops for subscribers without navigating", async () => {
    const storage = makeStorage();
    const navigateToPaywall = jest.fn();
    await runDay1SoftPaywallTrigger({
      storage,
      navigateToPaywall,
      isSubscribed: true,
      subscriptionLoading: false,
      isCancelled: () => false,
    });
    expect(navigateToPaywall).not.toHaveBeenCalled();
    expect(storage.state.pending).toBe(false);
  });
});

describe("P4a recordPaywallView (L1)", () => {
  const sources = [
    "day1_soft",
    "settings",
    "workout_gate",
    "challenge_complete",
    "unknown",
  ] as const;

  it.each(sources)(
    "flag and paywall_viewed land together for %s",
    async (source) => {
      const log: string[] = [];
      await recordPaywallView(
        { source, trialDaysRemaining: 6 },
        {
          trackPaywallViewed: (d) => log.push(`viewed:${d.source}`),
          markDay1SoftPaywallShown: async () => {
            log.push("flag");
          },
        },
      );
      if (source === "day1_soft") {
        expect(log).toEqual(["flag", "viewed:day1_soft"]);
      } else {
        expect(log).toEqual([`viewed:${source}`]);
      }
    },
  );

  it("never sets the flag without a day1_soft paywall_viewed", async () => {
    const flag = jest.fn(async () => undefined);
    const viewed = jest.fn();
    for (const source of sources) {
      await recordPaywallView(
        { source, trialDaysRemaining: 3 },
        { trackPaywallViewed: viewed, markDay1SoftPaywallShown: flag },
      );
    }
    expect(flag).toHaveBeenCalledTimes(1);
    expect(
      viewed.mock.calls.filter(([d]) => d.source === "day1_soft"),
    ).toHaveLength(1);
  });
});
