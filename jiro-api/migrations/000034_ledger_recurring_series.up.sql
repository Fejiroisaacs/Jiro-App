-- Real recurring series: a head has recurrence_next_date; copies point back via recurrence_source_id.

ALTER TABLE ledger_transactions
  ADD COLUMN IF NOT EXISTS recurrence_next_date DATE,
  ADD COLUMN IF NOT EXISTS recurrence_source_id UUID REFERENCES ledger_transactions(id) ON DELETE SET NULL;

-- One occurrence per series per date (source leg only), so racing catch-ups stay idempotent.
CREATE UNIQUE INDEX IF NOT EXISTS ledger_txn_recurrence_occurrence
  ON ledger_transactions (recurrence_source_id, date)
  WHERE recurrence_source_id IS NOT NULL AND NOT (type = 'transfer' AND amount > 0);

-- The catch-up asks "which of this user's series are due by today?".
CREATE INDEX IF NOT EXISTS ledger_txn_recurrence_due
  ON ledger_transactions (user_id, recurrence_next_date)
  WHERE recurrence_next_date IS NOT NULL;

-- Existing flagged copies: group each series, keep the latest as head, unflag the rest.
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY user_id, account_id, type, description, recurrence_interval, transfer_to_account_id
           ORDER BY date DESC, created_at DESC, id DESC
         ) AS rn
  FROM ledger_transactions
  WHERE is_recurring
    AND recurrence_interval IS NOT NULL
    AND NOT (type = 'transfer' AND amount > 0)
)
UPDATE ledger_transactions t
SET is_recurring = FALSE
FROM ranked r
WHERE r.id = t.id AND r.rn > 1;

-- A flagged row with no interval never meant anything; leave it unflagged.
UPDATE ledger_transactions
SET is_recurring = FALSE
WHERE is_recurring AND recurrence_interval IS NULL
  AND NOT (type = 'transfer' AND amount > 0);

-- Anchor day for monthly and yearly heads: the head's own day of the month.
UPDATE ledger_transactions
SET recurrence_day = LEAST(GREATEST(COALESCE(recurrence_day, EXTRACT(DAY FROM date)::int), 1), 31)
WHERE is_recurring
  AND recurrence_interval IN ('monthly', 'yearly')
  AND NOT (type = 'transfer' AND amount > 0);

-- Arm each head from today; earlier months are not back-filled.
UPDATE ledger_transactions t
SET recurrence_next_date = t.date + (7 * GREATEST(1, CEIL((CURRENT_DATE - t.date)::numeric / 7)))::int
WHERE t.is_recurring AND t.recurrence_interval = 'weekly'
  AND NOT (t.type = 'transfer' AND t.amount > 0);

UPDATE ledger_transactions t
SET recurrence_next_date = t.date + (14 * GREATEST(1, CEIL((CURRENT_DATE - t.date)::numeric / 14)))::int
WHERE t.is_recurring AND t.recurrence_interval = 'biweekly'
  AND NOT (t.type = 'transfer' AND t.amount > 0);

UPDATE ledger_transactions t
SET recurrence_next_date = (
  SELECT min(c.d)
  FROM generate_series(1, 2400) AS k,
       LATERAL (SELECT (date_trunc('month', t.date)
                        + make_interval(months => k * CASE t.recurrence_interval WHEN 'yearly' THEN 12 ELSE 1 END))::date AS m1) AS m,
       LATERAL (SELECT make_date(
                  EXTRACT(YEAR FROM m.m1)::int,
                  EXTRACT(MONTH FROM m.m1)::int,
                  LEAST(t.recurrence_day, EXTRACT(DAY FROM (m.m1 + interval '1 month' - interval '1 day'))::int)
                ) AS d) AS c
  WHERE c.d >= CURRENT_DATE
)
WHERE t.is_recurring AND t.recurrence_interval IN ('monthly', 'yearly')
  AND NOT (t.type = 'transfer' AND t.amount > 0);
