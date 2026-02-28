DROP INDEX IF EXISTS idx_recipes_public;
ALTER TABLE recipes DROP COLUMN IF EXISTS is_public;
