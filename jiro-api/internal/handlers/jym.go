package handlers

import (
	"context"
	"errors"
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
	storage    *services.StorageService
	appBaseURL string
	db         *pgxpool.Pool
}

func NewJymHandler(jymService *services.JymService, storage *services.StorageService, appBaseURL string, db *pgxpool.Pool) *JymHandler {
	return &JymHandler{jymService: jymService, storage: storage, appBaseURL: appBaseURL, db: db}
}

// signAttachments replaces each attachment's stored URL with a short-lived
// signed one — the bucket is not meant to be publicly readable. Mirrors
// JournalHandler.signImages.
func (h *JymHandler) signAttachments(ctx context.Context, attachments []models.SessionAttachment) {
	for i := range attachments {
		if url, err := h.storage.PresignGetObject(ctx, attachments[i].ObjectKey); err == nil {
			attachments[i].FileURL = url
		}
	}
}

func (h *JymHandler) signFormChecks(ctx context.Context, checks []models.ExerciseFormCheck) {
	for i := range checks {
		if url, err := h.storage.PresignGetObject(ctx, checks[i].ObjectKey); err == nil {
			checks[i].FileURL = url
		}
	}
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
		if err == services.ErrExerciseNameTaken {
			c.JSON(http.StatusConflict, models.ErrorResponse{Error: models.ErrorDetail{Code: "NAME_TAKEN", Message: "You already have an exercise with that name"}})
			return
		}
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
	// ?limit= trims the set list for callers that only need recent sets (the workout's suggestions).
	var limit *int
	if l := c.Query("limit"); l != "" {
		n, perr := strconv.Atoi(l)
		// 0 returns the header alone, for pages that load the sets another way.
		if perr != nil || n < 0 || n > 500 {
			c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "INVALID_LIMIT", Message: "limit must be 0 to 500"}})
			return
		}
		limit = &n
	}
	ex, err := h.jymService.GetExerciseWithHistory(c.Request.Context(), userID, exerciseID, limit)
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
		if err == services.ErrExerciseNameTaken {
			c.JSON(http.StatusConflict, models.ErrorResponse{Error: models.ErrorDetail{Code: "NAME_TAKEN", Message: "You already have an exercise with that name"}})
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
	objectKeys, err := h.jymService.DeleteExercise(c.Request.Context(), userID, exerciseID)
	if err != nil {
		if err == services.ErrExerciseNotFound {
			c.JSON(http.StatusNotFound, models.ErrorResponse{Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "Exercise not found"}})
			return
		}
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to delete exercise"}})
		return
	}
	for _, key := range objectKeys {
		h.storage.DeleteObject(c.Request.Context(), key)
	}
	c.JSON(http.StatusOK, gin.H{"message": "Exercise deleted"})
}

// GET /jym/exercises/:id/form-checks
// Returns all session attachments tied to this exercise for the current user,
// enriched with the session date for the form-progression gallery.
func (h *JymHandler) GetExerciseFormChecks(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	exerciseID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid exercise ID"}})
		return
	}
	checks, err := h.jymService.ListFormChecks(c.Request.Context(), userID, exerciseID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to load form checks"}})
		return
	}
	h.signFormChecks(c.Request.Context(), checks)
	c.JSON(http.StatusOK, checks)
}

// exerciseParam reads :id, answering 400 itself when it isn't a uuid.
func exerciseParam(c *gin.Context) (uuid.UUID, bool) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid exercise ID"}})
		return uuid.Nil, false
	}
	return id, true
}

// exerciseReadError answers a failed exercise read: 404 for a missing or unowned exercise, else 500.
func exerciseReadError(c *gin.Context, err error, what string) {
	if errors.Is(err, services.ErrExerciseNotFound) {
		c.JSON(http.StatusNotFound, models.ErrorResponse{Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "Exercise not found"}})
		return
	}
	c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to load " + what}})
}

func (h *JymHandler) GetExerciseStats(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	exerciseID, ok := exerciseParam(c)
	if !ok {
		return
	}
	stats, err := h.jymService.GetExerciseStats(c.Request.Context(), userID, exerciseID)
	if err != nil {
		exerciseReadError(c, err, "exercise stats")
		return
	}
	c.JSON(http.StatusOK, stats)
}

func (h *JymHandler) GetRepsAtWeight(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	exerciseID, ok := exerciseParam(c)
	if !ok {
		return
	}
	weight, err := strconv.ParseFloat(c.Query("weight"), 64)
	if err != nil || weight < 0 || weight > 2000 {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "INVALID_WEIGHT", Message: "weight must be a number from 0 to 2000"}})
		return
	}
	list, err := h.jymService.GetRepsAtWeight(c.Request.Context(), userID, exerciseID, weight)
	if err != nil {
		exerciseReadError(c, err, "reps at weight")
		return
	}
	c.JSON(http.StatusOK, list)
}

func (h *JymHandler) ListExerciseWorkouts(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	exerciseID, ok := exerciseParam(c)
	if !ok {
		return
	}
	limit := 10
	if l := c.Query("limit"); l != "" {
		n, perr := strconv.Atoi(l)
		if perr != nil || n < 1 || n > 50 {
			c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "INVALID_LIMIT", Message: "limit must be 1 to 50"}})
			return
		}
		limit = n
	}
	var before *time.Time
	beforeID := uuid.Nil
	if b := c.Query("before"); b != "" {
		t, perr := time.Parse(time.RFC3339Nano, b)
		if perr != nil {
			c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "INVALID_CURSOR", Message: "before must be an RFC 3339 time"}})
			return
		}
		before = &t
	}
	if b := c.Query("before_id"); b != "" {
		id, perr := uuid.Parse(b)
		if perr != nil {
			c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "INVALID_CURSOR", Message: "before_id must be a session id"}})
			return
		}
		beforeID = id
	}
	list, err := h.jymService.ListExerciseWorkouts(c.Request.Context(), userID, exerciseID, before, beforeID, limit)
	if err != nil {
		exerciseReadError(c, err, "workouts")
		return
	}
	c.JSON(http.StatusOK, list)
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
		// Cap before multiplying: overflow yields a negative OFFSET.
		if n, err := strconv.Atoi(p); err == nil && n > 1 && n <= 10000 {
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
		if err == services.ErrExerciseNotFound {
			c.JSON(http.StatusNotFound, models.ErrorResponse{Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "Exercise not found"}})
			return
		}
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to update routine items"}})
		return
	}
	c.JSON(http.StatusOK, result)
}

// ReplaceSplitItems saves several days of one split in one transaction (a drag touches two).
func (h *JymHandler) ReplaceSplitItems(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	splitID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid split ID"}})
		return
	}
	var req models.ReplaceSplitItemsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "VALIDATION_ERROR", Message: err.Error()}})
		return
	}
	result, err := h.jymService.ReplaceSplitItems(c.Request.Context(), userID, splitID, req.Routines)
	if err != nil {
		switch err {
		case services.ErrSplitNotFound:
			c.JSON(http.StatusNotFound, models.ErrorResponse{Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "Split not found"}})
		case services.ErrRoutineNotFound:
			c.JSON(http.StatusNotFound, models.ErrorResponse{Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "Routine not found in this split"}})
		case services.ErrExerciseNotFound:
			c.JSON(http.StatusNotFound, models.ErrorResponse{Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "Exercise not found"}})
		case services.ErrDuplicateRoutine:
			c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "VALIDATION_ERROR", Message: "Each routine may appear only once"}})
		default:
			c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to update routine items"}})
		}
		return
	}
	c.JSON(http.StatusOK, result)
}

// ─── Templates ────────────────────────────────────────────────────────────────

func (h *JymHandler) ListTemplates(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	templates, err := h.jymService.ListTemplates(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to list templates"}})
		return
	}
	c.JSON(http.StatusOK, templates)
}

func (h *JymHandler) CreateTemplateFromSession(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	sessionID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid session ID"}})
		return
	}
	var req models.CreateTemplateFromSessionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "VALIDATION_ERROR", Message: err.Error()}})
		return
	}
	tmpl, err := h.jymService.CreateTemplateFromSession(c.Request.Context(), userID, sessionID, req.Name)
	if err != nil {
		if err == services.ErrSessionNotFound {
			c.JSON(http.StatusNotFound, models.ErrorResponse{Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "Session not found or has no sets"}})
			return
		}
		if err == services.ErrNotOwner {
			c.JSON(http.StatusForbidden, models.ErrorResponse{Error: models.ErrorDetail{Code: "FORBIDDEN", Message: "Not your session"}})
			return
		}
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to create template"}})
		return
	}
	c.JSON(http.StatusCreated, tmpl)
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
		var open *services.SessionInProgressError
		if errors.As(err, &open) {
			c.JSON(http.StatusConflict, gin.H{"error": gin.H{
				"code":         "SESSION_IN_PROGRESS",
				"message":      "Another workout is still in progress",
				"session_id":   open.SessionID,
				"routine_name": open.RoutineName,
				"started_at":   open.StartedAt,
				"set_count":    open.SetCount,
				"last_set_at":  open.LastSetAt,
			}})
			return
		}
		var timesErr *services.SessionTimesError
		if errors.As(err, &timesErr) {
			c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "VALIDATION_ERROR", Message: timesErr.Reason}})
			return
		}
		if err == services.ErrRoutineNotInSeries {
			c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "ROUTINE_NOT_IN_SERIES", Message: "That day is not part of the series' split"}})
			return
		}
		if err == services.ErrRoutineNotFound {
			c.JSON(http.StatusNotFound, models.ErrorResponse{Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "Routine not found"}})
			return
		}
		if err == services.ErrSeriesNotFound {
			c.JSON(http.StatusNotFound, models.ErrorResponse{Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "Series not found"}})
			return
		}
		if err == services.ErrExerciseNotFound {
			c.JSON(http.StatusNotFound, models.ErrorResponse{Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "Exercise not found"}})
			return
		}
		if err == services.ErrInvalidSessionType {
			c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "INVALID_SESSION_TYPE", Message: "Invalid session type"}})
			return
		}
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to start session"}})
		return
	}
	analytics.TrackEvent(h.db, userID, "session.start", nil)
	c.JSON(http.StatusCreated, sess)
}

// ListSessions serves ?from=YYYY-MM-DD (every session from that day, plus unfinished ones), ?from=&to= (the
// sessions started on those days), or a cursor page (?before=<started_at>&before_id=<id>&limit=), newest first.
// ?exercise_id= and ?type= narrow any of them.
func (h *JymHandler) ListSessions(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	ctx := c.Request.Context()
	var filter models.SessionFilter
	if e := c.Query("exercise_id"); e != "" {
		id, perr := uuid.Parse(e)
		if perr != nil {
			c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "INVALID_ID", Message: "exercise_id must be an exercise id"}})
			return
		}
		filter.ExerciseID = &id
	}
	if t := c.Query("type"); t != "" {
		if t != "normal" && t != "deload" && t != "test" {
			c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "INVALID_TYPE", Message: "type must be normal, deload or test"}})
			return
		}
		filter.Type = &t
	}
	var sessions []models.SessionSummary
	var err error
	if from := c.Query("from"); from != "" {
		day, perr := time.Parse("2006-01-02", from)
		if perr != nil {
			c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "INVALID_DATE", Message: "from must be YYYY-MM-DD"}})
			return
		}
		// tz is only a fallback for a user with no timezone setting, as on GET /day.
		if to := c.Query("to"); to != "" {
			last, perr := time.Parse("2006-01-02", to)
			if perr != nil || last.Before(day) || last.Sub(day) > 62*24*time.Hour {
				c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "INVALID_DATE", Message: "to must be YYYY-MM-DD, on or after from, at most 62 days later"}})
				return
			}
			sessions, err = h.jymService.ListSessionsInDays(ctx, userID, day, last, c.Query("tz"), filter)
		} else {
			sessions, err = h.jymService.ListSessionsSince(ctx, userID, day, c.Query("tz"), filter)
		}
	} else {
		limit := 50
		if l := c.Query("limit"); l != "" {
			n, perr := strconv.Atoi(l)
			if perr != nil || n < 1 || n > 100 {
				c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "INVALID_LIMIT", Message: "limit must be 1 to 100"}})
				return
			}
			limit = n
		}
		var before *time.Time
		beforeID := uuid.Nil
		if b := c.Query("before"); b != "" {
			t, perr := time.Parse(time.RFC3339Nano, b)
			if perr != nil {
				c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "INVALID_CURSOR", Message: "before must be an RFC 3339 time"}})
				return
			}
			before = &t
		}
		if b := c.Query("before_id"); b != "" {
			id, perr := uuid.Parse(b)
			if perr != nil {
				c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "INVALID_CURSOR", Message: "before_id must be a session id"}})
				return
			}
			beforeID = id
		}
		sessions, err = h.jymService.ListSessionsFiltered(ctx, userID, filter, before, beforeID, limit)
	}
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
	h.signAttachments(c.Request.Context(), sess.Attachments)
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
	// Only a request with ended_at finishes the session; notes or type edits keep it running.
	sess, err := h.jymService.UpdateSession(c.Request.Context(), userID, sessionID, &req)
	if err != nil {
		if err == services.ErrSessionNotFound {
			c.JSON(http.StatusNotFound, models.ErrorResponse{Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "Session not found"}})
			return
		}
		if err == services.ErrSessionEnded {
			respondSessionEnded(c)
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

// UpdateSessionTimes handles PATCH /jym/sessions/:id/times for a finished workout.
func (h *JymHandler) UpdateSessionTimes(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	sessionID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid session ID"}})
		return
	}
	var req models.UpdateSessionTimesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "VALIDATION_ERROR", Message: err.Error()}})
		return
	}
	sess, err := h.jymService.UpdateSessionTimes(c.Request.Context(), userID, sessionID, &req)
	var timesErr *services.SessionTimesError
	switch {
	case err == nil:
		c.JSON(http.StatusOK, sess)
	case errors.As(err, &timesErr):
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "VALIDATION_ERROR", Message: timesErr.Reason}})
	case errors.Is(err, services.ErrSessionNotFound):
		c.JSON(http.StatusNotFound, models.ErrorResponse{Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "Session not found"}})
	case errors.Is(err, services.ErrSessionNotFinished):
		c.JSON(http.StatusConflict, models.ErrorResponse{Error: models.ErrorDetail{Code: "SESSION_NOT_FINISHED", Message: "Finish the workout before changing its times"}})
	default:
		respondInternal(c, err, "failed to update session times")
	}
}

func (h *JymHandler) DeleteSession(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	sessionID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid session ID"}})
		return
	}
	// Collect R2 object keys before the DB row (and its cascaded attachments) is removed.
	objectKeys, _ := h.jymService.GetSessionAttachmentKeys(c.Request.Context(), userID, sessionID)

	if err := h.jymService.DeleteSession(c.Request.Context(), userID, sessionID); err != nil {
		if err == services.ErrSessionNotFound {
			c.JSON(http.StatusNotFound, models.ErrorResponse{Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "Session not found"}})
			return
		}
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to delete session"}})
		return
	}
	// Best-effort R2 cleanup — ignore individual errors so the response is never blocked.
	for _, key := range objectKeys {
		h.storage.DeleteObject(c.Request.Context(), key)
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
		if errors.Is(err, services.ErrInvalidSeriesLength) {
			c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "VALIDATION_ERROR", Message: err.Error()}})
			return
		}
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
		if err == services.ErrExerciseNotFound {
			c.JSON(http.StatusNotFound, models.ErrorResponse{Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "Exercise not found"}})
			return
		}
		if err == services.ErrSessionNotFound || err == services.ErrNotOwner {
			c.JSON(http.StatusNotFound, models.ErrorResponse{Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "Session not found"}})
			return
		}
		if err == services.ErrSessionEnded {
			respondSessionEnded(c)
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

// DeleteSessionExercise removes an entire exercise block (every logged set
// for it) from an in-progress session.
func (h *JymHandler) DeleteSessionExercise(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	sessionID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid session ID"}})
		return
	}
	exerciseID, err := uuid.Parse(c.Param("exercise_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid exercise ID"}})
		return
	}
	if err := h.jymService.DeleteSessionExercise(c.Request.Context(), userID, sessionID, exerciseID); err != nil {
		if err == services.ErrSessionNotFound {
			c.JSON(http.StatusNotFound, models.ErrorResponse{Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "Session not found"}})
			return
		}
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to remove exercise"}})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Exercise removed"})
}

// AddSessionExercise puts an exercise on a workout's list.
// POST /jym/sessions/:id/exercises
func (h *JymHandler) AddSessionExercise(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	sessionID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid session ID"}})
		return
	}
	var req models.AddSessionExerciseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "VALIDATION_ERROR", Message: err.Error()}})
		return
	}
	ex, err := h.jymService.AddSessionExercise(c.Request.Context(), userID, sessionID, req.ExerciseID)
	if err != nil {
		switch err {
		case services.ErrSessionNotFound:
			c.JSON(http.StatusNotFound, models.ErrorResponse{Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "Session not found"}})
		case services.ErrExerciseNotFound:
			c.JSON(http.StatusNotFound, models.ErrorResponse{Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "Exercise not found"}})
		default:
			c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to add exercise"}})
		}
		return
	}
	c.JSON(http.StatusOK, ex)
}

// ReorderSessionExercises sets a workout's order.
// PUT /jym/sessions/:id/exercises/order
func (h *JymHandler) ReorderSessionExercises(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	sessionID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid session ID"}})
		return
	}
	var req models.ReorderSessionExercisesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "VALIDATION_ERROR", Message: err.Error()}})
		return
	}
	if err := h.jymService.ReorderSessionExercises(c.Request.Context(), userID, sessionID, req.ExerciseIDs); err != nil {
		switch err {
		case services.ErrSessionNotFound:
			c.JSON(http.StatusNotFound, models.ErrorResponse{Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "Session not found"}})
		case services.ErrExerciseOrder:
			c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "VALIDATION_ERROR", Message: err.Error()}})
		default:
			c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to save the order"}})
		}
		return
	}
	c.Status(http.StatusNoContent)
}

// GetSessionReport is a workout's summary, built by the same rules as every session list.
// GET /jym/sessions/:id/summary
func (h *JymHandler) GetSessionReport(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	sessionID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid session ID"}})
		return
	}
	report, err := h.jymService.GetSessionReport(c.Request.Context(), userID, sessionID)
	if err != nil {
		if errors.Is(err, services.ErrSessionNotFound) {
			c.JSON(http.StatusNotFound, models.ErrorResponse{Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "Session not found"}})
			return
		}
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to build the session summary"}})
		return
	}
	c.JSON(http.StatusOK, report)
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

	// tz is only a fallback for a user with no timezone setting, as on GET /day.
	if err := h.jymService.StreamSessionsCSV(c.Request.Context(), userID, from, to, exerciseID, c.Query("tz"), c.Writer); err != nil {
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

// ListShares handles GET /jym/splits/:split_id/shares: the split's live links.
func (h *JymHandler) ListShares(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	splitID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid split ID"}})
		return
	}
	links, err := h.jymService.ListShares(c.Request.Context(), userID, splitID, h.appBaseURL)
	if err != nil {
		if err == services.ErrSplitNotFound {
			c.JSON(http.StatusNotFound, models.ErrorResponse{Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "Split not found"}})
			return
		}
		respondInternal(c, err, "failed to list shares")
		return
	}
	c.JSON(http.StatusOK, links)
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

// respondSessionEnded is the 409 for writes that need a live session.
func respondSessionEnded(c *gin.Context) {
	c.JSON(http.StatusConflict, models.ErrorResponse{Error: models.ErrorDetail{Code: "SESSION_ENDED", Message: "This session has already finished"}})
}
