DROP INDEX IF EXISTS idx_users_username;

ALTER TABLE users
  DROP COLUMN IF EXISTS bio,
  DROP COLUMN IF EXISTS email_verified,
  DROP COLUMN IF EXISTS display_name,
  DROP COLUMN IF EXISTS username;
