package middleware

import (
	"context"
	"net/http"

	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// exemptFromVerification lists protected routes that must stay reachable by
// an unverified account — otherwise it could never become verified at all.
// The demo account is not exempt from anything: it is look-only everywhere.
var exemptFromVerification = map[string]bool{
	"/api/v1/auth/resend-verification": true,
}

// DemoReadOnlyMessage is what every blocked write from the demo account gets.
const DemoReadOnlyMessage = "The demo is look-only. Create an account to save your own."

// WriteAccessChecker is the per-request lookup the write gate needs.
type WriteAccessChecker interface {
	WriteAccess(ctx context.Context, id uuid.UUID) (verified, demo bool, err error)
}

// RequireWriteAccess blocks writes from the demo (DEMO_READ_ONLY) and unverified accounts (EMAIL_NOT_VERIFIED).
// Must run after AuthRequired, which puts user_id in the context.
func RequireWriteAccess(users WriteAccessChecker) gin.HandlerFunc {
	return func(c *gin.Context) {
		switch c.Request.Method {
		case http.MethodGet, http.MethodHead, http.MethodOptions:
			c.Next()
			return
		}

		raw, ok := c.Get("user_id")
		userID, isUUID := raw.(uuid.UUID)
		if !ok || !isUUID {
			c.AbortWithStatusJSON(http.StatusUnauthorized, models.ErrorResponse{
				Error: models.ErrorDetail{Code: "UNAUTHORIZED", Message: "Authentication required"},
			})
			return
		}

		// Fails closed, like AdminRequired: an unconfirmed status blocks the write.
		verified, demo, err := users.WriteAccess(c.Request.Context(), userID)
		if err == nil && demo {
			c.AbortWithStatusJSON(http.StatusForbidden, models.ErrorResponse{
				Error: models.ErrorDetail{Code: "DEMO_READ_ONLY", Message: DemoReadOnlyMessage},
			})
			return
		}
		if err == nil && exemptFromVerification[c.FullPath()] {
			c.Next()
			return
		}
		if err != nil || !verified {
			c.AbortWithStatusJSON(http.StatusForbidden, models.ErrorResponse{
				Error: models.ErrorDetail{
					Code:    "EMAIL_NOT_VERIFIED",
					Message: "Verify your email to make changes. Check your inbox for the link.",
				},
			})
			return
		}
		c.Next()
	}
}
