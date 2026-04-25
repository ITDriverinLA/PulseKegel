#!/usr/bin/env node
/**
 * rotate-cache-token.js
 *
 * Generates a fresh INVALIDATE_CACHE_TOKEN and walks through the
 * zero-downtime rotation steps.
 *
 * Usage:
 *   node scripts/rotate-cache-token.js           # generate + print instructions
 *   node scripts/rotate-cache-token.js --verify  # also test the running server
 *
 * Zero-downtime notes:
 *   - The server reads INVALIDATE_CACHE_TOKEN on every request (not at start-up),
 *     so the only gap is the few seconds it takes to restart the process after
 *     updating the secret.  During that window the cache-invalidation endpoint
 *     is temporarily unavailable, but no user-visible feature depends on it.
 *   - build-blog.js reads the token at build time, so the next blog build
 *     automatically picks up the new value with no extra steps.
 */

"use strict";

const crypto = require("crypto");
const https = require("https");
const http = require("http");

// ── helpers ──────────────────────────────────────────────────────────────────

function generateToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("hex");
}

function pad(label, width = 14) {
  return label.padEnd(width);
}

function printStep(n, text) {
  console.log(`\n  ${n}. ${text}`);
}

async function pingEndpoint(serverUrl, token) {
  return new Promise((resolve) => {
    try {
      const url = new URL(`${serverUrl}/api/invalidate-sitemap-cache`);
      const transport = url.protocol === "https:" ? https : http;
      const headers = { "Content-Type": "application/json", "Content-Length": "0" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const req = transport.request(
        {
          hostname: url.hostname,
          port: url.port || (url.protocol === "https:" ? 443 : 80),
          path: url.pathname,
          method: "POST",
          headers,
        },
        (res) => {
          let body = "";
          res.on("data", (chunk) => { body += chunk; });
          res.on("end", () => resolve({ status: res.statusCode, body: body.trim() }));
        }
      );
      req.on("error", (err) => resolve({ status: null, error: err.message }));
      req.setTimeout(4000, () => {
        req.destroy();
        resolve({ status: null, error: "request timed out" });
      });
      req.end();
    } catch (err) {
      resolve({ status: null, error: err.message });
    }
  });
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  const verify = process.argv.includes("--verify");
  const serverUrl = process.env.SERVER_URL || "http://localhost:5000";
  const currentToken = process.env.INVALIDATE_CACHE_TOKEN || "";
  const newToken = generateToken();

  console.log("\n┌─────────────────────────────────────────────────────────┐");
  console.log("│          INVALIDATE_CACHE_TOKEN rotation helper          │");
  console.log("└─────────────────────────────────────────────────────────┘");

  console.log(`\n  ${pad("New token:")}  ${newToken}`);
  console.log(`  ${pad("Token length:")} ${newToken.length} hex chars (${newToken.length / 2} bytes)`);

  // Optional: verify old token still works before rotation
  if (verify && currentToken) {
    console.log("\n  Verifying current token against server …");
    const result = await pingEndpoint(serverUrl, currentToken);
    if (result.status === 200) {
      console.log("  ✓  Current token accepted — server is healthy.");
    } else if (result.status === 401) {
      console.log("  ✗  Current token rejected (401). It may already be stale.");
    } else if (result.error) {
      console.log(`  !  Could not reach server: ${result.error}`);
    } else {
      console.log(`  ?  Server returned HTTP ${result.status}: ${result.body}`);
    }
  }

  console.log("\n══════════════════════════════════════════════════════════");
  console.log("  Rotation steps (zero downtime for end users)");
  console.log("══════════════════════════════════════════════════════════");

  printStep(1, "Copy the new token printed above.");

  printStep(
    2,
    "Open the Replit Secrets panel (padlock icon in the left sidebar)\n" +
    "     and update  INVALIDATE_CACHE_TOKEN  with the new value.\n" +
    "     (Replit secrets are stored encrypted; the value is never logged.)"
  );

  printStep(
    3,
    "Restart the backend server so it loads the new secret:\n" +
    "     • In Replit: click 'Restart' next to the Start Backend workflow, or\n" +
    "     • From a terminal: npm run server:dev\n" +
    "     The restart takes only a few seconds.  During this window the\n" +
    "     /api/invalidate-sitemap-cache endpoint is briefly unavailable,\n" +
    "     but no user-facing feature depends on it."
  );

  printStep(
    4,
    "If you use INVALIDATE_CACHE_TOKEN in a CI/CD pipeline or any\n" +
    "     external automation, update the secret there too before the next run."
  );

  printStep(
    5,
    "(Optional) Verify the new token works:\n" +
    `     SERVER_URL=${serverUrl} INVALIDATE_CACHE_TOKEN=<new-token> \\\n` +
    "       node scripts/rotate-cache-token.js --verify"
  );

  console.log("\n══════════════════════════════════════════════════════════");
  console.log("  Why this is safe");
  console.log("══════════════════════════════════════════════════════════");
  console.log(`
  • server/routes.ts reads INVALIDATE_CACHE_TOKEN inside the route handler
    on every request, not at process start — so a restart picks it up cleanly.

  • scripts/build-blog.js reads the token at build time from the environment,
    so the next blog build automatically uses the new value.

  • If the rotation window is a concern, you can:
      a) Set the new token in Replit secrets WITHOUT restarting the server first.
         The old token continues to work until the server is restarted.
      b) Restart the server.  From this point on only the new token is accepted.
      c) Trigger a blog build (or any cache invalidation) with the new token.
  `);

  // Optional: verify new token after rotation (run again with new token in env)
  if (verify && !currentToken) {
    console.log("  Tip: set INVALIDATE_CACHE_TOKEN=<new-token> in your shell and");
    console.log("  re-run with --verify to confirm the new token is accepted.\n");
  }
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
