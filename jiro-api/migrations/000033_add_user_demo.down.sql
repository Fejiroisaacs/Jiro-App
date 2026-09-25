-- Removes the demo flag. The demo user itself (demo@jiro.invalid) and its
-- sample rows stay behind as an ordinary account; delete it first if wanted:
--   DELETE FROM users WHERE is_demo;
DROP INDEX IF EXISTS users_single_demo;
ALTER TABLE users DROP COLUMN IF EXISTS demo_anchor_at;
ALTER TABLE users DROP COLUMN IF EXISTS is_demo;
