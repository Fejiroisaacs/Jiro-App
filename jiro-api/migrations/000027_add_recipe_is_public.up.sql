ALTER TABLE recipes ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX idx_recipes_public ON recipes(created_at DESC) WHERE is_public = TRUE;
