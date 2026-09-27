-- Copyable group invite links for any signed-in account until expired or revoked; only the token hash is stored.
CREATE TABLE IF NOT EXISTS journal_group_invite_links (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id   UUID NOT NULL REFERENCES journal_groups(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_journal_group_invite_links_group
    ON journal_group_invite_links(group_id);

-- Grant explicitly: 000032's default privileges only cover tables made by the role that ran it.
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'jiro_app') THEN
        GRANT SELECT, INSERT, UPDATE, DELETE ON journal_group_invite_links TO jiro_app;
    END IF;
END
$$;
