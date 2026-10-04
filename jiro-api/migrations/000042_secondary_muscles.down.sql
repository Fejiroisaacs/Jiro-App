-- Merged names stay merged.
ALTER TABLE exercises
    DROP CONSTRAINT IF EXISTS exercises_secondary_muscles_listed,
    DROP CONSTRAINT IF EXISTS exercises_muscle_group_listed,
    DROP COLUMN IF EXISTS secondary_muscles;
