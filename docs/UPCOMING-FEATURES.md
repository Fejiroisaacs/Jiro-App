# Upcoming Features

Planned features across all Jiro modules, in rough priority order.

---

## Jym

### Public Split Discovery

Allow users to opt-in to making their splits publicly browseable. Anyone can view and copy a public split — no link required.

**Schema changes**

New migration: `000015_split_visibility_tags.up.sql`

```sql
ALTER TABLE splits ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private'
  CHECK (visibility IN ('private', 'public'));

ALTER TABLE splits ADD COLUMN tags TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX idx_splits_public ON splits(visibility, created_at DESC)
  WHERE visibility = 'public';

CREATE INDEX idx_splits_tags ON splits USING GIN(tags);
```

**API endpoints**

| Method | Path | Description |
| ------ | ---- | ----------- |
| GET | `/jym/public-splits` | Browse public splits — paginated, optional `?search=`, `?tag=`, and `?muscle_group=` filters — no auth required |
| GET | `/jym/public-splits/:id` | Public split detail (name, tags, routines, exercise names) — no auth required |
| POST | `/jym/public-splits/:id/import` | Deep-copy the split into the caller's account — auth required |

The `PATCH /jym/splits/:id` endpoint gains `visibility` and `tags` fields. The `POST /jym/splits` and `PUT /jym/splits/:id` endpoints also accept `tags`. Tag filtering uses the PostgreSQL `&&` array overlap operator (`WHERE tags && ARRAY[$1]`). Import logic reuses the existing `copySplit` helper from share imports.

Tags also apply to private splits — users can tag and filter their own splits in the personal split list (`GET /jym/splits?tag=ppl`), independent of the public discovery feature.

**Frontend**

- Tags input on the split create/edit form — comma-separated or chip-style entry
- Tag chips displayed on each split card (personal list and discover page)
- Visibility toggle on the split detail page (Private / Public)
- New `/jym/discover` browse page — card grid with search, tag filter, and muscle group filter, accessible without login
- Public split detail at `/jym/discover/:id` — same layout as the share preview page, with "Import to My Account" button

---

### Other Jym Features

- **Routine templates** — save a session layout as a reusable routine without it being tied to a split
- **Deload auto-suggest** — after N consecutive sessions without a PR or with declining volume, suggest scheduling a deload week
- **Unit toggle in session player** — quick kg/lbs switch without going to settings

---

## Culinara

- **Recipe scaling** — enter a target serving count, all ingredient quantities scale automatically
- **Nutritional info** — optional per-recipe macros (calories, protein, carbs, fat)
- **Recipe sharing** — same copy-on-import model as splits: share a recipe link, recipient gets an independent copy
- **Meal planner** — drag recipes onto a weekly calendar; auto-generates a shopping list from the plan
- **Cook streak** — track how many days in a row a trial was logged (encourages consistent cooking)
- **Import from URL** — paste a recipe URL, parse it into the recipe form (structured data / open graph)
- **Collections** — group recipes into named folders beyond tags (e.g. "Date night", "Batch cooking Sunday", "Under 30 mins"); a recipe can belong to multiple collections
- **Dietary flags** — boolean flags per recipe: vegan, vegetarian, gluten-free, dairy-free, nut-free; filterable in the recipe list alongside existing tag filters; stored as a `dietary_flags JSONB` column on the `recipes` table

---

## File Upload & Object Storage

### Storage Provider

The project already plans to use **Cloudflare R2** as its object storage layer. R2 is the recommended choice.

#### Provider comparison

| Provider | Type | Egress fees | S3-compatible | Best for |
| -------- | ---- | ----------- | ------------- | -------- |
| **Cloudflare R2** | Cloud | None | Yes | Projects already on Cloudflare; zero egress cost |
| **AWS S3** | Cloud | Yes | Yes (it is S3) | Projects already on AWS |

**Recommendation: R2 for cloud deployments**

Both are S3-compatible, so the Go code uses the same AWS SDK (`aws-sdk-go-v2`) regardless. Switching between them is an environment variable change, not a code change.

#### Environment variables to add

```env
STORAGE_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com   # or MinIO URL
STORAGE_BUCKET=jiro-uploads
STORAGE_ACCESS_KEY=...
STORAGE_SECRET_KEY=...
STORAGE_PUBLIC_URL=https://cdn.yourdomain.com   # public base URL for serving files
```

---

### Upload Flow (presigned URLs)

Files are **never proxied through the API server**. Instead:

1. Client requests a presigned upload URL from the API
2. API generates a short-lived presigned PUT URL (5 minutes) directly from the storage provider
3. Client uploads the file directly to R2/MinIO using that URL
4. Client notifies the API with the final object key so the API can update the DB record

This keeps the Go server stateless and avoids memory/bandwidth overhead for large files.

```text
Client          API             R2 / MinIO
  |                |                |
  |-- POST /upload/presign -------->|
  |<-- { upload_url, object_key } --|
  |                                 |
  |-- PUT {upload_url} (file) ----->|
  |<-- 200 OK ----------------------|
  |                                 |
  |-- PATCH /user/me (object_key) ->|
  |<-- updated user ----------------|
```

---

### Initial use case: Avatar upload

#### API endpoints

| Method | Path | Description |
| ------ | ---- | ----------- |
| POST | `/upload/avatar/presign` | Returns a presigned PUT URL + object key for an avatar upload |
| DELETE | `/upload/avatar` | Deletes the current user's avatar from storage and clears `avatar_url` |

Presign request validates:

- `Content-Type` must be `image/jpeg`, `image/png`, or `image/webp`
- Max size enforced via `Content-Length` header check (limit: 5 MB)

Object key format: `avatars/{user_id}/{uuid}.{ext}` — namespaced by user so keys never collide.

#### Avatar implementation notes

- Go package: `aws-sdk-go-v2` with `s3` and `s3/presignClient` — works identically against R2 and MinIO
- Old avatar is deleted from storage when a new one is uploaded or the user removes it
- Served via `STORAGE_PUBLIC_URL` — files are public read; no signed download URLs needed for avatars
- Image resizing / thumbnail generation: out of scope for now; can add a Cloudflare Transform rule or a Workers image resize step later

#### Avatar frontend

- Avatar preview in the settings page with an "Upload photo" button
- File picker filtered to `image/*`; client-side size check before requesting presign
- Upload progress indicator during the direct-to-storage PUT
- Displays the `avatar_url` throughout the app (sidebar, profile page)

---

### Future upload targets

- **Recipe photos** — attach images to a recipe; stored at `recipes/{user_id}/{recipe_id}/{uuid}.jpg`
- **Workout attachments** — form check video clips attached to a session (larger files, same flow)

---

## Auth & User System

### Analytics Event Logger

Capture structured usage events server-side for understanding how the app is used. No third-party trackers — all data stays in the database.

#### Analytics schema

```sql
CREATE TABLE analytics_events (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES users(id) ON DELETE SET NULL,  -- NULL for anonymous
  event      VARCHAR(100) NOT NULL,   -- e.g. "session.started", "recipe.cooked"
  properties JSONB DEFAULT '{}',      -- arbitrary key-value metadata
  occurred_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_analytics_user    ON analytics_events(user_id, occurred_at DESC);
CREATE INDEX idx_analytics_event   ON analytics_events(event, occurred_at DESC);
```

#### Event taxonomy (initial set)

| Event | Properties | Description |
| ----- | ---------- | ----------- |
| `auth.register` | — | New account created |
| `auth.login` | — | Successful login |
| `session.started` | `routine_id`, `split_id`, `type` | Workout session started |
| `session.finished` | `duration_min`, `set_count`, `volume_kg` | Session completed |
| `recipe.created` | `has_tags`, `ingredient_count` | Recipe saved |
| `recipe.cooked` | `recipe_id`, `rating` | Trial logged |
| `split.shared` | `split_id` | Share link generated |
| `split.imported` | `share_id` | Split copied by another user |
| `export.csv` | `row_count` | CSV downloaded |

#### Analytics implementation notes

- A lightweight `TrackEvent(ctx, userID, event, properties)` helper in a shared `analytics` package — one line to add to any handler
- Events are fire-and-forget (no blocking the response); use a goroutine with a short timeout
- No PII stored in `properties` — only IDs and aggregate values
- Retention: keep raw events for 90 days; aggregate into summary tables for longer-term trends (future)

#### Analytics API endpoints (admin/self-hosted only)

| Method | Path | Description |
| ------ | ---- | ----------- |
| GET | `/admin/analytics/events` | List recent events with filters |
| GET | `/admin/analytics/summary` | Aggregate counts by event type and date |

Access gated by an `ADMIN_SECRET` header — not tied to user auth.

---

## Admin Dashboard

A protected `/admin` section of the app for monitoring users, events, and system health. Accessible only with an admin secret — not tied to regular user auth.

### Access control

- Protected by `ADMIN_SECRET` environment variable
- Frontend stores it in `sessionStorage` (cleared on tab close)
- API gates all `/admin/*` routes with a middleware that checks the `X-Admin-Secret` header

### Admin routes (frontend)

| Path | Description |
| ---- | ----------- |
| `/admin` | Login — enter admin secret |
| `/admin/dashboard` | Overview: user count, event counts, system health |
| `/admin/users` | User list — email, join date, verified status, last login |
| `/admin/users/:id` | User detail — profile, activity summary, ability to delete account |
| `/admin/events` | Analytics event log — filterable by event type, user, date range |
| `/admin/logs` | Server-side error log viewer (if structured logs are forwarded) |

### Admin API endpoints

| Method | Path | Description |
| ------ | ---- | ----------- |
| GET | `/admin/stats` | Total users, active users (last 30 days), event counts by type |
| GET | `/admin/users` | Paginated user list with filters |
| GET | `/admin/users/:id` | User detail including recent activity |
| DELETE | `/admin/users/:id` | Delete a user and all their data (cascades all modules) |
| POST | `/admin/users/:id/reset-password` | Trigger a password reset email on behalf of a user |
| DELETE | `/admin/users/:id/sessions` | Revoke all active sessions (delete refresh tokens) |
| GET | `/admin/events` | Paginated analytics event log with filters |

> Admin can never view or set passwords directly. Password reset is always user-initiated via email.

### Dashboard widgets

- **Total users** — count from `users` table
- **New users this week** — `created_at > now() - 7 days`
- **Active users (30d)** — distinct `user_id` in `analytics_events` last 30 days
- **Top events** — bar chart of event counts by type
- **Recent registrations** — list of newest accounts
- **Error rate** — count of 5xx responses if logged to analytics

### Admin implementation notes

- Admin frontend is a separate lazy-loaded Angular feature module at `/admin`
- No sensitive user data shown beyond email and activity summary
- All destructive actions (delete user) require a confirmation modal
- Built with the same design system as the rest of the app

---

## Base / Cross-module

- **Dashboard widgets** — customisable cards on the dashboard: last workout, recent recipes, body weight trend, upcoming reminders
- **Global search** — search across recipes, exercises, and sessions from anywhere in the app
- **Data export** — full account export as JSON (all modules)
- **Dark mode** — a proper dark theme alongside the existing colour themes
- **Mobile PWA** — service worker + manifest so the app installs as a PWA on mobile

---

## Echo (reminders module — not yet started)

See `docs/ECHO-DESIGN-DOC.md` for the full design. High-level planned features:

- RFC 5545 RRULE recurring reminders
- Multi-channel delivery: push notification (PWA), email
- Reminder templates (e.g. "rest day", "meal prep Sunday")
- Snooze and dismiss from notification

---

## Journaling module — planned

- Daily journal entries with mood tagging
- Free-form text with optional structured prompts
- Entry streaks and calendar view
- Private by default, no sharing
