-- Record types (J16): a set names the records it set. pr_kind is the top one, pr_kinds all of them in rank order.
ALTER TABLE session_sets DROP CONSTRAINT IF EXISTS session_sets_pr_kind_check;
ALTER TABLE session_sets
    ADD CONSTRAINT session_sets_pr_kind_check
        CHECK (pr_kind IN ('weight', 'e1rm', 'reps', 'hold', 'distance', 'pace')),
    ADD COLUMN pr_kinds TEXT[] NOT NULL DEFAULT '{}'
        CHECK (pr_kinds <@ ARRAY['weight', 'e1rm', 'reps', 'hold', 'distance', 'pace']::TEXT[]);

-- Existing distance records keep their kind; cmd/rerate-prs fills in the rest.
UPDATE session_sets SET pr_kinds = ARRAY[pr_kind] WHERE pr_kind IS NOT NULL;
