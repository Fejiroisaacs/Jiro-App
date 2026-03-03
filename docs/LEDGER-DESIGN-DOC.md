# Technical Design Document: Ledger (Finance Module)

## 1. Summary

Ledger is a personal finance module for tracking income, expenses, transfers, budgets, and net worth. It follows the same hub-and-spoke structure as other Jiro modules. All financial data stays local — no third-party bank integrations, no external syncing.

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

New migrations starting at `000028_ledger_*.up.sql`.

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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);
CREATE INDEX idx_ledger_categories_user ON ledger_categories(user_id);
```

Default categories seeded on user registration:

- **Expense:** Housing, Food & Drink, Transport, Health, Entertainment, Shopping, Utilities, Subscriptions, Other
- **Income:** Salary, Freelance, Investment, Gift, Other

### 3.3 Transactions

Every financial event — income, expense, or transfer.

```sql
CREATE TABLE ledger_transactions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id           UUID NOT NULL REFERENCES ledger_accounts(id) ON DELETE CASCADE,
  category_id          UUID REFERENCES ledger_categories(id) ON DELETE SET NULL,
  type                 VARCHAR(10) NOT NULL CHECK (type IN ('income','expense','transfer')),
  amount               NUMERIC(15,2) NOT NULL,  -- positive = income, negative = expense
  description          VARCHAR(255) NOT NULL,
  notes                TEXT,
  date                 DATE NOT NULL,
  is_recurring         BOOLEAN NOT NULL DEFAULT FALSE,
  recurrence_interval  VARCHAR(10) CHECK (recurrence_interval IN ('weekly','biweekly','monthly','yearly')),
  recurrence_day       INT,  -- day-of-week (1–7) for weekly, day-of-month (1–31) for monthly
  transfer_to_account_id UUID REFERENCES ledger_accounts(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_ledger_txn_user_date ON ledger_transactions(user_id, date DESC);
CREATE INDEX idx_ledger_txn_account   ON ledger_transactions(account_id);
```

`amount` convention: positive values are income, negative values are expenses. For transfers, the amount is negative on the source account row and positive on the destination account row. `SUM(amount)` gives net cashflow for any period.

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
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
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
| POST | `/ledger/transactions` | Log a transaction (income, expense, or transfer) |
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

### 4.6 Comparison

| Method | Path | Description |
| ------ | ---- | ----------- |
| GET | `/ledger/compare?period_a_from=...&period_a_to=...&period_b_from=...&period_b_to=...` | Compare two time ranges — returns totals + per-category breakdown with deltas |

**Query params:**
- `period_a_from`, `period_a_to` — start/end dates for Period A
- `period_b_from`, `period_b_to` — start/end dates for Period B

**Response shape:**

```json
{
  "period_a": { "from": "2026-01-01", "to": "2026-01-31" },
  "period_b": { "from": "2026-02-01", "to": "2026-02-28" },
  "summary": {
    "income":   { "a": 5000, "b": 5200, "delta": 200, "delta_pct": 4.0 },
    "expenses": { "a": 3200, "b": 2900, "delta": -300, "delta_pct": -9.4 },
    "net":      { "a": 1800, "b": 2300, "delta": 500, "delta_pct": 27.8 }
  },
  "categories": [
    {
      "category_id": "...",
      "name": "Food & Drink",
      "color": "#E57373",
      "a": 420, "b": 380, "delta": -40, "delta_pct": -9.5
    }
  ]
}
```

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
- Filters: date range picker, account dropdown, category dropdown, type toggle (all / income / expense / transfer)
- Search by description
- Amount color-coded: green (income), red (expense), blue (transfer)
- Recurring flag icon on recurring entries, with interval badge (e.g. "Monthly")
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

### 5.6 Comparison (`/ledger/compare`)

Dedicated page for comparing financial data across two time periods.

**Period selector (top bar):**
- Preset buttons: "This Month vs Last Month", "This Week vs Last Week", "This Quarter vs Last Quarter"
- Custom mode: two date range pickers (Period A and Period B)
- Apply button triggers the comparison

**Chart section:**
- Grouped bar chart (Chart.js) — Period A bars next to Period B bars
- Top-level summary bars: Total Income, Total Expenses, Net Cashflow
- Per-category grouped bars below, sorted by largest delta

**Detail table (below chart):**
- Rows per category
- Columns: Category Name, Period A Amount, Period B Amount, Delta ($), Delta (%)
- Delta color-coded: green (improvement = less spending or more income), red (worse)
- Summary row at bottom with totals
- Sortable by any column

### 5.7 UI/UX & Responsive Design

To ensure a premium feel and cross-platform consistency, Ledger uses explicit responsive patterns for Desktop vs. Mobile:

#### Global Patterns
- **Touch Targets:** All interactive elements on mobile (rows, buttons, tabs) must be at least 44px tall.
- **Empty States:** Beautiful, themed empty states for all views (e.g., an illustration and a "Log your first transaction" button).
- **Micro-animations:** Smooth transitions for opening modals, expanding rows, and chart rendering.

#### Ledger Hub
- **Desktop:** Summary bar on top, Budgets in a grid on the left, Recent Transactions list on the right. Standard "Quick Add" button top right.
- **Mobile:** Stacked layout. Summary bar first, then a horizontal scrollable list of budget cards (saves vertical space), followed by the recent transactions list. A floating action button (FAB) at the bottom right for quick entry.

#### Transaction Log
- **Desktop:** Rich list view. Filters (date range, account, category, type) presented in a collapsible top bar or persistent sidebar.
- **Mobile:** Full-width list view. Filters are hidden behind a single "Filter" button that triggers a bottom sheet.

#### Accounts & Budgets
- **Desktop:** Responsive grid of cards (`minmax` CSS grid).
- **Mobile:** Stacked vertical list of cards.

#### Comparison View
- **Desktop:** Side-by-side grouped bar chart at the top. Full multi-column data table below.
- **Mobile:** Chart simplifies (e.g., hiding secondary axes or legends to save space). The detail table transforms from a classic `<table>` into a vertical list of "Category Cards," where each card shows the category name, Period A vs Period B values, and the Delta badge in a compact layout.

---

## 6. Implementation Notes

### Balance consistency

Account `balance` is updated atomically in the same DB transaction as the transaction insert/update/delete — never recomputed from history. This keeps reads O(1) but means any direct DB edits outside the API must also update the balance.

### Amount sign convention

`amount > 0` = money in (income), `amount < 0` = money out (expense). The API accepts a `type` field (`"income"` | `"expense"` | `"transfer"`) and an unsigned `amount` from the client; the service layer applies the sign before writing.

### Transfer handling

A transfer is a single user action that creates **two** ledger_transactions rows in the same DB transaction:
1. A negative-amount row on the source account
2. A positive-amount row on the destination account (referenced via `transfer_to_account_id`)

Both rows share the same description and date. The UI shows transfers as a single entry with a "from → to" display. Transfers are excluded from income/expense totals in summaries to avoid double-counting.

### Multi-currency

Out of scope for v1. All amounts stored in the account's declared currency. The summary endpoint warns if accounts with different currencies are mixed.

### Recurring transactions

`is_recurring` marks a transaction as recurring. When toggled on, the user selects a `recurrence_interval` (weekly, biweekly, monthly, yearly) and a `recurrence_day`. This metadata is stored but **not acted upon** in v1 — no auto-generation of future entries. The UI displays the recurrence pattern as a badge (e.g. "🔁 Monthly on the 15th"). Auto-generation is planned via Chronos integration.

### Deleting accounts

Blocked if the account has transactions. User must either delete the transactions or reassign them to another account first. The `is_active` flag allows soft-archiving an account (hides it from the hub and dropdowns) without deleting.

### Category deletion

Does not cascade-delete transactions. Instead, `category_id` on affected transactions is set to `NULL`. The UI shows these as "Uncategorised" and prompts the user to reassign them.

### Icons

**No emojis.** All icons in Ledger use inline SVGs, consistent with the rest of Jiro. The established pattern is:

```html
<svg width="16" height="16" viewBox="0 0 24 24" fill="none"
     stroke="currentColor" stroke-width="2"
     stroke-linecap="round" stroke-linejoin="round">
  <path d="..." />
</svg>
```

- `stroke="currentColor"` ensures the icon automatically inherits the current text color, which adapts to the user's selected theme (Earth, Forest, Crimson, etc.)
- For accent-colored icons (e.g. income/expense indicators, active states), set `style="color: var(--color-primary)"` or `var(--color-accent)` on the SVG or its container
- For semantic colors (e.g. green for income, red for expense), use the existing CSS variables: `var(--color-accent)` for positive, `var(--color-danger)` for negative
- Account type icons, transaction type icons, recurring badges, budget status indicators, and comparison delta arrows all follow this pattern

---

## 7. Build Phases

The full feature set ships as v1, built in phases to allow parallel work on non-overlapping features.

### Phase 1 — Foundation (Sequential, must be first)
- Database migrations (`000028` onwards — all 5 tables)
- Go models (`models/ledger.go`)
- Service scaffold (`services/ledger.go`)
- Router registration (`router/router.go` — `/api/v1/ledger/*` group)
- Default category seeding logic

### Phase 2 — Independent CRUD Tracks (Parallel)

| Track | Backend | Frontend | Dependencies |
| ----- | ------- | -------- | ------------ |
| **A: Accounts** | CRUD endpoints + balance logic | Accounts page (`/ledger/accounts`) | Phase 1 |
| **B: Categories** | CRUD endpoints + tree query | Category management (settings or inline) | Phase 1 |

### Phase 3 — Data Entry (Parallel after Phase 2)

| Track | Backend | Frontend | Dependencies |
| ----- | ------- | -------- | ------------ |
| **C: Transactions** | CRUD + transfer logic + balance updates | Transaction Log page + quick-add form | Accounts + Categories |
| **D: Budgets** | CRUD + spend computation | Budgets page | Categories |

### Phase 4 — Analytics & Views (Parallel after Phase 3)

| Track | Backend | Frontend | Dependencies |
| ----- | ------- | -------- | ------------ |
| **E: Hub Page** | Summary endpoint | Ledger Hub (`/ledger`) | Transactions + Budgets |
| **F: Net Worth** | Snapshot CRUD | Net Worth page + chart | Accounts |
| **G: Comparison** | Compare endpoint | Comparison page + chart + table | Transactions |

---

## 8. Future Enhancements

- **Auto-recurring entries** — Chronos reads `recurrence_interval` / `recurrence_day` and auto-creates scheduled transactions
- **CSV import** — paste exported bank statement rows to bulk-import transactions
- **Multi-currency** — per-transaction exchange rate, display in a home currency
- **Split transactions** — one transaction split across multiple categories (e.g. a supermarket receipt with food + household)
- **Goals** — savings targets with progress tracking (e.g. "Emergency fund: £3,000")
- **Auto net worth snapshot** — triggered on the 1st of each month via a Chronos job

---

## 9. Decision Log

| # | Decision | Alternatives Considered | Rationale |
|---|----------|------------------------|-----------|
| 1 | Comparison lives on a dedicated `/ledger/compare` page | Inline badges on Hub, both inline + page | Clean separation of concerns; Hub stays focused on current-month glance |
| 2 | Comparison shows both high-level totals and per-category breakdown | Totals only, categories only | Users need both the "big picture" and the "where exactly" |
| 3 | Preset periods + fully custom date range picker | Presets only, custom only | Presets cover 80% of use cases; custom handles edge cases without limiting power users |
| 4 | Chart (grouped bar) + detail table on comparison page | Chart only, table only | Visual for scanning, table for precision — different users prefer different modes |
| 5 | Capture recurrence metadata now (interval + day), automate later | Bare boolean flag, full recurrence rules table | Forward-proofs the data without over-engineering; metadata is already there when Chronos integration is built |
| 6 | Transfers are first-class transaction type (two linked rows) | Deferred to future, single manual entries | Prevents double-counting in summaries; fundamental to accurate personal finance tracking |
| 7 | Full feature set ships as v1, built in parallelizable phases | Core CRUD only, strict phased releases | Everything in the doc is needed for a complete module; phasing allows parallel development without blocking |
| 8 | Add `updated_at` / `created_at` to all tables | Leave as-is | Consistency with existing Jiro modules (Jym, Culinara, Journal) |
| 9 | All icons use inline SVGs with `currentColor`, no emojis | Emoji characters, icon font library | Matches existing Jiro pattern; `currentColor` automatically adapts to the user's selected theme without extra logic |
