# Epic G1 — Progress transfer & sync (privacy amendment)

**Default: local-only.** No personal progress leaves the device unless the user
explicitly opts in (OP1). Fresh install never uploads until opt-in.

## Dual path

### Path B — Local phone-to-phone (no cloud)

1. Settings → **Moving to a new phone?**
2. Choose a passphrase → **Export & share backup** (AirDrop / Files / share sheet)
3. On the new phone → **Import backup file** with the same passphrase
4. Works with **network off** and **no account** (OP2)

Format: `PKB1` encrypted envelope (`schema_version: 1`), HMAC-authenticated.
Corrupt / wrong passphrase → safe fail (no partial apply).

Events: `transfer_flow_started`, `transfer_flow_completed`, `transfer_flow_fallback_backup`

### Path A — Cloud sync (opt-in only)

1. Soft prompt after first-session complete, or Settings → Moving to a new phone?
2. Affirmative copy: **Save progress to cloud…** listing what is stored (OP4)
3. Dismiss = stay local-only
4. Auth (Apple iOS / Google Android) only after opt-in; then push/pull
5. Opt-out stops uploads; offer delete remote copy (OP3)
6. **Zero** `/api/sync/push` without opt-in + Bearer token

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

| Env / secret | Purpose |
|---|---|
| `APPLE_CLIENT_ID` | Apple Sign-In audience (iOS) |
| `GOOGLE_CLIENT_ID` | Google Sign-In audience (Android) |
| `SYNC_DEV_AUTH_SECRET` | Optional lab-only: accept `identityToken: "dev:<subject>"` when client IDs unset |
| Database | Run `npm run db:push` after deploy so `sync_accounts` / `sync_snapshots` exist |

Client Expo IDs (EAS secrets / app config) must match the server client IDs.
Until configured, opt-in still stores the local flag; auth returns `503` with a
clear message — **no silent uploads**.

## AC coverage

| AC | Coverage |
|---|---|
| OP1 | Default opt-in flag off; `pushProgressIfOptedIn` no-ops; tests assert no fetch |
| OP2 | Path B export/import offline / no account |
| OP3 | Disable + optional remote delete via `DELETE /api/sync/delete` |
| OP4 | Affirmative UI copy in modal + Transfer checklist |
| OP5 | Sync/transfer analytics carry path/reason only — no workout payloads |

## Known limits

- Full Apple/Google JWKS verification lands when client IDs are provisioned;
  JWT `sub`/`aud` checks are in place as a bridge.
- iCloud/CloudKit-style storage is treated as off-device and still requires the
  same explicit opt-in copy.
- Purchases remain StoreKit / Play source of truth; backup only caches UX flags.
