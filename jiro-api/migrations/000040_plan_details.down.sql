ALTER TABLE session_exercises
    DROP COLUMN IF EXISTS notes,
    DROP COLUMN IF EXISTS rest_seconds,
    DROP COLUMN IF EXISTS target_rpe,
    DROP COLUMN IF EXISTS target_reps_max;

ALTER TABLE routine_items
    DROP COLUMN IF EXISTS notes,
    DROP COLUMN IF EXISTS rest_seconds,
    DROP COLUMN IF EXISTS target_rpe,
    DROP COLUMN IF EXISTS target_reps_max;
