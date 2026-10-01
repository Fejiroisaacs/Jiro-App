-- The split an imported copy came from, so importing it again opens that copy instead of making another.
ALTER TABLE splits ADD COLUMN source_split_id UUID REFERENCES splits(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX idx_splits_user_source ON splits (user_id, source_split_id) WHERE source_split_id IS NOT NULL;
