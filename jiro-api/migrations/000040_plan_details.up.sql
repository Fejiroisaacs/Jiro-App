-- A plan item's rep range top, target RPE, rest and cue; the workout's list keeps its own copy from the start.
ALTER TABLE routine_items
    ADD COLUMN target_reps_max INT CHECK (target_reps_max BETWEEN 1 AND 1000),
    ADD COLUMN target_rpe      INT CHECK (target_rpe BETWEEN 6 AND 10),
    ADD COLUMN rest_seconds    INT CHECK (rest_seconds BETWEEN 15 AND 600),
    ADD COLUMN notes           TEXT CHECK (char_length(notes) <= 140);

ALTER TABLE session_exercises
    ADD COLUMN target_reps_max INT,
    ADD COLUMN target_rpe      INT,
    ADD COLUMN rest_seconds    INT,
    ADD COLUMN notes           TEXT;
