import { generateKeyPair, exportJWK, SignJWT, createLocalJWKSet } from "jose";
import {
  verifyDevIdentityToken,
  verifyIdentityToken,
  _setSyncAuthJwksForTests,
  _resetSyncAuthJwksForTests,
} from "../syncAuth";

describe("verifyDevIdentityToken", () => {
  const secret = "lab-secret-value-32chars-minimum!";

  it("rejects when secret unset", () => {
    expect(verifyDevIdentityToken("dev:anything", undefined)).toBeNull();
    expect(verifyDevIdentityToken("dev:anything", "")).toBeNull();
  });

  it("never trusts bare dev:anything when secret is set", () => {
    expect(
      verifyDevIdentityToken("dev:pending-ashley-config", secret),
    ).toBeNull();
    expect(verifyDevIdentityToken("dev:forged-subject", secret)).toBeNull();
    expect(verifyDevIdentityToken("dev:", secret)).toBeNull();
  });

  it("accepts exact dev:<secret>", () => {
    expect(verifyDevIdentityToken(`dev:${secret}`, secret)).toEqual({
      subject: "dev-lab",
    });
  });

  it("accepts dev:<secret>:<subject> when secret matches", () => {
    expect(
      verifyDevIdentityToken(`dev:${secret}:alice_device-1`, secret),
    ).toEqual({ subject: "alice_device-1" });
  });

  it("rejects wrong secret even with subject suffix", () => {
    expect(verifyDevIdentityToken("dev:wrong-secret:alice", secret)).toBeNull();
  });
});

describe("verifyIdentityToken JWT", () => {
  afterEach(() => {
    _resetSyncAuthJwksForTests();
  });

  it("rejects forgeable unsigned JWT (no signature / JWKS)", async () => {
    const header = Buffer.from(
      JSON.stringify({ alg: "none", typ: "JWT" }),
    ).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({
        sub: "forged-user",
        aud: "com.example.app",
        iss: "https://appleid.apple.com",
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    ).toString("base64url");
    const forged = `${header}.${payload}.`;
    const result = await verifyIdentityToken("apple", forged, {
      appleClientId: "com.example.app",
      googleClientId: undefined,
      devSecret: undefined,
    });
    expect(result).toEqual({ error: "Invalid identity token", status: 401 });
  });

  it("rejects JWT with wrong audience", async () => {
    const { privateKey, publicKey } = await generateKeyPair("RS256");
    const jwk = await exportJWK(publicKey);
    jwk.alg = "RS256";
    jwk.use = "sig";
    jwk.kid = "test-kid";
    _setSyncAuthJwksForTests({
      apple: createLocalJWKSet({ keys: [jwk] }),
    });

    const token = await new SignJWT({ sub: "user-1" })
      .setProtectedHeader({ alg: "RS256", kid: "test-kid" })
      .setIssuer("https://appleid.apple.com")
      .setAudience("wrong-client-id")
      .setExpirationTime("1h")
      .sign(privateKey);

    const result = await verifyIdentityToken("apple", token, {
      appleClientId: "com.example.app",
      devSecret: undefined,
    });
    expect(result).toEqual({ error: "Invalid identity token", status: 401 });
  });

  it("accepts valid Apple JWT with matching aud/iss/sig", async () => {
    const { privateKey, publicKey } = await generateKeyPair("RS256");
    const jwk = await exportJWK(publicKey);
    jwk.alg = "RS256";
    jwk.use = "sig";
    jwk.kid = "test-kid";
    _setSyncAuthJwksForTests({
      apple: createLocalJWKSet({ keys: [jwk] }),
    });

    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "RS256", kid: "test-kid" })
      .setSubject("apple-sub-99")
      .setIssuer("https://appleid.apple.com")
      .setAudience("com.example.app")
      .setExpirationTime("1h")
      .sign(privateKey);

    const result = await verifyIdentityToken("apple", token, {
      appleClientId: "com.example.app",
    });
    expect(result).toEqual({ subject: "apple-sub-99" });
  });

  it("rejects expired JWT", async () => {
    const { privateKey, publicKey } = await generateKeyPair("RS256");
    const jwk = await exportJWK(publicKey);
    jwk.alg = "RS256";
    jwk.use = "sig";
    jwk.kid = "test-kid";
    _setSyncAuthJwksForTests({
      apple: createLocalJWKSet({ keys: [jwk] }),
    });

    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "RS256", kid: "test-kid" })
      .setSubject("apple-sub-99")
      .setIssuer("https://appleid.apple.com")
      .setAudience("com.example.app")
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(privateKey);

    const result = await verifyIdentityToken("apple", token, {
      appleClientId: "com.example.app",
    });
    expect(result).toEqual({ error: "Invalid identity token", status: 401 });
  });

  it("when client ID unset, requires proving dev secret", async () => {
    const noSecret = await verifyIdentityToken(
      "apple",
      "dev:pending-ashley-config",
      { appleClientId: undefined, devSecret: undefined },
    );
    expect(noSecret).toMatchObject({ status: 503 });

    const forged = await verifyIdentityToken(
      "apple",
      "dev:pending-ashley-config",
      { appleClientId: undefined, devSecret: "real-secret" },
    );
    expect(forged).toMatchObject({ status: 503 });

    const ok = await verifyIdentityToken("apple", "dev:real-secret", {
      appleClientId: undefined,
      devSecret: "real-secret",
    });
    expect(ok).toEqual({ subject: "dev-lab" });
  });

  it("rejects dev: tokens when production client ID is configured", async () => {
    const result = await verifyIdentityToken("apple", "dev:real-secret", {
      appleClientId: "com.example.app",
      devSecret: "real-secret",
    });
    expect(result).toEqual({ error: "Invalid identity token", status: 401 });
  });
});
