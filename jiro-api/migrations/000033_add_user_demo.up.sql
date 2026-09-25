-- Add demo user columns
ALTER TABLE users ADD COLUMN is_demo BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN demo_anchor_at TIMESTAMPTZ;

CREATE UNIQUE INDEX users_single_demo ON users ((TRUE)) WHERE is_demo;
