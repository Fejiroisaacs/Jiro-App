DO $$
BEGIN
    EXECUTE format(
        'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM jiro_app',
        current_user
    );
END
$$;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM jiro_app;
REVOKE USAGE ON SCHEMA public FROM jiro_app;

DO $$
BEGIN
    EXECUTE format('REVOKE CONNECT ON DATABASE %I FROM jiro_app', current_database());
END
$$;

DROP ROLE IF EXISTS jiro_app;
