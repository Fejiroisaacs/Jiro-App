package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func SecurityHeaders(environment string) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("X-Frame-Options", "DENY")
		c.Header("Referrer-Policy", "strict-origin-when-cross-origin")

		// This is a JSON API and should never be a document source, so the
		// tightest possible policy is also the correct one and costs nothing.
		// The frontend needs a real policy with actual sources; this does not.
		c.Header("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'")
		// Production only, deliberately. Sending HSTS from a local HTTP dev
		// server would pin the developer's browser to https://localhost and
		// break the dev loop in a way that is tedious to undo, so do not
		// "simplify" this by removing the check. max-age and preload match
		// what the frontend host already serves, so the two halves of the app
		// make the same promise.
		if environment == "production" {
			c.Header("Strict-Transport-Security", "max-age=31556926; includeSubDomains; preload")
		}
		c.Next()
	}
}

// MaxBodySize rejects requests whose body exceeds maxBytes.
func MaxBodySize(maxBytes int64) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxBytes)
		c.Next()
	}
}
