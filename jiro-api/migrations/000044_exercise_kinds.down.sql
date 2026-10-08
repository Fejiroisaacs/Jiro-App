-- Sets without reps (duration, distance) can't survive the NOT NULL; they go.
DELETE FROM session_sets WHERE reps_performed IS NULL;
ALTER TABLE session_exercises DROP COLUMN IF EXISTS target_distance_m;
ALTER TABLE routine_items DROP COLUMN IF EXISTS target_distance_m;
ALTER TABLE session_sets
    DROP COLUMN IF EXISTS pr_kind,
    DROP COLUMN IF EXISTS body_weight_kg,
    DROP COLUMN IF EXISTS distance_m,
    DROP COLUMN IF EXISTS duration_s,
    ALTER COLUMN reps_performed SET NOT NULL;
ALTER TABLE exercises DROP COLUMN IF EXISTS kind;
