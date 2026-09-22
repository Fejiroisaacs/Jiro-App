package middleware

import (
	"net/http"

	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/models"
	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/services"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// exemptFromVerification lists protected routes that must stay reachable by
// an unverified account — otherwise it could never become verified at all.
var exemptFromVerification = map[string]bool{
	"/api/v1/auth/resend-verification": true,
}

// RequireVerifiedEmail blocks writes (anything but GET/HEAD/OPTIONS) from an
// account whose email is not yet verified; reads are always allowed. Must
// run after AuthRequired, which is what puts user_id in the context.
func RequireVerifiedEmail(userService *services.UserService) gin.HandlerFunc {
	return func(c *gin.Context) {
		switch c.Request.Method {
		case http.MethodGet, http.MethodHead, http.MethodOptions:
			c.Next()
			return
		}
		if exemptFromVerification[c.FullPath()] {
			c.Next()
			return
		}

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

		// Fails closed, matching AdminRequired: if verification status can't
		// be confirmed, the write isn't allowed through.
		verified, err := userService.IsEmailVerified(c.Request.Context(), userID)
		if err != nil || !verified {
			c.AbortWithStatusJSON(http.StatusForbidden, models.ErrorResponse{
				Error: models.ErrorDetail{
					Code:    "EMAIL_NOT_VERIFIED",
					Message: "Verify your email to make changes. Check your inbox, or resend the email from Settings.",
				},
			})
			return
		}
		c.Next()
	}
}
