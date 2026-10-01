-- A workout's own exercise list: its order, and the plan's targets as they were when it started.
CREATE TABLE session_exercises (
    session_id  UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
    position    INT  NOT NULL,
    target_sets INT,
    target_reps INT,
    PRIMARY KEY (session_id, exercise_id)
);

-- Backfill 1: every workout's logged exercises, in the order first done; targets from its routine's current items.
WITH first_items AS (
    SELECT DISTINCT ON (routine_id, exercise_id) routine_id, exercise_id, target_sets, target_reps
    FROM routine_items
    ORDER BY routine_id, exercise_id, order_index, id
), logged AS (
    SELECT session_id, exercise_id,
           ROW_NUMBER() OVER (PARTITION BY session_id ORDER BY MIN(created_at), exercise_id) AS position
    FROM session_sets
    GROUP BY session_id, exercise_id
)
INSERT INTO session_exercises (session_id, exercise_id, position, target_sets, target_reps)
SELECT l.session_id, l.exercise_id, l.position, fi.target_sets, fi.target_reps
FROM logged l
JOIN sessions s ON s.id = l.session_id
LEFT JOIN first_items fi ON fi.routine_id = s.routine_id AND fi.exercise_id = l.exercise_id;

-- Backfill 2: an open workout's plan exercises not logged yet, after the logged ones.
WITH first_items AS (
    SELECT DISTINCT ON (routine_id, exercise_id) routine_id, exercise_id, target_sets, target_reps, order_index, id
    FROM routine_items
    ORDER BY routine_id, exercise_id, order_index, id
)
INSERT INTO session_exercises (session_id, exercise_id, position, target_sets, target_reps)
SELECT s.id, fi.exercise_id,
       COALESCE((SELECT MAX(x.position) FROM session_exercises x WHERE x.session_id = s.id), 0)
         + ROW_NUMBER() OVER (PARTITION BY s.id ORDER BY fi.order_index, fi.id),
       fi.target_sets, fi.target_reps
FROM sessions s
JOIN first_items fi ON fi.routine_id = s.routine_id
WHERE s.ended_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM session_exercises x WHERE x.session_id = s.id AND x.exercise_id = fi.exercise_id);
