package middleware

import (
	"net/http"

	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/models"
	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/services"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// AdminRequired allows only users flagged is_admin. Must run after AuthRequired,
// which is what puts user_id in the context.
func AdminRequired(userService *services.UserService) gin.HandlerFunc {
	return func(c *gin.Context) {
		raw, ok := c.Get("user_id")
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, models.ErrorResponse{
				Error: models.ErrorDetail{Code: "UNAUTHORIZED", Message: "Authentication required"},
			})
			return
		}
		userID, ok := raw.(uuid.UUID)
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, models.ErrorResponse{
				Error: models.ErrorDetail{Code: "UNAUTHORIZED", Message: "Authentication required"},
			})
			return
		}

		isAdmin, err := userService.IsAdmin(c.Request.Context(), userID)
		if err != nil || !isAdmin {
			// 404 rather than 403: don't confirm the admin surface exists.
			c.AbortWithStatusJSON(http.StatusNotFound, models.ErrorResponse{
				Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "Not found"},
			})
			return
		}
		c.Next()
	}
}
