package middleware

import (
	"net/http"

	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/models"
	"github.com/gin-gonic/gin"
)

// RequireTrustedOrigin rejects requests whose Origin is not allowlisted. Use it on
// routes authenticated by the refresh cookie, which the browser attaches for you —
// the thing SameSite=Strict used to prevent. Origin is required, not optional:
// browsers always send it on POST, so absent means a non-browser caller.
func RequireTrustedOrigin(allowedOrigins []string) gin.HandlerFunc {
	allowed := make(map[string]bool, len(allowedOrigins))
	for _, o := range allowedOrigins {
		allowed[o] = true
	}

	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		if origin == "" || !allowed[origin] {
			c.AbortWithStatusJSON(http.StatusForbidden, models.ErrorResponse{
				Error: models.ErrorDetail{Code: "UNTRUSTED_ORIGIN", Message: "Request origin is not allowed"},
			})
			return
		}
		c.Next()
	}
}
