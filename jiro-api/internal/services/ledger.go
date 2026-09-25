package services

import (
	"context"
	"errors"
	"fmt"
	"math"
	"regexp"
	"sort"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/models"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog/log"
)

var (
	ErrAccountNotFound        = errors.New("account not found")
	ErrAccountHasTransactions = errors.New("account has transactions and cannot be deleted")
	ErrCategoryNotFound       = errors.New("category not found")
	ErrBudgetNotFound         = errors.New("budget not found")
	ErrTransactionNotFound    = errors.New("transaction not found")
	ErrLedgerNotOwner         = errors.New("you do not own this resource")

	// ErrLedgerInvalid marks a malformed request (400); its message is shown, so keep it safe to return.
	ErrLedgerInvalid = errors.New("invalid ledger request")
	// ErrCategoryNameTaken: the user already has a category with that name (409).
	ErrCategoryNameTaken = errors.New("category name taken")
	// ErrBudgetExists: the category already has a budget for that period (409).
	ErrBudgetExists = errors.New("budget exists")
)

func ledgerInvalid(msg string) error {
	return fmt.Errorf("%w: %s", ErrLedgerInvalid, msg)
}

type LedgerService struct {
	db *pgxpool.Pool
}

func NewLedgerService(db *pgxpool.Pool) *LedgerService {
	return &LedgerService{db: db}
}

// categoryPalette is the colours a category can take, matching the defaults.
var categoryPalette = []string{
	"#8D6E63", "#E57373", "#64B5F6", "#81C784", "#FFD54F", "#F48FB1", "#90A4AE",
	"#CE93D8", "#BCAAA4", "#66BB6A", "#4DB6AC", "#FFA726", "#AB47BC", "#78909C",
}

var colorPattern = regexp.MustCompile(`^#[0-9A-Fa-f]{6}$`)

// pickCategoryColor is the first unused palette colour, cycling once all are taken.
func pickCategoryColor(used []string) string {
	taken := make(map[string]bool, len(used))
	for _, c := range used {
		taken[strings.ToUpper(c)] = true
	}
	for _, c := range categoryPalette {
		if !taken[c] {
			return c
		}
	}
	return categoryPalette[len(used)%len(categoryPalette)]
}

// normaliseColor validates a #RRGGBB colour and upper-cases it.
func normaliseColor(c string) (string, error) {
	c = strings.TrimSpace(c)
	if !colorPattern.MatchString(c) {
		return "", ledgerInvalid("color must be a hex colour like #64B5F6")
	}
	return strings.ToUpper(c), nil
}

// cleanCategoryName trims a name and checks it fits the column.
func cleanCategoryName(name string) (string, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return "", ledgerInvalid("name is required")
	}
	if utf8.RuneCountInString(name) > 100 {
		return "", ledgerInvalid("name must be 100 characters or fewer")
	}
	return name, nil
}

// ── Category Seeding ──────────────────────────────────────────────────────────

func (s *LedgerService) SeedDefaultCategories(ctx context.Context, userID uuid.UUID) {
	type cat struct {
		name  string
		ctype string
		color string
	}
	defaults := []cat{
		// Expense
		{"Housing", "expense", "#8D6E63"},
		{"Food & Drink", "expense", "#E57373"},
		{"Transport", "expense", "#64B5F6"},
		{"Health", "expense", "#81C784"},
		{"Entertainment", "expense", "#FFD54F"},
		{"Shopping", "expense", "#F48FB1"},
		{"Utilities", "expense", "#90A4AE"},
		{"Subscriptions", "expense", "#CE93D8"},
		{"Other", "expense", "#BCAAA4"},
		// Income
		{"Salary", "income", "#66BB6A"},
		{"Freelance", "income", "#4DB6AC"},
		{"Investment", "income", "#FFA726"},
		{"Gift", "income", "#AB47BC"},
		{"Other Income", "income", "#78909C"},
	}

	for _, c := range defaults {
		_, err := s.db.Exec(ctx,
			`INSERT INTO ledger_categories (user_id, name, type, color)
			 VALUES ($1, $2, $3, $4)
			 ON CONFLICT (user_id, name) DO NOTHING`,
			userID, c.name, c.ctype, c.color,
		)
		if err != nil {
			log.Error().Err(err).Str("category", c.name).Msg("Failed to seed ledger category")
		}
	}
}

// ── Accounts ──────────────────────────────────────────────────────────────────

// userCurrency is the user's one currency (settings.currency, USD by default).
func (s *LedgerService) userCurrency(ctx context.Context, userID uuid.UUID) (string, error) {
	var cur string
	err := s.db.QueryRow(ctx,
		`SELECT COALESCE(NULLIF(settings->>'currency', ''), 'USD') FROM users WHERE id = $1`, userID,
	).Scan(&cur)
	return cur, err
}

func (s *LedgerService) CreateAccount(ctx context.Context, userID uuid.UUID, req *models.CreateAccountRequest) (*models.LedgerAccount, error) {
	// The column is kept in step, but every amount displays in settings.currency.
	currency, err := s.userCurrency(ctx, userID)
	if err != nil {
		return nil, err
	}
	name := strings.TrimSpace(req.Name)
	if name == "" {
		return nil, ledgerInvalid("name is required")
	}

	acc := &models.LedgerAccount{}
	err = s.db.QueryRow(ctx,
		`INSERT INTO ledger_accounts (user_id, name, type, currency, balance)
		 VALUES ($1, $2, $3, $4, $5)
		 RETURNING id, user_id, name, type, currency, balance, is_active, created_at, updated_at`,
		userID, name, req.Type, currency, req.Balance,
	).Scan(&acc.ID, &acc.UserID, &acc.Name, &acc.Type, &acc.Currency,
		&acc.Balance, &acc.IsActive, &acc.CreatedAt, &acc.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return acc, nil
}

func (s *LedgerService) ListAccounts(ctx context.Context, userID uuid.UUID) ([]models.LedgerAccount, error) {
	rows, err := s.db.Query(ctx,
		`SELECT id, user_id, name, type, currency, balance, is_active, created_at, updated_at
		 FROM ledger_accounts WHERE user_id = $1 ORDER BY created_at ASC`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	accounts := []models.LedgerAccount{}
	for rows.Next() {
		var a models.LedgerAccount
		if err := rows.Scan(&a.ID, &a.UserID, &a.Name, &a.Type, &a.Currency,
			&a.Balance, &a.IsActive, &a.CreatedAt, &a.UpdatedAt); err != nil {
			return nil, err
		}
		accounts = append(accounts, a)
	}
	return accounts, rows.Err()
}

func (s *LedgerService) GetAccount(ctx context.Context, userID, accountID uuid.UUID) (*models.AccountWithTransactions, error) {
	acc := &models.AccountWithTransactions{}
	err := s.db.QueryRow(ctx,
		`SELECT id, user_id, name, type, currency, balance, is_active, created_at, updated_at
		 FROM ledger_accounts WHERE id = $1 AND user_id = $2`,
		accountID, userID,
	).Scan(&acc.ID, &acc.UserID, &acc.Name, &acc.Type, &acc.Currency,
		&acc.Balance, &acc.IsActive, &acc.CreatedAt, &acc.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrAccountNotFound
		}
		return nil, err
	}

	// This account's own transfer leg is the one whose sign gives the direction.
	acc.RecentTransactions, err = s.queryTransactions(ctx,
		txnSelect+` WHERE t.account_id = $1 AND t.user_id = $2
		 ORDER BY t.date DESC, t.created_at DESC LIMIT 10`,
		accountID, userID)
	if err != nil {
		return nil, err
	}
	return acc, nil
}

func (s *LedgerService) UpdateAccount(ctx context.Context, userID, accountID uuid.UUID, req *models.UpdateAccountRequest) (*models.LedgerAccount, error) {
	if req.Name != nil {
		n := strings.TrimSpace(*req.Name)
		if n == "" {
			return nil, ledgerInvalid("name is required")
		}
		req.Name = &n
	}
	acc := &models.LedgerAccount{}
	err := s.db.QueryRow(ctx,
		`UPDATE ledger_accounts
		 SET name      = COALESCE($3, name),
		     type      = COALESCE($4, type),
		     is_active = COALESCE($5, is_active),
		     updated_at = NOW()
		 WHERE id = $1 AND user_id = $2
		 RETURNING id, user_id, name, type, currency, balance, is_active, created_at, updated_at`,
		accountID, userID, req.Name, req.Type, req.IsActive,
	).Scan(&acc.ID, &acc.UserID, &acc.Name, &acc.Type, &acc.Currency,
		&acc.Balance, &acc.IsActive, &acc.CreatedAt, &acc.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrAccountNotFound
		}
		return nil, err
	}
	return acc, nil
}

func (s *LedgerService) DeleteAccount(ctx context.Context, userID, accountID uuid.UUID) error {
	// Check ownership
	var count int
	err := s.db.QueryRow(ctx,
		`SELECT COUNT(*) FROM ledger_accounts WHERE id = $1 AND user_id = $2`,
		accountID, userID,
	).Scan(&count)
	if err != nil || count == 0 {
		return ErrAccountNotFound
	}

	// Block if transactions exist
	var txCount int
	err = s.db.QueryRow(ctx,
		`SELECT COUNT(*) FROM ledger_transactions WHERE account_id = $1`,
		accountID,
	).Scan(&txCount)
	if err != nil {
		return err
	}
	if txCount > 0 {
		return ErrAccountHasTransactions
	}

	_, err = s.db.Exec(ctx,
		`DELETE FROM ledger_accounts WHERE id = $1 AND user_id = $2`,
		accountID, userID,
	)
	return err
}

// ── Categories ────────────────────────────────────────────────────────────────

func (s *LedgerService) CreateCategory(ctx context.Context, userID uuid.UUID, req *models.CreateCategoryRequest) (*models.LedgerCategory, error) {
	name, err := cleanCategoryName(req.Name)
	if err != nil {
		return nil, err
	}

	var color string
	if req.Color != nil && strings.TrimSpace(*req.Color) != "" {
		if color, err = normaliseColor(*req.Color); err != nil {
			return nil, err
		}
	} else {
		var used []string
		if err := s.db.QueryRow(ctx,
			`SELECT COALESCE(array_agg(upper(color)) FILTER (WHERE color IS NOT NULL), '{}')
			 FROM ledger_categories WHERE user_id = $1`, userID,
		).Scan(&used); err != nil {
			return nil, err
		}
		color = pickCategoryColor(used)
	}

	if req.ParentID != nil {
		if owned, err := s.ownsCategory(ctx, req.ParentID, userID); err != nil {
			return nil, err
		} else if !owned {
			return nil, ErrCategoryNotFound
		}
	}

	cat := &models.LedgerCategory{}
	err = s.db.QueryRow(ctx,
		`INSERT INTO ledger_categories (user_id, name, type, color, parent_id)
		 VALUES ($1, $2, $3, $4, $5)
		 RETURNING id, user_id, name, type, color, parent_id, created_at`,
		userID, name, req.Type, color, req.ParentID,
	).Scan(&cat.ID, &cat.UserID, &cat.Name, &cat.Type, &cat.Color, &cat.ParentID, &cat.CreatedAt)
	if err != nil {
		if isUniqueViolation(err) {
			return nil, ErrCategoryNameTaken
		}
		return nil, err
	}
	return cat, nil
}

// ListCategories returns the user's category tree: expense before income, then by name.
func (s *LedgerService) ListCategories(ctx context.Context, userID uuid.UUID) ([]models.CategoryTree, error) {
	rows, err := s.db.Query(ctx,
		`SELECT id, user_id, name, type, color, parent_id, created_at
		 FROM ledger_categories WHERE user_id = $1
		 ORDER BY type ASC, lower(name) ASC, name ASC, id ASC`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var all []models.LedgerCategory
	for rows.Next() {
		var c models.LedgerCategory
		if err := rows.Scan(&c.ID, &c.UserID, &c.Name, &c.Type, &c.Color, &c.ParentID, &c.CreatedAt); err != nil {
			return nil, err
		}
		all = append(all, c)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return buildCategoryTree(all), nil
}

// buildCategoryTree nests children under parents in input order; orphans become roots.
func buildCategoryTree(all []models.LedgerCategory) []models.CategoryTree {
	index := map[uuid.UUID]int{}
	result := []models.CategoryTree{}
	for _, c := range all {
		if c.ParentID == nil {
			index[c.ID] = len(result)
			result = append(result, models.CategoryTree{LedgerCategory: c, Children: []models.LedgerCategory{}})
		}
	}
	for _, c := range all {
		if c.ParentID == nil {
			continue
		}
		if i, ok := index[*c.ParentID]; ok {
			result[i].Children = append(result[i].Children, c)
		} else {
			result = append(result, models.CategoryTree{LedgerCategory: c, Children: []models.LedgerCategory{}})
		}
	}
	return result
}

func (s *LedgerService) UpdateCategory(ctx context.Context, userID, catID uuid.UUID, req *models.UpdateCategoryRequest) (*models.LedgerCategory, error) {
	var name, color *string
	if req.Name != nil {
		n, err := cleanCategoryName(*req.Name)
		if err != nil {
			return nil, err
		}
		name = &n
	}
	if req.Color != nil {
		c, err := normaliseColor(*req.Color)
		if err != nil {
			return nil, err
		}
		color = &c
	}

	cat := &models.LedgerCategory{}
	err := s.db.QueryRow(ctx,
		`UPDATE ledger_categories
		 SET name  = COALESCE($3, name),
		     color = COALESCE($4, color)
		 WHERE id = $1 AND user_id = $2
		 RETURNING id, user_id, name, type, color, parent_id, created_at`,
		catID, userID, name, color,
	).Scan(&cat.ID, &cat.UserID, &cat.Name, &cat.Type, &cat.Color, &cat.ParentID, &cat.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrCategoryNotFound
		}
		if isUniqueViolation(err) {
			return nil, ErrCategoryNameTaken
		}
		return nil, err
	}
	return cat, nil
}

// checkCategoryMove allows moving to another category of the same type, or to none (target nil).
func checkCategoryMove(deleted models.LedgerCategory, target *models.LedgerCategory) error {
	if target == nil {
		return nil
	}
	if target.ID == deleted.ID {
		return ledgerInvalid("choose a different category to move the transactions to")
	}
	if target.Type != deleted.Type {
		return ledgerInvalid("transactions can only move to a category of the same type")
	}
	return nil
}

// CategoryDeleteResult says what deleting a category did to the rest.
type CategoryDeleteResult struct {
	Moved          int64 `json:"moved"`
	BudgetsRemoved int64 `json:"budgets_removed"`
}

// DeleteCategory deletes a category in one transaction, moving its transactions to moveTo (nil: uncategorised).
func (s *LedgerService) DeleteCategory(ctx context.Context, userID, catID uuid.UUID, moveTo *uuid.UUID) (*CategoryDeleteResult, error) {
	tx, err := s.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	loadCat := func(id uuid.UUID) (*models.LedgerCategory, error) {
		var c models.LedgerCategory
		err := tx.QueryRow(ctx,
			`SELECT id, user_id, name, type, color, parent_id, created_at
			 FROM ledger_categories WHERE id = $1 AND user_id = $2 FOR UPDATE`, id, userID,
		).Scan(&c.ID, &c.UserID, &c.Name, &c.Type, &c.Color, &c.ParentID, &c.CreatedAt)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrCategoryNotFound
		}
		return &c, err
	}

	deleted, err := loadCat(catID)
	if err != nil {
		return nil, err
	}
	var target *models.LedgerCategory
	if moveTo != nil {
		if target, err = loadCat(*moveTo); err != nil {
			return nil, err
		}
	}
	if err := checkCategoryMove(*deleted, target); err != nil {
		return nil, err
	}

	var targetID *uuid.UUID
	if target != nil {
		targetID = &target.ID
	}
	res := &CategoryDeleteResult{}
	tag, err := tx.Exec(ctx,
		`UPDATE ledger_transactions SET category_id = $3, updated_at = NOW()
		 WHERE user_id = $1 AND category_id = $2`,
		userID, catID, targetID)
	if err != nil {
		return nil, err
	}
	res.Moved = tag.RowsAffected()

	if tag, err = tx.Exec(ctx,
		`DELETE FROM ledger_budgets WHERE user_id = $1 AND category_id = $2`, userID, catID,
	); err != nil {
		return nil, err
	}
	res.BudgetsRemoved = tag.RowsAffected()

	if _, err := tx.Exec(ctx,
		`DELETE FROM ledger_categories WHERE id = $1 AND user_id = $2`, catID, userID,
	); err != nil {
		return nil, err
	}
	return res, tx.Commit(ctx)
}

// ── Transactions ──────────────────────────────────────────────────────────────

func signedAmount(txType string, absAmount float64) float64 {
	switch txType {
	case "income":
		return absAmount
	case "expense", "transfer":
		return -absAmount
	}
	return absAmount
}

// txnSelect reads a transaction with its category and series, in scanTxn's order; callers append WHERE / ORDER BY.
const txnSelect = `
	SELECT t.id, t.user_id, t.account_id, t.category_id, t.type, t.amount,
	       t.description, t.notes, t.date, t.is_recurring, t.recurrence_interval,
	       t.recurrence_day, t.transfer_to_account_id, t.recurrence_next_date, t.recurrence_source_id,
	       t.created_at, t.updated_at, c.name, c.color,
	       CASE WHEN t.is_recurring THEN t.recurrence_interval
	            WHEN h.is_recurring THEN h.recurrence_interval END,
	       CASE WHEN t.is_recurring THEN t.recurrence_next_date
	            WHEN h.is_recurring THEN h.recurrence_next_date END
	FROM ledger_transactions t
	LEFT JOIN ledger_categories c ON c.id = t.category_id
	LEFT JOIN ledger_transactions h ON h.id = t.recurrence_source_id AND h.user_id = t.user_id`

func scanTxn(row pgx.Row, tx *models.LedgerTransaction) error {
	return row.Scan(&tx.ID, &tx.UserID, &tx.AccountID, &tx.CategoryID, &tx.Type,
		&tx.Amount, &tx.Description, &tx.Notes, &tx.Date, &tx.IsRecurring,
		&tx.RecurrenceInterval, &tx.RecurrenceDay, &tx.TransferToAccountID,
		&tx.RecurrenceNextDate, &tx.RecurrenceSourceID,
		&tx.CreatedAt, &tx.UpdatedAt, &tx.CategoryName, &tx.CategoryColor,
		&tx.SeriesInterval, &tx.SeriesNextDate)
}

func (s *LedgerService) queryTransactions(ctx context.Context, sql string, args ...any) ([]models.LedgerTransaction, error) {
	rows, err := s.db.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	txs := []models.LedgerTransaction{}
	for rows.Next() {
		var tx models.LedgerTransaction
		if err := scanTxn(rows, &tx); err != nil {
			return nil, err
		}
		txs = append(txs, tx)
	}
	return txs, rows.Err()
}

// The balance UPDATEs are user-scoped, so an unchecked account id from the body
// silently no-ops instead of failing. Check it first.
func (s *LedgerService) ownsAccount(ctx context.Context, accountID, userID uuid.UUID) (bool, error) {
	var ok bool
	err := s.db.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM ledger_accounts WHERE id = $1 AND user_id = $2)`,
		accountID, userID,
	).Scan(&ok)
	return ok, err
}

// A nil id is valid (uncategorised) and passes.
func (s *LedgerService) ownsCategory(ctx context.Context, categoryID *uuid.UUID, userID uuid.UUID) (bool, error) {
	if categoryID == nil {
		return true, nil
	}
	var ok bool
	err := s.db.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM ledger_categories WHERE id = $1 AND user_id = $2)`,
		*categoryID, userID,
	).Scan(&ok)
	return ok, err
}

func (s *LedgerService) requireAccount(ctx context.Context, accountID, userID uuid.UUID) error {
	owned, err := s.ownsAccount(ctx, accountID, userID)
	if err != nil {
		return err
	}
	if !owned {
		return ErrAccountNotFound
	}
	return nil
}

func (s *LedgerService) requireCategory(ctx context.Context, categoryID *uuid.UUID, userID uuid.UUID) error {
	owned, err := s.ownsCategory(ctx, categoryID, userID)
	if err != nil {
		return err
	}
	if !owned {
		return ErrCategoryNotFound
	}
	return nil
}

func parseLedgerDate(raw string) (time.Time, error) {
	d, err := time.Parse(dayLayout, raw)
	if err != nil {
		return time.Time{}, ledgerInvalid("date must be YYYY-MM-DD")
	}
	return d, nil
}

// cleanNotes turns blank notes into NULL.
func cleanNotes(n *string) *string {
	if n == nil {
		return nil
	}
	t := strings.TrimSpace(*n)
	if t == "" {
		return nil
	}
	return &t
}

// recurrence is what a transaction's recurring columns will hold.
type recurrence struct {
	on       bool
	interval *string
	day      *int
	next     *time.Time
}

// newRecurrence arms a series from start; the first copy is after max(start, lastCopy), so no date repeats.
func newRecurrence(start time.Time, interval string, lastCopy time.Time) recurrence {
	anchor := start.Day()
	after := start
	if lastCopy.After(after) {
		after = lastCopy
	}
	next := nextOccurrenceAfter(start, interval, anchor, after)
	return recurrence{on: true, interval: &interval, day: &anchor, next: &next}
}

func (s *LedgerService) CreateTransaction(ctx context.Context, userID uuid.UUID, req *models.CreateTransactionRequest) (*models.LedgerTransaction, error) {
	txDate, err := parseLedgerDate(req.Date)
	if err != nil {
		return nil, err
	}
	absAmount := math.Abs(req.Amount)
	if absAmount == 0 {
		return nil, ledgerInvalid("amount must not be zero")
	}

	rec := recurrence{}
	if req.IsRecurring {
		interval := deref(req.RecurrenceInterval)
		if !ValidRecurrenceInterval(interval) {
			return nil, ledgerInvalid("choose how often it repeats: weekly, biweekly, monthly or yearly")
		}
		rec = newRecurrence(txDate, interval, time.Time{})
	}

	if err := s.requireAccount(ctx, req.AccountID, userID); err != nil {
		return nil, err
	}

	if req.Type == "transfer" {
		return s.createTransfer(ctx, userID, req, txDate, absAmount, rec)
	}
	if err := s.requireCategory(ctx, req.CategoryID, userID); err != nil {
		return nil, err
	}
	signedAmt := signedAmount(req.Type, absAmount)

	tx, err := s.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var id uuid.UUID
	err = tx.QueryRow(ctx,
		`INSERT INTO ledger_transactions
		 (user_id, account_id, category_id, type, amount, description, notes, date,
		  is_recurring, recurrence_interval, recurrence_day, recurrence_next_date)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
		 RETURNING id`,
		userID, req.AccountID, req.CategoryID, req.Type, signedAmt, strings.TrimSpace(req.Description),
		cleanNotes(req.Notes), txDate, rec.on, rec.interval, rec.day, rec.next,
	).Scan(&id)
	if err != nil {
		return nil, err
	}

	if _, err = tx.Exec(ctx,
		`UPDATE ledger_accounts SET balance = balance + $1, updated_at = NOW() WHERE id = $2 AND user_id = $3`,
		signedAmt, req.AccountID, userID,
	); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return s.GetTransaction(ctx, userID, id)
}

func (s *LedgerService) createTransfer(ctx context.Context, userID uuid.UUID, req *models.CreateTransactionRequest, txDate time.Time, absAmount float64, rec recurrence) (*models.LedgerTransaction, error) {
	if req.TransferToAccountID == nil {
		return nil, ledgerInvalid("choose the account the money goes to")
	}
	if *req.TransferToAccountID == req.AccountID {
		return nil, ledgerInvalid("a transfer needs two different accounts")
	}
	if err := s.requireAccount(ctx, *req.TransferToAccountID, userID); err != nil {
		return nil, err
	}

	tx, err := s.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	desc, notes := strings.TrimSpace(req.Description), cleanNotes(req.Notes)

	// Source row (negative). It alone carries the series, if any.
	var id uuid.UUID
	err = tx.QueryRow(ctx,
		`INSERT INTO ledger_transactions
		 (user_id, account_id, type, amount, description, notes, date,
		  is_recurring, recurrence_interval, recurrence_day, recurrence_next_date, transfer_to_account_id)
		 VALUES ($1,$2,'transfer',$3,$4,$5,$6,$7,$8,$9,$10,$11)
		 RETURNING id`,
		userID, req.AccountID, -absAmount, desc, notes, txDate,
		rec.on, rec.interval, rec.day, rec.next, req.TransferToAccountID,
	).Scan(&id)
	if err != nil {
		return nil, err
	}

	// Destination row (positive); transfer_to_account_id points back to the source account.
	if _, err = tx.Exec(ctx,
		`INSERT INTO ledger_transactions
		 (user_id, account_id, type, amount, description, notes, date, transfer_to_account_id)
		 VALUES ($1,$2,'transfer',$3,$4,$5,$6,$7)`,
		userID, req.TransferToAccountID, absAmount, desc, notes, txDate, req.AccountID,
	); err != nil {
		return nil, err
	}

	if _, err = tx.Exec(ctx,
		`UPDATE ledger_accounts SET balance = balance - $1, updated_at = NOW() WHERE id = $2 AND user_id = $3`,
		absAmount, req.AccountID, userID,
	); err != nil {
		return nil, err
	}
	if _, err = tx.Exec(ctx,
		`UPDATE ledger_accounts SET balance = balance + $1, updated_at = NOW() WHERE id = $2 AND user_id = $3`,
		absAmount, req.TransferToAccountID, userID,
	); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return s.GetTransaction(ctx, userID, id)
}

// ListTransactions lists transactions newest first; a transfer appears once, by its source leg.
func (s *LedgerService) ListTransactions(ctx context.Context, userID uuid.UUID, f models.TransactionFilters) ([]models.LedgerTransaction, error) {
	query := txnSelect + `
		WHERE t.user_id = $1 AND NOT (t.type = 'transfer' AND t.amount > 0)`

	args := []interface{}{userID}
	argN := 2

	if f.From != "" {
		query += fmt.Sprintf(" AND t.date >= $%d", argN)
		args = append(args, f.From)
		argN++
	}
	if f.To != "" {
		query += fmt.Sprintf(" AND t.date <= $%d", argN)
		args = append(args, f.To)
		argN++
	}
	if f.AccountID != "" {
		query += fmt.Sprintf(" AND (t.account_id = $%d OR (t.type = 'transfer' AND t.transfer_to_account_id = $%d))", argN, argN)
		args = append(args, f.AccountID)
		argN++
	}
	if f.CategoryID != "" {
		query += fmt.Sprintf(" AND t.category_id = $%d", argN)
		args = append(args, f.CategoryID)
		argN++
	}
	if f.Type != "" {
		query += fmt.Sprintf(" AND t.type = $%d", argN)
		args = append(args, f.Type)
		argN++
	}
	// Free-text search over the description and the notes. COALESCE because
	// notes is nullable and NULL ILIKE anything is NULL, not false.
	if f.Q != "" {
		query += fmt.Sprintf(" AND (t.description ILIKE $%d OR COALESCE(t.notes, '') ILIKE $%d)", argN, argN)
		args = append(args, "%"+f.Q+"%")
		argN++
	}

	query += " ORDER BY t.date DESC, t.created_at DESC, t.id DESC"

	limit := f.Limit
	if limit <= 0 {
		limit = 50
	}
	offset := (f.Page - 1) * limit
	if offset < 0 {
		offset = 0
	}
	query += fmt.Sprintf(" LIMIT $%d OFFSET $%d", argN, argN+1)
	args = append(args, limit, offset)

	return s.queryTransactions(ctx, query, args...)
}

func (s *LedgerService) GetTransaction(ctx context.Context, userID, txID uuid.UUID) (*models.LedgerTransaction, error) {
	var tx models.LedgerTransaction
	err := scanTxn(s.db.QueryRow(ctx, txnSelect+` WHERE t.id = $1 AND t.user_id = $2`, txID, userID), &tx)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrTransactionNotFound
		}
		return nil, err
	}
	return &tx, nil
}

// queryRower is what both a pool and a transaction offer.
type queryRower interface {
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

// transferPartner finds a transfer's other leg (same date, opposite amount), or nil when gone.
func transferPartner(ctx context.Context, q queryRower, userID uuid.UUID, leg *models.LedgerTransaction) (*models.LedgerTransaction, error) {
	if leg.Type != "transfer" || leg.TransferToAccountID == nil {
		return nil, nil
	}
	var p models.LedgerTransaction
	err := scanTxn(q.QueryRow(ctx, txnSelect+`
		WHERE t.user_id = $1 AND t.type = 'transfer' AND t.id <> $2
		  AND t.account_id = $3 AND t.transfer_to_account_id = $4
		  AND t.date = $5 AND t.amount = $6
		ORDER BY (t.recurrence_source_id IS NOT DISTINCT FROM $7) DESC,
		         abs(extract(epoch FROM t.created_at - $8::timestamptz)) ASC
		LIMIT 1`,
		userID, leg.ID, *leg.TransferToAccountID, leg.AccountID, dateOnly(leg.Date), -leg.Amount,
		leg.RecurrenceSourceID, leg.CreatedAt), &p)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &p, nil
}

// resolveRecurrence works out the recurring columns after an edit; a Ledger-written copy cannot start a series.
func (s *LedgerService) resolveRecurrence(ctx context.Context, existing *models.LedgerTransaction, req *models.UpdateTransactionRequest, newDate time.Time) (recurrence, error) {
	current := recurrence{
		on: existing.IsRecurring, interval: existing.RecurrenceInterval,
		day: existing.RecurrenceDay, next: existing.RecurrenceNextDate,
	}
	want := existing.IsRecurring
	if req.IsRecurring != nil {
		want = *req.IsRecurring
	}
	if !want {
		if !existing.IsRecurring {
			return current, nil
		}
		// Stopped: the interval is kept for the record, nothing more is written.
		return recurrence{on: false, interval: existing.RecurrenceInterval, day: existing.RecurrenceDay}, nil
	}
	if existing.RecurrenceSourceID != nil && !existing.IsRecurring {
		return recurrence{}, ledgerInvalid("this transaction was added by a repeating series; edit or stop the series instead")
	}
	interval := deref(existing.RecurrenceInterval)
	if req.RecurrenceInterval != nil && *req.RecurrenceInterval != "" {
		interval = *req.RecurrenceInterval
	}
	if !ValidRecurrenceInterval(interval) {
		return recurrence{}, ledgerInvalid("choose how often it repeats: weekly, biweekly, monthly or yearly")
	}
	unchanged := existing.IsRecurring && existing.RecurrenceNextDate != nil &&
		interval == deref(existing.RecurrenceInterval) && newDate.Equal(dateOnly(existing.Date))
	if unchanged {
		return current, nil
	}

	var last *time.Time
	if err := s.db.QueryRow(ctx,
		`SELECT max(date) FROM ledger_transactions
		 WHERE recurrence_source_id = $1 AND NOT (type = 'transfer' AND amount > 0)`, existing.ID,
	).Scan(&last); err != nil {
		return recurrence{}, err
	}
	lastCopy := time.Time{}
	if last != nil {
		lastCopy = dateOnly(*last)
	}
	return newRecurrence(newDate, interval, lastCopy), nil
}

// UpdateTransaction applies an edit and moves balances with it, in one transaction.
func (s *LedgerService) UpdateTransaction(ctx context.Context, userID, txID uuid.UUID, req *models.UpdateTransactionRequest) (*models.LedgerTransaction, error) {
	existing, err := s.GetTransaction(ctx, userID, txID)
	if err != nil {
		return nil, err
	}
	if existing.Type == "transfer" {
		return s.updateTransfer(ctx, userID, existing, req)
	}

	newAccountID := existing.AccountID
	if req.AccountID != nil {
		if err := s.requireAccount(ctx, *req.AccountID, userID); err != nil {
			return nil, err
		}
		newAccountID = *req.AccountID
	}
	newCategoryID := existing.CategoryID
	if req.CategoryID.Set {
		if err := s.requireCategory(ctx, req.CategoryID.Value, userID); err != nil {
			return nil, err
		}
		newCategoryID = req.CategoryID.Value
	}
	newAmount := existing.Amount
	if req.Amount != nil {
		if *req.Amount == 0 {
			return nil, ledgerInvalid("amount must not be zero")
		}
		newAmount = signedAmount(existing.Type, math.Abs(*req.Amount))
	}
	newDescription := existing.Description
	if req.Description != nil {
		newDescription = strings.TrimSpace(*req.Description)
	}
	newNotes := existing.Notes
	if req.Notes != nil {
		newNotes = cleanNotes(req.Notes)
	}
	newDate := dateOnly(existing.Date)
	if req.Date != nil {
		if newDate, err = parseLedgerDate(*req.Date); err != nil {
			return nil, err
		}
	}
	rec, err := s.resolveRecurrence(ctx, existing, req, newDate)
	if err != nil {
		return nil, err
	}

	dbtx, err := s.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return nil, err
	}
	defer dbtx.Rollback(ctx)

	// Take the old amount off the old account, put the new one on the new.
	if _, err = dbtx.Exec(ctx,
		`UPDATE ledger_accounts SET balance = balance - $1, updated_at = NOW() WHERE id = $2 AND user_id = $3`,
		existing.Amount, existing.AccountID, userID,
	); err != nil {
		return nil, err
	}
	if _, err = dbtx.Exec(ctx,
		`UPDATE ledger_accounts SET balance = balance + $1, updated_at = NOW() WHERE id = $2 AND user_id = $3`,
		newAmount, newAccountID, userID,
	); err != nil {
		return nil, err
	}

	if _, err = dbtx.Exec(ctx,
		`UPDATE ledger_transactions
		 SET account_id           = $3,
		     category_id          = $4,
		     amount               = $5,
		     description          = $6,
		     notes                = $7,
		     date                 = $8,
		     is_recurring         = $9,
		     recurrence_interval  = $10,
		     recurrence_day       = $11,
		     recurrence_next_date = $12,
		     updated_at           = NOW()
		 WHERE id = $1 AND user_id = $2`,
		txID, userID, newAccountID, newCategoryID, newAmount, newDescription, newNotes, newDate,
		rec.on, rec.interval, rec.day, rec.next,
	); err != nil {
		return nil, err
	}

	if err := dbtx.Commit(ctx); err != nil {
		return nil, err
	}
	return s.GetTransaction(ctx, userID, txID)
}

// updateTransfer edits both legs of a transfer together, working from the source leg.
func (s *LedgerService) updateTransfer(ctx context.Context, userID uuid.UUID, existing *models.LedgerTransaction, req *models.UpdateTransactionRequest) (*models.LedgerTransaction, error) {
	src := existing
	if existing.Amount > 0 {
		p, err := transferPartner(ctx, s.db, userID, existing)
		if err != nil {
			return nil, err
		}
		if p == nil {
			return nil, ledgerInvalid("the other side of this transfer is missing; delete it and log it again")
		}
		src = p
	}
	dst, err := transferPartner(ctx, s.db, userID, src)
	if err != nil {
		return nil, err
	}

	oldAbs := math.Abs(src.Amount)
	oldFrom := src.AccountID
	var oldTo uuid.UUID
	if src.TransferToAccountID != nil {
		oldTo = *src.TransferToAccountID
	}

	newFrom, newTo := oldFrom, oldTo
	if req.AccountID != nil {
		newFrom = *req.AccountID
	}
	if req.TransferToAccountID != nil {
		newTo = *req.TransferToAccountID
	}
	if newTo == uuid.Nil {
		return nil, ledgerInvalid("choose the account the money goes to")
	}
	if newFrom == newTo {
		return nil, ledgerInvalid("a transfer needs two different accounts")
	}
	if err := s.requireAccount(ctx, newFrom, userID); err != nil {
		return nil, err
	}
	if err := s.requireAccount(ctx, newTo, userID); err != nil {
		return nil, err
	}

	newAbs := oldAbs
	if req.Amount != nil {
		if *req.Amount == 0 {
			return nil, ledgerInvalid("amount must not be zero")
		}
		newAbs = math.Abs(*req.Amount)
	}
	newDescription := src.Description
	if req.Description != nil {
		newDescription = strings.TrimSpace(*req.Description)
	}
	newNotes := src.Notes
	if req.Notes != nil {
		newNotes = cleanNotes(req.Notes)
	}
	newDate := dateOnly(src.Date)
	if req.Date != nil {
		if newDate, err = parseLedgerDate(*req.Date); err != nil {
			return nil, err
		}
	}
	rec, err := s.resolveRecurrence(ctx, src, req, newDate)
	if err != nil {
		return nil, err
	}

	tx, err := s.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	move := func(account uuid.UUID, delta float64) error {
		_, err := tx.Exec(ctx,
			`UPDATE ledger_accounts SET balance = balance + $1, updated_at = NOW() WHERE id = $2 AND user_id = $3`,
			delta, account, userID)
		return err
	}
	// Undo the old transfer, then apply the new one.
	if err := move(oldFrom, oldAbs); err != nil {
		return nil, err
	}
	if dst != nil {
		if err := move(dst.AccountID, -oldAbs); err != nil {
			return nil, err
		}
	}
	if err := move(newFrom, -newAbs); err != nil {
		return nil, err
	}
	if err := move(newTo, newAbs); err != nil {
		return nil, err
	}

	if _, err := tx.Exec(ctx,
		`UPDATE ledger_transactions
		 SET account_id = $3, transfer_to_account_id = $4, amount = $5, description = $6, notes = $7,
		     date = $8, is_recurring = $9, recurrence_interval = $10, recurrence_day = $11,
		     recurrence_next_date = $12, updated_at = NOW()
		 WHERE id = $1 AND user_id = $2`,
		src.ID, userID, newFrom, newTo, -newAbs, newDescription, newNotes, newDate,
		rec.on, rec.interval, rec.day, rec.next,
	); err != nil {
		return nil, err
	}
	if dst != nil {
		_, err = tx.Exec(ctx,
			`UPDATE ledger_transactions
			 SET account_id = $3, transfer_to_account_id = $4, amount = $5, description = $6, notes = $7,
			     date = $8, updated_at = NOW()
			 WHERE id = $1 AND user_id = $2`,
			dst.ID, userID, newTo, newFrom, newAbs, newDescription, newNotes, newDate)
	} else {
		// The other leg was lost; write it again so the pair is whole.
		_, err = tx.Exec(ctx,
			`INSERT INTO ledger_transactions
			 (user_id, account_id, type, amount, description, notes, date, transfer_to_account_id, recurrence_source_id)
			 VALUES ($1,$2,'transfer',$3,$4,$5,$6,$7,$8)`,
			userID, newTo, newAbs, newDescription, newNotes, newDate, newFrom, src.RecurrenceSourceID)
	}
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return s.GetTransaction(ctx, userID, src.ID)
}

// StopRecurring stops the series a transaction heads or came from; copies already written stay.
func (s *LedgerService) StopRecurring(ctx context.Context, userID, txID uuid.UUID) (*models.LedgerTransaction, error) {
	t, err := s.GetTransaction(ctx, userID, txID)
	if err != nil {
		return nil, err
	}
	head := t
	if t.Type == "transfer" && t.Amount > 0 {
		if p, err := transferPartner(ctx, s.db, userID, t); err != nil {
			return nil, err
		} else if p != nil {
			head = p
		}
	}
	headID := head.ID
	if head.RecurrenceSourceID != nil && !head.IsRecurring {
		headID = *head.RecurrenceSourceID
	}
	if _, err := s.db.Exec(ctx,
		`UPDATE ledger_transactions SET is_recurring = FALSE, recurrence_next_date = NULL, updated_at = NOW()
		 WHERE id = $1 AND user_id = $2`, headID, userID,
	); err != nil {
		return nil, err
	}
	return s.GetTransaction(ctx, userID, txID)
}

func (s *LedgerService) DeleteTransaction(ctx context.Context, userID, txID uuid.UUID) error {
	existing, err := s.GetTransaction(ctx, userID, txID)
	if err != nil {
		return err
	}

	dbtx, err := s.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return err
	}
	defer dbtx.Rollback(ctx)

	// Reverse balance on this account
	if _, err = dbtx.Exec(ctx,
		`UPDATE ledger_accounts SET balance = balance - $1, updated_at = NOW() WHERE id = $2 AND user_id = $3`,
		existing.Amount, existing.AccountID, userID,
	); err != nil {
		return err
	}

	// For transfers: also delete + reverse the paired row
	partner, err := transferPartner(ctx, dbtx, userID, existing)
	if err != nil {
		return err
	}
	if partner != nil {
		if _, err := dbtx.Exec(ctx,
			`UPDATE ledger_accounts SET balance = balance - $1, updated_at = NOW() WHERE id = $2 AND user_id = $3`,
			partner.Amount, partner.AccountID, userID,
		); err != nil {
			return err
		}
		if _, err := dbtx.Exec(ctx, `DELETE FROM ledger_transactions WHERE id = $1 AND user_id = $2`, partner.ID, userID); err != nil {
			return err
		}
	}

	if _, err = dbtx.Exec(ctx, `DELETE FROM ledger_transactions WHERE id = $1 AND user_id = $2`, txID, userID); err != nil {
		return err
	}

	return dbtx.Commit(ctx)
}

// ── Budgets ───────────────────────────────────────────────────────────────────

const budgetReturning = `RETURNING id, user_id, category_id, amount, period, start_date, created_at, updated_at`

func scanBudget(row pgx.Row, b *models.LedgerBudget) error {
	return row.Scan(&b.ID, &b.UserID, &b.CategoryID, &b.Amount, &b.Period,
		&b.StartDate, &b.CreatedAt, &b.UpdatedAt)
}

func (s *LedgerService) CreateBudget(ctx context.Context, userID uuid.UUID, req *models.CreateBudgetRequest, tzHint string) (*models.LedgerBudget, error) {
	var startDate time.Time
	if req.StartDate != "" {
		var err error
		if startDate, err = parseLedgerDate(req.StartDate); err != nil {
			return nil, err
		}
	} else {
		loc, err := userLocation(ctx, s.db, userID, tzHint)
		if err != nil {
			return nil, err
		}
		startDate = calendarToday(time.Now(), loc)
	}

	if err := s.requireCategory(ctx, &req.CategoryID, userID); err != nil {
		return nil, err
	}

	budget := &models.LedgerBudget{}
	err := scanBudget(s.db.QueryRow(ctx,
		`INSERT INTO ledger_budgets (user_id, category_id, amount, period, start_date)
		 VALUES ($1, $2, $3, $4, $5)
		 ON CONFLICT (user_id, category_id, period) DO UPDATE
		   SET amount = EXCLUDED.amount, updated_at = NOW()
		 `+budgetReturning,
		userID, req.CategoryID, req.Amount, req.Period, startDate,
	), budget)
	if err != nil {
		return nil, err
	}
	return budget, nil
}

// UpdateBudget changes a budget's limit or period in place.
func (s *LedgerService) UpdateBudget(ctx context.Context, userID, budgetID uuid.UUID, req *models.UpdateBudgetRequest) (*models.LedgerBudget, error) {
	budget := &models.LedgerBudget{}
	err := scanBudget(s.db.QueryRow(ctx,
		`UPDATE ledger_budgets
		 SET amount = COALESCE($3, amount), period = COALESCE($4, period), updated_at = NOW()
		 WHERE id = $1 AND user_id = $2
		 `+budgetReturning,
		budgetID, userID, req.Amount, req.Period,
	), budget)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrBudgetNotFound
		}
		if isUniqueViolation(err) {
			return nil, ErrBudgetExists
		}
		return nil, err
	}
	return budget, nil
}

// ListBudgets returns budgets with spend in their current period, cut at the user's midnight.
func (s *LedgerService) ListBudgets(ctx context.Context, userID uuid.UUID, tzHint string) ([]models.BudgetWithSpend, error) {
	loc, err := userLocation(ctx, s.db, userID, tzHint)
	if err != nil {
		return nil, err
	}
	today := calendarToday(time.Now(), loc).Format(dayLayout)

	// Single query: JOIN transactions for the current period using SQL date functions,
	// eliminating the N+1 pattern of one query per budget.
	rows, err := s.db.Query(ctx,
		`SELECT b.id, b.user_id, b.category_id, b.amount, b.period, b.start_date,
		        b.created_at, b.updated_at, c.name, c.color,
		        COALESCE(SUM(ABS(t.amount)), 0) AS spent
		 FROM ledger_budgets b
		 JOIN ledger_categories c ON c.id = b.category_id
		 LEFT JOIN ledger_transactions t
		        ON  t.user_id     = b.user_id
		        AND t.category_id = b.category_id
		        AND t.type        = 'expense'
		        AND t.date BETWEEN
		            CASE b.period
		                WHEN 'weekly' THEN date_trunc('week',  $2::date)::date
		                WHEN 'yearly' THEN date_trunc('year',  $2::date)::date
		                ELSE               date_trunc('month', $2::date)::date
		            END
		            AND
		            CASE b.period
		                WHEN 'weekly' THEN (date_trunc('week',  $2::date) + INTERVAL '6 days')::date
		                WHEN 'yearly' THEN (date_trunc('year',  $2::date) + INTERVAL '1 year'  - INTERVAL '1 day')::date
		                ELSE               (date_trunc('month', $2::date) + INTERVAL '1 month' - INTERVAL '1 day')::date
		            END
		 WHERE b.user_id = $1
		 GROUP BY b.id, b.user_id, b.category_id, b.amount, b.period, b.start_date,
		          b.created_at, b.updated_at, c.name, c.color
		 ORDER BY lower(c.name) ASC, b.period ASC`,
		userID, today,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	budgets := []models.BudgetWithSpend{}
	for rows.Next() {
		var b models.BudgetWithSpend
		var spent float64
		if err := rows.Scan(&b.ID, &b.UserID, &b.CategoryID, &b.Amount, &b.Period,
			&b.StartDate, &b.CreatedAt, &b.UpdatedAt, &b.CategoryName, &b.CategoryColor, &spent); err != nil {
			return nil, err
		}
		b.Spent = spent
		b.Remaining = b.Amount - spent
		if b.Amount > 0 {
			b.PctUsed = (spent / b.Amount) * 100
		}
		budgets = append(budgets, b)
	}
	return budgets, rows.Err()
}

func (s *LedgerService) DeleteBudget(ctx context.Context, userID, budgetID uuid.UUID) error {
	tag, err := s.db.Exec(ctx,
		`DELETE FROM ledger_budgets WHERE id = $1 AND user_id = $2`,
		budgetID, userID,
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrBudgetNotFound
	}
	return nil
}

// ── Net Worth ─────────────────────────────────────────────────────────────────

func (s *LedgerService) CreateSnapshot(ctx context.Context, userID uuid.UUID, req *models.CreateSnapshotRequest) (*models.NetWorthSnapshot, error) {
	date, err := parseLedgerDate(req.SnapshotDate)
	if err != nil {
		return nil, err
	}

	snap := &models.NetWorthSnapshot{}
	err = s.db.QueryRow(ctx,
		`INSERT INTO ledger_networth_snapshots (user_id, assets_total, liabilities_total, snapshot_date)
		 VALUES ($1, $2, $3, $4)
		 ON CONFLICT (user_id, snapshot_date) DO UPDATE
		   SET assets_total = EXCLUDED.assets_total, liabilities_total = EXCLUDED.liabilities_total
		 RETURNING id, user_id, assets_total, liabilities_total, net_worth, snapshot_date`,
		userID, req.AssetsTotal, req.LiabilitiesTotal, date,
	).Scan(&snap.ID, &snap.UserID, &snap.AssetsTotal, &snap.LiabilitiesTotal, &snap.NetWorth, &snap.SnapshotDate)
	if err != nil {
		return nil, err
	}
	return snap, nil
}

func (s *LedgerService) ListSnapshots(ctx context.Context, userID uuid.UUID) ([]models.NetWorthSnapshot, error) {
	rows, err := s.db.Query(ctx,
		`SELECT id, user_id, assets_total, liabilities_total, net_worth, snapshot_date
		 FROM ledger_networth_snapshots WHERE user_id = $1
		 ORDER BY snapshot_date ASC`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	snaps := []models.NetWorthSnapshot{}
	for rows.Next() {
		var s models.NetWorthSnapshot
		if err := rows.Scan(&s.ID, &s.UserID, &s.AssetsTotal, &s.LiabilitiesTotal, &s.NetWorth, &s.SnapshotDate); err != nil {
			return nil, err
		}
		snaps = append(snaps, s)
	}
	return snaps, rows.Err()
}

// ── Summary ───────────────────────────────────────────────────────────────────

// GetSummary totals income and spending for month (YYYY-MM; empty for the user's current month).
func (s *LedgerService) GetSummary(ctx context.Context, userID uuid.UUID, month, tzHint string) (*models.LedgerSummary, error) {
	if month == "" {
		loc, err := userLocation(ctx, s.db, userID, tzHint)
		if err != nil {
			return nil, err
		}
		month = calendarToday(time.Now(), loc).Format("2006-01")
	}
	parsed, err := time.Parse("2006-01-02", month+"-01")
	if err != nil {
		return nil, ledgerInvalid("month must be YYYY-MM")
	}
	from := parsed.Format(dayLayout)
	to := parsed.AddDate(0, 1, -1).Format(dayLayout)

	var income, expenses float64
	if err := s.db.QueryRow(ctx,
		`SELECT
		   COALESCE(SUM(CASE WHEN type='income' THEN ABS(amount) ELSE 0 END), 0)::float8,
		   COALESCE(SUM(CASE WHEN type='expense' THEN ABS(amount) ELSE 0 END), 0)::float8
		 FROM ledger_transactions
		 WHERE user_id = $1 AND date BETWEEN $2 AND $3 AND type != 'transfer'`,
		userID, from, to,
	).Scan(&income, &expenses); err != nil {
		return nil, err
	}

	net := round2(income - expenses)
	savingsRate := 0.0
	if income > 0 {
		savingsRate = (net / income) * 100
	}

	return &models.LedgerSummary{
		Month:       month,
		Income:      round2(income),
		Expenses:    round2(expenses),
		Net:         net,
		SavingsRate: math.Round(savingsRate*10) / 10,
	}, nil
}

// ── Comparison ────────────────────────────────────────────────────────────────

func round2(v float64) float64 { return math.Round(v*100) / 100 }

// compareValues returns Delta B - A and DeltaPct as a share of |A|, nil when A is zero.
func compareValues(a, b float64) models.ComparisonValue {
	a, b = round2(a), round2(b)
	v := models.ComparisonValue{A: a, B: b, Delta: round2(b - a)}
	if a != 0 {
		pct := math.Round((b-a)/math.Abs(a)*1000) / 10
		v.DeltaPct = &pct
	}
	return v
}

// comparisonRow is one category's positive income or spending in each period.
type comparisonRow struct {
	categoryID *uuid.UUID
	name       string
	color      *string
	txType     string
	a, b       float64
}

// buildComparison totals by type and orders categories by size of change, then type and name.
func buildComparison(rows []comparisonRow) (models.ComparisonSummary, []models.ComparisonCategory) {
	var aIncome, bIncome, aExpenses, bExpenses float64
	cats := make([]models.ComparisonCategory, 0, len(rows))
	for _, r := range rows {
		if r.txType == "income" {
			aIncome += r.a
			bIncome += r.b
		} else {
			aExpenses += r.a
			bExpenses += r.b
		}
		v := compareValues(r.a, r.b)
		cats = append(cats, models.ComparisonCategory{
			CategoryID: r.categoryID, Name: r.name, Type: r.txType, Color: r.color,
			A: v.A, B: v.B, Delta: v.Delta, DeltaPct: v.DeltaPct,
		})
	}
	sort.SliceStable(cats, func(i, j int) bool {
		di, dj := math.Abs(cats[i].Delta), math.Abs(cats[j].Delta)
		if di != dj {
			return di > dj
		}
		if cats[i].Type != cats[j].Type {
			return cats[i].Type < cats[j].Type
		}
		return strings.ToLower(cats[i].Name) < strings.ToLower(cats[j].Name)
	})
	return models.ComparisonSummary{
		Income:   compareValues(aIncome, bIncome),
		Expenses: compareValues(aExpenses, bExpenses),
		Net:      compareValues(aIncome-aExpenses, bIncome-bExpenses),
	}, cats
}

// GetComparison compares period B with base period A; positive means higher in B.
func (s *LedgerService) GetComparison(ctx context.Context, userID uuid.UUID, aFrom, aTo, bFrom, bTo string) (*models.ComparisonResponse, error) {
	for _, pair := range [][2]string{{aFrom, aTo}, {bFrom, bTo}} {
		from, err := parseLedgerDate(pair[0])
		if err != nil {
			return nil, err
		}
		to, err := parseLedgerDate(pair[1])
		if err != nil {
			return nil, err
		}
		if to.Before(from) {
			return nil, ledgerInvalid("each period must end on or after the day it starts")
		}
	}

	rows, err := s.db.Query(ctx,
		`SELECT t.category_id, c.name, c.color, t.type,
		        COALESCE(SUM(ABS(t.amount)) FILTER (WHERE t.date BETWEEN $2 AND $3), 0)::float8,
		        COALESCE(SUM(ABS(t.amount)) FILTER (WHERE t.date BETWEEN $4 AND $5), 0)::float8
		 FROM ledger_transactions t
		 LEFT JOIN ledger_categories c ON c.id = t.category_id AND c.user_id = t.user_id
		 WHERE t.user_id = $1 AND t.type IN ('income', 'expense')
		   AND (t.date BETWEEN $2 AND $3 OR t.date BETWEEN $4 AND $5)
		 GROUP BY t.category_id, c.name, c.color, t.type`,
		userID, aFrom, aTo, bFrom, bTo,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []comparisonRow
	for rows.Next() {
		var r comparisonRow
		var name *string
		if err := rows.Scan(&r.categoryID, &name, &r.color, &r.txType, &r.a, &r.b); err != nil {
			return nil, err
		}
		r.name = "Uncategorised"
		if name != nil {
			r.name = *name
		} else {
			r.categoryID = nil
		}
		list = append(list, r)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	summary, cats := buildComparison(list)
	return &models.ComparisonResponse{
		PeriodA:    models.ComparisonPeriod{From: aFrom, To: aTo},
		PeriodB:    models.ComparisonPeriod{From: bFrom, To: bTo},
		Summary:    summary,
		Categories: cats,
	}, nil
}
