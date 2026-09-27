-- Keys map back to the old default palette; custom hex values are not recoverable.
WITH keys(key, hex) AS (VALUES
  ('data-1', '#E57373'), ('data-2', '#81C784'), ('data-3', '#FFD54F'), ('data-4', '#81C784'),
  ('data-5', '#64B5F6'), ('data-6', '#F48FB1'), ('data-7', '#BCAAA4'), ('data-8', '#66BB6A'),
  ('data-9', '#CE93D8'), ('data-10', '#90A4AE'), ('data-11', '#FFA726'), ('data-12', '#8D6E63')
)
UPDATE ledger_categories c SET color = k.hex FROM keys k WHERE c.color = k.key;

UPDATE ledger_categories SET color = NULL WHERE color !~ '^#[0-9A-Fa-f]{6}$';

ALTER TABLE ledger_categories ALTER COLUMN color TYPE CHAR(7);
