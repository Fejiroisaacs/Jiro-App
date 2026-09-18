# Jiro security audit — 2026-09-17

Branch `New-Features`. Six parallel read-only audits across the 36-item checklist.
Every finding below was verified against source; line numbers are as of this commit.

**Verdict:** no SQL injection, no NoSQL injection, no committed secrets, no XSS escape
hatch, no path traversal, no SSRF. The real problems are (a) a fail-open configuration
default and (b) a set of missing ownership checks in Journaly and the presigned-upload flow.

---

## 0. Do this first — is it an incident or a hardening task?

Nothing in the repo sets `ENVIRONMENT`. There is no `cloudbuild.yaml`, no `service.yaml`,
no deploy workflow (`.github/` has only `dependabot.yml`), and the Dockerfile sets no `ENV`.
Whether the live service has it set is not knowable from source, and it decides everything.

- [ ] **0.1** Check the deployed env:
      `gcloud run services describe jiro-app --region us-east4 --format="value(spec.template.spec.containers[0].env)"`
- [ ] **0.2** If `ENVIRONMENT=production` is **present** → the P1 items below are hardening. Proceed normally.
- [ ] **0.3** If it is **absent** → treat as an active incident, in this order:
      1. Set `ENVIRONMENT=production`, `JWT_SECRET` (new, ≥32 bytes), `ADMIN_SECRET`, `CORS_ORIGINS`.
      2. Rotate `JWT_SECRET` — the old one was the public string `change-me-in-production`.
      3. `DELETE FROM refresh_tokens;` to invalidate every live session.
      4. Review `analytics_events` and Cloud Logging for `/api/v1/admin/*` calls from unknown IPs.

Because with `ENVIRONMENT` unset, four controls fail simultaneously: JWT signing uses a
publicly-known string, `/api/v1/admin/*` serves unauthenticated, HSTS is not sent, and Gin
runs in debug mode dumping the route table at boot.

---

## P1 — Critical / High. Fix before the next deploy.

### Config fails open
- [x] **1.1** `internal/config/config.go:37` — flip default: `getEnv("ENVIRONMENT", "production")`.
- [x] **1.2** `config.go:44-57` — move the `JWT_SECRET` empty/placeholder/length checks **out** of
      the `if isProd` block so they run unconditionally. Delete the `change-me-in-production` fallback.
- [x] **1.3** `config.go:39` — drop the `postgres://postgres:postgres@localhost...sslmode=disable`
      fallback; require `DATABASE_URL`. Replace the `strings.Contains(url,"localhost")` prod check
      with a parse + `sslmode=require` assertion.
- [x] **1.4** `config.go` — add `RESEND_API_KEY` and `CORS_ORIGINS` to the production fatal list.
      Without the former, `services/email.go:22-29` logs every password-reset link at Info level.

### Admin surface has no real authentication
- [x] **1.5** `internal/middleware/admin.go:15-18` — delete the `if secret == "" { c.Next() }` bypass. Fail closed.
- [x] **1.6** `internal/router/router.go:315` — add `middleware.AuthRequired(authService)` in front of
      the admin group. Today `AdminRequired` runs *instead of* auth, so no user is identified and
      nothing is attributable in logs.
- [ ] **1.7** *(deferred — needs your call, see Review)* Add `is_admin BOOLEAN NOT NULL DEFAULT FALSE` to `users` and check it against the
      authenticated `user_id`. Replaces the process-wide shared header secret.
      (Note: no `is_admin` column exists today, which is also why self-promotion is impossible —
      there is nothing to escalate to. That property must survive this change: keep `is_admin`
      out of every request DTO.)
- [x] **1.8** `router.go:315` — add `middleware.RateLimitByIP(rl, 10)`. The admin group is the only
      one with no limiter, so the secret is brute-forceable at unlimited rate.

### Journaly authorization holes
- [x] **1.9** `router.go:312` — `POST /journal/groups/join` is on the **public** group. Move it to `protected`.
- [x] **1.10** `services/journal.go:658-692` — `AcceptInvite` takes no user identity, and its
      `UPDATE journal_group_members SET status='active' WHERE group_id=$1 AND status='pending'`
      has no `user_id` predicate: one redemption activates **every** pending invitee in the group.
      Pass the authenticated `user_id`, compare it to the invite's stored `email`, and scope the
      UPDATE with `AND user_id = $2`.
- [x] **1.11** `handlers/journal.go:509-535` — `CreateGroupEntry` has no membership check.
      `isActiveMember` is called on the read paths (journal.go:106, 475, 697) but not here.
      Add the gate; any authenticated user with a group UUID can currently post into a private group.
- [x] **1.12** `services/journal.go:868-880` — `AddEntryToCollection` verifies the collection owner
      then inserts `entryID` unchecked; `GetCollection` reads entries back by collection membership
      alone. Require `SELECT 1 FROM journal_entries WHERE id=$2 AND user_id=$1`, and add
      `AND e.user_id = $2` to the `GetCollection` query as defence in depth.

### Presigned uploads are unvalidated
- [x] **1.13** `services/storage.go:59-63, 79-83, 99-103, 116-120` — all four `PresignPutObject`
      calls pass only `Bucket`, `Key`, `CacheControl`. Add `ContentType` and `ContentLength` so both
      are in the SigV4 signature. Until then every check in `handlers/upload.go:51-64` is advisory:
      request an `image/png` presign, PUT HTML with `Content-Type: text/html`, and it is served as a
      live page from the public bucket host, cached `immutable` for a year.

---

## P2 — Medium. Next sprint.

### Needs a decision, not a patch
- [ ] **2.1** **Cross-site cookie topology.** API is on `run.app`, frontend on Firebase — both are on
      the Public Suffix List, so they are *different sites*, and the refresh cookie is `SameSite=Strict`
      (`handlers/auth.go:253-258`). The browser will not attach it to the frontend's refresh call:
      **every user gets logged out when their access token expires.** This is a production outage as
      much as a security issue.
      Preferred fix: put the API behind the same site (Firebase Hosting rewrite to Cloud Run, or a
      shared custom domain) and keep `SameSite=Strict`.
      Fallback: `SameSite=None; Secure` **plus** an Origin allowlist check and a double-submit CSRF
      token on `/auth/refresh` and `/auth/logout`. Do not loosen SameSite on its own — it is the only
      CSRF defence those endpoints have.
- [ ] **2.2** **R2 bucket is world-readable.** `storage.go:140-142` returns a permanent public URL and
      there is no `PresignGetObject` anywhere. Private journal photos are protected only by URL secrecy,
      forever, with no revocation. Decide: proxy reads through an authenticated handler, or issue
      short-lived signed GETs.

### Remaining ownership gaps
- [x] **2.3** `handlers/recipe.go:457-483` — `GetCollectionRecipeIDs` never reads `user_id` from context.
      The only handler in the codebase that does no ownership check at all.
- [x] **2.4** `handlers/upload.go:580-648` and `handlers/journal.go:243-270` — the *confirm* steps check
      only the key prefix (which contains the caller's own ID, so it is trivially satisfiable) while the
      *presign* steps correctly verify ownership. Re-verify session/entry ownership in both confirms.
- [x] **2.5** Nested writes trust a foreign key from the body without checking its owner:
      `services/jym.go:687-739` (`routine_id`, `series_id`), `jym.go:1046-1050` (`exercise_id`),
      `jym.go:639-643`, `services/meal_plan.go:150-198` (`recipe_id`),
      `services/ledger.go:344-353` (`account_id`, `category_id`), `ledger.go:759-767`.
      Copy the pattern already used correctly in `ledger.go:389-398` (`createTransfer`).
- [x] **2.6** `handlers/journal.go:405-445` — `InviteMember` allows any *member* to invite, but the UI
      gates invites on ownership (`journal-group.ts:218-237`). Align the two: add the owner check server-side.

### Output encoding
- [x] **2.7** `services/jym.go:1539-1544` — CSV formula injection. `routine`, `exercise`, `muscleGroup`
      are free text written unescaped. **Cross-user**: `jym.go:1723-1733` copies foreign `r.name` / `e.name`
      on import, so a weaponised public split reaches a victim's export. Prefix any cell starting with
      `= + - @` tab or CR with `'`.
- [x] **2.8** `handlers/journal.go:453-455` — `group.Name` is interpolated into invite-email HTML unescaped,
      and the email goes to any address the inviter types. That is branded phishing from your own sending
      domain. `html.EscapeString` it, and make `buildEmailHTML` (`auth.go:403`) escape too.
- [x] **2.9** 12 handler sites return raw `err.Error()` (unwrapped pgx errors) to clients — 3 on 500 paths
      (`meal_plan.go:36,64,90`), 9 on 4xx catch-alls (`ledger.go` ×5, `journal.go:479,482`, `auth.go:85`,
      `user.go:108`). Add a `respondInternal(c, err)` helper that logs server-side and returns a fixed message.

### Platform
- [x] **2.10** *(already done by you in `aa62610`, during the audit — finding was stale.)* `firebase.json` — no `headers` block at all. The origin that holds the access token in
      `localStorage` has no CSP, no `X-Frame-Options`, no `nosniff`, no `Referrer-Policy`.
      (The API sets all of these correctly; the frontend never got its policy.)
- [x] **2.11** Create `jiro-api/.dockerignore` with `.env`, `*.exe`, `.git`. `COPY . .` currently bakes the
      live `.env` — R2 keys, Resend key, JWT secret — into the builder layer. Final image is clean
      (multi-stage), but the builder layer persists in BuildKit/registry cache.
- [x] **2.12** `jiro-api/Dockerfile` — add `RUN adduser -D -u 10001 app` + `USER app`; the container runs as root.
- [x] **2.13** `services/auth.go:294-302` — password reset never revokes sessions. `RevokeAllUserTokens`
      exists at `auth.go:186` and is **never called**. A user resetting after a compromise leaves the
      attacker's 7-day refresh token live. Also wrap the three `Exec`s in one transaction — the
      read-then-write on `used_at` (auth.go:286) is a TOCTOU that lets two requests consume one token.
- [x] **2.14** `handlers/recipe.go:582-586` — unauthenticated `/culinara/discover` honours `?limit=10000000`.
      Clamp to 100. The pool is 10 connections and the route allows 60 req/min/IP.
- [x] **2.15** `npm audit` — 39 vulnerabilities (1 critical, 22 high). Most are dev-only, but
      `@angular/core`, `@angular/common` and `@angular/compiler` are **runtime** deps with open XSS
      sanitizer-bypass advisories affecting ≤21.2.19. Upgrade past 21.2.19.

---

## P3 — Low / hardening. Backlog.

**Auth:** user enumeration on register (explicit) and login (timing — Argon2 is skipped for unknown
emails, `handlers/auth.go:152-167`); password policy is `min=8` with no complexity or max; Argon2 params
not stored with the hash so cost can never be raised (`services/auth.go:36-53` — switch to PHC format);
JWT has no `iss`/`aud`/`typ`/`jti` and no `kid` rotation path; no refresh-token reuse detection
(`handlers/auth.go:198-216`); `LoginFailTracker` never reclaims blocked entries
(`middleware/ratelimit.go:30-44` — the `count < maxLoginFails` condition is permanently false once
blocked, so IP cycling grows the map without bound); rate limits are in-memory, so on Cloud Run the
effective limit is 5/min × N instances; email verification is never enforced anywhere; reset tokens
travel in the query string.

**Validation:** `binding:"required"` means *non-zero*, not *non-negative* — `CreateSetRequest`
(`models/jym.go:373-380`) rejects `weight: 0` but accepts `weight: -500`; 10 enum fields fall through to
DB CHECK constraints producing 500s instead of 400s (`UpdateSplitRequest.Visibility` is the
security-adjacent one — the private↔public toggle validated only by a migration); almost no `max=` on
free-text fields; no `max` on any array; discarded `strconv.Atoi` errors (`handlers/journal.go:66,181,565`)
where `?offset=-1` reaches Postgres and 500s; `page` arithmetic overflows to a negative offset
(`handlers/jym.go:245-249`, `handlers/admin.go:148-152`).

**Frontend:** access token in `localStorage` — hold it in the existing in-memory signal instead and let
`init()` re-derive it from the refresh cookie (`auth.service.ts:258-263`); auth interceptor attaches the
bearer token to *any* URL with no origin allowlist (`auth.interceptor.ts:10-20` — nothing leaks today,
but one future third-party `http.get` would); `SafeHtmlPipe` is a global unrestricted
`bypassSecurityTrustHtml` (both current call sites are safe constant lookups — narrow or delete it);
add `"**/*.map"` to the `firebase.json` ignore list; set `"sourceMap": false` explicitly in
`angular.json` production rather than relying on the builder default.

**Platform:** no least-privilege DB role — the app connects as schema owner and there are zero
`GRANT`/`CREATE ROLE`/RLS statements across all 28 migrations, so the app layer is the *only* tenant
control (RLS with `SET LOCAL app.user_id` would turn every P1/P2 ownership finding into a failed query);
`Vary: Origin` missing on CORS responses; `Permissions-Policy` missing; public recipe DTOs leak owner
`user_id` (`services/recipe.go:698-701` — Jym's public DTOs correctly omit it); Jym share links never
expire (`expires_at` defaults NULL and `CreateShare` never sets it).

**Config bugs (not security, but will bite):** `.env` sets `JWT_ACCESS_TTL_MINUTES=10080` — seven days,
not the documented fifteen minutes. `.env` also sets `JWT_REFRESH_TTL_MINUTES`, which matches nothing —
`config.go:62` reads `JWT_REFRESH_TTL_DAYS`, whose fallback is in *minutes* (`7*24*60`), so following
`README.md:35` and setting `JWT_REFRESH_TTL_DAYS=7` yields a **7-minute** refresh token.

---

## Checklist coverage — all 36 items

| # | Item | Result |
|---|---|---|
| 1 | Exposed DB credentials | ⚠️ `postgres:postgres` default in `config.go:39` (localhost-only) — P1.3 |
| 2 | Public .env files | ✅ Never committed; ignored; not servable. ⚠️ Docker builder layer — P2.11 |
| 3 | Hardcoded secrets | ⚠️ `change-me-in-production` JWT fallback — P1.2 |
| 4 | Weak auth | ⚠️ enumeration, `min=8`, no MFA — P3 |
| 5 | Missing authz check | ❌ `/journal/groups/join` public — P1.9 |
| 6 | Cross user access | ❌ group entries, collections, nested FKs — P1.11/1.12, P2.5 |
| 7 | Open DB permissions | ⚠️ superuser connection, no RLS — P3 |
| 8 | Cloud service misconfig | ⚠️ no Firebase headers — P2.10 |
| 9 | Unprotected admin routes | ❌ fail-open + no AuthRequired — P1.5-1.8 |
| 10 | Exposed prod debug tools | ✅ No pprof/swagger/debug routes. ⚠️ Gin debug mode via P1.1 |
| 11 | Logs leak secrets | ⚠️ reset links logged if `RESEND_API_KEY` unset — P1.4 |
| 12 | Verbose prod errors | ⚠️ 12 sites echo pgx errors — P2.9 |
| 13 | Secrets in git | ✅ Clean — 241 commits checked, `.env` never existed |
| 14 | Secrets in JS | ✅ Clean — no Firebase SDK, no R2 keys, no hardcoded emails |
| 15 | Client-only security | ✅ Every client check has a server counterpart, except P2.6 |
| 16 | Input validation | ⚠️ enums, bounds, negatives — P3 |
| 17 | SQL injection | ✅ **None.** All 42 `ORDER BY` literal; 6 builders interpolate only `$n` indices |
| 18 | NoSQL injection | ✅ N/A — no NoSQL store; Mongo driver is an unreachable Gin transitive dep |
| 19 | XSS | ✅ No escape hatch reachable by user data. ⚠️ No frontend CSP — P2.10 |
| 20 | CSRF | ⚠️ Cookie is `Strict` but cross-site in prod — P2.1 |
| 21 | Insecure file uploads | ❌ Content-Type/Length unsigned — P1.13 |
| 22 | Path traversal | ✅ No filesystem sinks. ⚠️ object keys lack `path.Clean` — P3 |
| 23 | SSRF | ✅ **None** — zero outbound user-controlled fetches in the module |
| 24 | Broken password reset | ⚠️ Token handling sound; no session revocation — P2.13 |
| 25 | Weak session mgmt | ⚠️ No reuse detection; token in localStorage — P3 |
| 26 | JWT secrets | ❌ Fallback default — P1.2. ✅ alg confusion correctly blocked |
| 27 | Permissive CORS | ✅ Exact-match allowlist, no `*`, no reflection. ⚠️ no `Vary` — P3 |
| 28 | Rate limits | ⚠️ Admin group unlimited — P1.8; in-memory on Cloud Run — P3 |
| 29 | Exposed environments | ✅ Clean — two env files, correct `fileReplacements` |
| 30 | Default credentials | ✅ No seeded accounts in any migration. ❌ empty `ADMIN_SECRET` — P1.5 |
| 31 | Unsigned webhooks | ✅ N/A — no inbound webhooks |
| 32 | FE payment checks | ✅ N/A — no payment flow, no tiers, no premium gating |
| 33 | IDOR / BOLA | ⚠️ See 6. ✅ All PKs are `gen_random_uuid()` — no enumeration |
| 34 | APIs + user input | ⚠️ CSV + email HTML injection — P2.7, P2.8 |
| 35 | Exposed logs | ✅ No file logging; analytics read path is admin-gated |
| 36 | Exposed source maps | ✅ None built, committed or deployed — safe by default, pin it in P3 |

---

## Review — P2

**P2 landed 2026-09-17.** 12 of 15 items done (2.10 turned out to be already done by
you). 2.1 and 2.2 remain open because both are decisions, not patches. 2.15 is a
dependency upgrade, handled separately.

Verified by an 11-case smoke test (`scratchpad/p2-smoke.ps1`), plus the P1 suite re-run
clean as a regression check — 21 assertions green in total. `go vet` clean.

| Check | Before | After |
|---|---|---|
| read another user's collection recipe-ids | full contents | empty set |
| transaction against another user's account | silently no-opped the balance | 404 |
| transaction / budget with another user's category | accepted | 404 |
| log a set against another user's exercise | reflected their exercise name | 404 |
| start a session on another user's routine | returned their exercise list | 404 |
| pin another user's recipe into a plan | accepted, leaked title | 403 |
| confirm-attach to another user's session | accepted | 404 |
| unauthenticated `discover?limit=10000000` | honoured | capped at 100 |
| own-resource equivalents of all the above | worked | still work |

Container: builds clean, runs as uid 10001, and neither `.env` nor `*.exe` appears in
the builder stage or the final image (both verified by inspecting the built images).
Alpine went 3.19 → 3.22; 3.19 is past its supported window.

**Notes on what changed beyond the listed items:**

- Several handlers had no mapping for the errors these checks now return, so the first
  test run produced 500s and 400s where 404 was right. `StartSession`, `LogSet` and
  `ReplaceRoutineItems` now map the ownership sentinels explicitly. Worth noting that
  the *security* behaviour was correct on the first run — the requests were rejected —
  but a 500 on a foreign id is itself a signal, so the mapping matters.
- 2.9 was scoped down deliberately. The ~57 `err.Error()` sites after `ShouldBindJSON`
  are validator output naming the offending request field; they are useful to a real
  client and leak nothing. Only the service-layer catch-alls, which return unwrapped
  pgx errors carrying table and constraint names, were routed through the new
  `respondInternal` helper in `handlers/errors.go`.
- 2.13 grew a transaction. The three separate `Exec`s meant a password could change
  without its session revocation landing, and the read-then-write on `used_at` let two
  concurrent requests consume one token. Single-use is now enforced by
  `WHERE used_at IS NULL` and `RowsAffected`, not by the earlier read.

**2.15 done separately** (`36e1b1a`, `a34ca7d`): audit 39 -> 9, and no runtime
dependency is flagged any more. Angular needed an explicit bump to 21.2.23 because
`npm audit fix` leaves it at 21.2.4 while the sanitizer-bypass advisories cover
everything through 21.2.19. The remaining 9 are build-toolchain only (vite, esbuild,
picomatch) and never reach the deployed bundle; they could not be applied because a
running `ng serve` holds `esbuild.exe`, so they need one `npm audit fix` with the dev
server stopped.

**Still open:** 2.1 and 2.2 — both are decisions, not patches.

---

## Review — P1

**P1 landed 2026-09-17.** 12 of 13 items done; 1.7 deferred. Verified by a 10-case
smoke test (`scratchpad/p1-smoke.ps1`), all passing, plus `go vet` clean and a clean
Angular production build.

| Check | Before | After |
|---|---|---|
| `POST /journal/groups/join` anonymous | reachable | 401 |
| non-member posts into a group | accepted | 403 |
| foreign entry into own collection | accepted (read primitive) | 404 |
| own entry into own collection | accepted | accepted (no regression) |
| `/admin/stats` with no token | served | 401 |
| `/admin/stats` logged in, no secret | served | 401 |
| `/admin/stats` wrong secret | 401 | 401 |
| presigned PUT signed headers | key only | includes content-type + content-length |

Two things changed beyond the plan, both consequences of the above:

- `AddEntryToCollection` in `handlers/journal.go` mapped only the collection error,
  so the new entry-ownership rejection would have surfaced as a 500. It now returns 404.
- Requiring auth on join exposed a pre-existing bug: `journal-join.ts` sent the return
  path as `redirect`, but `login.ts` reads `returnUrl`, so signing in from an invite
  dropped the user on the dashboard and lost the invite. Keys now match, and `returnUrl`
  is restricted to same-origin paths so it cannot become an open redirect.

**Still open and needing a decision:**

1. **1.7 — replace the shared admin secret with a per-user `is_admin` claim.** Deferred
   because it needs a migration and touches `admin.service.ts` on the frontend. The
   interim state is meaningfully stronger than before (a caller must now be an
   authenticated user *and* hold the secret, and the secret is rate limited), but it is
   still one shared static password with no per-admin attribution or revocation.
2. **The one real end-to-end upload is yours to run.** Signing content-type/length is
   verified at the presign layer only; per `r2-storage-is-live`, I did not fire a real
   PUT at the live bucket unattended. The frontend already declares `file.type`/`file.size`
   at presign and sends the same on the PUT, so they should match — but confirm one real
   avatar upload before deploying, because a mismatch now *fails* the upload rather than
   being ignored.
3. **Cloud Run `ENVIRONMENT` (item 0.1) is still unverified.** Note that config now fails
   closed: if that variable is missing in production, the service will refuse to boot
   rather than run insecurely. That is the intended behaviour, but it means **the next
   deploy will crash-loop if `JWT_SECRET`, `ADMIN_SECRET`, `DATABASE_URL` or `CORS_ORIGINS`
   are not set**. Check those before deploying.
