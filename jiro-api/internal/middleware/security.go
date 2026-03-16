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
		if environment == "production" {
			c.Header("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
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
