-- Recurring transactions become real. A series is its first transaction
-- (the "head", is_recurring = true). recurrence_next_date is the next date
-- the series is due; NULL means it is not repeating (stopped, or never was).
-- Each occurrence Ledger writes points back at its head through
-- recurrence_source_id. recurrence_day (already present) holds the day of
-- the month a monthly or yearly series falls on, so a series that starts on
-- the 31st lands on the last day of shorter months without drifting.
--
-- Additive only: two nullable columns and two indexes. jiro_app already
-- holds table-level grants on ledger_transactions, which cover new columns.

ALTER TABLE ledger_transactions
  ADD COLUMN IF NOT EXISTS recurrence_next_date DATE,
  ADD COLUMN IF NOT EXISTS recurrence_source_id UUID REFERENCES ledger_transactions(id) ON DELETE SET NULL;

-- One occurrence per series per date: this is what makes the lazy catch-up
-- idempotent even if two requests race past the row lock. A transfer writes
-- two rows per occurrence, so only its source leg (the negative one) counts.
CREATE UNIQUE INDEX IF NOT EXISTS ledger_txn_recurrence_occurrence
  ON ledger_transactions (recurrence_source_id, date)
  WHERE recurrence_source_id IS NOT NULL AND NOT (type = 'transfer' AND amount > 0);

-- The catch-up asks "which of this user's series are due by today?".
CREATE INDEX IF NOT EXISTS ledger_txn_recurrence_due
  ON ledger_transactions (user_id, recurrence_next_date)
  WHERE recurrence_next_date IS NOT NULL;

-- Existing data. Until now "recurring" was only a flag, and people flagged
-- each month's copy by hand, so one real series can be several flagged rows.
-- Group them (same account, kind, description, interval and transfer target),
-- keep the latest as the head, and clear the flag on the older copies.
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

-- Activate each head from the day this runs: its next date is the first
-- scheduled date on or after today. Nothing is back-filled for the months
-- before this migration, since people have been entering those by hand.
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
