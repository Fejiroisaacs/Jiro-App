-- Add user_id to routines so standalone templates have a direct owner,
-- then make split_id optional (NULL = standalone template).

ALTER TABLE routines
  ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;

-- Backfill user_id from the owning split
UPDATE routines r
SET user_id = s.user_id
FROM splits s
WHERE s.id = r.split_id;

ALTER TABLE routines ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE routines ALTER COLUMN split_id DROP NOT NULL;

CREATE INDEX idx_routines_user ON routines(user_id);
