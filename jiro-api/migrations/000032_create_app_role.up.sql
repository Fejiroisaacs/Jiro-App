-- Least-privilege role for the running API. It previously connected with
-- whatever admin/owner credential applies migrations, which can do
-- anything - DROP TABLE, alter other roles, read every database on the
-- instance. A leaked or SSRF'd runtime credential should only be able to
-- do what the app itself does: read and write the rows it already reads
-- and writes. DDL and role management stay with the admin connection
-- (DATABASE_URL, used by cmd/migrate and manual psql access).
--
-- This migration creates the role and its grants only. It does not set a
-- password - that's a secret, generated and stored per environment like
-- JWT_SECRET, never committed. After running this, in each environment:
--   ALTER ROLE jiro_app WITH PASSWORD '<generate one, do not commit it>';
-- then point that environment's APP_DATABASE_URL (not DATABASE_URL) at
-- jiro_app instead of the admin role.

DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'jiro_app') THEN
        CREATE ROLE jiro_app WITH LOGIN;
    END IF;
END
$$;

DO $$
BEGIN
    EXECUTE format('GRANT CONNECT ON DATABASE %I TO jiro_app', current_database());
END
$$;

GRANT USAGE ON SCHEMA public TO jiro_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO jiro_app;

-- So a future migration's new table is automatically readable/writable by
-- jiro_app without a follow-up grant - current_user is whichever admin
-- role runs migrations in this environment.
DO $$
BEGIN
    EXECUTE format(
        'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO jiro_app',
        current_user
    );
END
$$;
