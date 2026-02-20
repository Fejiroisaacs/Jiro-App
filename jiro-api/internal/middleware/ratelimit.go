package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/models"
	"github.com/gin-gonic/gin"
)

type bucket struct {
	tokens     float64
	lastFill   time.Time
	capacity   float64
	ratePerSec float64
}

type RateLimiter struct {
	mu      sync.Mutex
	buckets map[string]*bucket
}

func NewRateLimiter() *RateLimiter {
	rl := &RateLimiter{
		buckets: make(map[string]*bucket),
	}

	// Background cleanup of stale buckets every 5 minutes
	go func() {
		for {
			time.Sleep(5 * time.Minute)
			rl.mu.Lock()
			cutoff := time.Now().Add(-10 * time.Minute)
			for key, b := range rl.buckets {
				if b.lastFill.Before(cutoff) {
					delete(rl.buckets, key)
				}
			}
			rl.mu.Unlock()
		}
	}()

	return rl
}

func (rl *RateLimiter) allow(key string, capacity float64, ratePerSec float64) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	b, exists := rl.buckets[key]
	if !exists {
		rl.buckets[key] = &bucket{
			tokens:     capacity - 1,
			lastFill:   now,
			capacity:   capacity,
			ratePerSec: ratePerSec,
		}
		return true
	}

	// Refill tokens based on elapsed time
	elapsed := now.Sub(b.lastFill).Seconds()
	b.tokens += elapsed * b.ratePerSec
	if b.tokens > b.capacity {
		b.tokens = b.capacity
	}
	b.lastFill = now

	if b.tokens < 1 {
		return false
	}

	b.tokens--
	return true
}

// RateLimitByIP applies rate limiting keyed by client IP.
// capacity: max burst size, perMinute: sustained requests per minute.
func RateLimitByIP(rl *RateLimiter, perMinute float64) gin.HandlerFunc {
	return func(c *gin.Context) {
		key := "ip:" + c.ClientIP()
		if !rl.allow(key, perMinute, perMinute/60.0) {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, models.ErrorResponse{
				Error: models.ErrorDetail{Code: "RATE_LIMITED", Message: "Too many requests, please try again later"},
			})
			return
		}
		c.Next()
	}
}
