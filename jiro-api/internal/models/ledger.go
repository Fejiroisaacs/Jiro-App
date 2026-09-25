package models

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// OptionalUUID tells a field that was left out of a PATCH body apart from one
// sent as null: Set is false when absent, and Value is nil for an explicit
// null (clear it).
type OptionalUUID struct {
	Set   bool
	Value *uuid.UUID
}

func (o *OptionalUUID) UnmarshalJSON(b []byte) error {
	o.Set = true
	if string(b) == "null" {
		o.Value = nil
		return nil
	}
	var id uuid.UUID
	if err := json.Unmarshal(b, &id); err != nil {
		return err
	}
	o.Value = &id
	return nil
}

// ── Accounts ──────────────────────────────────────────────────────────────────

type LedgerAccount struct {
	ID        uuid.UUID `json:"id"`
	UserID    uuid.UUID `json:"user_id"`
	Name      string    `json:"name"`
	Type      string    `json:"type"`
	Currency  string    `json:"currency"`
	Balance   float64   `json:"balance"`
	IsActive  bool      `json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type AccountWithTransactions struct {
	LedgerAccount
	RecentTransactions []LedgerTransaction `json:"recent_transactions"`
}

// CreateAccountRequest has no currency: every account uses the user's one
// currency (settings.currency). The column is still written, from settings.
type CreateAccountRequest struct {
	Name    string  `json:"name" binding:"required"`
	Type    string  `json:"type" binding:"required,oneof=checking savings credit investment cash"`
	Balance float64 `json:"balance"`
}

type UpdateAccountRequest struct {
	Name     *string `json:"name"`
	Type     *string `json:"type"`
	IsActive *bool   `json:"is_active"`
}

// ── Categories ────────────────────────────────────────────────────────────────

type LedgerCategory struct {
	ID        uuid.UUID  `json:"id"`
	UserID    uuid.UUID  `json:"user_id"`
	Name      string     `json:"name"`
	Type      string     `json:"type"`
	Color     *string    `json:"color"`
	ParentID  *uuid.UUID `json:"parent_id"`
	CreatedAt time.Time  `json:"created_at"`
}

type CategoryTree struct {
	LedgerCategory
	Children []LedgerCategory `json:"children"`
}

type CreateCategoryRequest struct {
	Name string `json:"name" binding:"required"`
	Type string `json:"type" binding:"required,oneof=income expense"`
	// Color is #RRGGBB; left out, the next unused palette colour is picked.
	Color    *string    `json:"color"`
	ParentID *uuid.UUID `json:"parent_id"`
}

// UpdateCategoryRequest renames or recolours. The type is fixed: moving a
// category between income and expense would misfile its transactions.
type UpdateCategoryRequest struct {
	Name  *string `json:"name"`
	Color *string `json:"color"`
}

// ── Transactions ──────────────────────────────────────────────────────────────

type LedgerTransaction struct {
	ID                  uuid.UUID  `json:"id"`
	UserID              uuid.UUID  `json:"user_id"`
	AccountID           uuid.UUID  `json:"account_id"`
	CategoryID          *uuid.UUID `json:"category_id"`
	Type                string     `json:"type"`
	Amount              float64    `json:"amount"`
	Description         string     `json:"description"`
	Notes               *string    `json:"notes"`
	Date                time.Time  `json:"date"`
	IsRecurring         bool       `json:"is_recurring"`
	RecurrenceInterval  *string    `json:"recurrence_interval"`
	RecurrenceDay       *int       `json:"recurrence_day"`
	TransferToAccountID *uuid.UUID `json:"transfer_to_account_id"`
	// RecurrenceNextDate is set on an active series head: the next date
	// Ledger will write a copy on. Nil when the row is not a live series.
	RecurrenceNextDate *time.Time `json:"recurrence_next_date"`
	// RecurrenceSourceID is set on a copy Ledger wrote: the series head.
	RecurrenceSourceID *uuid.UUID `json:"recurrence_source_id"`
	CreatedAt          time.Time  `json:"created_at"`
	UpdatedAt          time.Time  `json:"updated_at"`
	// Joined fields for display
	CategoryName  *string `json:"category_name,omitempty"`
	CategoryColor *string `json:"category_color,omitempty"`
	// SeriesInterval and SeriesNextDate describe the series this row belongs
	// to (its own for a head, its head's for a copy); nil when it has none or
	// the series has stopped.
	SeriesInterval *string    `json:"series_interval"`
	SeriesNextDate *time.Time `json:"series_next_date"`
}

type CreateTransactionRequest struct {
	AccountID           uuid.UUID  `json:"account_id" binding:"required"`
	CategoryID          *uuid.UUID `json:"category_id"`
	Type                string     `json:"type" binding:"required,oneof=income expense transfer"`
	Amount              float64    `json:"amount" binding:"required"`
	Description         string     `json:"description"`
	Notes               *string    `json:"notes"`
	Date                string     `json:"date" binding:"required"` // YYYY-MM-DD
	IsRecurring         bool       `json:"is_recurring"`
	RecurrenceInterval  *string    `json:"recurrence_interval"`
	TransferToAccountID *uuid.UUID `json:"transfer_to_account_id"`
}

// UpdateTransactionRequest: every field is optional and a field left out is
// left alone. category_id may be sent as null to uncategorise; notes as ""
// to clear them. The type cannot change.
type UpdateTransactionRequest struct {
	AccountID           *uuid.UUID   `json:"account_id"`
	TransferToAccountID *uuid.UUID   `json:"transfer_to_account_id"`
	CategoryID          OptionalUUID `json:"category_id"`
	Amount              *float64     `json:"amount"`
	Description         *string      `json:"description"`
	Notes               *string      `json:"notes"`
	Date                *string      `json:"date"` // YYYY-MM-DD
	IsRecurring         *bool        `json:"is_recurring"`
	RecurrenceInterval  *string      `json:"recurrence_interval"`
}

type TransactionFilters struct {
	From       string
	To         string
	AccountID  string
	CategoryID string
	Type       string
	// Q matches the description or the notes, case-insensitively.
	Q     string
	Page  int
	Limit int
}

// ── Budgets ───────────────────────────────────────────────────────────────────

type LedgerBudget struct {
	ID         uuid.UUID `json:"id"`
	UserID     uuid.UUID `json:"user_id"`
	CategoryID uuid.UUID `json:"category_id"`
	Amount     float64   `json:"amount"`
	Period     string    `json:"period"`
	StartDate  time.Time `json:"start_date"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

type BudgetWithSpend struct {
	LedgerBudget
	CategoryName  string  `json:"category_name"`
	CategoryColor *string `json:"category_color"`
	Spent         float64 `json:"spent"`
	Remaining     float64 `json:"remaining"`
	PctUsed       float64 `json:"pct_used"`
}

type CreateBudgetRequest struct {
	CategoryID uuid.UUID `json:"category_id" binding:"required"`
	Amount     float64   `json:"amount" binding:"required,gt=0"`
	Period     string    `json:"period" binding:"required,oneof=monthly weekly yearly"`
	// StartDate is optional and unused by the spend maths (a budget always
	// covers the current period); it defaults to today in the user's zone.
	StartDate string `json:"start_date"` // YYYY-MM-DD
}

type UpdateBudgetRequest struct {
	Amount *float64 `json:"amount" binding:"omitempty,gt=0"`
	Period *string  `json:"period" binding:"omitempty,oneof=monthly weekly yearly"`
}

// ── Net Worth ─────────────────────────────────────────────────────────────────

type NetWorthSnapshot struct {
	ID               uuid.UUID `json:"id"`
	UserID           uuid.UUID `json:"user_id"`
	AssetsTotal      float64   `json:"assets_total"`
	LiabilitiesTotal float64   `json:"liabilities_total"`
	NetWorth         float64   `json:"net_worth"`
	SnapshotDate     time.Time `json:"snapshot_date"`
}

type CreateSnapshotRequest struct {
	AssetsTotal      float64 `json:"assets_total"`
	LiabilitiesTotal float64 `json:"liabilities_total"`
	SnapshotDate     string  `json:"snapshot_date" binding:"required"` // YYYY-MM-DD
}

// ── Analytics ─────────────────────────────────────────────────────────────────

type LedgerSummary struct {
	Month       string  `json:"month"`
	Income      float64 `json:"income"`
	Expenses    float64 `json:"expenses"`
	Net         float64 `json:"net"`
	SavingsRate float64 `json:"savings_rate"` // net / income * 100
}

type ComparisonPeriod struct {
	From string `json:"from"`
	To   string `json:"to"`
}

// ComparisonValue compares period B against period A (the base): Delta is
// B - A, DeltaPct is that change as a share of |A|, and nil when A is zero
// (no base to measure against).
type ComparisonValue struct {
	A        float64  `json:"a"`
	B        float64  `json:"b"`
	Delta    float64  `json:"delta"`
	DeltaPct *float64 `json:"delta_pct"`
}

type ComparisonSummary struct {
	Income   ComparisonValue `json:"income"`
	Expenses ComparisonValue `json:"expenses"`
	Net      ComparisonValue `json:"net"`
}

// ComparisonCategory is one category's income or spending in each period,
// as a positive amount. CategoryID is nil for uncategorised transactions.
type ComparisonCategory struct {
	CategoryID *uuid.UUID `json:"category_id"`
	Name       string     `json:"name"`
	Type       string     `json:"type"` // income | expense
	Color      *string    `json:"color"`
	A          float64    `json:"a"`
	B          float64    `json:"b"`
	Delta      float64    `json:"delta"`
	DeltaPct   *float64   `json:"delta_pct"`
}

type ComparisonResponse struct {
	PeriodA    ComparisonPeriod     `json:"period_a"`
	PeriodB    ComparisonPeriod     `json:"period_b"`
	Summary    ComparisonSummary    `json:"summary"`
	Categories []ComparisonCategory `json:"categories"`
}
