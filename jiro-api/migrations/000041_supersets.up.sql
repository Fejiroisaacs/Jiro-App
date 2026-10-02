-- Adjacent items with the same group number are one superset (a circuit with three or more).
ALTER TABLE routine_items ADD COLUMN superset_group INT CHECK (superset_group BETWEEN 1 AND 100);
ALTER TABLE session_exercises ADD COLUMN superset_group INT;
