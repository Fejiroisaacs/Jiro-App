package handlers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/analytics"
	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/models"
	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/services"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog/log"
)

type JymHandler struct {
	jymService *services.JymService
	appBaseURL string
	db         *pgxpool.Pool
}

func NewJymHandler(jymService *services.JymService, appBaseURL string, db *pgxpool.Pool) *JymHandler {
	return &JymHandler{jymService: jymService, appBaseURL: appBaseURL, db: db}
}

// ─── Exercises ────────────────────────────────────────────────────────────────

func (h *JymHandler) CreateExercise(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	var req models.CreateExerciseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "VALIDATION_ERROR", Message: err.Error()}})
		return
	}
	ex, err := h.jymService.CreateExercise(c.Request.Context(), userID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to create exercise"}})
		return
	}
	c.JSON(http.StatusCreated, ex)
}

func (h *JymHandler) ListExercises(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	exercises, err := h.jymService.ListExercises(c.Request.Context(), userID, c.Query("q"), c.Query("mg"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to list exercises"}})
		return
	}
	c.JSON(http.StatusOK, exercises)
}

func (h *JymHandler) GetExercise(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	exerciseID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid exercise ID"}})
		return
	}
	ex, err := h.jymService.GetExerciseWithHistory(c.Request.Context(), userID, exerciseID)
	if err != nil {
		if err == services.ErrExerciseNotFound {
			c.JSON(http.StatusNotFound, models.ErrorResponse{Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "Exercise not found"}})
			return
		}
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to get exercise"}})
		return
	}
	c.JSON(http.StatusOK, ex)
}

func (h *JymHandler) GetPRs(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	prs, err := h.jymService.GetPRs(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to fetch PRs"}})
		return
	}
	c.JSON(http.StatusOK, prs)
}

func (h *JymHandler) UpdateExercise(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	exerciseID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid exercise ID"}})
		return
	}
	var req models.UpdateExerciseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "VALIDATION_ERROR", Message: err.Error()}})
		return
	}
	ex, err := h.jymService.UpdateExercise(c.Request.Context(), userID, exerciseID, &req)
	if err != nil {
		if err == services.ErrExerciseNotFound {
			c.JSON(http.StatusNotFound, models.ErrorResponse{Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "Exercise not found"}})
			return
		}
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to update exercise"}})
		return
	}
	c.JSON(http.StatusOK, ex)
}

func (h *JymHandler) DeleteExercise(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	exerciseID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid exercise ID"}})
		return
	}
	if err := h.jymService.DeleteExercise(c.Request.Context(), userID, exerciseID); err != nil {
		if err == services.ErrExerciseNotFound {
			c.JSON(http.StatusNotFound, models.ErrorResponse{Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "Exercise not found"}})
			return
		}
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to delete exercise"}})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Exercise deleted"})
}

// ─── Splits ───────────────────────────────────────────────────────────────────

func (h *JymHandler) CreateSplit(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	var req models.CreateSplitRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "VALIDATION_ERROR", Message: err.Error()}})
		return
	}
	sp, err := h.jymService.CreateSplit(c.Request.Context(), userID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to create split"}})
		return
	}
	c.JSON(http.StatusCreated, sp)
}

func (h *JymHandler) ListSplits(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	splits, err := h.jymService.ListSplits(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to list splits"}})
		return
	}
	c.JSON(http.StatusOK, splits)
}

func (h *JymHandler) GetSplit(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	splitID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid split ID"}})
		return
	}
	sp, err := h.jymService.GetSplitWithRoutines(c.Request.Context(), userID, splitID)
	if err != nil {
		if err == services.ErrSplitNotFound {
			c.JSON(http.StatusNotFound, models.ErrorResponse{Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "Split not found"}})
			return
		}
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to get split"}})
		return
	}
	c.JSON(http.StatusOK, sp)
}

func (h *JymHandler) UpdateSplit(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	splitID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid split ID"}})
		return
	}
	var req models.UpdateSplitRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "VALIDATION_ERROR", Message: err.Error()}})
		return
	}
	sp, err := h.jymService.UpdateSplit(c.Request.Context(), userID, splitID, &req)
	if err != nil {
		if err == services.ErrSplitNotFound {
			c.JSON(http.StatusNotFound, models.ErrorResponse{Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "Split not found"}})
			return
		}
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to update split"}})
		return
	}
	c.JSON(http.StatusOK, sp)
}

func (h *JymHandler) DeleteSplit(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	splitID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid split ID"}})
		return
	}
	if err := h.jymService.DeleteSplit(c.Request.Context(), userID, splitID); err != nil {
		if err == services.ErrSplitNotFound {
			c.JSON(http.StatusNotFound, models.ErrorResponse{Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "Split not found"}})
			return
		}
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to delete split"}})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Split deleted"})
}

// ─── Public Split Discovery ────────────────────────────────────────────────────

func (h *JymHandler) ListPublicSplits(c *gin.Context) {
	search := c.Query("search")
	tag := c.Query("tag")
	muscleGroup := c.Query("muscle_group")

	limit := 20
	offset := 0
	if p := c.Query("page"); p != "" {
		if n, err := strconv.Atoi(p); err == nil && n > 1 {
			offset = (n - 1) * limit
		}
	}

	splits, err := h.jymService.ListPublicSplits(c.Request.Context(), search, tag, muscleGroup, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to list public splits"}})
		return
	}
	c.JSON(http.StatusOK, splits)
}

func (h *JymHandler) GetPublicSplit(c *gin.Context) {
	splitID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid split ID"}})
		return
	}
	detail, err := h.jymService.GetPublicSplit(c.Request.Context(), splitID)
	if err != nil {
		if err == services.ErrSplitNotFound {
			c.JSON(http.StatusNotFound, models.ErrorResponse{Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "Split not found or not public"}})
			return
		}
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to get split"}})
		return
	}
	c.JSON(http.StatusOK, detail)
}

func (h *JymHandler) ImportPublicSplit(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	splitID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid split ID"}})
		return
	}
	newSplitID, err := h.jymService.ImportPublicSplit(c.Request.Context(), userID, splitID)
	if err != nil {
		if err == services.ErrSplitNotFound {
			c.JSON(http.StatusNotFound, models.ErrorResponse{Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "Split not found or not public"}})
			return
		}
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to import split"}})
		return
	}
	analytics.TrackEvent(h.db, userID, "split.import", nil)
	c.JSON(http.StatusOK, models.ImportShareResponse{SplitID: newSplitID.String()})
}

// ─── Routines ─────────────────────────────────────────────────────────────────

func (h *JymHandler) CreateRoutine(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	splitID, err := uuid.Parse(c.Param("split_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid split ID"}})
		return
	}
	var req models.CreateRoutineRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "VALIDATION_ERROR", Message: err.Error()}})
		return
	}
	rt, err := h.jymService.CreateRoutine(c.Request.Context(), userID, splitID, &req)
	if err != nil {
		if err == services.ErrSplitNotFound || err == services.ErrNotOwner {
			c.JSON(http.StatusNotFound, models.ErrorResponse{Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "Split not found"}})
			return
		}
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to create routine"}})
		return
	}
	c.JSON(http.StatusCreated, rt)
}

func (h *JymHandler) UpdateRoutine(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	routineID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid routine ID"}})
		return
	}
	var req models.UpdateRoutineRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "VALIDATION_ERROR", Message: err.Error()}})
		return
	}
	rt, err := h.jymService.UpdateRoutine(c.Request.Context(), userID, routineID, &req)
	if err != nil {
		if err == services.ErrRoutineNotFound {
			c.JSON(http.StatusNotFound, models.ErrorResponse{Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "Routine not found"}})
			return
		}
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to update routine"}})
		return
	}
	c.JSON(http.StatusOK, rt)
}

func (h *JymHandler) DeleteRoutine(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	routineID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid routine ID"}})
		return
	}
	if err := h.jymService.DeleteRoutine(c.Request.Context(), userID, routineID); err != nil {
		if err == services.ErrRoutineNotFound {
			c.JSON(http.StatusNotFound, models.ErrorResponse{Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "Routine not found"}})
			return
		}
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to delete routine"}})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Routine deleted"})
}

func (h *JymHandler) ReplaceRoutineItems(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	routineID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid routine ID"}})
		return
	}
	var items []models.ReplaceItemEntry
	if err := c.ShouldBindJSON(&items); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "VALIDATION_ERROR", Message: err.Error()}})
		return
	}
	result, err := h.jymService.ReplaceRoutineItems(c.Request.Context(), userID, routineID, items)
	if err != nil {
		if err == services.ErrRoutineNotFound {
			c.JSON(http.StatusNotFound, models.ErrorResponse{Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "Routine not found"}})
			return
		}
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to update routine items"}})
		return
	}
	c.JSON(http.StatusOK, result)
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

func (h *JymHandler) StartSession(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	var req models.CreateSessionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "VALIDATION_ERROR", Message: err.Error()}})
		return
	}
	sess, err := h.jymService.StartSession(c.Request.Context(), userID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to start session"}})
		return
	}
	analytics.TrackEvent(h.db, userID, "session.start", nil)
	c.JSON(http.StatusCreated, sess)
}

func (h *JymHandler) ListSessions(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	sessions, err := h.jymService.ListSessions(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to list sessions"}})
		return
	}
	c.JSON(http.StatusOK, sessions)
}

func (h *JymHandler) GetSession(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	sessionID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid session ID"}})
		return
	}
	sess, err := h.jymService.GetSession(c.Request.Context(), userID, sessionID)
	if err != nil {
		if err == services.ErrSessionNotFound {
			c.JSON(http.StatusNotFound, models.ErrorResponse{Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "Session not found"}})
			return
		}
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to get session"}})
		return
	}
	c.JSON(http.StatusOK, sess)
}

func (h *JymHandler) UpdateSession(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	sessionID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid session ID"}})
		return
	}
	var req models.UpdateSessionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "VALIDATION_ERROR", Message: err.Error()}})
		return
	}
	// Default ended_at to now if not provided
	if req.EndedAt == nil {
		now := time.Now()
		req.EndedAt = &now
	}
	sess, err := h.jymService.UpdateSession(c.Request.Context(), userID, sessionID, &req)
	if err != nil {
		if err == services.ErrSessionNotFound {
			c.JSON(http.StatusNotFound, models.ErrorResponse{Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "Session not found"}})
			return
		}
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to update session"}})
		return
	}
	// Track session finish when ended_at is set
	if req.EndedAt != nil {
		analytics.TrackEvent(h.db, userID, "session.finish", nil)
	}
	c.JSON(http.StatusOK, sess)
}

func (h *JymHandler) DeleteSession(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	sessionID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid session ID"}})
		return
	}
	if err := h.jymService.DeleteSession(c.Request.Context(), userID, sessionID); err != nil {
		if err == services.ErrSessionNotFound {
			c.JSON(http.StatusNotFound, models.ErrorResponse{Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "Session not found"}})
			return
		}
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to delete session"}})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Session deleted"})
}

// ─── Body Weights ─────────────────────────────────────────────────────────────

func (h *JymHandler) LogBodyWeight(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	var req models.LogBodyWeightRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "VALIDATION_ERROR", Message: err.Error()}})
		return
	}
	bw, err := h.jymService.LogBodyWeight(c.Request.Context(), userID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to log body weight"}})
		return
	}
	c.JSON(http.StatusCreated, bw)
}

func (h *JymHandler) ListBodyWeights(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	weights, err := h.jymService.ListBodyWeights(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to list body weights"}})
		return
	}
	c.JSON(http.StatusOK, weights)
}

func (h *JymHandler) DeleteBodyWeight(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid ID"}})
		return
	}
	if err := h.jymService.DeleteBodyWeight(c.Request.Context(), userID, id); err != nil {
		if err == services.ErrBodyWeightNotFound {
			c.JSON(http.StatusNotFound, models.ErrorResponse{Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "Body weight not found"}})
			return
		}
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to delete body weight"}})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Deleted"})
}

// ─── Series ───────────────────────────────────────────────────────────────────

func (h *JymHandler) CreateSeries(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	var req models.CreateSeriesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "VALIDATION_ERROR", Message: err.Error()}})
		return
	}
	sr, err := h.jymService.CreateSeries(c.Request.Context(), userID, &req)
	if err != nil {
		if err == services.ErrSplitNotFound || err == services.ErrNotOwner {
			c.JSON(http.StatusNotFound, models.ErrorResponse{Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "Split not found"}})
			return
		}
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to create series"}})
		return
	}
	c.JSON(http.StatusCreated, sr)
}

func (h *JymHandler) ListSeries(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	series, err := h.jymService.ListSeries(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to list series"}})
		return
	}
	c.JSON(http.StatusOK, series)
}

func (h *JymHandler) GetSeries(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	seriesID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid series ID"}})
		return
	}
	detail, err := h.jymService.GetSeriesDetail(c.Request.Context(), userID, seriesID)
	if err != nil {
		if err == services.ErrSeriesNotFound {
			c.JSON(http.StatusNotFound, models.ErrorResponse{Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "Series not found"}})
			return
		}
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to get series"}})
		return
	}
	c.JSON(http.StatusOK, detail)
}

func (h *JymHandler) UpdateSeries(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	seriesID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid series ID"}})
		return
	}
	var req models.UpdateSeriesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "VALIDATION_ERROR", Message: err.Error()}})
		return
	}
	sr, err := h.jymService.UpdateSeries(c.Request.Context(), userID, seriesID, &req)
	if err != nil {
		if err == services.ErrSeriesNotFound {
			c.JSON(http.StatusNotFound, models.ErrorResponse{Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "Series not found"}})
			return
		}
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to update series"}})
		return
	}
	c.JSON(http.StatusOK, sr)
}

func (h *JymHandler) DeleteSeries(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	seriesID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid series ID"}})
		return
	}
	if err := h.jymService.DeleteSeries(c.Request.Context(), userID, seriesID); err != nil {
		if err == services.ErrSeriesNotFound {
			c.JSON(http.StatusNotFound, models.ErrorResponse{Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "Series not found"}})
			return
		}
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to delete series"}})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Series deleted"})
}

// ─── Sets ─────────────────────────────────────────────────────────────────────

func (h *JymHandler) LogSet(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	sessionID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid session ID"}})
		return
	}
	var req models.CreateSetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "VALIDATION_ERROR", Message: err.Error()}})
		return
	}
	set, err := h.jymService.LogSet(c.Request.Context(), userID, sessionID, &req)
	if err != nil {
		if err == services.ErrSessionNotFound || err == services.ErrNotOwner {
			c.JSON(http.StatusNotFound, models.ErrorResponse{Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "Session not found"}})
			return
		}
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to log set"}})
		return
	}
	c.JSON(http.StatusCreated, set)
}

func (h *JymHandler) UpdateSet(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	setID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid set ID"}})
		return
	}
	var req models.UpdateSetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "VALIDATION_ERROR", Message: err.Error()}})
		return
	}
	set, err := h.jymService.UpdateSet(c.Request.Context(), userID, setID, &req)
	if err != nil {
		if err == services.ErrSetNotFound {
			c.JSON(http.StatusNotFound, models.ErrorResponse{Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "Set not found"}})
			return
		}
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to update set"}})
		return
	}
	c.JSON(http.StatusOK, set)
}

func (h *JymHandler) DeleteSet(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	setID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid set ID"}})
		return
	}
	if err := h.jymService.DeleteSet(c.Request.Context(), userID, setID); err != nil {
		if err == services.ErrSetNotFound {
			c.JSON(http.StatusNotFound, models.ErrorResponse{Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "Set not found"}})
			return
		}
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to delete set"}})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Set deleted"})
}

// ─── CSV Export ───────────────────────────────────────────────────────────────

func (h *JymHandler) ExportSessions(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)

	var from, to *time.Time
	if f := c.Query("from"); f != "" {
		t, err := time.Parse("2006-01-02", f)
		if err == nil {
			from = &t
		}
	}
	if t := c.Query("to"); t != "" {
		parsed, err := time.Parse("2006-01-02", t)
		if err == nil {
			to = &parsed
		}
	}

	var exerciseID *uuid.UUID
	if eid := c.Query("exercise_id"); eid != "" {
		id, err := uuid.Parse(eid)
		if err == nil {
			exerciseID = &id
		}
	}

	filename := "jym-export-" + time.Now().Format("2006-01-02") + ".csv"
	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", `attachment; filename="`+filename+`"`)
	c.Status(http.StatusOK)

	if err := h.jymService.StreamSessionsCSV(c.Request.Context(), userID, from, to, exerciseID, c.Writer); err != nil {
		log.Error().Err(err).Msg("failed to stream sessions CSV")
	}
	analytics.TrackEvent(h.db, userID, "export.csv", nil)
}

// ─── Split Shares ─────────────────────────────────────────────────────────────

func (h *JymHandler) CreateShare(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	splitID, err := uuid.Parse(c.Param("split_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid split ID"}})
		return
	}
	resp, err := h.jymService.CreateShare(c.Request.Context(), userID, splitID, h.appBaseURL)
	if err != nil {
		if err == services.ErrSplitNotFound {
			c.JSON(http.StatusNotFound, models.ErrorResponse{Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "Split not found"}})
			return
		}
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to create share"}})
		return
	}
	analytics.TrackEvent(h.db, userID, "split.share", nil)
	c.JSON(http.StatusCreated, resp)
}

func (h *JymHandler) RevokeShare(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	shareID, err := uuid.Parse(c.Param("share_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid share ID"}})
		return
	}
	if err := h.jymService.RevokeShare(c.Request.Context(), userID, shareID); err != nil {
		if err == services.ErrShareNotFound {
			c.JSON(http.StatusNotFound, models.ErrorResponse{Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "Share not found"}})
			return
		}
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to revoke share"}})
		return
	}
	c.Status(http.StatusNoContent)
}

// GetSharePreview is a public endpoint — no auth required.
func (h *JymHandler) GetSharePreview(c *gin.Context) {
	shareID, err := uuid.Parse(c.Param("share_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid share ID"}})
		return
	}
	preview, err := h.jymService.GetSharePreview(c.Request.Context(), shareID)
	if err != nil {
		if err == services.ErrShareNotFound {
			c.JSON(http.StatusNotFound, models.ErrorResponse{Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "Share link not found"}})
			return
		}
		if err == services.ErrShareExpired {
			c.JSON(http.StatusGone, models.ErrorResponse{Error: models.ErrorDetail{Code: "SHARE_EXPIRED", Message: "This share link has expired"}})
			return
		}
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to load share"}})
		return
	}
	c.JSON(http.StatusOK, preview)
}

func (h *JymHandler) ImportShare(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	shareID, err := uuid.Parse(c.Param("share_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid share ID"}})
		return
	}
	newSplitID, err := h.jymService.ImportShare(c.Request.Context(), userID, shareID)
	if err != nil {
		if err == services.ErrShareNotFound {
			c.JSON(http.StatusNotFound, models.ErrorResponse{Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "Share link not found"}})
			return
		}
		if err == services.ErrShareExpired {
			c.JSON(http.StatusGone, models.ErrorResponse{Error: models.ErrorDetail{Code: "SHARE_EXPIRED", Message: "This share link has expired"}})
			return
		}
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to import split"}})
		return
	}
	analytics.TrackEvent(h.db, userID, "split.import", nil)
	c.JSON(http.StatusCreated, models.ImportShareResponse{SplitID: newSplitID.String()})
}
