ALTER TABLE splits ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private'
  CHECK (visibility IN ('private', 'public'));

ALTER TABLE splits ADD COLUMN tags TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX idx_splits_public ON splits(visibility, created_at DESC)
  WHERE visibility = 'public';

CREATE INDEX idx_splits_tags ON splits USING GIN(tags);
