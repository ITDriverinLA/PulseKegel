import { reduceSessionAppState } from "../sessionAppState";

describe("P6 session app state", () => {
  it("ignores a fold (active → inactive → active) and does not suspend", () => {
    const folded = reduceSessionAppState("active", "inactive", false);
    expect(folded).toEqual({ suspended: false, action: "ignore" });

    const unfolded = reduceSessionAppState(
      "inactive",
      "active",
      folded.suspended,
    );
    expect(unfolded).toEqual({ suspended: false, action: "ignore" });
  });

  it("suspends on a real background and resumes after the inactive beat", () => {
    const toInactive = reduceSessionAppState("active", "inactive", false);
    const toBackground = reduceSessionAppState(
      "inactive",
      "background",
      toInactive.suspended,
    );
    expect(toBackground).toEqual({ suspended: true, action: "suspend" });

    const returning = reduceSessionAppState(
      "background",
      "inactive",
      toBackground.suspended,
    );
    expect(returning).toEqual({ suspended: true, action: "ignore" });

    const active = reduceSessionAppState(
      "inactive",
      "active",
      returning.suspended,
    );
    expect(active).toEqual({ suspended: false, action: "resume" });
  });

  it("suspends and resumes when Android skips inactive", () => {
    const backgrounded = reduceSessionAppState("active", "background", false);
    expect(backgrounded).toEqual({ suspended: true, action: "suspend" });
    expect(reduceSessionAppState("background", "active", true)).toEqual({
      suspended: false,
      action: "resume",
    });
  });

  it("does not suspend twice while already backgrounded", () => {
    expect(reduceSessionAppState("background", "background", true)).toEqual({
      suspended: true,
      action: "ignore",
    });
  });
});
