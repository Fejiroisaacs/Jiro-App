CREATE TABLE ledger_accounts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       VARCHAR(100) NOT NULL,
  type       VARCHAR(20) NOT NULL CHECK (type IN ('checking','savings','credit','investment','cash')),
  currency   CHAR(3) NOT NULL DEFAULT 'USD',
  balance    NUMERIC(15,2) NOT NULL DEFAULT 0,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ledger_accounts_user ON ledger_accounts(user_id);

CREATE TABLE ledger_categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       VARCHAR(100) NOT NULL,
  type       VARCHAR(10) NOT NULL CHECK (type IN ('income','expense')),
  color      CHAR(7),
  parent_id  UUID REFERENCES ledger_categories(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

CREATE INDEX idx_ledger_categories_user ON ledger_categories(user_id);

CREATE TABLE ledger_transactions (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id             UUID NOT NULL REFERENCES ledger_accounts(id) ON DELETE CASCADE,
  category_id            UUID REFERENCES ledger_categories(id) ON DELETE SET NULL,
  type                   VARCHAR(10) NOT NULL CHECK (type IN ('income','expense','transfer')),
  amount                 NUMERIC(15,2) NOT NULL,
  description            VARCHAR(255) NOT NULL,
  notes                  TEXT,
  date                   DATE NOT NULL,
  is_recurring           BOOLEAN NOT NULL DEFAULT FALSE,
  recurrence_interval    VARCHAR(10) CHECK (recurrence_interval IN ('weekly','biweekly','monthly','yearly')),
  recurrence_day         INT,
  transfer_to_account_id UUID REFERENCES ledger_accounts(id) ON DELETE SET NULL,
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ledger_txn_user_date ON ledger_transactions(user_id, date DESC);
CREATE INDEX idx_ledger_txn_account   ON ledger_transactions(account_id);

CREATE TABLE ledger_budgets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES ledger_categories(id) ON DELETE CASCADE,
  amount      NUMERIC(15,2) NOT NULL,
  period      VARCHAR(10) NOT NULL CHECK (period IN ('monthly','weekly','yearly')),
  start_date  DATE NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, category_id, period)
);

CREATE INDEX idx_ledger_budgets_user ON ledger_budgets(user_id);

CREATE TABLE ledger_networth_snapshots (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assets_total      NUMERIC(15,2) NOT NULL,
  liabilities_total NUMERIC(15,2) NOT NULL,
  net_worth         NUMERIC(15,2) GENERATED ALWAYS AS (assets_total - liabilities_total) STORED,
  snapshot_date     DATE NOT NULL,
  UNIQUE(user_id, snapshot_date)
);

CREATE INDEX idx_ledger_networth_user ON ledger_networth_snapshots(user_id, snapshot_date DESC);
