import {
  decideLandingRoute,
  gateBackAction,
  GATE_BACK_EXIT_WINDOW_MS,
  onboardingBackAction,
  resolveGateHydrate,
  resolveOnboardingResume,
  shouldAutoStartFirstSession,
  shouldHoldGateLoader,
  shouldTrackGateShown,
} from "../firstRunRouting";

const KEYS = ["welcome", "anatomy", "start"] as const;

describe("P2a decideLandingRoute", () => {
  it("never lands on main with zero completed sessions", () => {
    for (const onboardingComplete of [true, false]) {
      expect(
        decideLandingRoute({ onboardingComplete, hasFirstSession: false }),
      ).not.toBe("main");
    }
  });

  it("maps the first-run states (same on every platform)", () => {
    expect(
      decideLandingRoute({ onboardingComplete: false, hasFirstSession: false }),
    ).toBe("onboarding");
    expect(
      decideLandingRoute({ onboardingComplete: true, hasFirstSession: false }),
    ).toBe("first_session_gate");
    expect(
      decideLandingRoute({ onboardingComplete: true, hasFirstSession: true }),
    ).toBe("main");
  });

  it("force update wins over everything", () => {
    expect(
      decideLandingRoute({
        onboardingComplete: true,
        hasFirstSession: true,
        needsUpdate: true,
      }),
    ).toBe("force_update");
  });

  it("P2.4 restored history (sessions > 0) goes home; none stays on gate", () => {
    expect(
      decideLandingRoute({ onboardingComplete: true, hasFirstSession: true }),
    ).toBe("main");
    expect(
      decideLandingRoute({ onboardingComplete: true, hasFirstSession: false }),
    ).toBe("first_session_gate");
  });
});

describe("P2b resolveOnboardingResume", () => {
  it("starts fresh without saved progress", () => {
    expect(
      resolveOnboardingResume({ saved: null, anatomy: null, keys: KEYS }),
    ).toEqual({ index: 0, resumed: false });
  });

  it("resumes at the saved screen key", () => {
    expect(
      resolveOnboardingResume({
        saved: { screenKey: "anatomy", index: 1 },
        anatomy: null,
        keys: KEYS,
      }),
    ).toEqual({ index: 1, resumed: true });
    expect(
      resolveOnboardingResume({
        saved: { screenKey: "start", index: 2 },
        anatomy: "female",
        keys: KEYS,
      }),
    ).toEqual({ index: 2, resumed: true });
  });

  it("falls back to a valid saved index when the key is unknown", () => {
    expect(
      resolveOnboardingResume({
        saved: { screenKey: "legacy", index: 1 },
        anatomy: "male",
        keys: KEYS,
      }),
    ).toEqual({ index: 1, resumed: true });
    expect(
      resolveOnboardingResume({
        saved: { screenKey: "legacy", index: 9 },
        anatomy: "male",
        keys: KEYS,
      }),
    ).toEqual({ index: 0, resumed: false });
  });

  it("never resumes past anatomy without an anatomy choice", () => {
    expect(
      resolveOnboardingResume({
        saved: { screenKey: "start", index: 2 },
        anatomy: null,
        keys: KEYS,
      }),
    ).toEqual({ index: 1, resumed: true });
  });
});

describe("P2b shouldAutoStartFirstSession", () => {
  const base = {
    pendingSource: "post_onboarding" as const,
    inProgress: false,
    completed: false,
    alreadyAutoStarted: false,
  };

  it("auto-starts right after onboarding's final CTA", () => {
    expect(shouldAutoStartFirstSession(base)).toBe(true);
  });

  it("does not auto-start on cold open, resume, completion, or twice", () => {
    expect(
      shouldAutoStartFirstSession({ ...base, pendingSource: "cold_open" }),
    ).toBe(false);
    expect(shouldAutoStartFirstSession({ ...base, pendingSource: null })).toBe(
      false,
    );
    expect(shouldAutoStartFirstSession({ ...base, inProgress: true })).toBe(
      false,
    );
    expect(shouldAutoStartFirstSession({ ...base, completed: true })).toBe(
      false,
    );
    expect(
      shouldAutoStartFirstSession({ ...base, alreadyAutoStarted: true }),
    ).toBe(false);
  });
});

describe("P2c Android back decisions", () => {
  it("onboarding back steps back, exits only from the first screen", () => {
    expect(onboardingBackAction(2)).toBe("previous_step");
    expect(onboardingBackAction(1)).toBe("previous_step");
    expect(onboardingBackAction(0)).toBe("exit");
  });

  it("gate back blocks first, exits on a second press inside the window", () => {
    expect(gateBackAction(null, 1000)).toBe("blocked");
    expect(gateBackAction(1000, 1000 + GATE_BACK_EXIT_WINDOW_MS - 1)).toBe(
      "exit",
    );
    expect(gateBackAction(1000, 1000 + GATE_BACK_EXIT_WINDOW_MS + 1)).toBe(
      "blocked",
    );
  });
});

describe("P2.1 shouldTrackGateShown", () => {
  const shown = {
    ready: true,
    isFocused: true,
    autoStartPending: false,
    autoStartLaunching: false,
    celebrating: false,
    alreadyTracked: false,
  };

  it("fires when the gate is actually on screen", () => {
    expect(shouldTrackGateShown(shown)).toBe(true);
  });

  it("never fires during the Day-1 auto-start pass-through", () => {
    expect(shouldTrackGateShown({ ...shown, autoStartPending: true })).toBe(
      false,
    );
    expect(shouldTrackGateShown({ ...shown, autoStartLaunching: true })).toBe(
      false,
    );
  });

  it("does not fire before hydration, when unfocused, celebrating, or twice", () => {
    expect(shouldTrackGateShown({ ...shown, ready: false })).toBe(false);
    expect(shouldTrackGateShown({ ...shown, isFocused: false })).toBe(false);
    expect(shouldTrackGateShown({ ...shown, celebrating: true })).toBe(false);
    expect(shouldTrackGateShown({ ...shown, alreadyTracked: true })).toBe(
      false,
    );
  });

  it("auto-start then leave: fires only once the gate is shown on return", () => {
    // onboarding Start Day 1 → hydrate → pending → launching → blurred
    const seq = [
      { ...shown, autoStartPending: true },
      { ...shown, autoStartLaunching: true },
      { ...shown, autoStartLaunching: true, isFocused: false },
    ];
    expect(seq.some((s) => shouldTrackGateShown(s))).toBe(false);
    // user leaves the player and lands on the gate
    expect(shouldTrackGateShown(shown)).toBe(true);
  });
});

describe("P2.1 shouldHoldGateLoader", () => {
  it("holds the loader until hydrated and the auto-start launch completes", () => {
    const base = {
      ready: true,
      autoStartPending: false,
      autoStartLaunching: false,
    };
    expect(shouldHoldGateLoader(base)).toBe(false);
    expect(shouldHoldGateLoader({ ...base, ready: false })).toBe(true);
    expect(shouldHoldGateLoader({ ...base, autoStartPending: true })).toBe(
      true,
    );
    expect(shouldHoldGateLoader({ ...base, autoStartLaunching: true })).toBe(
      true,
    );
  });
});

/**
 * P2.1 H1: drives the gate's state through the same helpers/order the screen
 * uses (hydrate on focus → launch effect → blur → refocus) to prove the loader
 * never sticks and the celebration / unlock is reached.
 */
describe("P2.1 gate lifecycle (H1)", () => {
  type Store = {
    completed: boolean;
    celebrated: boolean;
    inProgress: boolean;
    pendingSource: "post_onboarding" | "cold_open" | "resume" | null;
  };
  function makeGate(store: Store) {
    const st = {
      ready: false,
      autoStartPending: false,
      autoStartLaunching: false,
      celebrating: false,
      autoStarted: false,
      unlocked: 0,
      launches: 0,
    };
    const hydrate = () => {
      const o = resolveGateHydrate({
        ...store,
        alreadyAutoStarted: st.autoStarted,
      });
      if (o.autoStartLaunching === false) {
        st.autoStartLaunching = false;
        st.autoStartPending = false;
      }
      if (o.kind === "celebrate") {
        st.celebrating = true;
        st.ready = true;
        return;
      }
      if (o.kind === "unlock") {
        st.unlocked += 1;
        return;
      }
      if (o.autoStart) {
        st.autoStarted = true;
        st.autoStartPending = true;
      }
      st.ready = true;
    };
    const runLaunchEffect = (fail = false) => {
      if (!st.ready || !st.autoStartPending) return;
      st.autoStartLaunching = true;
      st.autoStartPending = false;
      st.launches += 1;
      if (fail) {
        st.autoStartLaunching = false; // .catch()
        return;
      }
      store.inProgress = true;
      store.pendingSource = null;
    };
    const loader = () => shouldHoldGateLoader(st);
    const finishCelebration = () => {
      store.celebrated = true;
      st.celebrating = false;
      st.unlocked += 1;
    };
    return { st, hydrate, runLaunchEffect, loader, finishCelebration };
  }
  const fresh = (): Store => ({
    completed: false,
    celebrated: false,
    inProgress: false,
    pendingSource: "post_onboarding",
  });

  it("auto-start → complete → refocus shows celebration, then onUnlocked", () => {
    const store = fresh();
    const g = makeGate(store);
    g.hydrate();
    g.runLaunchEffect();
    expect(g.loader()).toBe(true); // no gate flash while launching
    // Player finishes Day 1, then pops back to the gate.
    store.completed = true;
    store.inProgress = false;
    g.hydrate();
    expect(g.loader()).toBe(false);
    expect(g.st.celebrating).toBe(true);
    g.finishCelebration();
    expect(g.st.unlocked).toBe(1);
  });

  it("auto-start → complete (already celebrated) → refocus unlocks", () => {
    const store = fresh();
    const g = makeGate(store);
    g.hydrate();
    g.runLaunchEffect();
    store.completed = true;
    store.celebrated = true;
    g.hydrate();
    expect(g.st.autoStartLaunching).toBe(false);
    expect(g.st.unlocked).toBe(1);
  });

  it("auto-start → leave/abandon → refocus shows resume gate, no re-launch", () => {
    const store = fresh();
    const g = makeGate(store);
    g.hydrate();
    g.runLaunchEffect();
    g.hydrate(); // inProgress, left the player
    g.runLaunchEffect();
    expect(g.loader()).toBe(false);
    expect(g.st.launches).toBe(1);
    expect(
      shouldTrackGateShown({
        ...g.st,
        isFocused: true,
        alreadyTracked: false,
      }),
    ).toBe(true);
  });

  it("launch failure drops the loader and shows the gate", () => {
    const g = makeGate(fresh());
    g.hydrate();
    g.runLaunchEffect(true);
    expect(g.loader()).toBe(false);
  });

  it("app killed mid-launch: fresh mount never sticks on the loader", () => {
    // Killed before storage writes: pending source still set → auto-starts.
    const before = makeGate(fresh());
    before.hydrate();
    before.runLaunchEffect();
    expect(before.st.launches).toBe(1);
    // Killed after writes: in-progress → resume gate, loader down.
    const after = makeGate({
      ...fresh(),
      inProgress: true,
      pendingSource: null,
    });
    after.hydrate();
    after.runLaunchEffect();
    expect(after.loader()).toBe(false);
    expect(after.st.launches).toBe(0);
  });
});
