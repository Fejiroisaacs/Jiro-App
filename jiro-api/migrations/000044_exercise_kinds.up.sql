-- Exercise types (J21): bodyweight ± load, duration and distance + time beside weight × reps.
ALTER TABLE exercises
    ADD COLUMN kind TEXT NOT NULL DEFAULT 'weight_reps'
        CHECK (kind IN ('weight_reps', 'bodyweight', 'duration', 'distance'));

-- A duration or distance set has no reps; weight stays the load (0 for none).
ALTER TABLE session_sets
    ALTER COLUMN reps_performed DROP NOT NULL,
    ADD COLUMN duration_s INT CHECK (duration_s BETWEEN 1 AND 86400),
    ADD COLUMN distance_m NUMERIC(9,1) CHECK (distance_m > 0),
    -- The body weight a bodyweight set counts, copied from body_weights (latest on or before the workout's day).
    ADD COLUMN body_weight_kg NUMERIC(5,2),
    ADD COLUMN pr_kind TEXT CHECK (pr_kind IN ('distance', 'pace'));

-- A distance plan's target; a duration plan keeps its seconds in target_reps.
ALTER TABLE routine_items ADD COLUMN target_distance_m NUMERIC(9,1) CHECK (target_distance_m > 0);
ALTER TABLE session_exercises ADD COLUMN target_distance_m NUMERIC(9,1) CHECK (target_distance_m > 0);
