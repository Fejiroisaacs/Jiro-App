# Upcoming Features

Planned features across all Jiro modules, in rough priority order.

---

## Jym

### Other Jym Features

- **Deload auto-suggest** — after N consecutive sessions without a PR or with declining volume, suggest scheduling a deload week

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

## Base / Cross-module

- **Dashboard widgets** — customisable cards on the dashboard: last workout, recent recipes, body weight trend, upcoming reminders
- **Global search** — search across recipes, exercises, and sessions from anywhere in the app
- **Data export** — full account export as JSON (all modules)

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
