# Technical Design Document: Ledger (Finance Module)

## 1. Summary

Ledger is a personal finance module for tracking income, expenses, budgets, and net worth. It follows the same hub-and-spoke structure as other Jiro modules. All financial data stays local — no third-party bank integrations, no external syncing.

---

## 2. Architecture

Ledger is a spoke module within the Jiro hub. All endpoints are served by the Go (Gin) API under `/api/v1/ledger/`. Data is stored in PostgreSQL. The module is fully isolated behind JWT auth with `user_id` scoping on every table.

```text
Angular UI (/ledger/*)
      │
      ▼
Go API (/api/v1/ledger/*)
      │
      ▼
PostgreSQL (ledger_* tables)
```

---

## 3. Data Schema (PostgreSQL)

New migrations starting at `000012_ledger_*.up.sql`.

### 3.1 Accounts

Represents a financial account — bank account, credit card, cash wallet, or investment account.

```sql
CREATE TABLE ledger_accounts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       VARCHAR(100) NOT NULL,
  type       VARCHAR(20) NOT NULL CHECK (type IN ('checking','savings','credit','investment','cash')),
  currency   CHAR(3) NOT NULL DEFAULT 'USD',
  balance    NUMERIC(15,2) NOT NULL DEFAULT 0,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_ledger_accounts_user ON ledger_accounts(user_id);
```

| Type | Role | Example |
| ---- | ---- | ------- |
| `checking` | Asset | Current / everyday account |
| `savings` | Asset | High-interest savings |
| `investment` | Asset | Stocks, ETFs, crypto |
| `cash` | Asset | Physical cash |
| `credit` | Liability | Credit card |

Net worth = Σ asset balances − Σ credit balances.

### 3.2 Categories

User-defined labels for transactions. Supports one level of nesting (subcategories).

```sql
CREATE TABLE ledger_categories (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name      VARCHAR(100) NOT NULL,
  type      VARCHAR(10) NOT NULL CHECK (type IN ('income','expense')),
  color     CHAR(7),    -- hex color e.g. #A0422A
  parent_id UUID REFERENCES ledger_categories(id) ON DELETE SET NULL,
  UNIQUE(user_id, name)
);
CREATE INDEX idx_ledger_categories_user ON ledger_categories(user_id);
```

Default categories seeded on user registration:

- **Expense:** Housing, Food & Drink, Transport, Health, Entertainment, Shopping, Utilities, Subscriptions, Other
- **Income:** Salary, Freelance, Investment, Gift, Other

### 3.3 Transactions

Every financial event — income or expense.

```sql
CREATE TABLE ledger_transactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id  UUID NOT NULL REFERENCES ledger_accounts(id) ON DELETE CASCADE,
  category_id UUID REFERENCES ledger_categories(id) ON DELETE SET NULL,
  amount      NUMERIC(15,2) NOT NULL,  -- positive = income, negative = expense
  description VARCHAR(255) NOT NULL,
  notes       TEXT,
  date        DATE NOT NULL,
  is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_ledger_txn_user_date ON ledger_transactions(user_id, date DESC);
CREATE INDEX idx_ledger_txn_account   ON ledger_transactions(account_id);
```

`amount` convention: positive values are income, negative values are expenses. This makes summing straightforward — `SUM(amount)` gives net cashflow for any period.

### 3.4 Budgets

Monthly (or weekly/yearly) spending limits per category.

```sql
CREATE TABLE ledger_budgets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES ledger_categories(id) ON DELETE CASCADE,
  amount      NUMERIC(15,2) NOT NULL,
  period      VARCHAR(10) NOT NULL CHECK (period IN ('monthly','weekly','yearly')),
  start_date  DATE NOT NULL,
  UNIQUE(user_id, category_id, period)
);
CREATE INDEX idx_ledger_budgets_user ON ledger_budgets(user_id);
```

### 3.5 Net Worth Snapshots

Point-in-time asset/liability totals for trending. `net_worth` is a PostgreSQL computed column — always in sync with the two totals.

```sql
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
```

---

## 4. API Endpoints

All routes under `/api/v1/ledger`, require JWT.

### 4.1 Accounts

| Method | Path | Description |
| ------ | ---- | ----------- |
| POST | `/ledger/accounts` | Create account |
| GET | `/ledger/accounts` | List all accounts with balances |
| GET | `/ledger/accounts/:id` | Account detail + recent transactions |
| PATCH | `/ledger/accounts/:id` | Update name, type, active status |
| DELETE | `/ledger/accounts/:id` | Delete (blocked if transactions exist) |

### 4.2 Transactions

| Method | Path | Description |
| ------ | ---- | ----------- |
| POST | `/ledger/transactions` | Log a transaction |
| GET | `/ledger/transactions` | List with filters: `from`, `to`, `account_id`, `category_id`, `type` |
| GET | `/ledger/transactions/:id` | Get single transaction |
| PATCH | `/ledger/transactions/:id` | Update |
| DELETE | `/ledger/transactions/:id` | Delete (also reverses the account balance adjustment) |

### 4.3 Categories

| Method | Path | Description |
| ------ | ---- | ----------- |
| POST | `/ledger/categories` | Create category |
| GET | `/ledger/categories` | List as tree (parents with nested children) |
| PATCH | `/ledger/categories/:id` | Rename, recolor, reparent |
| DELETE | `/ledger/categories/:id` | Delete; transactions set to `category_id = NULL` |

### 4.4 Budgets

| Method | Path | Description |
| ------ | ---- | ----------- |
| POST | `/ledger/budgets` | Create or replace budget for a category+period |
| GET | `/ledger/budgets` | List budgets with current period spend computed |
| DELETE | `/ledger/budgets/:id` | Remove budget |

### 4.5 Summary & Net Worth

| Method | Path | Description |
| ------ | ---- | ----------- |
| GET | `/ledger/summary?month=2026-02` | Income, expenses, savings rate for a given month |
| GET | `/ledger/networth` | All net worth snapshots (for chart) |
| POST | `/ledger/networth/snapshot` | Record a manual snapshot |

---

## 5. Frontend Pages

### 5.1 Ledger Hub (`/ledger`)

The landing page for the module.

- **Monthly summary bar** — income vs expenses side by side, savings rate %
- **Budget snapshot** — compact progress bars for each active budget (% used, turns amber/red)
- **Recent transactions** — last 10 entries with description, amount, category chip
- **Quick add button** — opens inline form to log a transaction without leaving the hub

### 5.2 Transaction Log (`/ledger/transactions`)

Full history with filtering and search.

- Paginated list, newest first
- Filters: date range picker, account dropdown, category dropdown, type toggle (all / income / expense)
- Search by description
- Amount color-coded: green (income), red (expense)
- Recurring flag icon on recurring entries
- Tap row to edit inline or open detail sheet

### 5.3 Accounts (`/ledger/accounts`)

- Card per account showing name, type icon, current balance
- Tap to open account detail with its own transaction list
- Add account button — name, type, opening balance, currency
- Deactivate (hide from hub) without deleting

### 5.4 Budgets (`/ledger/budgets`)

- Card per budget: category name, limit, spent, remaining, days left in period
- Progress bar — green → amber at 80% → red at 100%
- Previous period comparison badge (over/under by X)
- Add / edit / remove budget inline

### 5.5 Net Worth (`/ledger/networth`)

- Line chart of net worth over time (Chart.js, same as exercise 1RM chart)
- Stacked bar below: assets vs liabilities per snapshot
- "Take snapshot" button — pre-fills current account balances, user confirms before saving
- Snapshot list with date and net worth value

---

## 6. Implementation Notes

### Balance consistency

Account `balance` is updated atomically in the same DB transaction as the transaction insert/update/delete — never recomputed from history. This keeps reads O(1) but means any direct DB edits outside the API must also update the balance.

### Amount sign convention

`amount > 0` = money in (income), `amount < 0` = money out (expense). The API accepts a `type` field (`"income"` | `"expense"`) and an unsigned `amount` from the client; the service layer applies the sign before writing.

### Multi-currency

Out of scope for v1. All amounts stored in the account's declared currency. The summary endpoint warns if accounts with different currencies are mixed.

### Recurring transactions

`is_recurring` is a metadata flag only in v1. Auto-generation of future recurring entries is a future feature, planned via Chronos integration.

### Deleting accounts

Blocked if the account has transactions. User must either delete the transactions or reassign them to another account first. This prevents silent data loss.

### Category deletion

Does not cascade-delete transactions. Instead, `category_id` on affected transactions is set to `NULL`. The UI shows these as "Uncategorised" and prompts the user to reassign them.

---

## 7. Future Enhancements

- **Auto-recurring entries** — Chronos creates scheduled transactions based on the recurring flag
- **CSV import** — paste exported bank statement rows to bulk-import transactions
- **Multi-currency** — per-transaction exchange rate, display in a home currency
- **Split transactions** — one transaction split across multiple categories (e.g. a supermarket receipt with food + household)
- **Goals** — savings targets with progress tracking (e.g. "Emergency fund: £3,000")
- **Auto net worth snapshot** — triggered on the 1st of each month via a Chronos job
