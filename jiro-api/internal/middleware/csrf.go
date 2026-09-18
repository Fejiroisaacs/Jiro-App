package middleware

import (
	"net/http"

	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/models"
	"github.com/gin-gonic/gin"
)

// RequireTrustedOrigin rejects requests whose Origin is not in the allowlist.
//
// Apply it to the endpoints that authenticate with the refresh cookie rather
// than a bearer token. Every other route reads Authorization, which an attacker
// site cannot set without a preflight, so those are not CSRF-reachable. The
// cookie ones are: the browser attaches it automatically, which is exactly what
// SameSite=Strict used to prevent before the cookie had to become None to work
// across the app and API origins.
//
// Origin is required, not optional. Browsers always send it on a cross-origin
// POST, and on a same-origin POST too, so "absent" means a non-browser client —
// which has no ambient cookie to abuse and no reason to call these endpoints.
// Treating absent as trusted would hand back the bypass this exists to close.
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
