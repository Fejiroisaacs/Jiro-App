-- Admin access is a property of a user, not a shared password.
ALTER TABLE users ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- Partial index: admins are a handful of rows out of the whole table.
CREATE INDEX idx_users_is_admin ON users (id) WHERE is_admin;
