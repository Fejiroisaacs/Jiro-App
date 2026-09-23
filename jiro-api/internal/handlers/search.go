package handlers

import (
	"errors"
	"net/http"

	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/models"
	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/services"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type SearchHandler struct {
	svc *services.SearchService
}

func NewSearchHandler(svc *services.SearchService) *SearchHandler {
	return &SearchHandler{svc: svc}
}

// Search handles GET /search?q=<text>.
func (h *SearchHandler) Search(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)

	resp, err := h.svc.Search(c.Request.Context(), userID, c.Query("q"))
	if err != nil {
		if errors.Is(err, services.ErrSearchQueryTooLong) {
			c.JSON(http.StatusBadRequest, models.ErrorResponse{
				Error: models.ErrorDetail{Code: "INVALID_QUERY", Message: "Search is limited to 100 characters"},
			})
			return
		}
		respondInternal(c, err, "Failed to run search")
		return
	}
	c.JSON(http.StatusOK, resp)
}
