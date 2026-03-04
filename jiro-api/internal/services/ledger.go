package services

import (
	"context"
	"errors"
	"fmt"
	"math"
	"time"

	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/models"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog/log"
)

var (
	ErrAccountNotFound      = errors.New("account not found")
	ErrAccountHasTransactions = errors.New("account has transactions and cannot be deleted")
	ErrCategoryNotFound     = errors.New("category not found")
	ErrBudgetNotFound       = errors.New("budget not found")
	ErrTransactionNotFound  = errors.New("transaction not found")
	ErrLedgerNotOwner       = errors.New("you do not own this resource")
)

type LedgerService struct {
	db *pgxpool.Pool
}

func NewLedgerService(db *pgxpool.Pool) *LedgerService {
	return &LedgerService{db: db}
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

func (s *LedgerService) CreateAccount(ctx context.Context, userID uuid.UUID, req *models.CreateAccountRequest) (*models.LedgerAccount, error) {
	currency := req.Currency
	if currency == "" {
		currency = "USD"
	}

	acc := &models.LedgerAccount{}
	err := s.db.QueryRow(ctx,
		`INSERT INTO ledger_accounts (user_id, name, type, currency, balance)
		 VALUES ($1, $2, $3, $4, $5)
		 RETURNING id, user_id, name, type, currency, balance, is_active, created_at, updated_at`,
		userID, req.Name, req.Type, currency, req.Balance,
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
	return accounts, nil
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

	rows, err := s.db.Query(ctx,
		`SELECT t.id, t.user_id, t.account_id, t.category_id, t.type, t.amount,
		        t.description, t.notes, t.date, t.is_recurring, t.recurrence_interval,
		        t.recurrence_day, t.transfer_to_account_id, t.created_at, t.updated_at,
		        c.name, c.color
		 FROM ledger_transactions t
		 LEFT JOIN ledger_categories c ON c.id = t.category_id
		 WHERE t.account_id = $1 AND t.user_id = $2
		 ORDER BY t.date DESC, t.created_at DESC LIMIT 10`,
		accountID, userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	acc.RecentTransactions = []models.LedgerTransaction{}
	for rows.Next() {
		var tx models.LedgerTransaction
		if err := rows.Scan(&tx.ID, &tx.UserID, &tx.AccountID, &tx.CategoryID, &tx.Type,
			&tx.Amount, &tx.Description, &tx.Notes, &tx.Date, &tx.IsRecurring,
			&tx.RecurrenceInterval, &tx.RecurrenceDay, &tx.TransferToAccountID,
			&tx.CreatedAt, &tx.UpdatedAt, &tx.CategoryName, &tx.CategoryColor); err != nil {
			return nil, err
		}
		acc.RecentTransactions = append(acc.RecentTransactions, tx)
	}
	return acc, nil
}

func (s *LedgerService) UpdateAccount(ctx context.Context, userID, accountID uuid.UUID, req *models.UpdateAccountRequest) (*models.LedgerAccount, error) {
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
	cat := &models.LedgerCategory{}
	err := s.db.QueryRow(ctx,
		`INSERT INTO ledger_categories (user_id, name, type, color, parent_id)
		 VALUES ($1, $2, $3, $4, $5)
		 RETURNING id, user_id, name, type, color, parent_id, created_at`,
		userID, req.Name, req.Type, req.Color, req.ParentID,
	).Scan(&cat.ID, &cat.UserID, &cat.Name, &cat.Type, &cat.Color, &cat.ParentID, &cat.CreatedAt)
	if err != nil {
		return nil, err
	}
	return cat, nil
}

func (s *LedgerService) ListCategories(ctx context.Context, userID uuid.UUID) ([]models.CategoryTree, error) {
	rows, err := s.db.Query(ctx,
		`SELECT id, user_id, name, type, color, parent_id, created_at
		 FROM ledger_categories WHERE user_id = $1 ORDER BY name ASC`,
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

	// Assemble tree in Go
	parentMap := map[uuid.UUID]*models.CategoryTree{}
	result := []models.CategoryTree{}

	// First pass: create all parent nodes (no parent_id)
	for _, c := range all {
		if c.ParentID == nil {
			node := models.CategoryTree{LedgerCategory: c, Children: []models.LedgerCategory{}}
			parentMap[c.ID] = &node
		}
	}
	// Second pass: attach children
	for _, c := range all {
		if c.ParentID != nil {
			if parent, ok := parentMap[*c.ParentID]; ok {
				parent.Children = append(parent.Children, c)
			}
		}
	}
	for _, node := range parentMap {
		result = append(result, *node)
	}
	return result, nil
}

func (s *LedgerService) UpdateCategory(ctx context.Context, userID, catID uuid.UUID, req *models.UpdateCategoryRequest) (*models.LedgerCategory, error) {
	cat := &models.LedgerCategory{}
	err := s.db.QueryRow(ctx,
		`UPDATE ledger_categories
		 SET name      = COALESCE($3, name),
		     color     = COALESCE($4, color),
		     parent_id = $5
		 WHERE id = $1 AND user_id = $2
		 RETURNING id, user_id, name, type, color, parent_id, created_at`,
		catID, userID, req.Name, req.Color, req.ParentID,
	).Scan(&cat.ID, &cat.UserID, &cat.Name, &cat.Type, &cat.Color, &cat.ParentID, &cat.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrCategoryNotFound
		}
		return nil, err
	}
	return cat, nil
}

func (s *LedgerService) DeleteCategory(ctx context.Context, userID, catID uuid.UUID) error {
	tag, err := s.db.Exec(ctx,
		`DELETE FROM ledger_categories WHERE id = $1 AND user_id = $2`,
		catID, userID,
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrCategoryNotFound
	}
	return nil
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

func (s *LedgerService) CreateTransaction(ctx context.Context, userID uuid.UUID, req *models.CreateTransactionRequest) (*models.LedgerTransaction, error) {
	txDate, err := time.Parse("2006-01-02", req.Date)
	if err != nil {
		return nil, fmt.Errorf("invalid date format, expected YYYY-MM-DD")
	}

	absAmount := math.Abs(req.Amount)
	signedAmt := signedAmount(req.Type, absAmount)

	if req.Type == "transfer" {
		return s.createTransfer(ctx, userID, req, txDate, absAmount)
	}

	tx, err := s.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var ledgerTx models.LedgerTransaction
	err = tx.QueryRow(ctx,
		`INSERT INTO ledger_transactions
		 (user_id, account_id, category_id, type, amount, description, notes, date,
		  is_recurring, recurrence_interval, recurrence_day)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
		 RETURNING id, user_id, account_id, category_id, type, amount, description,
		           notes, date, is_recurring, recurrence_interval, recurrence_day,
		           transfer_to_account_id, created_at, updated_at`,
		userID, req.AccountID, req.CategoryID, req.Type, signedAmt, req.Description,
		req.Notes, txDate, req.IsRecurring, req.RecurrenceInterval, req.RecurrenceDay,
	).Scan(&ledgerTx.ID, &ledgerTx.UserID, &ledgerTx.AccountID, &ledgerTx.CategoryID,
		&ledgerTx.Type, &ledgerTx.Amount, &ledgerTx.Description, &ledgerTx.Notes,
		&ledgerTx.Date, &ledgerTx.IsRecurring, &ledgerTx.RecurrenceInterval,
		&ledgerTx.RecurrenceDay, &ledgerTx.TransferToAccountID,
		&ledgerTx.CreatedAt, &ledgerTx.UpdatedAt)
	if err != nil {
		return nil, err
	}

	_, err = tx.Exec(ctx,
		`UPDATE ledger_accounts SET balance = balance + $1, updated_at = NOW() WHERE id = $2 AND user_id = $3`,
		signedAmt, req.AccountID, userID,
	)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return &ledgerTx, nil
}

func (s *LedgerService) createTransfer(ctx context.Context, userID uuid.UUID, req *models.CreateTransactionRequest, txDate time.Time, absAmount float64) (*models.LedgerTransaction, error) {
	if req.TransferToAccountID == nil {
		return nil, fmt.Errorf("transfer_to_account_id is required for transfers")
	}

	tx, err := s.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	// Verify the destination account belongs to this user before touching anything
	var destExists bool
	if err := tx.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM ledger_accounts WHERE id = $1 AND user_id = $2)`,
		req.TransferToAccountID, userID,
	).Scan(&destExists); err != nil {
		return nil, err
	}
	if !destExists {
		return nil, ErrAccountNotFound
	}

	// Source row (negative)
	var source models.LedgerTransaction
	err = tx.QueryRow(ctx,
		`INSERT INTO ledger_transactions
		 (user_id, account_id, type, amount, description, notes, date,
		  is_recurring, recurrence_interval, recurrence_day, transfer_to_account_id)
		 VALUES ($1,$2,'transfer',$3,$4,$5,$6,$7,$8,$9,$10)
		 RETURNING id, user_id, account_id, category_id, type, amount, description,
		           notes, date, is_recurring, recurrence_interval, recurrence_day,
		           transfer_to_account_id, created_at, updated_at`,
		userID, req.AccountID, -absAmount, req.Description, req.Notes, txDate,
		req.IsRecurring, req.RecurrenceInterval, req.RecurrenceDay, req.TransferToAccountID,
	).Scan(&source.ID, &source.UserID, &source.AccountID, &source.CategoryID, &source.Type,
		&source.Amount, &source.Description, &source.Notes, &source.Date, &source.IsRecurring,
		&source.RecurrenceInterval, &source.RecurrenceDay, &source.TransferToAccountID,
		&source.CreatedAt, &source.UpdatedAt)
	if err != nil {
		return nil, err
	}

	// Destination row (positive) — transfer_to_account_id points back to source account
	_, err = tx.Exec(ctx,
		`INSERT INTO ledger_transactions
		 (user_id, account_id, type, amount, description, notes, date,
		  is_recurring, recurrence_interval, recurrence_day, transfer_to_account_id)
		 VALUES ($1,$2,'transfer',$3,$4,$5,$6,$7,$8,$9,$10)`,
		userID, req.TransferToAccountID, absAmount, req.Description, req.Notes, txDate,
		req.IsRecurring, req.RecurrenceInterval, req.RecurrenceDay, req.AccountID,
	)
	if err != nil {
		return nil, err
	}

	// Update source account balance
	_, err = tx.Exec(ctx,
		`UPDATE ledger_accounts SET balance = balance - $1, updated_at = NOW() WHERE id = $2 AND user_id = $3`,
		absAmount, req.AccountID, userID,
	)
	if err != nil {
		return nil, err
	}

	// Update destination account balance
	_, err = tx.Exec(ctx,
		`UPDATE ledger_accounts SET balance = balance + $1, updated_at = NOW() WHERE id = $2 AND user_id = $3`,
		absAmount, req.TransferToAccountID, userID,
	)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return &source, nil
}

func (s *LedgerService) ListTransactions(ctx context.Context, userID uuid.UUID, f models.TransactionFilters) ([]models.LedgerTransaction, error) {
	query := `
		SELECT t.id, t.user_id, t.account_id, t.category_id, t.type, t.amount,
		       t.description, t.notes, t.date, t.is_recurring, t.recurrence_interval,
		       t.recurrence_day, t.transfer_to_account_id, t.created_at, t.updated_at,
		       c.name, c.color
		FROM ledger_transactions t
		LEFT JOIN ledger_categories c ON c.id = t.category_id
		WHERE t.user_id = $1`

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
		query += fmt.Sprintf(" AND t.account_id = $%d", argN)
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

	query += " ORDER BY t.date DESC, t.created_at DESC"

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

	rows, err := s.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	txs := []models.LedgerTransaction{}
	for rows.Next() {
		var tx models.LedgerTransaction
		if err := rows.Scan(&tx.ID, &tx.UserID, &tx.AccountID, &tx.CategoryID, &tx.Type,
			&tx.Amount, &tx.Description, &tx.Notes, &tx.Date, &tx.IsRecurring,
			&tx.RecurrenceInterval, &tx.RecurrenceDay, &tx.TransferToAccountID,
			&tx.CreatedAt, &tx.UpdatedAt, &tx.CategoryName, &tx.CategoryColor); err != nil {
			return nil, err
		}
		txs = append(txs, tx)
	}
	return txs, nil
}

func (s *LedgerService) GetTransaction(ctx context.Context, userID, txID uuid.UUID) (*models.LedgerTransaction, error) {
	var tx models.LedgerTransaction
	err := s.db.QueryRow(ctx,
		`SELECT t.id, t.user_id, t.account_id, t.category_id, t.type, t.amount,
		        t.description, t.notes, t.date, t.is_recurring, t.recurrence_interval,
		        t.recurrence_day, t.transfer_to_account_id, t.created_at, t.updated_at,
		        c.name, c.color
		 FROM ledger_transactions t
		 LEFT JOIN ledger_categories c ON c.id = t.category_id
		 WHERE t.id = $1 AND t.user_id = $2`,
		txID, userID,
	).Scan(&tx.ID, &tx.UserID, &tx.AccountID, &tx.CategoryID, &tx.Type,
		&tx.Amount, &tx.Description, &tx.Notes, &tx.Date, &tx.IsRecurring,
		&tx.RecurrenceInterval, &tx.RecurrenceDay, &tx.TransferToAccountID,
		&tx.CreatedAt, &tx.UpdatedAt, &tx.CategoryName, &tx.CategoryColor)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrTransactionNotFound
		}
		return nil, err
	}
	return &tx, nil
}

func (s *LedgerService) UpdateTransaction(ctx context.Context, userID, txID uuid.UUID, req *models.UpdateTransactionRequest) (*models.LedgerTransaction, error) {
	// Fetch existing transaction
	existing, err := s.GetTransaction(ctx, userID, txID)
	if err != nil {
		return nil, err
	}

	// Transfers: only description/notes/recurrence allowed
	if existing.Type == "transfer" {
		return s.updateTransferMeta(ctx, userID, existing, req)
	}

	// Determine new values
	newAmount := existing.Amount
	if req.Amount != nil {
		newAmount = signedAmount(existing.Type, math.Abs(*req.Amount))
	}
	newAccountID := existing.AccountID
	newDescription := existing.Description
	if req.Description != nil {
		newDescription = *req.Description
	}
	newDate := existing.Date
	if req.Date != nil {
		newDate, err = time.Parse("2006-01-02", *req.Date)
		if err != nil {
			return nil, fmt.Errorf("invalid date format")
		}
	}

	dbtx, err := s.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return nil, err
	}
	defer dbtx.Rollback(ctx)

	// Reverse old balance
	_, err = dbtx.Exec(ctx,
		`UPDATE ledger_accounts SET balance = balance - $1, updated_at = NOW() WHERE id = $2 AND user_id = $3`,
		existing.Amount, existing.AccountID, userID,
	)
	if err != nil {
		return nil, err
	}

	// Apply new balance
	_, err = dbtx.Exec(ctx,
		`UPDATE ledger_accounts SET balance = balance + $1, updated_at = NOW() WHERE id = $2 AND user_id = $3`,
		newAmount, newAccountID, userID,
	)
	if err != nil {
		return nil, err
	}

	var updated models.LedgerTransaction
	err = dbtx.QueryRow(ctx,
		`UPDATE ledger_transactions
		 SET category_id         = $3,
		     amount              = $4,
		     description         = $5,
		     notes               = COALESCE($6, notes),
		     date                = $7,
		     is_recurring        = COALESCE($8, is_recurring),
		     recurrence_interval = COALESCE($9, recurrence_interval),
		     recurrence_day      = COALESCE($10, recurrence_day),
		     updated_at          = NOW()
		 WHERE id = $1 AND user_id = $2
		 RETURNING id, user_id, account_id, category_id, type, amount, description,
		           notes, date, is_recurring, recurrence_interval, recurrence_day,
		           transfer_to_account_id, created_at, updated_at`,
		txID, userID,
		req.CategoryID, newAmount, newDescription, req.Notes, newDate,
		req.IsRecurring, req.RecurrenceInterval, req.RecurrenceDay,
	).Scan(&updated.ID, &updated.UserID, &updated.AccountID, &updated.CategoryID, &updated.Type,
		&updated.Amount, &updated.Description, &updated.Notes, &updated.Date, &updated.IsRecurring,
		&updated.RecurrenceInterval, &updated.RecurrenceDay, &updated.TransferToAccountID,
		&updated.CreatedAt, &updated.UpdatedAt)
	if err != nil {
		return nil, err
	}

	if err := dbtx.Commit(ctx); err != nil {
		return nil, err
	}
	return &updated, nil
}

// updateTransferMeta updates only description, notes, and recurrence fields for a transfer pair.
func (s *LedgerService) updateTransferMeta(ctx context.Context, userID uuid.UUID, existing *models.LedgerTransaction, req *models.UpdateTransactionRequest) (*models.LedgerTransaction, error) {
	tx, err := s.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var updated models.LedgerTransaction
	err = tx.QueryRow(ctx,
		`UPDATE ledger_transactions
		 SET description         = COALESCE($3, description),
		     notes               = COALESCE($4, notes),
		     is_recurring        = COALESCE($5, is_recurring),
		     recurrence_interval = COALESCE($6, recurrence_interval),
		     recurrence_day      = COALESCE($7, recurrence_day),
		     updated_at          = NOW()
		 WHERE id = $1 AND user_id = $2
		 RETURNING id, user_id, account_id, category_id, type, amount, description,
		           notes, date, is_recurring, recurrence_interval, recurrence_day,
		           transfer_to_account_id, created_at, updated_at`,
		existing.ID, userID,
		req.Description, req.Notes, req.IsRecurring, req.RecurrenceInterval, req.RecurrenceDay,
	).Scan(&updated.ID, &updated.UserID, &updated.AccountID, &updated.CategoryID, &updated.Type,
		&updated.Amount, &updated.Description, &updated.Notes, &updated.Date, &updated.IsRecurring,
		&updated.RecurrenceInterval, &updated.RecurrenceDay, &updated.TransferToAccountID,
		&updated.CreatedAt, &updated.UpdatedAt)
	if err != nil {
		return nil, err
	}

	// Also update the paired transfer row atomically
	if existing.TransferToAccountID != nil {
		if _, err := tx.Exec(ctx,
			`UPDATE ledger_transactions
			 SET description = COALESCE($3, description), notes = COALESCE($4, notes), updated_at = NOW()
			 WHERE user_id = $1 AND type = 'transfer'
			   AND account_id = $2 AND transfer_to_account_id = $5
			   AND id != $6`,
			userID, existing.TransferToAccountID, req.Description, req.Notes,
			existing.AccountID, existing.ID,
		); err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return &updated, nil
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
	_, err = dbtx.Exec(ctx,
		`UPDATE ledger_accounts SET balance = balance - $1, updated_at = NOW() WHERE id = $2 AND user_id = $3`,
		existing.Amount, existing.AccountID, userID,
	)
	if err != nil {
		return err
	}

	// For transfers: also delete + reverse the paired row
	if existing.Type == "transfer" && existing.TransferToAccountID != nil {
		var partnerID uuid.UUID
		var partnerAmount float64
		partnerErr := dbtx.QueryRow(ctx,
			`SELECT id, amount FROM ledger_transactions
			 WHERE user_id = $1 AND type = 'transfer'
			   AND account_id = $2 AND transfer_to_account_id = $3
			   AND id != $4
			 LIMIT 1`,
			userID, existing.TransferToAccountID, existing.AccountID, existing.ID,
		).Scan(&partnerID, &partnerAmount)
		if partnerErr == nil {
			if _, err := dbtx.Exec(ctx,
				`UPDATE ledger_accounts SET balance = balance - $1, updated_at = NOW() WHERE id = $2 AND user_id = $3`,
				partnerAmount, existing.TransferToAccountID, userID,
			); err != nil {
				return err
			}
			if _, err := dbtx.Exec(ctx, `DELETE FROM ledger_transactions WHERE id = $1`, partnerID); err != nil {
				return err
			}
		}
	}

	_, err = dbtx.Exec(ctx, `DELETE FROM ledger_transactions WHERE id = $1 AND user_id = $2`, txID, userID)
	if err != nil {
		return err
	}

	return dbtx.Commit(ctx)
}

// ── Budgets ───────────────────────────────────────────────────────────────────

func (s *LedgerService) CreateBudget(ctx context.Context, userID uuid.UUID, req *models.CreateBudgetRequest) (*models.LedgerBudget, error) {
	startDate, err := time.Parse("2006-01-02", req.StartDate)
	if err != nil {
		return nil, fmt.Errorf("invalid start_date format")
	}

	budget := &models.LedgerBudget{}
	err = s.db.QueryRow(ctx,
		`INSERT INTO ledger_budgets (user_id, category_id, amount, period, start_date)
		 VALUES ($1, $2, $3, $4, $5)
		 ON CONFLICT (user_id, category_id, period) DO UPDATE
		   SET amount = EXCLUDED.amount, start_date = EXCLUDED.start_date, updated_at = NOW()
		 RETURNING id, user_id, category_id, amount, period, start_date, created_at, updated_at`,
		userID, req.CategoryID, req.Amount, req.Period, startDate,
	).Scan(&budget.ID, &budget.UserID, &budget.CategoryID, &budget.Amount, &budget.Period,
		&budget.StartDate, &budget.CreatedAt, &budget.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return budget, nil
}

func (s *LedgerService) ListBudgets(ctx context.Context, userID uuid.UUID) ([]models.BudgetWithSpend, error) {
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
		                WHEN 'weekly' THEN date_trunc('week',  CURRENT_DATE)::date
		                WHEN 'yearly' THEN date_trunc('year',  CURRENT_DATE)::date
		                ELSE               date_trunc('month', CURRENT_DATE)::date
		            END
		            AND
		            CASE b.period
		                WHEN 'weekly' THEN (date_trunc('week',  CURRENT_DATE) + INTERVAL '6 days')::date
		                WHEN 'yearly' THEN (date_trunc('year',  CURRENT_DATE) + INTERVAL '1 year'  - INTERVAL '1 day')::date
		                ELSE               (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day')::date
		            END
		 WHERE b.user_id = $1
		 GROUP BY b.id, b.user_id, b.category_id, b.amount, b.period, b.start_date,
		          b.created_at, b.updated_at, c.name, c.color
		 ORDER BY c.name ASC`,
		userID,
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
	return budgets, nil
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
	date, err := time.Parse("2006-01-02", req.SnapshotDate)
	if err != nil {
		return nil, fmt.Errorf("invalid snapshot_date format")
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
	return snaps, nil
}

// ── Summary ───────────────────────────────────────────────────────────────────

func (s *LedgerService) GetSummary(ctx context.Context, userID uuid.UUID, month string) (*models.LedgerSummary, error) {
	// month = "2026-02"
	from := month + "-01"
	parsed, err := time.Parse("2006-01-02", from)
	if err != nil {
		return nil, fmt.Errorf("invalid month format, expected YYYY-MM")
	}
	to := parsed.AddDate(0, 1, -1).Format("2006-01-02")

	var income, expenses float64
	s.db.QueryRow(ctx,
		`SELECT
		   COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE 0 END), 0),
		   COALESCE(SUM(CASE WHEN type='expense' THEN ABS(amount) ELSE 0 END), 0)
		 FROM ledger_transactions
		 WHERE user_id = $1 AND date BETWEEN $2 AND $3 AND type != 'transfer'`,
		userID, from, to,
	).Scan(&income, &expenses)

	net := income - expenses
	savingsRate := 0.0
	if income > 0 {
		savingsRate = (net / income) * 100
	}

	return &models.LedgerSummary{
		Month:       month,
		Income:      income,
		Expenses:    expenses,
		Net:         net,
		SavingsRate: math.Round(savingsRate*10) / 10,
	}, nil
}

// ── Comparison ────────────────────────────────────────────────────────────────

func (s *LedgerService) GetComparison(ctx context.Context, userID uuid.UUID, aFrom, aTo, bFrom, bTo string) (*models.ComparisonResponse, error) {
	// High-level totals
	var aIncome, aExpenses, bIncome, bExpenses float64
	err := s.db.QueryRow(ctx,
		`SELECT
		   COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE 0 END), 0),
		   COALESCE(SUM(CASE WHEN type='expense' THEN ABS(amount) ELSE 0 END), 0)
		 FROM ledger_transactions
		 WHERE user_id = $1 AND date BETWEEN $2 AND $3 AND type != 'transfer'`,
		userID, aFrom, aTo,
	).Scan(&aIncome, &aExpenses)
	if err != nil {
		return nil, err
	}

	err = s.db.QueryRow(ctx,
		`SELECT
		   COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE 0 END), 0),
		   COALESCE(SUM(CASE WHEN type='expense' THEN ABS(amount) ELSE 0 END), 0)
		 FROM ledger_transactions
		 WHERE user_id = $1 AND date BETWEEN $2 AND $3 AND type != 'transfer'`,
		userID, bFrom, bTo,
	).Scan(&bIncome, &bExpenses)
	if err != nil {
		return nil, err
	}

	// Per-category breakdown
	rows, err := s.db.Query(ctx,
		`WITH a_cats AS (
		   SELECT category_id, SUM(amount) AS amount
		   FROM ledger_transactions
		   WHERE user_id = $1 AND date BETWEEN $2 AND $3 AND type != 'transfer'
		   GROUP BY category_id
		 ),
		 b_cats AS (
		   SELECT category_id, SUM(amount) AS amount
		   FROM ledger_transactions
		   WHERE user_id = $1 AND date BETWEEN $4 AND $5 AND type != 'transfer'
		   GROUP BY category_id
		 )
		 SELECT
		   COALESCE(a.category_id, b.category_id) AS cat_id,
		   COALESCE(c.name, 'Uncategorised') AS cat_name,
		   c.color,
		   COALESCE(a.amount, 0) AS a_amount,
		   COALESCE(b.amount, 0) AS b_amount
		 FROM a_cats a
		 FULL OUTER JOIN b_cats b ON a.category_id = b.category_id
		 LEFT JOIN ledger_categories c ON c.id = COALESCE(a.category_id, b.category_id)
		 WHERE COALESCE(a.category_id, b.category_id) IS NOT NULL
		   AND (c.user_id = $1 OR c.user_id IS NULL)
		 ORDER BY ABS(COALESCE(b.amount, 0) - COALESCE(a.amount, 0)) DESC`,
		userID, aFrom, aTo, bFrom, bTo,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	cats := []models.ComparisonCategory{}
	for rows.Next() {
		var cc models.ComparisonCategory
		var aAmt, bAmt float64
		if err := rows.Scan(&cc.CategoryID, &cc.Name, &cc.Color, &aAmt, &bAmt); err != nil {
			return nil, err
		}
		cc.A = aAmt
		cc.B = bAmt
		cc.Delta = bAmt - aAmt
		if aAmt != 0 {
			cc.DeltaPct = math.Round(((bAmt-aAmt)/math.Abs(aAmt))*1000) / 10
		}
		cats = append(cats, cc)
	}

	mkVal := func(a, b float64) models.ComparisonValue {
		delta := b - a
		pct := 0.0
		if a != 0 {
			pct = math.Round(((b-a)/math.Abs(a))*1000) / 10
		}
		return models.ComparisonValue{A: a, B: b, Delta: delta, DeltaPct: pct}
	}

	return &models.ComparisonResponse{
		PeriodA:    models.ComparisonPeriod{From: aFrom, To: aTo},
		PeriodB:    models.ComparisonPeriod{From: bFrom, To: bTo},
		Summary: models.ComparisonSummary{
			Income:   mkVal(aIncome, bIncome),
			Expenses: mkVal(aExpenses, bExpenses),
			Net:      mkVal(aIncome-aExpenses, bIncome-bExpenses),
		},
		Categories: cats,
	}, nil
}
