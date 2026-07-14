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
