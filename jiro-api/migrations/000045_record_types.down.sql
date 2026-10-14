ALTER TABLE session_sets DROP COLUMN IF EXISTS pr_kinds;
ALTER TABLE session_sets DROP CONSTRAINT IF EXISTS session_sets_pr_kind_check;
UPDATE session_sets SET pr_kind = NULL WHERE pr_kind NOT IN ('distance', 'pace');
ALTER TABLE session_sets ADD CONSTRAINT session_sets_pr_kind_check CHECK (pr_kind IN ('distance', 'pace'));
