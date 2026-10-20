import { verifyAdminAuthorization } from "../security";

function basic(username: string, password: string): string {
  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
}

describe("verifyAdminAuthorization", () => {
  it("fails closed when either credential is not configured", () => {
    expect(verifyAdminAuthorization(undefined, undefined, undefined)).toBe(
      "unconfigured",
    );
    expect(verifyAdminAuthorization(undefined, "admin", undefined)).toBe(
      "unconfigured",
    );
  });

  it("rejects missing, malformed, and incorrect credentials", () => {
    expect(verifyAdminAuthorization(undefined, "admin", "secret")).toBe(
      "unauthorized",
    );
    expect(verifyAdminAuthorization("Bearer token", "admin", "secret")).toBe(
      "unauthorized",
    );
    expect(
      verifyAdminAuthorization(basic("admin", "wrong"), "admin", "secret"),
    ).toBe("unauthorized");
  });

  it("accepts the configured username and password", () => {
    expect(
      verifyAdminAuthorization(
        basic("analytics-admin", "long:password"),
        "analytics-admin",
        "long:password",
      ),
    ).toBe("authorized");
  });
});

describe("analytics read-only key", () => {
  const { verifyReadOnlyKey, extractReadOnlyKey, requireAnalyticsReadAccess } =
    jest.requireActual("../security");

  function run(method: string, headers: Record<string, string>) {
    const res: any = {
      statusCode: 200,
      headers: {} as Record<string, unknown>,
      setHeader(k: string, v: unknown) {
        this.headers[k] = v;
      },
      status(c: number) {
        this.statusCode = c;
        return this;
      },
      json() {
        return this;
      },
    };
    const next = jest.fn();
    requireAnalyticsReadAccess({ method, headers } as any, res, next);
    return { res, next };
  }

  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it("is disabled when the key is unset or empty", () => {
    expect(verifyReadOnlyKey("GET", "", undefined)).toBe(false);
    expect(verifyReadOnlyKey("GET", "", "")).toBe(false);
    expect(verifyReadOnlyKey("GET", "x", "")).toBe(false);
  });

  it("only allows GET/HEAD with the exact key", () => {
    expect(verifyReadOnlyKey("GET", "k3y", "k3y")).toBe(true);
    expect(verifyReadOnlyKey("HEAD", "k3y", "k3y")).toBe(true);
    expect(verifyReadOnlyKey("DELETE", "k3y", "k3y")).toBe(false);
    expect(verifyReadOnlyKey("POST", "k3y", "k3y")).toBe(false);
    expect(verifyReadOnlyKey("GET", "k3", "k3y")).toBe(false);
    expect(verifyReadOnlyKey("GET", "k3yy", "k3y")).toBe(false);
  });

  it("extracts bearer or X-Analytics-Key", () => {
    expect(extractReadOnlyKey("Bearer abc", undefined)).toBe("abc");
    expect(extractReadOnlyKey(undefined, "abc")).toBe("abc");
    expect(extractReadOnlyKey("Basic xyz", undefined)).toBeUndefined();
  });

  it("middleware: key grants GET, rejects DELETE, admin Basic unchanged", () => {
    process.env.ANALYTICS_READONLY_KEY = "ro-key";
    process.env.ANALYTICS_ADMIN_USERNAME = "admin";
    process.env.ANALYTICS_ADMIN_PASSWORD = "secret";
    expect(
      run("GET", { authorization: "Bearer ro-key" }).next,
    ).toHaveBeenCalled();
    expect(run("GET", { "x-analytics-key": "ro-key" }).next).toHaveBeenCalled();
    const del = run("DELETE", { authorization: "Bearer ro-key" });
    expect(del.next).not.toHaveBeenCalled();
    expect(del.res.statusCode).toBe(401);
    const bad = run("GET", { authorization: "Bearer nope" });
    expect(bad.res.statusCode).toBe(401);
    expect(bad.res.headers["WWW-Authenticate"]).toBe(
      'Basic realm="PulseKegel Analytics"',
    );
    expect(
      run("GET", { authorization: basic("admin", "secret") }).next,
    ).toHaveBeenCalled();
  });
});
