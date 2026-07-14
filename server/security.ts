import { timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, RequestHandler, Response } from "express";

type AdminAuthResult = "authorized" | "unauthorized" | "unconfigured";

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function verifyAdminAuthorization(
  authorizationHeader: string | undefined,
  expectedUsername: string | undefined,
  expectedPassword: string | undefined,
): AdminAuthResult {
  if (!expectedUsername || !expectedPassword) return "unconfigured";
  if (!authorizationHeader?.startsWith("Basic ")) return "unauthorized";

  try {
    const decoded = Buffer.from(
      authorizationHeader.slice("Basic ".length),
      "base64",
    ).toString("utf8");
    const separatorIndex = decoded.indexOf(":");
    if (separatorIndex < 0) return "unauthorized";

    const username = decoded.slice(0, separatorIndex);
    const password = decoded.slice(separatorIndex + 1);
    const usernameMatches = safeEqual(username, expectedUsername);
    const passwordMatches = safeEqual(password, expectedPassword);
    return usernameMatches && passwordMatches ? "authorized" : "unauthorized";
  } catch {
    return "unauthorized";
  }
}

export const requireAnalyticsAdmin: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const result = verifyAdminAuthorization(
    req.headers.authorization,
    process.env.ANALYTICS_ADMIN_USERNAME,
    process.env.ANALYTICS_ADMIN_PASSWORD,
  );

  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  if (result === "unconfigured") {
    res.status(503).json({ error: "Analytics administration is unavailable" });
    return;
  }
  if (result === "unauthorized") {
    res.setHeader("WWW-Authenticate", 'Basic realm="PulseKegel Analytics"');
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
};

type RateLimiterOptions = {
  maxRequests: number;
  windowMs: number;
  maxEntries?: number;
  keyGenerator?: (req: Request) => string;
};

export function createRateLimiter({
  maxRequests,
  windowMs,
  maxEntries = 10_000,
  keyGenerator = (req) => req.ip ?? "unknown",
}: RateLimiterOptions): RequestHandler {
  const buckets = new Map<string, { count: number; resetAt: number }>();
  const cleanup = setInterval(
    () => {
      const now = Date.now();
      for (const [key, bucket] of buckets) {
        if (now >= bucket.resetAt) buckets.delete(key);
      }
    },
    Math.max(windowMs, 60_000),
  );
  cleanup.unref();

  return (req, res, next) => {
    const key = keyGenerator(req);
    const now = Date.now();
    let bucket = buckets.get(key);

    if (!bucket || now >= bucket.resetAt) {
      if (!bucket && buckets.size >= maxEntries) {
        for (const [candidate, entry] of buckets) {
          if (now >= entry.resetAt) buckets.delete(candidate);
          if (buckets.size < maxEntries) break;
        }
        if (buckets.size >= maxEntries) {
          const oldestKey = buckets.keys().next().value;
          if (oldestKey !== undefined) buckets.delete(oldestKey);
        }
      }
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }

    bucket.count += 1;
    res.setHeader("X-RateLimit-Limit", maxRequests);
    res.setHeader(
      "X-RateLimit-Remaining",
      Math.max(0, maxRequests - bucket.count),
    );
    if (bucket.count > maxRequests) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((bucket.resetAt - now) / 1000),
      );
      res.setHeader("Retry-After", retryAfterSeconds);
      res.status(429).json({ error: "Too many requests" });
      return;
    }
    next();
  };
}
