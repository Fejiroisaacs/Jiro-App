ALTER TABLE session_sets
  DROP COLUMN IF EXISTS is_warmup,
  DROP COLUMN IF EXISTS exercise_note;
