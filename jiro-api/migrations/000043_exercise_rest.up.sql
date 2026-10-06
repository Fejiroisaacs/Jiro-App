-- An exercise's own rest, used when the workout's plan sets none; null rests for the account's usual.
ALTER TABLE exercises
    ADD COLUMN rest_seconds INT CHECK (rest_seconds BETWEEN 15 AND 600);
