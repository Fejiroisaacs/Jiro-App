-- ─── Private + Group entries ──────────────────────────────────────────────

CREATE TABLE journal_entries (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    group_id   UUID,
    title      VARCHAR(255),
    body       TEXT NOT NULL,
    mood       VARCHAR(32),
    tags       TEXT[] DEFAULT '{}',
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
    status     VARCHAR(16) NOT NULL DEFAULT 'pending',
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

-- FK from entries to groups (after both tables exist)
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

CREATE TABLE journal_collection_entries (
    collection_id UUID NOT NULL REFERENCES journal_collections(id) ON DELETE CASCADE,
    entry_id      UUID NOT NULL REFERENCES journal_entries(id)     ON DELETE CASCADE,
    added_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (collection_id, entry_id)
);

CREATE INDEX idx_journal_collection_entries_entry ON journal_collection_entries(entry_id);
