package middleware

import "github.com/gin-gonic/gin"

// NoStore tells browsers and any intermediary not to keep the response.
//
// The API previously set no Cache-Control at all, on anything. Without a
// directive, a cache is free to apply heuristic freshness, which is the wrong
// default for endpoints that return someone's complete financial history,
// their journal entries and their account profile. no-store is the expected
// baseline for authenticated JSON and costs nothing here, because none of
// these responses are cacheable in any useful way: they are per-user and they
// change whenever the user changes them.
//
// Pragma is legacy, for HTTP/1.0 intermediaries that never learned
// Cache-Control. It is two bytes on the wire and removes a class of surprise.
func NoStore() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Cache-Control", "no-store")
		c.Header("Pragma", "no-cache")
		c.Next()
	}
}
