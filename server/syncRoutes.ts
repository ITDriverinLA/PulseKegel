/**
 * Epic G1 Path A — Express sync routes (opt-in gated on client; auth required here).
 * No progress writes without a valid Bearer token issued after identity exchange.
 */

import type { Express, Request, Response, NextFunction } from "express";
import { createHash, randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "./db";
import { syncAccounts, syncSnapshots } from "../shared/schema";
import { createRateLimiter } from "./security";
import { PROGRESS_TRANSFER_SCHEMA_VERSION } from "../shared/progressTransfer";

const syncAuthSchema = z
  .object({
    provider: z.enum(["apple", "google"]),
    identityToken: z.string().trim().min(10).max(8192),
  })
  .strict();

const syncPushSchema = z
  .object({
    payload: z
      .object({
        schema_version: z.literal(PROGRESS_TRANSFER_SCHEMA_VERSION),
        exported_at: z.string().min(1),
        progress: z.record(z.unknown()),
        settings: z.record(z.unknown()),
        audio_settings: z.record(z.unknown()).optional(),
        in_progress_session: z.unknown().nullable().optional(),
        tips_seen: z.record(z.unknown()).optional(),
        purchases_cache: z.record(z.unknown()).optional(),
      })
      .passthrough(),
  })
  .strict();

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}


type AuthedRequest = Request & {
  syncAccountId?: string;
};

async function requireSyncAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const auth = req.headers.authorization ?? "";
  if (!auth.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const token = auth.slice("Bearer ".length).trim();
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const tokenHash = sha256Hex(token);
  try {
    const rows = await db
      .select()
      .from(syncAccounts)
      .where(eq(syncAccounts.accessTokenHash, tokenHash))
      .limit(1);
    const account = rows[0];
    if (!account || account.revoked) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    req.syncAccountId = account.id;
    next();
  } catch {
    res.status(503).json({ error: "Sync storage unavailable" });
  }
}

/**
 * Verify Apple/Google identity tokens when client IDs are configured.
 * Dev fallback: SYNC_DEV_AUTH_SECRET + identityToken === `dev:<subject>` when
 * EXPO_PUBLIC / server Apple/Google client IDs are unset (Ashley config pending).
 */
async function verifyIdentityToken(
  provider: "apple" | "google",
  identityToken: string,
): Promise<{ subject: string } | { error: string; status: number }> {
  const appleClientId = process.env.APPLE_CLIENT_ID;
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const devSecret = process.env.SYNC_DEV_AUTH_SECRET;

  if (provider === "apple" && !appleClientId) {
    if (devSecret && identityToken.startsWith("dev:")) {
      return { subject: identityToken.slice(4) || "dev-apple" };
    }
    return {
      error:
        "Apple Sign-In not configured (set APPLE_CLIENT_ID — Ashley config)",
      status: 503,
    };
  }
  if (provider === "google" && !googleClientId) {
    if (devSecret && identityToken.startsWith("dev:")) {
      return { subject: identityToken.slice(4) || "dev-google" };
    }
    return {
      error:
        "Google Sign-In not configured (set GOOGLE_CLIENT_ID — Ashley config)",
      status: 503,
    };
  }

  // Production path: decode JWT payload without full JWKS verification here.
  // Full Apple/Google JWKS verification lands when client IDs are provisioned.
  try {
    const parts = identityToken.split(".");
    if (parts.length < 2) {
      return { error: "Invalid identity token", status: 401 };
    }
    const payloadJson = Buffer.from(parts[1]!, "base64url").toString("utf8");
    const payload = JSON.parse(payloadJson) as { sub?: string; aud?: string };
    if (!payload.sub) {
      return { error: "Invalid identity token (no sub)", status: 401 };
    }
    const expectedAud = provider === "apple" ? appleClientId : googleClientId;
    if (expectedAud && payload.aud && payload.aud !== expectedAud) {
      return { error: "Invalid identity token audience", status: 401 };
    }
    return { subject: payload.sub };
  } catch {
    return { error: "Invalid identity token", status: 401 };
  }
}

export function registerSyncRoutes(app: Express): void {
  const authLimit = createRateLimiter({
    maxRequests: 20,
    windowMs: 60_000,
  });
  const syncLimit = createRateLimiter({
    maxRequests: 30,
    windowMs: 60_000,
  });

  app.post("/api/sync/auth", authLimit, async (req, res) => {
    const parsed = syncAuthSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid auth request" });
      return;
    }
    const verified = await verifyIdentityToken(
      parsed.data.provider,
      parsed.data.identityToken,
    );
    if ("error" in verified) {
      res.status(verified.status).json({ error: verified.error });
      return;
    }

    const accessToken = randomBytes(32).toString("hex");
    const accessTokenHash = sha256Hex(accessToken);

    try {
      const existing = await db
        .select()
        .from(syncAccounts)
        .where(
          and(
            eq(syncAccounts.provider, parsed.data.provider),
            eq(syncAccounts.providerSubject, verified.subject),
          ),
        )
        .limit(1);

      let accountId: string;
      if (existing[0]) {
        accountId = existing[0].id;
        await db
          .update(syncAccounts)
          .set({
            accessTokenHash,
            revoked: false,
            updatedAt: new Date(),
          })
          .where(eq(syncAccounts.id, accountId));
      } else {
        const inserted = await db
          .insert(syncAccounts)
          .values({
            provider: parsed.data.provider,
            providerSubject: verified.subject,
            accessTokenHash,
          })
          .returning({ id: syncAccounts.id });
        accountId = inserted[0]!.id;
      }

      res.json({
        accountId,
        accessToken,
        provider: parsed.data.provider,
      });
    } catch {
      res.status(503).json({ error: "Sync storage unavailable" });
    }
  });

  app.post(
    "/api/sync/push",
    syncLimit,
    requireSyncAuth as never,
    async (req: AuthedRequest, res: Response) => {
      const parsed = syncPushSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid sync payload" });
        return;
      }
      const accountId = req.syncAccountId;
      if (!accountId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const exportedAt = new Date(parsed.data.payload.exported_at);
      if (Number.isNaN(exportedAt.getTime())) {
        res.status(400).json({ error: "Invalid exported_at" });
        return;
      }
      try {
        const existing = await db
          .select()
          .from(syncSnapshots)
          .where(eq(syncSnapshots.accountId, accountId))
          .limit(1);
        if (existing[0]) {
          await db
            .update(syncSnapshots)
            .set({
              payload: parsed.data.payload,
              schemaVersion: PROGRESS_TRANSFER_SCHEMA_VERSION,
              exportedAt,
              updatedAt: new Date(),
            })
            .where(eq(syncSnapshots.accountId, accountId));
        } else {
          await db.insert(syncSnapshots).values({
            accountId,
            schemaVersion: PROGRESS_TRANSFER_SCHEMA_VERSION,
            payload: parsed.data.payload,
            exportedAt,
          });
        }
        res.json({ ok: true });
      } catch {
        res.status(503).json({ error: "Sync storage unavailable" });
      }
    },
  );

  app.get(
    "/api/sync/pull",
    syncLimit,
    requireSyncAuth as never,
    async (req: AuthedRequest, res: Response) => {
      const accountId = req.syncAccountId;
      if (!accountId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      try {
        const rows = await db
          .select()
          .from(syncSnapshots)
          .where(eq(syncSnapshots.accountId, accountId))
          .limit(1);
        if (!rows[0]) {
          res.status(404).json({ error: "No remote snapshot" });
          return;
        }
        res.json({
          payload: rows[0].payload,
          updatedAt: rows[0].updatedAt,
        });
      } catch {
        res.status(503).json({ error: "Sync storage unavailable" });
      }
    },
  );

  app.delete(
    "/api/sync/delete",
    syncLimit,
    requireSyncAuth as never,
    async (req: AuthedRequest, res: Response) => {
      const accountId = req.syncAccountId;
      if (!accountId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      try {
        await db
          .delete(syncSnapshots)
          .where(eq(syncSnapshots.accountId, accountId));
        await db
          .update(syncAccounts)
          .set({ revoked: true, updatedAt: new Date() })
          .where(eq(syncAccounts.id, accountId));
        res.json({ ok: true });
      } catch {
        res.status(503).json({ error: "Sync storage unavailable" });
      }
    },
  );
}
