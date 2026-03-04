package handlers

import (
	"errors"
	"net/http"
	"strconv"

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

// ── Accounts ──────────────────────────────────────────────────────────────────

func (h *LedgerHandler) CreateAccount(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)

	var req models.CreateAccountRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "VALIDATION_ERROR", Message: err.Error()},
		})
		return
	}

	acc, err := h.svc.CreateAccount(c.Request.Context(), userID, &req)
	if err != nil {
		log.Error().Err(err).Msg("Failed to create ledger account")
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to create account"},
		})
		return
	}
	c.JSON(http.StatusCreated, acc)
}

func (h *LedgerHandler) ListAccounts(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)

	accounts, err := h.svc.ListAccounts(c.Request.Context(), userID)
	if err != nil {
		log.Error().Err(err).Msg("Failed to list ledger accounts")
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to list accounts"},
		})
		return
	}
	c.JSON(http.StatusOK, accounts)
}

func (h *LedgerHandler) GetAccount(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)

	accountID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid account ID"},
		})
		return
	}

	acc, err := h.svc.GetAccount(c.Request.Context(), userID, accountID)
	if err != nil {
		if errors.Is(err, services.ErrAccountNotFound) {
			c.JSON(http.StatusNotFound, models.ErrorResponse{
				Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "Account not found"},
			})
			return
		}
		log.Error().Err(err).Msg("Failed to get ledger account")
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to get account"},
		})
		return
	}
	c.JSON(http.StatusOK, acc)
}

func (h *LedgerHandler) UpdateAccount(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)

	accountID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid account ID"},
		})
		return
	}

	var req models.UpdateAccountRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "VALIDATION_ERROR", Message: err.Error()},
		})
		return
	}

	acc, err := h.svc.UpdateAccount(c.Request.Context(), userID, accountID, &req)
	if err != nil {
		if errors.Is(err, services.ErrAccountNotFound) {
			c.JSON(http.StatusNotFound, models.ErrorResponse{
				Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "Account not found"},
			})
			return
		}
		log.Error().Err(err).Msg("Failed to update ledger account")
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to update account"},
		})
		return
	}
	c.JSON(http.StatusOK, acc)
}

func (h *LedgerHandler) DeleteAccount(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)

	accountID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid account ID"},
		})
		return
	}

	err = h.svc.DeleteAccount(c.Request.Context(), userID, accountID)
	if err != nil {
		if errors.Is(err, services.ErrAccountNotFound) {
			c.JSON(http.StatusNotFound, models.ErrorResponse{
				Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "Account not found"},
			})
			return
		}
		if errors.Is(err, services.ErrAccountHasTransactions) {
			c.JSON(http.StatusConflict, models.ErrorResponse{
				Error: models.ErrorDetail{Code: "ACCOUNT_HAS_TRANSACTIONS", Message: "Account has transactions. Delete or reassign them first."},
			})
			return
		}
		log.Error().Err(err).Msg("Failed to delete ledger account")
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to delete account"},
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Account deleted"})
}

// ── Transactions ──────────────────────────────────────────────────────────────

func (h *LedgerHandler) CreateTransaction(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)

	var req models.CreateTransactionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "VALIDATION_ERROR", Message: err.Error()},
		})
		return
	}

	tx, err := h.svc.CreateTransaction(c.Request.Context(), userID, &req)
	if err != nil {
		log.Error().Err(err).Msg("Failed to create ledger transaction")
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "BAD_REQUEST", Message: err.Error()},
		})
		return
	}
	c.JSON(http.StatusCreated, tx)
}

func (h *LedgerHandler) ListTransactions(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)

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
		Page:       page,
		Limit:      limit,
	}

	txs, err := h.svc.ListTransactions(c.Request.Context(), userID, filters)
	if err != nil {
		log.Error().Err(err).Msg("Failed to list ledger transactions")
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to list transactions"},
		})
		return
	}
	c.JSON(http.StatusOK, txs)
}

func (h *LedgerHandler) GetTransaction(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)

	txID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid transaction ID"},
		})
		return
	}

	tx, err := h.svc.GetTransaction(c.Request.Context(), userID, txID)
	if err != nil {
		if errors.Is(err, services.ErrTransactionNotFound) {
			c.JSON(http.StatusNotFound, models.ErrorResponse{
				Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "Transaction not found"},
			})
			return
		}
		log.Error().Err(err).Msg("Failed to get ledger transaction")
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to get transaction"},
		})
		return
	}
	c.JSON(http.StatusOK, tx)
}

func (h *LedgerHandler) UpdateTransaction(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)

	txID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid transaction ID"},
		})
		return
	}

	var req models.UpdateTransactionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "VALIDATION_ERROR", Message: err.Error()},
		})
		return
	}

	tx, err := h.svc.UpdateTransaction(c.Request.Context(), userID, txID, &req)
	if err != nil {
		if errors.Is(err, services.ErrTransactionNotFound) {
			c.JSON(http.StatusNotFound, models.ErrorResponse{
				Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "Transaction not found"},
			})
			return
		}
		log.Error().Err(err).Msg("Failed to update ledger transaction")
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "BAD_REQUEST", Message: err.Error()},
		})
		return
	}
	c.JSON(http.StatusOK, tx)
}

func (h *LedgerHandler) DeleteTransaction(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)

	txID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid transaction ID"},
		})
		return
	}

	err = h.svc.DeleteTransaction(c.Request.Context(), userID, txID)
	if err != nil {
		if errors.Is(err, services.ErrTransactionNotFound) {
			c.JSON(http.StatusNotFound, models.ErrorResponse{
				Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "Transaction not found"},
			})
			return
		}
		log.Error().Err(err).Msg("Failed to delete ledger transaction")
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to delete transaction"},
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Transaction deleted"})
}

// ── Categories ────────────────────────────────────────────────────────────────

func (h *LedgerHandler) CreateCategory(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)

	var req models.CreateCategoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "VALIDATION_ERROR", Message: err.Error()},
		})
		return
	}

	cat, err := h.svc.CreateCategory(c.Request.Context(), userID, &req)
	if err != nil {
		log.Error().Err(err).Msg("Failed to create ledger category")
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to create category"},
		})
		return
	}
	c.JSON(http.StatusCreated, cat)
}

func (h *LedgerHandler) ListCategories(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)

	tree, err := h.svc.ListCategories(c.Request.Context(), userID)
	if err != nil {
		log.Error().Err(err).Msg("Failed to list ledger categories")
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to list categories"},
		})
		return
	}
	c.JSON(http.StatusOK, tree)
}

func (h *LedgerHandler) UpdateCategory(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)

	catID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid category ID"},
		})
		return
	}

	var req models.UpdateCategoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "VALIDATION_ERROR", Message: err.Error()},
		})
		return
	}

	cat, err := h.svc.UpdateCategory(c.Request.Context(), userID, catID, &req)
	if err != nil {
		if errors.Is(err, services.ErrCategoryNotFound) {
			c.JSON(http.StatusNotFound, models.ErrorResponse{
				Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "Category not found"},
			})
			return
		}
		log.Error().Err(err).Msg("Failed to update ledger category")
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to update category"},
		})
		return
	}
	c.JSON(http.StatusOK, cat)
}

func (h *LedgerHandler) DeleteCategory(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)

	catID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid category ID"},
		})
		return
	}

	err = h.svc.DeleteCategory(c.Request.Context(), userID, catID)
	if err != nil {
		if errors.Is(err, services.ErrCategoryNotFound) {
			c.JSON(http.StatusNotFound, models.ErrorResponse{
				Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "Category not found"},
			})
			return
		}
		log.Error().Err(err).Msg("Failed to delete ledger category")
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to delete category"},
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Category deleted"})
}

// ── Budgets ───────────────────────────────────────────────────────────────────

func (h *LedgerHandler) CreateBudget(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)

	var req models.CreateBudgetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "VALIDATION_ERROR", Message: err.Error()},
		})
		return
	}

	budget, err := h.svc.CreateBudget(c.Request.Context(), userID, &req)
	if err != nil {
		log.Error().Err(err).Msg("Failed to create ledger budget")
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "BAD_REQUEST", Message: err.Error()},
		})
		return
	}
	c.JSON(http.StatusCreated, budget)
}

func (h *LedgerHandler) ListBudgets(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)

	budgets, err := h.svc.ListBudgets(c.Request.Context(), userID)
	if err != nil {
		log.Error().Err(err).Msg("Failed to list ledger budgets")
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to list budgets"},
		})
		return
	}
	c.JSON(http.StatusOK, budgets)
}

func (h *LedgerHandler) DeleteBudget(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)

	budgetID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid budget ID"},
		})
		return
	}

	err = h.svc.DeleteBudget(c.Request.Context(), userID, budgetID)
	if err != nil {
		if errors.Is(err, services.ErrBudgetNotFound) {
			c.JSON(http.StatusNotFound, models.ErrorResponse{
				Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "Budget not found"},
			})
			return
		}
		log.Error().Err(err).Msg("Failed to delete ledger budget")
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to delete budget"},
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Budget deleted"})
}

// ── Summary & Net Worth ───────────────────────────────────────────────────────

func (h *LedgerHandler) GetSummary(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)

	month := c.Query("month")
	if month == "" {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "MISSING_PARAM", Message: "month query param required (YYYY-MM)"},
		})
		return
	}

	summary, err := h.svc.GetSummary(c.Request.Context(), userID, month)
	if err != nil {
		log.Error().Err(err).Msg("Failed to get ledger summary")
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "BAD_REQUEST", Message: err.Error()},
		})
		return
	}
	c.JSON(http.StatusOK, summary)
}

func (h *LedgerHandler) GetNetWorth(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)

	snaps, err := h.svc.ListSnapshots(c.Request.Context(), userID)
	if err != nil {
		log.Error().Err(err).Msg("Failed to list net worth snapshots")
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to list snapshots"},
		})
		return
	}
	c.JSON(http.StatusOK, snaps)
}

func (h *LedgerHandler) CreateSnapshot(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)

	var req models.CreateSnapshotRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "VALIDATION_ERROR", Message: err.Error()},
		})
		return
	}

	snap, err := h.svc.CreateSnapshot(c.Request.Context(), userID, &req)
	if err != nil {
		log.Error().Err(err).Msg("Failed to create net worth snapshot")
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "BAD_REQUEST", Message: err.Error()},
		})
		return
	}
	c.JSON(http.StatusCreated, snap)
}

// ── Comparison ────────────────────────────────────────────────────────────────

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

	result, err := h.svc.GetComparison(c.Request.Context(), userID, aFrom, aTo, bFrom, bTo)
	if err != nil {
		log.Error().Err(err).Msg("Failed to get ledger comparison")
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to compute comparison"},
		})
		return
	}
	c.JSON(http.StatusOK, result)
}
