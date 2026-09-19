# Epic G1 — Progress transfer & sync (privacy amendment)

**Default: local-only.** No personal progress leaves the device unless the user
explicitly opts in (OP1). Fresh install never uploads until opt-in.

## Dual path

### Path B — Local phone-to-phone (no cloud)

1. Settings → **Moving to a new phone?**
2. Choose a passphrase (min **8** characters) → **Export & share backup**
3. On the new phone → **Import backup file** with the same passphrase
4. Works with **network off** and **no account** (OP2)

Format: **`PKB2`** envelope — PBKDF2-SHA256 (210k iterations) + **AES-256-GCM**
(AEAD). Min passphrase length: 8.

**Migration:** Legacy `PKB1` (custom SHA-256 XOR + weak KDF) is **not** decrypted.
Decrypt fails closed with a clear message — re-export from a current app build.
Corrupt / wrong passphrase → safe fail (no partial apply).

Events: `transfer_flow_started`, `transfer_flow_completed`, `transfer_flow_fallback_backup`

**Export compliance:** Path B PKB2 uses AES-GCM under a user passphrase for
local transfer only. Ashley confirmed this is covered by an export exemption;
`ITSAppUsesNonExemptEncryption` remains `false` in `app.json` (see
`docs/security-operations.md`). Do not describe the app as "HTTPS/OS encryption
only."

### Path A — Cloud sync (opt-in only)

1. Soft prompt after first-session complete, or Settings → Moving to a new phone?
2. Affirmative copy: **Save progress to cloud…** listing what is stored (OP4)
3. Dismiss = stay local-only
4. Auth (Apple iOS / Google Android) only after opt-in **and** after a real
   Sign-In identity token; then push/pull
5. Opt-out stops uploads; offer delete remote copy (OP3)
6. **Zero** `/api/sync/push` without opt-in + Bearer token (token in **SecureStore**)

If `EXPO_PUBLIC_APPLE_CLIENT_ID` / `EXPO_PUBLIC_GOOGLE_CLIENT_ID` are missing,
**Enable Cloud is disabled** in the UI (fail closed) — use Path B instead.
There is no shared `dev:pending-*` identity.

Conflict rules: union of completed days; settings LWW; tips-seen OR; never
replace non-empty local with empty remote without confirm (default No).

Events: `sync_enabled`, `sync_pull_ok`, `sync_push_ok`, `sync_conflict`, `sync_error`  
Analytics never include workout payload content (OP5).

## Payload (`schema_version = 1`)

Included: challenge/program progress, completed days, session history, streaks,
onboarding/anatomy, settings (rest/haptics/audio/reminders), tips seen,
in-progress session (`step_index` + `session_id`, TTL 48h), purchases UX cache only.

Excluded: analytics device id, OS permissions, ephemeral UI, secrets, sync tokens.

## Ashley config (required for Path A production auth)

| Env / secret                   | Purpose                                                                                                                                                 |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `APPLE_CLIENT_ID`              | Server: Apple Sign-In audience (JWT `aud`)                                                                                                              |
| `GOOGLE_CLIENT_ID`             | Server: Google Sign-In audience (JWT `aud`)                                                                                                             |
| `EXPO_PUBLIC_APPLE_CLIENT_ID`  | Client: enables Apple Sign-In UI                                                                                                                        |
| `EXPO_PUBLIC_GOOGLE_CLIENT_ID` | Client: enables Google Sign-In UI                                                                                                                       |
| `SYNC_DEV_AUTH_SECRET`         | Optional lab-only: accept proving tokens `dev:<secret>` or `dev:<secret>:<subject>` when server client IDs unset. **Never** trusts bare `dev:anything`. |
| Database                       | Run `npm run db:push` after deploy so `sync_accounts` / `sync_snapshots` exist                                                                          |

Server verifies Apple/Google identity tokens via **JWKS** (signature + `aud` +
`iss` + `exp`). Unsigned / wrong-audience JWTs are rejected.

Until client IDs are provisioned, Enable Cloud stays unavailable on device;
`/api/sync/auth` returns `503` for production tokens without client IDs —
**no silent uploads**.

## AC coverage

| AC  | Coverage                                                                       |
| --- | ------------------------------------------------------------------------------ |
| OP1 | Default opt-in flag off; `pushProgressIfOptedIn` no-ops; tests assert no fetch |
| OP2 | Path B export/import offline / no account                                      |
| OP3 | Disable + optional remote delete via `DELETE /api/sync/delete`                 |
| OP4 | Affirmative UI copy in modal + Transfer checklist                              |
| OP5 | Sync/transfer analytics carry path/reason only — no workout payloads           |
