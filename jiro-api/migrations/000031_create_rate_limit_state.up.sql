-- Shared, cross-instance backing store for rate limiting and login-fail
-- tracking. Both were previously in-process maps, which on Cloud Run means
-- each instance enforces its own independent limit — a client (or an
-- attacker brute-forcing logins) that lands on N instances effectively gets
-- N times the intended budget. Moving the state into Postgres, which every
-- instance already shares, closes that gap.

CREATE TABLE rate_limit_buckets (
    key TEXT PRIMARY KEY,
    tokens DOUBLE PRECISION NOT NULL,
    capacity DOUBLE PRECISION NOT NULL,
    rate_per_sec DOUBLE PRECISION NOT NULL,
    last_fill TIMESTAMPTZ NOT NULL
);

CREATE TABLE login_fail_entries (
    ip TEXT PRIMARY KEY,
    fail_count INT NOT NULL DEFAULT 0,
    last_seen TIMESTAMPTZ NOT NULL,
    blocked_until TIMESTAMPTZ
);
