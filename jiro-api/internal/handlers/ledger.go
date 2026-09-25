package handlers

import (
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/models"
	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/services"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

type LedgerHandler struct {
	svc *services.LedgerService
}

func NewLedgerHandler(svc *services.LedgerService) *LedgerHandler {
	return &LedgerHandler{svc: svc}
}

// fail maps a ledger service error to its response. Anything it does not
// recognise is a 500 whose detail stays in the log.
func (h *LedgerHandler) fail(c *gin.Context, err error, action string) {
	respond := func(status int, code, msg string) {
		c.JSON(status, models.ErrorResponse{Error: models.ErrorDetail{Code: code, Message: msg}})
	}
	switch {
	case errors.Is(err, services.ErrLedgerInvalid):
		// The wrapped message is written for people; drop the sentinel prefix.
		msg := strings.TrimPrefix(err.Error(), services.ErrLedgerInvalid.Error()+": ")
		respond(http.StatusBadRequest, "VALIDATION_ERROR", msg)
	case errors.Is(err, services.ErrAccountNotFound):
		respond(http.StatusNotFound, "NOT_FOUND", "Account not found")
	case errors.Is(err, services.ErrCategoryNotFound):
		respond(http.StatusNotFound, "NOT_FOUND", "Category not found")
	case errors.Is(err, services.ErrTransactionNotFound):
		respond(http.StatusNotFound, "NOT_FOUND", "Transaction not found")
	case errors.Is(err, services.ErrBudgetNotFound):
		respond(http.StatusNotFound, "NOT_FOUND", "Budget not found")
	case errors.Is(err, services.ErrAccountHasTransactions):
		respond(http.StatusConflict, "ACCOUNT_HAS_TRANSACTIONS", "Account has transactions. Delete or reassign them first.")
	case errors.Is(err, services.ErrCategoryNameTaken):
		respond(http.StatusConflict, "CATEGORY_EXISTS", "You already have a category with that name.")
	case errors.Is(err, services.ErrBudgetExists):
		respond(http.StatusConflict, "BUDGET_EXISTS", "That category already has a budget for this period.")
	default:
		respondInternal(c, err, action)
	}
}

func bindError(c *gin.Context, err error) {
	c.JSON(http.StatusBadRequest, models.ErrorResponse{
		Error: models.ErrorDetail{Code: "VALIDATION_ERROR", Message: err.Error()},
	})
}

// pathID parses the :id route parameter, answering 400 itself when it is not
// a UUID.
func pathID(c *gin.Context, what string) (uuid.UUID, bool) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid " + what + " ID"},
		})
		return uuid.Nil, false
	}
	return id, true
}

// catchUp writes any recurring transactions that have come due before a
// Ledger read, so the page shows them. A failure is logged and the read goes
// ahead: the next visit catches up instead. tz is only a fallback for a
// user with no timezone setting, as on GET /day.
func (h *LedgerHandler) catchUp(c *gin.Context, userID uuid.UUID) {
	n, err := h.svc.CatchUpRecurring(c.Request.Context(), userID, c.Query("tz"), time.Now())
	if err != nil {
		log.Error().Err(err).Str("user_id", userID.String()).Msg("ledger recurring catch-up failed")
		return
	}
	if n > 0 {
		log.Info().Int("written", n).Str("user_id", userID.String()).Msg("ledger recurring catch-up")
	}
}

// ── Accounts ──────────────────────────────────────────────────────────────────

func (h *LedgerHandler) CreateAccount(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)

	var req models.CreateAccountRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		bindError(c, err)
		return
	}

	acc, err := h.svc.CreateAccount(c.Request.Context(), userID, &req)
	if err != nil {
		h.fail(c, err, "Failed to create ledger account")
		return
	}
	c.JSON(http.StatusCreated, acc)
}

func (h *LedgerHandler) ListAccounts(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	h.catchUp(c, userID)

	accounts, err := h.svc.ListAccounts(c.Request.Context(), userID)
	if err != nil {
		h.fail(c, err, "Failed to list ledger accounts")
		return
	}
	c.JSON(http.StatusOK, accounts)
}

func (h *LedgerHandler) GetAccount(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	accountID, ok := pathID(c, "account")
	if !ok {
		return
	}
	h.catchUp(c, userID)

	acc, err := h.svc.GetAccount(c.Request.Context(), userID, accountID)
	if err != nil {
		h.fail(c, err, "Failed to get ledger account")
		return
	}
	c.JSON(http.StatusOK, acc)
}

func (h *LedgerHandler) UpdateAccount(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	accountID, ok := pathID(c, "account")
	if !ok {
		return
	}

	var req models.UpdateAccountRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		bindError(c, err)
		return
	}

	acc, err := h.svc.UpdateAccount(c.Request.Context(), userID, accountID, &req)
	if err != nil {
		h.fail(c, err, "Failed to update ledger account")
		return
	}
	c.JSON(http.StatusOK, acc)
}

func (h *LedgerHandler) DeleteAccount(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	accountID, ok := pathID(c, "account")
	if !ok {
		return
	}

	if err := h.svc.DeleteAccount(c.Request.Context(), userID, accountID); err != nil {
		h.fail(c, err, "Failed to delete ledger account")
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Account deleted"})
}

// ── Transactions ──────────────────────────────────────────────────────────────

func (h *LedgerHandler) CreateTransaction(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)

	var req models.CreateTransactionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		bindError(c, err)
		return
	}

	tx, err := h.svc.CreateTransaction(c.Request.Context(), userID, &req)
	if err != nil {
		h.fail(c, err, "Failed to create ledger transaction")
		return
	}
	c.JSON(http.StatusCreated, tx)
}

func (h *LedgerHandler) ListTransactions(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	h.catchUp(c, userID)

	page := 1
	if p, err := strconv.Atoi(c.DefaultQuery("page", "1")); err == nil && p > 0 {
		page = p
	}
	limit := 50
	if l, err := strconv.Atoi(c.DefaultQuery("limit", "50")); err == nil && l > 0 && l <= 500 {
		limit = l
	}

	filters := models.TransactionFilters{
		From:       c.Query("from"),
		To:         c.Query("to"),
		AccountID:  c.Query("account_id"),
		CategoryID: c.Query("category_id"),
		Type:       c.Query("type"),
		Q:          strings.TrimSpace(c.Query("q")),
		Page:       page,
		Limit:      limit,
	}

	txs, err := h.svc.ListTransactions(c.Request.Context(), userID, filters)
	if err != nil {
		h.fail(c, err, "Failed to list ledger transactions")
		return
	}
	c.JSON(http.StatusOK, txs)
}

func (h *LedgerHandler) GetTransaction(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	txID, ok := pathID(c, "transaction")
	if !ok {
		return
	}

	tx, err := h.svc.GetTransaction(c.Request.Context(), userID, txID)
	if err != nil {
		h.fail(c, err, "Failed to get ledger transaction")
		return
	}
	c.JSON(http.StatusOK, tx)
}

func (h *LedgerHandler) UpdateTransaction(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	txID, ok := pathID(c, "transaction")
	if !ok {
		return
	}

	var req models.UpdateTransactionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		bindError(c, err)
		return
	}

	tx, err := h.svc.UpdateTransaction(c.Request.Context(), userID, txID, &req)
	if err != nil {
		h.fail(c, err, "Failed to update ledger transaction")
		return
	}
	c.JSON(http.StatusOK, tx)
}

// StopRecurring stops the series the transaction heads or was written by.
func (h *LedgerHandler) StopRecurring(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	txID, ok := pathID(c, "transaction")
	if !ok {
		return
	}

	tx, err := h.svc.StopRecurring(c.Request.Context(), userID, txID)
	if err != nil {
		h.fail(c, err, "Failed to stop ledger series")
		return
	}
	c.JSON(http.StatusOK, tx)
}

func (h *LedgerHandler) DeleteTransaction(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	txID, ok := pathID(c, "transaction")
	if !ok {
		return
	}

	if err := h.svc.DeleteTransaction(c.Request.Context(), userID, txID); err != nil {
		h.fail(c, err, "Failed to delete ledger transaction")
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Transaction deleted"})
}

// ── Categories ────────────────────────────────────────────────────────────────

func (h *LedgerHandler) CreateCategory(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)

	var req models.CreateCategoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		bindError(c, err)
		return
	}

	cat, err := h.svc.CreateCategory(c.Request.Context(), userID, &req)
	if err != nil {
		h.fail(c, err, "Failed to create ledger category")
		return
	}
	c.JSON(http.StatusCreated, cat)
}

func (h *LedgerHandler) ListCategories(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)

	tree, err := h.svc.ListCategories(c.Request.Context(), userID)
	if err != nil {
		h.fail(c, err, "Failed to list ledger categories")
		return
	}
	c.JSON(http.StatusOK, tree)
}

func (h *LedgerHandler) UpdateCategory(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	catID, ok := pathID(c, "category")
	if !ok {
		return
	}

	var req models.UpdateCategoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		bindError(c, err)
		return
	}

	cat, err := h.svc.UpdateCategory(c.Request.Context(), userID, catID, &req)
	if err != nil {
		h.fail(c, err, "Failed to update ledger category")
		return
	}
	c.JSON(http.StatusOK, cat)
}

// DeleteCategory deletes a category. ?move_to=<category id> moves its
// transactions to that category (same type); without it they become
// uncategorised.
func (h *LedgerHandler) DeleteCategory(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	catID, ok := pathID(c, "category")
	if !ok {
		return
	}
	var moveTo *uuid.UUID
	if raw := c.Query("move_to"); raw != "" {
		id, err := uuid.Parse(raw)
		if err != nil {
			c.JSON(http.StatusBadRequest, models.ErrorResponse{
				Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid move_to category ID"},
			})
			return
		}
		moveTo = &id
	}

	res, err := h.svc.DeleteCategory(c.Request.Context(), userID, catID, moveTo)
	if err != nil {
		h.fail(c, err, "Failed to delete ledger category")
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Category deleted", "moved": res.Moved, "budgets_removed": res.BudgetsRemoved})
}

// ── Budgets ───────────────────────────────────────────────────────────────────

func (h *LedgerHandler) CreateBudget(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)

	var req models.CreateBudgetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		bindError(c, err)
		return
	}

	budget, err := h.svc.CreateBudget(c.Request.Context(), userID, &req, c.Query("tz"))
	if err != nil {
		h.fail(c, err, "Failed to create ledger budget")
		return
	}
	c.JSON(http.StatusCreated, budget)
}

func (h *LedgerHandler) UpdateBudget(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	budgetID, ok := pathID(c, "budget")
	if !ok {
		return
	}

	var req models.UpdateBudgetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		bindError(c, err)
		return
	}

	budget, err := h.svc.UpdateBudget(c.Request.Context(), userID, budgetID, &req)
	if err != nil {
		h.fail(c, err, "Failed to update ledger budget")
		return
	}
	c.JSON(http.StatusOK, budget)
}

func (h *LedgerHandler) ListBudgets(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	h.catchUp(c, userID)

	// tz is only a fallback for a user with no timezone setting, as on GET /day.
	budgets, err := h.svc.ListBudgets(c.Request.Context(), userID, c.Query("tz"))
	if err != nil {
		h.fail(c, err, "Failed to list ledger budgets")
		return
	}
	c.JSON(http.StatusOK, budgets)
}

func (h *LedgerHandler) DeleteBudget(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	budgetID, ok := pathID(c, "budget")
	if !ok {
		return
	}

	if err := h.svc.DeleteBudget(c.Request.Context(), userID, budgetID); err != nil {
		h.fail(c, err, "Failed to delete ledger budget")
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Budget deleted"})
}

// ── Summary & Net Worth ───────────────────────────────────────────────────────

// GetSummary: ?month=YYYY-MM, or no month for the current one in the user's
// timezone.
func (h *LedgerHandler) GetSummary(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	h.catchUp(c, userID)

	summary, err := h.svc.GetSummary(c.Request.Context(), userID, c.Query("month"), c.Query("tz"))
	if err != nil {
		h.fail(c, err, "Failed to get ledger summary")
		return
	}
	c.JSON(http.StatusOK, summary)
}

func (h *LedgerHandler) GetNetWorth(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)

	snaps, err := h.svc.ListSnapshots(c.Request.Context(), userID)
	if err != nil {
		h.fail(c, err, "Failed to list net worth snapshots")
		return
	}
	c.JSON(http.StatusOK, snaps)
}

func (h *LedgerHandler) CreateSnapshot(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)

	var req models.CreateSnapshotRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		bindError(c, err)
		return
	}

	snap, err := h.svc.CreateSnapshot(c.Request.Context(), userID, &req)
	if err != nil {
		h.fail(c, err, "Failed to create net worth snapshot")
		return
	}
	c.JSON(http.StatusCreated, snap)
}

// ── Comparison ────────────────────────────────────────────────────────────────

// GetComparison compares period B against period A (the base); the change
// is B - A.
func (h *LedgerHandler) GetComparison(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)

	aFrom := c.Query("period_a_from")
	aTo := c.Query("period_a_to")
	bFrom := c.Query("period_b_from")
	bTo := c.Query("period_b_to")

	if aFrom == "" || aTo == "" || bFrom == "" || bTo == "" {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "MISSING_PARAM", Message: "period_a_from, period_a_to, period_b_from, period_b_to are all required"},
		})
		return
	}
	h.catchUp(c, userID)

	result, err := h.svc.GetComparison(c.Request.Context(), userID, aFrom, aTo, bFrom, bTo)
	if err != nil {
		h.fail(c, err, "Failed to get ledger comparison")
		return
	}
	c.JSON(http.StatusOK, result)
}
