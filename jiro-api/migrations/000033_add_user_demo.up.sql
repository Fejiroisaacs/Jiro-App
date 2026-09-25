-- F1 "Try the demo": one shared, look-only sample account.
--
-- is_demo marks it. The write gate (middleware.RequireWriteAccess) reads it
-- in the same query as email_verified and refuses every non-GET request from
-- it with 403 DEMO_READ_ONLY.
--
-- demo_anchor_at is when the sample data's dates were last lined up with the
-- calendar. On each demo login DemoService.Login slides every demo row
-- forward by the whole days passed since then, so the data always looks
-- recent. NULL on every other user.
--
-- The partial unique index allows at most one demo user; the seed runs
-- under an advisory lock as well, so this is the backstop.
--
-- No grants needed: jiro_app (000032) has table-level SELECT/INSERT/UPDATE/
-- DELETE on users, which covers new columns, and pg_advisory_xact_lock is
-- executable by PUBLIC.

ALTER TABLE users ADD COLUMN is_demo BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN demo_anchor_at TIMESTAMPTZ;

CREATE UNIQUE INDEX users_single_demo ON users ((TRUE)) WHERE is_demo;
