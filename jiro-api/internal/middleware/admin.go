package middleware

import (
	"net/http"

	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/models"
	"github.com/gin-gonic/gin"
)

// AdminRequired checks the X-Admin-Secret header against the configured secret.
// If ADMIN_SECRET is empty the server is in dev mode and all admin requests pass.
func AdminRequired(secret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if secret == "" {
			c.Next()
			return
		}
		if c.GetHeader("X-Admin-Secret") != secret {
			c.AbortWithStatusJSON(http.StatusUnauthorized, models.ErrorResponse{
				Error: models.ErrorDetail{Code: "UNAUTHORIZED", Message: "Invalid admin secret"},
			})
			return
		}
		c.Next()
	}
}
