-- Copyable group invite links. Unlike journal_group_invites (one row per
-- emailed address, redeemable only by that address), a link admits any
-- signed-in Jiro account that holds it, until it expires or the owner
-- revokes it. Only a SHA-256 hash of the token is stored, as with email
-- invites and refresh tokens: the raw token is shown to the owner once.
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

-- 000032's default privileges only cover tables created by the role that ran
-- it; grant explicitly so this works whichever admin role applies it.
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'jiro_app') THEN
        GRANT SELECT, INSERT, UPDATE, DELETE ON journal_group_invite_links TO jiro_app;
    END IF;
END
$$;
