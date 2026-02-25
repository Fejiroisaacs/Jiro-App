CREATE TABLE analytics_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  event       VARCHAR(100) NOT NULL,
  properties  JSONB,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_analytics_event      ON analytics_events(event);
CREATE INDEX idx_analytics_user       ON analytics_events(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_analytics_occurred   ON analytics_events(occurred_at DESC);
