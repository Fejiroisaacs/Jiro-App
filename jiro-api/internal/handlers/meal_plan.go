package handlers

import (
	"errors"
	"net/http"
	"time"

	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/models"
	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/services"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type MealPlanHandler struct {
	service *services.MealPlanService
}

func NewMealPlanHandler(service *services.MealPlanService) *MealPlanHandler {
	return &MealPlanHandler{service: service}
}

// GET /culinara/meal-plan?week=YYYY-MM-DD
// Returns (or creates) the meal plan for the given week.
// If week is omitted, uses the current week's Monday.
func (h *MealPlanHandler) GetOrCreate(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)

	weekStart, err := parseWeekStart(c.Query("week"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "week must be YYYY-MM-DD"})
		return
	}

	plan, err := h.service.GetOrCreatePlan(c.Request.Context(), userID, weekStart)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, plan)
}

// POST /culinara/meal-plan/:plan_id/entries
func (h *MealPlanHandler) AddEntry(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)

	planID, err := uuid.Parse(c.Param("plan_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid plan_id"})
		return
	}

	var req models.AddMealPlanEntryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	entry, err := h.service.AddEntry(c.Request.Context(), userID, planID, &req)
	if err != nil {
		if errors.Is(err, services.ErrNotOwner) {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, entry)
}

// DELETE /culinara/meal-plan/entries/:entry_id
func (h *MealPlanHandler) RemoveEntry(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)

	entryID, err := uuid.Parse(c.Param("entry_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid entry_id"})
		return
	}

	err = h.service.RemoveEntry(c.Request.Context(), userID, entryID)
	if err != nil {
		if errors.Is(err, services.ErrMealPlanEntryNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "entry not found"})
			return
		}
		if errors.Is(err, services.ErrNotOwner) {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

// parseWeekStart parses a YYYY-MM-DD string and returns the Monday of that week.
// If s is empty, returns the Monday of the current week.
func parseWeekStart(s string) (time.Time, error) {
	var t time.Time
	if s == "" {
		t = time.Now().UTC()
	} else {
		var err error
		t, err = time.Parse("2006-01-02", s)
		if err != nil {
			return time.Time{}, err
		}
	}
	// Roll back to Monday
	weekday := int(t.Weekday()) // 0=Sun
	if weekday == 0 {
		weekday = 7
	}
	monday := t.AddDate(0, 0, -(weekday - 1))
	return time.Date(monday.Year(), monday.Month(), monday.Day(), 0, 0, 0, 0, time.UTC), nil
}
