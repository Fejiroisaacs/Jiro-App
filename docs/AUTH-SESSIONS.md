# Sign-in sessions

How Jiro keeps people signed in, why the app currently holds its own refresh token, and the two saved plans for going back to a cookie-only session.

**Status (27 Sep 2026):** the app keeps its own refresh token. This is an interim design, chosen while the user base is small. The long-term fix is still to be decided: Option 1, a custom domain, is preferred; Option 2 moves the API into the Firebase project.

---

## How it works now

| Piece | Lifetime | Where it lives |
| --- | --- | --- |
| Access token (JWT) | 15 minutes | Memory only; gone on every reload |
| Refresh token (random, 256-bit) | 7 days, renewed on every refresh | The app's `localStorage` (`jiro_refresh_token`), **and** an httpOnly cookie `refresh_token` (path `/api/v1/auth`) |
| Profile copy | Until sign-out | `localStorage` (`jiro_user`); only tells the app "this browser was signed in" |

- **Login, register, demo and refresh** return the refresh token in the response body. They also set it as the cookie.
- **The app** stores the body copy. It sends it in the body of `POST /auth/refresh` and `POST /auth/logout`, together with the cookie.
- **The API** reads the body first, then the cookie. So older app builds, and Chrome sessions from before this change, keep working.
- **Rotation.** Every refresh returns a new token. The old one is marked used only after the new one is stored.
  - A used token presented again within 30 seconds is accepted: two tabs refreshing at once.
  - Later than that, it is treated as stolen and every session for that user is revoked. On the shared demo account, only that token is revoked.
- **Sign-out** deletes the token on the server, with no grace window. The app then removes its copy.
- **Server storage.** The database stores only a SHA-256 hash of each token (`refresh_tokens`).

Code: `jiro-api/internal/handlers/auth.go` (`issueRefreshToken`, `presentedRefreshToken`), `jiro-api/internal/services/auth.go` (`ValidateRefreshToken`), `jiro-ui/src/app/core/services/auth.service.ts`.

## Why the app holds the token

The app is served from `jiro-app-3e88c.web.app` (Firebase Hosting) and the API from `jiro-app-401631848579.us-east4.run.app` (Cloud Run, in a different Google Cloud project). These are two different sites, so the API's cookie is a third-party cookie.

WebKit blocks third-party cookies. That covers Safari and every browser and home-screen app on iPhone. It ignores the cookie when it is set, so it is never sent back.

Since `a9745af` the access token lives only in memory, so every relaunch needs a refresh, and so does every 15-minute expiry. With the cookie gone, that refresh returned 401 and the app signed out. iOS reloads a suspended home-screen app after a few minutes, which is why people were "signed out after about 5 minutes".

This was verified on 27 Sep 2026 against production with Playwright: WebKit 26.5 dropped the cookie, while Chrome kept it.

To reproduce it locally, open the app on a different host from the API, so the two are cross-site and the cookie is never used. Serve a development build at `http://127.0.0.1:4300`, with the API at `http://localhost:8080` and `CORS_ORIGINS` including that origin. The Angular dev server itself only answers to `localhost`.

## Why it is interim

An httpOnly cookie is the stronger home for a refresh token, and both options below make it the only copy again. The trade-offs of the interim are written up in `tasks/auth-sessions-tradeoffs.md`, which is kept out of the repo.

**When to revisit:** before inviting more people, or when a domain is bought.

---

## Option 1: a custom domain (preferred)

Buy a domain and serve the app at `<domain>` and the API at `api.<domain>`. Both are the same site, so every browser treats the cookie as first-party. Nothing moves between Google Cloud projects.

1. **Buy a domain** from any registrar.
2. **Put the app on it.** In the Firebase console, go to Hosting → Add custom domain and add `<domain>`, with `www.<domain>` redirecting to it. Add the DNS records Firebase shows, then wait for the certificate. The commented `google-site-verification` tag in `jiro-ui/src/index.html` is for Search Console at this point.
3. **Put the API on `api.<domain>`,** one of these ways:

   | Way | Cost | Notes |
   | --- | --- | --- |
   | Cloud Run domain mapping (Cloud Run → Manage custom domains) | Free | Available in `us-east4`. Google marks it Preview and "not recommended for production" because of latency. |
   | Global external Application Load Balancer with a serverless NEG | A monthly load-balancer charge | Google's recommended way. Also allows Cloud Armor and a CDN. |
   | A Firebase Hosting site in the API's project that rewrites to the service | Cheap | Brings Hosting's rules: only a cookie named `__session` is forwarded, a 60-second timeout, and the client IP in `Fastly-Client-IP` (see Option 2's code changes). |

4. **Update the API's environment:** `CORS_ORIGINS=https://<domain>` and `APP_BASE_URL=https://<domain>`.
5. **Change the code:**
   - `jiro-ui/src/app/core/site.config.ts`: `ORIGIN = 'https://<domain>'`.
   - `jiro-ui/src/environments/environment.production.ts`: `apiUrl: 'https://api.<domain>/api/v1'`.
   - `firebase.json`: in the CSP `connect-src`, replace the `run.app` host with `https://api.<domain>`.
   - Hosts written out by hand, which don't read `ORIGIN`: `jiro-ui/src/index.html` (`og:url`, `og:image`, `twitter:image`), `jiro-ui/public/sitemap.xml`, and the `Sitemap:` line in `jiro-ui/public/robots.txt`.
   - `refreshCookiePolicy()` in `handlers/auth.go`: `SameSite=Lax`, Secure in production. The two are same-site now, so `None` is no longer needed.
   - Then remove the interim (below), in a later deploy.
6. **Deal with the old address.** `jiro-app-3e88c.web.app` keeps serving the same site; send visitors on to the new domain, for example with a hostname check at startup that redirects to `ORIGIN` plus the path. Installed home-screen apps belong to the old address, so people reinstall from the new domain and sign in once there.
7. **Check in WebKit:** sign in, reload, and you should still be signed in, with the refresh request carrying the cookie.

## Option 2: the API inside the Firebase project, served at `/api`

Run the API as a Cloud Run service in the Firebase project `jiro-app-3e88c`, and have Firebase Hosting forward `/api/**` to it. The app and API then share one origin, `jiro-app-3e88c.web.app`. No domain to buy, and the app's address and installed apps are unchanged.

- **Why the API has to move:** Hosting can only forward to a Cloud Run service in its own project.
- **Why the app can't move instead:** the `web.app` address belongs to the Firebase project, so moving the app would change its address.

**Code changes:**

- **`handlers/auth.go`:** name the cookie `__session`, the only cookie Hosting passes through. Make it `SameSite=Lax`, Secure in production.
- **`router/router.go`:** set `r.TrustedPlatform = "Fastly-Client-IP"`, with a test that the header wins and that a direct caller's forged `X-Forwarded-For` is ignored.
  - Why: behind Hosting, every request otherwise carries Hosting's address. The login lockout (10 failures, then 15 minutes) and the per-IP rate limits are keyed by that address, so one person's typos would lock everyone out.
  - Hosting's CDN sets `Fastly-Client-IP` from the connection. The checks to run after deploying are in `tasks/auth-sessions-tradeoffs.md`.
- **`environment.production.ts`:** set `` apiUrl: `${ORIGIN}/api/v1` ``. It is absolute on purpose: the prerendered Discover pages fetch at build time, when a relative URL has no origin.
- **`firebase.json`:**
  - add `{"source": "/api/**", "run": {"serviceId": "jiro-api", "region": "us-east4"}}` before the `**` rewrite;
  - add a `/api/**` header rule, `Cache-Control: no-store`, after the shell's `no-cache` rule;
  - drop the `run.app` host from the CSP `connect-src`.
- **`jiro-ui/public/robots.txt`:** add `Disallow: /api/`.
- **Then remove the interim** (below), in a later deploy.

**Runbook** (Google Cloud console, since `gcloud` isn't installed):

1. **Stop old deploys.** In the API's current project, disable the Cloud Build trigger, so merging doesn't deploy the new cookie code to the old service while the old app still uses it.
2. **Merge** to `main`.
3. **Billing.** Put the Firebase project on the Blaze plan; Cloud Run needs billing.
4. **Create the service.** In project `jiro-app-3e88c`, go to Cloud Run → Create service `jiro-api`:
   - region `us-east4`;
   - "Continuously deploy from a repository": the GitHub repo, branch `main`, Dockerfile `jiro-api/Dockerfile`, the same as the old trigger;
   - public access allowed, ingress "All".

   Copy the old service's variables:
   - `ENVIRONMENT`, `DATABASE_URL` (and `APP_DATABASE_URL` if set), `JWT_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`;
   - `CORS_ORIGINS`, `APP_BASE_URL`;
   - `STORAGE_ENDPOINT`, `STORAGE_BUCKET`, `STORAGE_BUCKET_PRIVATE`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`, `STORAGE_PUBLIC_URL`;
   - any `JWT_*_TTL_*`.

   Also copy its CPU, memory, instance and timeout settings.
5. **Check** that `<new service URL>/api/v1/health` answers.
6. **Deploy the app:** `cd jiro-ui && npx ng build && cd .. && firebase deploy --only hosting`.
7. **Check the switch:**
   - `curl -sI https://jiro-app-3e88c.web.app/api/v1/health` returns 200 with `cache-control: no-store`;
   - on an iPhone, sign in, close the app, and reopen it 20 or more minutes later: still signed in.
8. **Build and deploy the app once more.** The first build ran before `/api` answered on `web.app`, so Discover prerendered empty.
9. **A week later,** delete the old service and its trigger.

**What doesn't change:** the database, storage, email, the app's address and installed apps. Everyone signs in once after the switch, because the old cookie belongs to the `run.app` host.

## Both together

A custom domain in front of Option 2 puts the app at `<domain>` and the API at `<domain>/api`: one origin on your own domain, no CORS, and one cookie scope. That is Option 2 plus Option 1's domain, environment and host changes, without the `api.` subdomain.

## Removing the interim (after either option)

Do this in a deploy after the same-site cookie is live and confirmed in WebKit. Until then the app's copy is what keeps iPhones signed in.

- **API:** stop returning `refresh_token` in the body, and read it from the cookie only (drop the body path in `presentedRefreshToken`).
- **App:** stop storing and sending `jiro_refresh_token`, and remove the key at startup for anyone who still has one.
- **Privacy page:** remove the `jiro_refresh_token` entry and the note under the cookie.
- **Check in WebKit** that a reload still keeps you signed in.
