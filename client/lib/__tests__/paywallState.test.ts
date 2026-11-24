import * as fs from "fs";
import * as path from "path";
import {
  derivePaywallView,
  freeWeekEligible,
  iosHasFreeWeekIntro,
  IOS_INTRO_ELIGIBLE,
  shouldLoadOnMount,
  unavailableCopyFor,
} from "../paywallState";
import {
  BILLING_NOT_ALLOWED_ANDROID,
  BILLING_NOT_ALLOWED_IOS,
  CANT_LOAD_SUBSCRIPTION,
  ENTITLEMENT_CONFIRMING_NOTE,
  FREE_WEEK_CTA,
  PAYMENT_PENDING_NOTE,
  PAYWALL_LOADING_PRICE,
  RESTORE_UNREACHABLE_BODY,
  RESTORE_UNREACHABLE_TITLE,
  continueTrainingCta,
  freeWeekPriceLine,
  subscribeCta,
} from "../../constants/paywallCopy";

describe("P9b.1/3 paywall state machine", () => {
  it("priced only with a real store package", () => {
    expect(derivePaywallView({ hasPackages: true, failure: null })).toEqual({
      kind: "priced",
    });
  });
  it("loading while there is nothing yet and no failure (no fake price)", () => {
    expect(derivePaywallView({ hasPackages: false, failure: null })).toEqual({
      kind: "loading",
    });
  });
  it("code 3 → billing-not-allowed state", () => {
    expect(
      derivePaywallView({
        hasPackages: false,
        failure: { rcCode: 3, code: "rc_3" },
      }),
    ).toEqual({ kind: "unavailable", variant: "not_allowed", code: 3 });
  });
  it("other causes → generic state (rc_23, network, not_configured, empty)", () => {
    for (const failure of [
      { rcCode: 23, code: "rc_23" },
      { code: "offerings_fetch_error" },
      { code: "not_configured" },
      { code: "no_offerings" },
    ]) {
      expect(derivePaywallView({ hasPackages: false, failure })).toMatchObject({
        kind: "unavailable",
        variant: "generic",
      });
    }
    expect(
      derivePaywallView({
        hasPackages: false,
        failure: { code: "no_offerings" },
      }),
    ).toMatchObject({ code: "no_offerings" });
  });
  it("platform copy for code 3; generic everywhere else", () => {
    expect(unavailableCopyFor("not_allowed", "android")).toBe(
      BILLING_NOT_ALLOWED_ANDROID,
    );
    expect(unavailableCopyFor("not_allowed", "ios")).toBe(
      BILLING_NOT_ALLOWED_IOS,
    );
    expect(unavailableCopyFor("not_allowed", "web")).toBe(
      CANT_LOAD_SUBSCRIPTION,
    );
    expect(unavailableCopyFor("generic", "android")).toBe(
      CANT_LOAD_SUBSCRIPTION,
    );
  });
  it("loads on mount only when idle and empty; Retry never loops", () => {
    expect(
      shouldLoadOnMount({
        hasPackages: false,
        contextLoading: false,
        alreadyLoading: false,
      }),
    ).toBe(true);
    expect(
      shouldLoadOnMount({
        hasPackages: true,
        contextLoading: false,
        alreadyLoading: false,
      }),
    ).toBe(false);
    expect(
      shouldLoadOnMount({
        hasPackages: false,
        contextLoading: true,
        alreadyLoading: false,
      }),
    ).toBe(false);
    expect(
      shouldLoadOnMount({
        hasPackages: false,
        contextLoading: false,
        alreadyLoading: true,
      }),
    ).toBe(false);
    // Two failed retries in a row: the state just stays up.
    let view = derivePaywallView({
      hasPackages: false,
      failure: { rcCode: 3, code: "rc_3" },
    });
    view = derivePaywallView({
      hasPackages: false,
      failure: { rcCode: 3, code: "rc_3" },
    });
    expect(view).toMatchObject({ kind: "unavailable", variant: "not_allowed" });
  });
});

describe("P9b.6 free-week eligibility", () => {
  const iosProduct = (intro: object | null) => ({
    identifier: "pulsekegel_premium_v2",
    priceString: "$4.99",
    introPrice: intro as never,
  });
  const weekFree = {
    price: 0,
    periodUnit: "WEEK",
    periodNumberOfUnits: 1,
    cycles: 1,
    period: "P1W",
  };

  it("iOS: $0 one-week intro AND eligible", () => {
    expect(
      freeWeekEligible({
        os: "ios",
        product: iosProduct(weekFree),
        iosEligibilityStatus: IOS_INTRO_ELIGIBLE,
      }),
    ).toBe(true);
    expect(
      freeWeekEligible({
        os: "ios",
        product: iosProduct(weekFree),
        iosEligibilityStatus: 1,
      }),
    ).toBe(false);
    expect(
      freeWeekEligible({
        os: "ios",
        product: iosProduct(weekFree),
        iosEligibilityStatus: null,
      }),
    ).toBe(false);
    expect(
      freeWeekEligible({
        os: "ios",
        product: iosProduct({ ...weekFree, price: 0.99 }),
        iosEligibilityStatus: 2,
      }),
    ).toBe(false);
    expect(
      freeWeekEligible({
        os: "ios",
        product: iosProduct(null),
        iosEligibilityStatus: 2,
      }),
    ).toBe(false);
  });
  it("iOS: 7-day unit form counts; a 3-day or 1-month trial doesn't (copy says 7 days)", () => {
    expect(
      iosHasFreeWeekIntro(
        iosProduct({
          price: 0,
          periodUnit: "DAY",
          periodNumberOfUnits: 7,
          cycles: 1,
        }),
      ),
    ).toBe(true);
    expect(
      iosHasFreeWeekIntro(
        iosProduct({
          price: 0,
          periodUnit: "DAY",
          periodNumberOfUnits: 3,
          cycles: 1,
          period: "P3D",
        }),
      ),
    ).toBe(false);
    expect(
      iosHasFreeWeekIntro(
        iosProduct({
          price: 0,
          periodUnit: "MONTH",
          periodNumberOfUnits: 1,
          cycles: 1,
          period: "P1M",
        }),
      ),
    ).toBe(false);
  });
  it("Android: defaultOption.freePhase of one week", () => {
    const product = (freePhase: object | null) => ({
      identifier: "pulsekegel_premium_v2:1yr-pulsekegel",
      priceString: "$4.99",
      defaultOption: { freePhase: freePhase as never },
    });
    expect(
      freeWeekEligible({
        os: "android",
        product: product({
          billingPeriod: { unit: "WEEK", value: 1, iso8601: "P1W" },
        }),
      }),
    ).toBe(true);
    expect(
      freeWeekEligible({
        os: "android",
        product: product({
          billingPeriod: { unit: "DAY", value: 7, iso8601: "P7D" },
        }),
      }),
    ).toBe(true);
    expect(freeWeekEligible({ os: "android", product: product(null) })).toBe(
      false,
    );
    expect(
      freeWeekEligible({
        os: "android",
        product: product({
          billingPeriod: { unit: "DAY", value: 3, iso8601: "P3D" },
        }),
      }),
    ).toBe(false);
    expect(
      freeWeekEligible({
        os: "web",
        product: product({ billingPeriod: { unit: "WEEK", value: 1 } }),
      }),
    ).toBe(false);
  });
});

describe("A14: P9 copy is exactly what Keg passed (Nov 23)", () => {
  it("matches the spec strings", () => {
    expect(BILLING_NOT_ALLOWED_ANDROID).toEqual({
      title: "Purchases aren't available right now",
      body: "Google Play isn't allowing purchases on this device or account. Check that you're signed in to the Play Store and have a payment method set up, then tap Retry.",
      retry: "Retry",
      dismiss: "Not now",
    });
    expect(BILLING_NOT_ALLOWED_IOS).toEqual({
      title: "Purchases are turned off on this device",
      body: "Check Settings › Screen Time › Content & Privacy Restrictions, then tap Retry.",
      retry: "Retry",
      dismiss: "Not now",
    });
    expect(CANT_LOAD_SUBSCRIPTION).toEqual({
      title: "Can't load the subscription right now",
      body: "Check your connection and tap Retry.",
      retry: "Retry",
      dismiss: "Not now",
    });
    expect(PAYWALL_LOADING_PRICE).toBe("Loading price…");
    expect(PAYMENT_PENDING_NOTE).toBe(
      "Your payment is pending. PulseKegel unlocks as soon as the store confirms it.",
    );
    expect(ENTITLEMENT_CONFIRMING_NOTE).toBe(
      "We're still confirming your purchase. Tap Restore Purchases in a minute.",
    );
    expect(RESTORE_UNREACHABLE_TITLE).toBe("Couldn't reach the store");
    expect(RESTORE_UNREACHABLE_BODY).toBe(
      "Check your connection and store sign-in, then try again.",
    );
    expect(FREE_WEEK_CTA).toBe("Start your free week");
    expect(freeWeekPriceLine("$4.99")).toBe(
      "7 days free, then $4.99/year. Cancel anytime in your store settings.",
    );
    expect(subscribeCta("€5,49")).toBe("Subscribe — €5,49/year");
    expect(continueTrainingCta("€5,49")).toBe(
      "Continue My Training — €5,49/year",
    );
  });
});

describe("A10: no hardcoded $4.99 in app code", () => {
  function walk(dir: string, out: string[] = []): string[] {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "__tests__" || entry.name === "node_modules")
          continue;
        walk(p, out);
      } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
        out.push(p);
      }
    }
    return out;
  }
  it("no client source file contains a $4.99 literal", () => {
    const clientDir = path.resolve(__dirname, "../..");
    const offenders = walk(clientDir).filter((f) =>
      fs.readFileSync(f, "utf8").includes("4.99"),
    );
    expect(offenders).toEqual([]);
  });
});

describe("derivePaywallView: package without a price (Rev L3)", () => {
  it("shows unavailable with Retry instead of loading forever", () => {
    expect(
      derivePaywallView({
        hasPackages: false,
        failure: null,
        packageWithoutPrice: true,
      }),
    ).toEqual({ kind: "unavailable", variant: "generic", code: "no_price" });
  });
  it("a real failure still wins", () => {
    expect(
      derivePaywallView({
        hasPackages: false,
        failure: { rcCode: 3, code: "rc_3" },
        packageWithoutPrice: true,
      }),
    ).toMatchObject({ kind: "unavailable", variant: "not_allowed" });
  });
});
