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

type DayHandler struct {
	svc *services.DayService
}

func NewDayHandler(svc *services.DayService) *DayHandler {
	return &DayHandler{svc: svc}
}

// GetDay handles GET /day?date=YYYY-MM-DD&tz=<IANA> (date omitted: today in
// the user's timezone; tz is only a fallback for a user with no timezone
// setting). Read-only; 400 for a malformed or future date.
func (h *DayHandler) GetDay(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)

	resp, err := h.svc.GetDay(c.Request.Context(), userID, c.Query("date"), c.Query("tz"), time.Now())
	if err != nil {
		switch {
		case errors.Is(err, services.ErrInvalidDay):
			c.JSON(http.StatusBadRequest, models.ErrorResponse{
				Error: models.ErrorDetail{Code: "INVALID_DATE", Message: "date must be YYYY-MM-DD"},
			})
		case errors.Is(err, services.ErrFutureDay):
			c.JSON(http.StatusBadRequest, models.ErrorResponse{
				Error: models.ErrorDetail{Code: "FUTURE_DATE", Message: "date cannot be in the future"},
			})
		default:
			respondInternal(c, err, "Failed to load day")
		}
		return
	}
	c.JSON(http.StatusOK, resp)
}
