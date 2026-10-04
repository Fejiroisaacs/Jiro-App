-- One fixed muscle list: stored names map onto it ignoring case (unknown ones become Other), and an exercise
-- gains secondary muscles, which only organise it (every count stays on the primary).
UPDATE exercises SET muscle_group = CASE LOWER(TRIM(muscle_group))
    WHEN 'chest' THEN 'Chest'
    WHEN 'back' THEN 'Back'
    WHEN 'shoulders' THEN 'Shoulders'
    WHEN 'biceps' THEN 'Biceps'
    WHEN 'triceps' THEN 'Triceps'
    WHEN 'legs' THEN 'Legs'
    WHEN 'quadriceps' THEN 'Legs'
    WHEN 'quads' THEN 'Legs'
    WHEN 'hamstrings' THEN 'Legs'
    WHEN 'calves' THEN 'Legs'
    WHEN 'glutes' THEN 'Glutes'
    WHEN 'core' THEN 'Core'
    WHEN 'abs' THEN 'Core'
    WHEN 'cardio' THEN 'Cardio'
    WHEN '' THEN NULL
    ELSE 'Other'
  END
WHERE muscle_group IS NOT NULL;

ALTER TABLE exercises
    ADD COLUMN secondary_muscles TEXT[] NOT NULL DEFAULT '{}',
    ADD CONSTRAINT exercises_muscle_group_listed CHECK (muscle_group IS NULL OR muscle_group IN
        ('Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Legs', 'Glutes', 'Core', 'Cardio', 'Other')),
    ADD CONSTRAINT exercises_secondary_muscles_listed CHECK (secondary_muscles <@
        ARRAY['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Legs', 'Glutes', 'Core', 'Cardio', 'Other']::TEXT[]);
