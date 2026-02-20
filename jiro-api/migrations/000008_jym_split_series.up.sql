-- Split series: tracks a structured "run" through a split program
CREATE TABLE split_series (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  split_id         UUID        NOT NULL REFERENCES splits(id) ON DELETE CASCADE,
  name             VARCHAR(100) NOT NULL,
  duration_type    VARCHAR(20) NOT NULL CHECK (duration_type IN ('weeks', 'sessions', 'open')),
  target_weeks     INT,
  target_sessions  INT,
  started_at       TIMESTAMPTZ DEFAULT NOW(),
  ended_at         TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_split_series_user  ON split_series(user_id, started_at DESC);
CREATE INDEX idx_split_series_split ON split_series(split_id);

-- Link sessions to a series (optional)
ALTER TABLE sessions
  ADD COLUMN series_id UUID REFERENCES split_series(id) ON DELETE SET NULL;
CREATE INDEX idx_sessions_series ON sessions(series_id);
