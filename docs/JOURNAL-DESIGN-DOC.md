# Technical Design Document: Journaly Module

## 1. Summary

Journaly is a journaling module within the Jiro platform. It supports two modes:

- **Private** — traditional solo journaling. Entries are only visible to the author.
- **Group** — a shared space where a small group of invited users can write and read each other's entries (think long-distance friends keeping a joint journal). Groups are created and owned by one user, membership is by email invite.

Features: free-form entries, fixed + custom mood tags, image attachments (up to 3 per entry, 10 MB each), entry streaks, calendar view, and collections for thematic grouping.

---

## 2. Architecture

Journal is a spoke module in the Jiro hub. All endpoints are served by the Go (Gin) API under `/api/v1/journal/`. Data is stored in PostgreSQL. Entry images are stored in Cloudflare R2 via presigned URLs.

Object key pattern: `journal/{user_id}/{entry_id}/{uuid}.{ext}`

---

## 3. Data Schema (PostgreSQL)

### Migration: `000025_create_journal.up.sql`

```sql
-- ─── Private + Group entries ──────────────────────────────────────────────

CREATE TABLE journal_entries (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    group_id   UUID,                           -- NULL = private entry
    title      VARCHAR(255),
    body       TEXT NOT NULL,
    mood       VARCHAR(32),                    -- fixed enum value or NULL
    tags       TEXT[] DEFAULT '{}',            -- free-form custom tags
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_journal_entries_user  ON journal_entries(user_id, created_at DESC);
CREATE INDEX idx_journal_entries_group ON journal_entries(group_id, created_at DESC);

-- ─── Entry images ──────────────────────────────────────────────────────────

CREATE TABLE journal_images (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_id   UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    object_key VARCHAR(512) NOT NULL,
    file_url   VARCHAR(512) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_journal_images_entry ON journal_images(entry_id);

-- ─── Group journaling ──────────────────────────────────────────────────────

CREATE TABLE journal_groups (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name       VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_journal_groups_owner ON journal_groups(owner_id);

CREATE TABLE journal_group_members (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id   UUID NOT NULL REFERENCES journal_groups(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    invited_by UUID NOT NULL REFERENCES users(id),
    status     VARCHAR(16) NOT NULL DEFAULT 'pending', -- 'pending' | 'active'
    joined_at  TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(group_id, user_id)
);

CREATE INDEX idx_journal_group_members_group ON journal_group_members(group_id);
CREATE INDEX idx_journal_group_members_user  ON journal_group_members(user_id);

CREATE TABLE journal_group_invites (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id   UUID NOT NULL REFERENCES journal_groups(id) ON DELETE CASCADE,
    email      VARCHAR(255) NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_journal_group_invites_group ON journal_group_invites(group_id);

-- Add FK from entries to groups (after both tables exist)
ALTER TABLE journal_entries
    ADD CONSTRAINT fk_journal_entries_group
    FOREIGN KEY (group_id) REFERENCES journal_groups(id) ON DELETE CASCADE;

-- ─── Collections ───────────────────────────────────────────────────────────

CREATE TABLE journal_collections (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name            VARCHAR(100) NOT NULL,
    description     TEXT,
    cover_image_url VARCHAR(512),
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_journal_collections_user ON journal_collections(user_id);

-- Many-to-many: one entry can belong to multiple collections
CREATE TABLE journal_collection_entries (
    collection_id UUID NOT NULL REFERENCES journal_collections(id) ON DELETE CASCADE,
    entry_id      UUID NOT NULL REFERENCES journal_entries(id)     ON DELETE CASCADE,
    added_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (collection_id, entry_id)
);

CREATE INDEX idx_journal_collection_entries_entry ON journal_collection_entries(entry_id);
```

### `000025_create_journal.down.sql`

```sql
ALTER TABLE journal_entries DROP CONSTRAINT IF EXISTS fk_journal_entries_group;
DROP TABLE IF EXISTS journal_collection_entries;
DROP TABLE IF EXISTS journal_collections;
DROP TABLE IF EXISTS journal_group_invites;
DROP TABLE IF EXISTS journal_group_members;
DROP TABLE IF EXISTS journal_images;
DROP TABLE IF EXISTS journal_entries;
DROP TABLE IF EXISTS journal_groups;
```

### Fixed Mood Values

Validated at the API layer (not a DB enum, easier to extend later):

`happy` · `calm` · `energised` · `grateful` · `anxious` · `sad` · `tired` · `stressed`

---

## 4. API Endpoints

All routes under `protected.Group("/journal")` (auth + rate-limit middleware).

### Private Entries

| Method   | Path             | Description                              |
| -------- | ---------------- | ---------------------------------------- |
| `POST`   | `/entries`       | Create private entry                     |
| `GET`    | `/entries`       | List own entries (filters below)         |
| `GET`    | `/entries/:id`   | Get entry with images                    |
| `PUT`    | `/entries/:id`   | Update entry                             |
| `DELETE` | `/entries/:id`   | Delete entry + cascade images + R2 clean |
| `GET`    | `/streak`        | Current + longest streak                 |
| `GET`    | `/calendar`      | Days with entries (`?year=&month=`)      |

**List query params:** `?q=` `?mood=` `?tag=` `?from=` `?to=` `?limit=` `?offset=`

### Images (private + group entries)

| Method   | Path                          | Description                    |
| -------- | ----------------------------- | ------------------------------ |
| `POST`   | `/entries/:id/images/presign` | Get presigned upload URL       |
| `POST`   | `/entries/:id/images/confirm` | Confirm upload, store row      |
| `DELETE` | `/images/:image_id`           | Delete image + R2 object       |

### Groups

| Method   | Path                              | Description                              |
| -------- | --------------------------------- | ---------------------------------------- |
| `POST`   | `/groups`                         | Create a group                           |
| `GET`    | `/groups`                         | List groups user belongs to              |
| `GET`    | `/groups/:id`                     | Group details + member list              |
| `PUT`    | `/groups/:id`                     | Rename group (owner only)                |
| `DELETE` | `/groups/:id`                     | Delete group (owner only)                |
| `POST`   | `/groups/:id/invite`              | Invite user by email                     |
| `DELETE` | `/groups/:id/members/:user_id`    | Remove member (owner) or leave (self)    |
| `POST`   | `/groups/:id/entries`             | Create entry in group                    |
| `GET`    | `/groups/:id/entries`             | List all members' entries in group       |
| `GET`    | `/groups/:id/calendar`            | Group calendar view                      |

### Invite Acceptance (public route — no auth required)

| Method | Path           | Description                                   |
| ------ | -------------- | --------------------------------------------- |
| `POST` | `/groups/join` | Accept invite via `?token=<raw>` in query     |

### Collections

| Method   | Path                                  | Description                              |
| -------- | ------------------------------------- | ---------------------------------------- |
| `POST`   | `/collections`                        | Create collection                        |
| `GET`    | `/collections`                        | List user's collections (+ entry count)  |
| `GET`    | `/collections/:id`                    | Get collection + its entries             |
| `PUT`    | `/collections/:id`                    | Rename / update description              |
| `DELETE` | `/collections/:id`                    | Delete collection (entries kept)         |
| `POST`   | `/collections/:id/entries`            | Add entry `{ "entry_id": "..." }`        |
| `DELETE` | `/collections/:id/entries/:entry_id`  | Remove entry from collection             |

---

## 5. Group Invite Flow

```
Owner POSTs /journal/groups/:id/invite  { "email": "friend@example.com" }
  │
  ├─ Look up users table by email
  │    ├─ NOT FOUND → 404 { code: "USER_NOT_FOUND", message: "No Jiro account found with that email." }
  │    └─ FOUND →
  │         ├─ Already an active member? → 409 { code: "ALREADY_MEMBER" }
  │         ├─ Generate crypto/rand 32-byte token → hex raw → SHA-256 hash stored
  │         ├─ INSERT journal_group_invites (token_hash, 7-day expiry)
  │         ├─ INSERT journal_group_members (status='pending')
  │         ├─ Send invite email to friend:
  │         │    "You've been invited to join [Group Name] on Jiro"
  │         │    Link: https://app.jiro.com/journal/join?token=<raw_token>
  │         ├─ Send confirmation email to owner:
  │         │    "Invite sent to friend@example.com"
  │         └─ Return 200 { "message": "Invite sent." }

Friend clicks link → Angular /journal/join?token=xxx
  │
  ├─ Not logged in → redirect to /login?redirect=/journal/join?token=xxx
  └─ Logged in → POST /api/v1/journal/groups/join?token=xxx
       ├─ SHA-256 hash token → look up journal_group_invites → check expiry
       ├─ UPDATE journal_group_members SET status='active', joined_at=NOW()
       ├─ DELETE journal_group_invites row
       └─ 200 { "group_id": "...", "group_name": "..." }  → frontend redirects to /journal/groups/:id
```

---

## 6. Streak Logic

Computed at query time — no materialized cache needed at this scale.

```sql
WITH daily AS (
    -- count only private entries toward personal streak
    SELECT DISTINCT DATE(created_at AT TIME ZONE 'UTC') AS day
    FROM journal_entries
    WHERE user_id = $1
      AND group_id IS NULL
),
numbered AS (
    SELECT day, ROW_NUMBER() OVER (ORDER BY day DESC) AS rn
    FROM daily
),
streaks AS (
    SELECT day, rn,
           (day - (rn || ' days')::INTERVAL)::DATE AS grp
    FROM numbered
)
SELECT COUNT(*) AS streak_len
FROM streaks
WHERE grp = (SELECT grp FROM streaks ORDER BY day DESC LIMIT 1);
```

`GET /journal/streak` response:

```json
{
  "current_streak": 7,
  "longest_streak": 21,
  "total_entries": 143,
  "last_entry_at": "2026-02-27T08:00:00Z"
}
```

---

## 7. Image Upload Flow

Mirrors the existing presign pattern used for avatars and session attachments.

1. **Presign** — `POST /journal/entries/:id/images/presign` with `{ content_type, content_length }`
   - Validate: entry exists + belongs to user, current image count < 3, type is `image/jpeg` / `image/png` / `image/webp`, size ≤ 10 MB
   - Returns `{ upload_url, object_key }`
2. **Upload** — client PUTs file directly to R2 using the presigned URL (no backend involved)
3. **Confirm** — `POST /journal/entries/:id/images/confirm` with `{ object_key }`
   - Verify key has prefix `journal/{user_id}/{entry_id}/`
   - INSERT `journal_images` row
   - Returns full image object
4. **Delete entry** — handler iterates `journal_images`, calls `storage.DeleteObject` for each, then deletes the entry (DB cascade removes image rows)

---

## 8. Backend File Structure

```
jiro-api/
  internal/
    models/
      journal.go          — structs: JournalEntry, JournalImage, JournalGroup,
                            JournalGroupMember, JournalCollection, + all request/response types
    services/
      journal.go          — JournalService: entries CRUD, streaks, calendar,
                            groups, invite tokens, collections
    handlers/
      journal.go          — JournalHandler: all HTTP handlers
    router/
      router.go           — add /journal route group (edit existing file)
  migrations/
    000025_create_journal.up.sql
    000025_create_journal.down.sql
```

---

## 9. Frontend Architecture

```
jiro-ui/src/app/features/journal/
  journal-home/           — entry list + streak banner + calendar
                            tabs: Private | Groups | Collections
  journal-editor/         — create/edit entry: mood picker, tag input, image upload,
                            "add to collection" selector
  journal-group/          — group feed (all members' entries) + invite management
  journal-join/           — token-accept landing (/journal/join?token=xxx)
  journal-collection/     — collection detail: entry list filtered to collection
  journal-quick-nav/      — tab nav: Home | Groups | New Entry

jiro-ui/src/app/core/services/
  journal.service.ts      — all HTTP calls + TypeScript interfaces
```

### Routes (`app.routes.ts`)

```typescript
{ path: 'journal',                  loadComponent: () => import('./features/journal/journal-home/journal-home').then(m => m.JournalHomeComponent) },
{ path: 'journal/new',              loadComponent: () => import('./features/journal/journal-editor/journal-editor').then(m => m.JournalEditorComponent) },
{ path: 'journal/:id/edit',         loadComponent: () => import('./features/journal/journal-editor/journal-editor').then(m => m.JournalEditorComponent) },
{ path: 'journal/groups/:id',       loadComponent: () => import('./features/journal/journal-group/journal-group').then(m => m.JournalGroupComponent) },
{ path: 'journal/collections/:id',  loadComponent: () => import('./features/journal/journal-collection/journal-collection').then(m => m.JournalCollectionComponent) },
// Public — no auth guard; component handles redirect to login if needed
{ path: 'journal/join',             loadComponent: () => import('./features/journal/journal-join/journal-join').then(m => m.JournalJoinComponent) },
```

### Key UI Components

| Component | Description |
| --- | --- |
| Streak banner | Flame icon + "X day streak" at top of home |
| Mode tabs | Private / Groups / Collections switcher on home |
| Mood picker | Horizontal scroll row of 8 emoji+label chips, single select |
| Tag input | Type-and-enter chip input for free-form custom tags |
| Calendar | Month grid; days with entries highlighted in `--color-primary`; click to filter |
| Entry card | Date, title or body excerpt, mood chip, tags, image count badge |
| Group feed | Entry cards with author name; all active members can read |
| Invite input | Email field + "Send Invite" button; inline "No account found" error |
| Collection card | Name, description, entry count, cover image or first-entry thumbnail |
| Add to collection | Multi-select popover on entry cards / editor |

---

## 10. Cross-Cutting Concerns

| Concern | Approach |
| --- | --- |
| Multi-tenancy | All private queries filter by `user_id`; group queries verify active membership |
| Group write access | Only `active` members and the owner may create entries in a group |
| Entry ownership | Handler checks `entry.user_id == authenticated user` before update/delete — even in groups |
| Image security | Object key prefix verified as `journal/{user_id}/{entry_id}/` on confirm |
| Invite token | `crypto/rand` 32 bytes → hex raw → SHA-256 stored; same pattern as refresh tokens |
| Invite expiry | 7 days |
| User-not-found on invite | Returns 404 (intentional — owner typed the email explicitly, needs clear feedback) |
| Cascade | `ON DELETE CASCADE` on all child tables; R2 objects deleted by handler before DB delete |
| Mood validation | Checked against fixed set in the handler, not a DB enum (easier to extend) |
| Body required | `NOT NULL` in DB + `binding:"required"` in Go handler |

---

## 11. UI/UX & Mobile Optimization Guidelines

### A. Core Aesthetics & Theming
- **Palette**: Earthy, calming tones (warm off-whites, soft sand, deep forest greens) to reflect the reflective nature of journaling.
- **Typography**: Clean, highly readable sans-serif for UI elements, paired with an elegant serif or structured sans for entry bodies to enhance reading focus.
- **Micro-animations**: Subtle, organic scaling on mood chips and gentle page transitions. Keep interactions smooth and responsive.

### B. Mobile-First & Responsiveness
- **Touch Targets**: All interactive elements (mood chips, custom tags, FABs) must be at least 44x44px for easy thumb tapping.
- **Layout Adjustments**:
  - Horizontal scrolling for the mood picker to save vertical space.
  - The calendar view should collapse into a streamlined, swipeable week view or single-column month view on mobile.
  - Quick navigation shifts to a sticky bottom navigation bar layout on mobile for ergonomic thumb reach.
- **Editor Experience**: On mobile, the text editor must occupy the full screen (immersive mode). The keyboard should push controls (mood, tags, attachments) up into a collapsible toolbar just above the keyboard.
- **Image Previews**: Responsive grid for attached images that stacks gracefully on mobile screens, allowing swipeable lightboxes for full-screen viewing.

### C. Accessibility & Inclusivity
- **Contrast**: Ensure WCAG AA compliance (minimum 4.5:1 text contrast) across all themes.
- **Focus Management & Navigation**: Full keyboard navigation support for tabbing through the editor inputs, mood selections, and entry feed. 
- **Screen Readers**: Use appropriate dynamic aria-labels on all icon-only buttons (like image uploads, streak flame icon, or bottom nav icons) and context announcements for new entries.
