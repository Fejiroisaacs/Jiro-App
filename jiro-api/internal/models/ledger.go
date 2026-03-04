package models

import (
	"time"

	"github.com/google/uuid"
)

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

type CreateAccountRequest struct {
	Name     string  `json:"name" binding:"required"`
	Type     string  `json:"type" binding:"required"`
	Currency string  `json:"currency"`
	Balance  float64 `json:"balance"`
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
	Name     string     `json:"name" binding:"required"`
	Type     string     `json:"type" binding:"required"`
	Color    *string    `json:"color"`
	ParentID *uuid.UUID `json:"parent_id"`
}

type UpdateCategoryRequest struct {
	Name     *string    `json:"name"`
	Color    *string    `json:"color"`
	ParentID *uuid.UUID `json:"parent_id"`
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
	CreatedAt           time.Time  `json:"created_at"`
	UpdatedAt           time.Time  `json:"updated_at"`
	// Joined fields for display
	CategoryName  *string `json:"category_name,omitempty"`
	CategoryColor *string `json:"category_color,omitempty"`
}

type CreateTransactionRequest struct {
	AccountID           uuid.UUID  `json:"account_id" binding:"required"`
	CategoryID          *uuid.UUID `json:"category_id"`
	Type                string     `json:"type" binding:"required"`
	Amount              float64    `json:"amount" binding:"required"`
	Description         string     `json:"description"`
	Notes               *string    `json:"notes"`
	Date                string     `json:"date" binding:"required"` // YYYY-MM-DD
	IsRecurring         bool       `json:"is_recurring"`
	RecurrenceInterval  *string    `json:"recurrence_interval"`
	RecurrenceDay       *int       `json:"recurrence_day"`
	TransferToAccountID *uuid.UUID `json:"transfer_to_account_id"`
}

type UpdateTransactionRequest struct {
	CategoryID         *uuid.UUID `json:"category_id"`
	Amount             *float64   `json:"amount"`
	Description        *string    `json:"description"`
	Notes              *string    `json:"notes"`
	Date               *string    `json:"date"` // YYYY-MM-DD
	IsRecurring        *bool      `json:"is_recurring"`
	RecurrenceInterval *string    `json:"recurrence_interval"`
	RecurrenceDay      *int       `json:"recurrence_day"`
}

type TransactionFilters struct {
	From       string
	To         string
	AccountID  string
	CategoryID string
	Type       string
	Page       int
	Limit      int
}

// ── Budgets ───────────────────────────────────────────────────────────────────

type LedgerBudget struct {
	ID           uuid.UUID `json:"id"`
	UserID       uuid.UUID `json:"user_id"`
	CategoryID   uuid.UUID `json:"category_id"`
	Amount       float64   `json:"amount"`
	Period       string    `json:"period"`
	StartDate    time.Time `json:"start_date"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
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
	Amount     float64   `json:"amount" binding:"required"`
	Period     string    `json:"period" binding:"required"`
	StartDate  string    `json:"start_date" binding:"required"` // YYYY-MM-DD
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

type ComparisonValue struct {
	A        float64 `json:"a"`
	B        float64 `json:"b"`
	Delta    float64 `json:"delta"`
	DeltaPct float64 `json:"delta_pct"`
}

type ComparisonSummary struct {
	Income   ComparisonValue `json:"income"`
	Expenses ComparisonValue `json:"expenses"`
	Net      ComparisonValue `json:"net"`
}

type ComparisonCategory struct {
	CategoryID uuid.UUID `json:"category_id"`
	Name       string    `json:"name"`
	Color      *string   `json:"color"`
	A          float64   `json:"a"`
	B          float64   `json:"b"`
	Delta      float64   `json:"delta"`
	DeltaPct   float64   `json:"delta_pct"`
}

type ComparisonResponse struct {
	PeriodA    ComparisonPeriod     `json:"period_a"`
	PeriodB    ComparisonPeriod     `json:"period_b"`
	Summary    ComparisonSummary    `json:"summary"`
	Categories []ComparisonCategory `json:"categories"`
}
