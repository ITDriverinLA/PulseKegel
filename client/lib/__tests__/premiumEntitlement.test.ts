import {
  checkPremium,
  completionFields,
  decideStatusChange,
  hasPremium,
  normalizePeriodType,
  parseStoredStatus,
  PREMIUM_ENTITLEMENT_ID,
  statusFromCheck,
} from "../premiumEntitlement";

const info = (active: Record<string, object>) => ({
  entitlements: { active },
});

describe("P9b.7 named entitlement with safety net", () => {
  it("named entitlement active", () => {
    const c = checkPremium(
      info({ premium: { periodType: "NORMAL" } }),
      "premium",
    );
    expect(c.active).toBe(true);
    expect(c.mismatch).toBeUndefined();
  });

  it("named missing but another active → access kept + mismatch", () => {
    const c = checkPremium(info({ pro: {}, other: {} }), "premium");
    expect(c.active).toBe(true);
    expect(c.mismatch).toEqual({
      expected: "premium",
      activeIds: ["pro", "other"],
    });
  });

  it("caps activeIds at 5", () => {
    const c = checkPremium(
      info({ a: {}, b: {}, c: {}, d: {}, e: {}, f: {} }),
      "premium",
    );
    expect(c.mismatch?.activeIds).toHaveLength(5);
  });

  it("empty → no access", () => {
    expect(hasPremium(info({}), "premium")).toBe(false);
    expect(hasPremium(null, "premium")).toBe(false);
    expect(hasPremium({}, null)).toBe(false);
  });

  it("no ID configured → any active entitlement, no mismatch", () => {
    const c = checkPremium(info({ whatever: {} }), null);
    expect(c.active).toBe(true);
    expect(c.mismatch).toBeUndefined();
  });

  it("default constant is the checklist placeholder (filled before submit)", () => {
    expect(
      PREMIUM_ENTITLEMENT_ID === null ||
        typeof PREMIUM_ENTITLEMENT_ID === "string",
    ).toBe(true);
  });
});

describe("P9a.4 trial vs paid", () => {
  it("free-week start is a trial, never paid", () => {
    const c = checkPremium(
      info({ p: { periodType: "TRIAL", isSandbox: true } }),
      "p",
    );
    expect(statusFromCheck(c)).toBe("trial");
    expect(completionFields(c)).toEqual({
      periodType: "TRIAL",
      isTrial: true,
      isSandbox: true,
    });
  });
  it("normal / intro are paid", () => {
    expect(
      statusFromCheck(checkPremium(info({ p: { periodType: "normal" } }), "p")),
    ).toBe("paid");
    expect(
      statusFromCheck(checkPremium(info({ p: { periodType: "INTRO" } }), "p")),
    ).toBe("paid");
    expect(statusFromCheck(checkPremium(info({}), "p"))).toBe("none");
  });
  it("unknown periodType is left out", () => {
    expect(normalizePeriodType("weird")).toBeUndefined();
    expect(completionFields(checkPremium(info({ p: {} }), "p"))).toEqual({});
  });
});

describe("P9a.5 status change dedupe", () => {
  it("seeds silently on first run", () => {
    expect(decideStatusChange(null, "paid")).toBeNull();
  });
  it("logs only real changes", () => {
    expect(decideStatusChange("trial", "trial")).toBeNull();
    expect(decideStatusChange("none", "trial")).toEqual({
      from: "none",
      to: "trial",
    });
    expect(decideStatusChange("trial", "paid")).toEqual({
      from: "trial",
      to: "paid",
    });
  });
  it("parses stored values", () => {
    expect(parseStoredStatus("paid")).toBe("paid");
    expect(parseStoredStatus("junk")).toBeNull();
    expect(parseStoredStatus(null)).toBeNull();
  });
});
