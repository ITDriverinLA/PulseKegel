import { parseRouteId } from "../routeId";

describe("parseRouteId", () => {
  it("parses one positive integer from a string or a single-element array", () => {
    expect(parseRouteId("12")).toBe(12);
    expect(parseRouteId(["7"])).toBe(7);
  });

  it("rejects ids that would become NaN or a partial parse", () => {
    expect(parseRouteId("nope")).toBeNull();
    expect(parseRouteId("12abc")).toBeNull();
    expect(parseRouteId("")).toBeNull();
    expect(parseRouteId("0")).toBeNull();
    expect(parseRouteId("-3")).toBeNull();
    expect(parseRouteId([])).toBeNull();
    expect(parseRouteId(undefined)).toBeNull();
  });
});
