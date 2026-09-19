/**
 * Epic G1 Path A — Apple/Google identity token verification (JWKS) + lab dev auth.
 * Rejects forgeable unsigned JWTs; requires aud/iss/exp/signature.
 */

import { createHash, timingSafeEqual } from "node:crypto";
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

const APPLE_ISSUER = "https://appleid.apple.com";
const GOOGLE_ISSUERS = [
  "https://accounts.google.com",
  "accounts.google.com",
] as const;

const APPLE_JWKS_URL = "https://appleid.apple.com/auth/keys";
const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";

const appleJwks = createRemoteJWKSet(new URL(APPLE_JWKS_URL));
const googleJwks = createRemoteJWKSet(new URL(GOOGLE_JWKS_URL));

/** Test-only JWKS overrides (local keys). */
let testJwks: {
  apple?: JWTVerifyGetKey;
  google?: JWTVerifyGetKey;
} = {};

export function _setSyncAuthJwksForTests(overrides: {
  apple?: JWTVerifyGetKey;
  google?: JWTVerifyGetKey;
}): void {
  testJwks = { ...overrides };
}

export function _resetSyncAuthJwksForTests(): void {
  testJwks = {};
}

function jwksFor(provider: "apple" | "google"): JWTVerifyGetKey {
  if (provider === "apple") return testJwks.apple ?? appleJwks;
  return testJwks.google ?? googleJwks;
}

function safeEqualString(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");
  if (aBuf.length !== bBuf.length) {
    // Constant-ish reject: compare against self to avoid early length oracle timing
    timingSafeEqual(aBuf, aBuf);
    return false;
  }
  return timingSafeEqual(aBuf, bBuf);
}

/**
 * Lab-only: accept tokens that prove knowledge of SYNC_DEV_AUTH_SECRET.
 * Formats:
 *   - `dev:<secret>` → subject `dev-lab`
 *   - `dev:<secret>:<subject>` → custom subject (alphanumeric/_/-)
 * Never trusts bare `dev:anything` without the secret.
 */
export function verifyDevIdentityToken(
  identityToken: string,
  devSecret: string | undefined,
): { subject: string } | null {
  if (!devSecret || !identityToken.startsWith("dev:")) {
    return null;
  }
  const rest = identityToken.slice("dev:".length);
  if (!rest) return null;

  // Prefer `dev:<secret>:<subject>` when a second colon segment exists and
  // the secret prefix matches; otherwise require exact `dev:<secret>`.
  const firstColon = rest.indexOf(":");
  if (firstColon === -1) {
    if (!safeEqualString(rest, devSecret)) return null;
    return { subject: "dev-lab" };
  }

  const secretPart = rest.slice(0, firstColon);
  const subjectPart = rest.slice(firstColon + 1);
  if (!safeEqualString(secretPart, devSecret)) return null;
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(subjectPart)) return null;
  return { subject: subjectPart };
}

export type VerifyIdentityResult =
  | { subject: string }
  | { error: string; status: number };

/**
 * Verify Apple/Google identity tokens with JWKS (sig + aud + iss + exp).
 * When the provider client ID is unset, only accept proving `dev:` tokens
 * if SYNC_DEV_AUTH_SECRET is configured.
 */
export async function verifyIdentityToken(
  provider: "apple" | "google",
  identityToken: string,
  env: {
    appleClientId?: string;
    googleClientId?: string;
    devSecret?: string;
  } = {
    appleClientId: process.env.APPLE_CLIENT_ID,
    googleClientId: process.env.GOOGLE_CLIENT_ID,
    devSecret: process.env.SYNC_DEV_AUTH_SECRET,
  },
): Promise<VerifyIdentityResult> {
  const appleClientId = env.appleClientId;
  const googleClientId = env.googleClientId;
  const devSecret = env.devSecret;
  const clientId = provider === "apple" ? appleClientId : googleClientId;

  if (!clientId) {
    const dev = verifyDevIdentityToken(identityToken, devSecret);
    if (dev) return dev;
    return {
      error:
        provider === "apple"
          ? "Apple Sign-In not configured (set APPLE_CLIENT_ID)"
          : "Google Sign-In not configured (set GOOGLE_CLIENT_ID)",
      status: 503,
    };
  }

  // Never accept forgeable `dev:` shortcuts when production client IDs are set.
  if (identityToken.startsWith("dev:")) {
    return { error: "Invalid identity token", status: 401 };
  }

  try {
    const { payload } = await jwtVerify(identityToken, jwksFor(provider), {
      issuer: provider === "apple" ? APPLE_ISSUER : [...GOOGLE_ISSUERS],
      audience: clientId,
      algorithms: ["RS256"],
    });
    if (typeof payload.sub !== "string" || !payload.sub) {
      return { error: "Invalid identity token (no sub)", status: 401 };
    }
    return { subject: payload.sub };
  } catch {
    return { error: "Invalid identity token", status: 401 };
  }
}

/** Stable hash helper shared with sync session storage. */
export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
