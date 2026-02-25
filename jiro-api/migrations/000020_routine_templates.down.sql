-- Remove standalone templates before restoring NOT NULL constraint
DELETE FROM routines WHERE split_id IS NULL;

ALTER TABLE routines ALTER COLUMN split_id SET NOT NULL;
ALTER TABLE routines DROP COLUMN user_id;

DROP INDEX IF EXISTS idx_routines_user;
