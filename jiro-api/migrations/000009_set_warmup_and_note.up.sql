ALTER TABLE session_sets
  ADD COLUMN is_warmup    BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN exercise_note TEXT;
