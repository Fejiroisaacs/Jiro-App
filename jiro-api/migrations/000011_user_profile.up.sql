-- Add profile fields to users table
ALTER TABLE users
  ADD COLUMN username       VARCHAR(30)  UNIQUE,
  ADD COLUMN display_name   VARCHAR(100),
  ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN bio            TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username);
