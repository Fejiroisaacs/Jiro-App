package handlers

import (
	"net/http"
	"strconv"

	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/models"
	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/services"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type FeedbackHandler struct {
	feedbackService *services.FeedbackService
}

func NewFeedbackHandler(feedbackService *services.FeedbackService) *FeedbackHandler {
	return &FeedbackHandler{feedbackService: feedbackService}
}

// Submit handles POST /feedback (authenticated)
func (h *FeedbackHandler) Submit(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)

	var req models.SubmitFeedbackRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "VALIDATION_ERROR", Message: err.Error()},
		})
		return
	}

	feedback, err := h.feedbackService.SubmitFeedback(c.Request.Context(), userID, &req)
	if err != nil {
		if err == services.ErrInvalidFeedbackType {
			c.JSON(http.StatusBadRequest, models.ErrorResponse{
				Error: models.ErrorDetail{Code: "INVALID_TYPE", Message: "Type must be one of: bug, feature, other"},
			})
			return
		}
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to submit feedback"},
		})
		return
	}

	c.JSON(http.StatusCreated, feedback)
}

// List handles GET /admin/feedback (admin)
func (h *FeedbackHandler) List(c *gin.Context) {
	limit := 20
	offset := 0
	if l := c.Query("limit"); l != "" {
		if v, err := strconv.Atoi(l); err == nil && v > 0 {
			limit = v
		}
	}
	if o := c.Query("offset"); o != "" {
		if v, err := strconv.Atoi(o); err == nil && v >= 0 {
			offset = v
		}
	}

	list, err := h.feedbackService.ListFeedback(c.Request.Context(), limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to list feedback"},
		})
		return
	}

	c.JSON(http.StatusOK, list)
}

// Delete handles DELETE /admin/feedback/:id (admin)
func (h *FeedbackHandler) Delete(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid feedback ID"},
		})
		return
	}

	if err := h.feedbackService.DeleteFeedback(c.Request.Context(), id); err != nil {
		if err == services.ErrFeedbackNotFound {
			c.JSON(http.StatusNotFound, models.ErrorResponse{
				Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "Feedback not found"},
			})
			return
		}
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to delete feedback"},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Feedback deleted"})
}
