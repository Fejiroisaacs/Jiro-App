DROP INDEX IF EXISTS ledger_txn_recurrence_due;
DROP INDEX IF EXISTS ledger_txn_recurrence_occurrence;
ALTER TABLE ledger_transactions
  DROP COLUMN IF EXISTS recurrence_source_id,
  DROP COLUMN IF EXISTS recurrence_next_date;
