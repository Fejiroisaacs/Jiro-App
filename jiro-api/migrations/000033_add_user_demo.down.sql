-- Removes the demo flag; the demo user stays as an ordinary account (DELETE FROM users WHERE is_demo first if wanted).
DROP INDEX IF EXISTS users_single_demo;
ALTER TABLE users DROP COLUMN IF EXISTS demo_anchor_at;
ALTER TABLE users DROP COLUMN IF EXISTS is_demo;
