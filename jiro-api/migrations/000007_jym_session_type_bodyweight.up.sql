-- Add session type to sessions (normal / deload / test)
ALTER TABLE sessions
  ADD COLUMN session_type VARCHAR(20) NOT NULL DEFAULT 'normal'
  CHECK (session_type IN ('normal', 'deload', 'test'));

-- Body weight tracking
CREATE TABLE body_weights (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recorded_at DATE        NOT NULL,
  weight_kg   DECIMAL(5,2) NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, recorded_at)
);
CREATE INDEX idx_body_weights_user_date ON body_weights(user_id, recorded_at DESC);
