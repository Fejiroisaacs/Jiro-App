DROP INDEX IF EXISTS idx_splits_user_source;
ALTER TABLE splits DROP COLUMN IF EXISTS source_split_id;
