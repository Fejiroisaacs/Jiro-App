CREATE TABLE split_shares (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  split_id   UUID NOT NULL REFERENCES splits(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ  -- NULL = never expires
);

CREATE INDEX idx_split_shares_split      ON split_shares(split_id);
CREATE INDEX idx_split_shares_created_by ON split_shares(created_by);
