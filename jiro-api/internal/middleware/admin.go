package middleware

import (
	"crypto/subtle"
	"net/http"

	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/models"
	"github.com/gin-gonic/gin"
)

// AdminRequired checks X-Admin-Secret. Fails closed: an unconfigured secret
// refuses every request rather than admitting all of them.
func AdminRequired(secret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if secret == "" {
			c.AbortWithStatusJSON(http.StatusServiceUnavailable, models.ErrorResponse{
				Error: models.ErrorDetail{Code: "ADMIN_DISABLED", Message: "Admin API is not configured"},
			})
			return
		}
		provided := c.GetHeader("X-Admin-Secret")
		if subtle.ConstantTimeCompare([]byte(provided), []byte(secret)) != 1 {
			c.AbortWithStatusJSON(http.StatusUnauthorized, models.ErrorResponse{
				Error: models.ErrorDetail{Code: "UNAUTHORIZED", Message: "Invalid admin secret"},
			})
			return
		}
		c.Next()
	}
}
