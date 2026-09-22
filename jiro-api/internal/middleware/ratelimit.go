package middleware

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/models"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog/log"
)

// LoginFailTracker blocks IPs after too many failed login attempts. Backed by
// Postgres (see migration 000031) rather than an in-process map, so the
// block is enforced consistently across every Cloud Run instance instead of
// one attempt budget per instance.
const (
	maxLoginFails      = 10
	loginBlockDuration = 15 * time.Minute
	staleEntryTTL      = 24 * time.Hour
)

type LoginFailTracker struct {
	db *pgxpool.Pool
}

func NewLoginFailTracker(db *pgxpool.Pool) *LoginFailTracker {
	lft := &LoginFailTracker{db: db}
	go func() {
		for {
			time.Sleep(10 * time.Minute)
			cutoff := time.Now().Add(-staleEntryTTL)
			if _, err := db.Exec(context.Background(),
				`DELETE FROM login_fail_entries WHERE last_seen < $1`, cutoff); err != nil {
				log.Error().Err(err).Msg("login fail tracker cleanup failed")
			}
		}
	}()
	return lft
}

func (lft *LoginFailTracker) RecordFail(ctx context.Context, ip string) {
	blockedUntil := time.Now().Add(loginBlockDuration)
	const q = `
		INSERT INTO login_fail_entries (ip, fail_count, last_seen, blocked_until)
		VALUES ($1, 1, now(), NULL)
		ON CONFLICT (ip) DO UPDATE SET
			fail_count = login_fail_entries.fail_count + 1,
			last_seen = now(),
			blocked_until = CASE
				WHEN login_fail_entries.fail_count + 1 >= $2 THEN $3
				ELSE login_fail_entries.blocked_until
			END`
	if _, err := lft.db.Exec(ctx, q, ip, maxLoginFails, blockedUntil); err != nil {
		log.Error().Err(err).Msg("login fail tracker: record fail")
	}
}

func (lft *LoginFailTracker) RecordSuccess(ctx context.Context, ip string) {
	if _, err := lft.db.Exec(ctx, `DELETE FROM login_fail_entries WHERE ip = $1`, ip); err != nil {
		log.Error().Err(err).Msg("login fail tracker: record success")
	}
}

// IsBlocked fails open (returns false) on a DB error — a lockout check that
// cannot reach the database should not itself take login down.
func (lft *LoginFailTracker) IsBlocked(ctx context.Context, ip string) bool {
	var blockedUntil *time.Time
	err := lft.db.QueryRow(ctx, `SELECT blocked_until FROM login_fail_entries WHERE ip = $1`, ip).Scan(&blockedUntil)
	if err != nil {
		if !errors.Is(err, pgx.ErrNoRows) {
			log.Error().Err(err).Msg("login fail tracker: is blocked")
		}
		return false
	}
	if blockedUntil == nil {
		return false
	}
	if time.Now().After(*blockedUntil) {
		if _, err := lft.db.Exec(ctx, `DELETE FROM login_fail_entries WHERE ip = $1`, ip); err != nil {
			log.Error().Err(err).Msg("login fail tracker: expire block")
		}
		return false
	}
	return true
}

// RateLimiter implements a token bucket per key, persisted in Postgres so
// every Cloud Run instance enforces the same shared budget. The refill and
// spend happen in one atomic UPDATE (guarded by Postgres's row lock), so
// concurrent requests for the same key — whether on one instance or several
// — cannot both read the same token count and both be let through.
type RateLimiter struct {
	db *pgxpool.Pool
}

func NewRateLimiter(db *pgxpool.Pool) *RateLimiter {
	rl := &RateLimiter{db: db}
	go func() {
		for {
			time.Sleep(30 * time.Minute)
			cutoff := time.Now().Add(-staleEntryTTL)
			if _, err := db.Exec(context.Background(),
				`DELETE FROM rate_limit_buckets WHERE last_fill < $1`, cutoff); err != nil {
				log.Error().Err(err).Msg("rate limiter cleanup failed")
			}
		}
	}()
	return rl
}

// allow fails open (returns true) on a DB error — a rate limiter that cannot
// reach the database should not itself take the API down.
func (rl *RateLimiter) allow(ctx context.Context, key string, capacity float64, ratePerSec float64) bool {
	const q = `
		INSERT INTO rate_limit_buckets (key, tokens, capacity, rate_per_sec, last_fill)
		VALUES ($1, $2 - 1, $2, $3, now())
		ON CONFLICT (key) DO UPDATE SET
			tokens = LEAST($2, rate_limit_buckets.tokens
				+ EXTRACT(EPOCH FROM (now() - rate_limit_buckets.last_fill)) * $3) - 1,
			capacity = $2,
			rate_per_sec = $3,
			last_fill = now()
		WHERE LEAST($2, rate_limit_buckets.tokens
			+ EXTRACT(EPOCH FROM (now() - rate_limit_buckets.last_fill)) * $3) >= 1
		RETURNING tokens`

	var tokens float64
	err := rl.db.QueryRow(ctx, q, key, capacity, ratePerSec).Scan(&tokens)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return false
		}
		log.Error().Err(err).Str("key", key).Msg("rate limiter check failed")
		return true
	}
	return true
}

// RateLimitByIP applies rate limiting keyed by client IP.
// scope namespaces the bucket so two different limits do not share one.
// capacity equals the burst size; perMinute is the sustained refill rate.
func RateLimitByIP(rl *RateLimiter, scope string, perMinute float64) gin.HandlerFunc {
	return func(c *gin.Context) {
		key := scope + ":ip:" + c.ClientIP()
		if !rl.allow(c.Request.Context(), key, perMinute, perMinute/60.0) {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, models.ErrorResponse{
				Error: models.ErrorDetail{Code: "RATE_LIMITED", Message: "Too many requests, please try again later"},
			})
			return
		}
		c.Next()
	}
}

// RateLimitByUser applies rate limiting keyed by the authenticated user ID.
// scope namespaces the bucket so a per-route limit is not swallowed by the group.
// Falls back to client IP when no user ID is present in the context.
// capacity equals the burst size; perMinute is the sustained refill rate.
func RateLimitByUser(rl *RateLimiter, scope string, perMinute float64) gin.HandlerFunc {
	return func(c *gin.Context) {
		var key string
		if uid, exists := c.Get("user_id"); exists {
			if userID, ok := uid.(interface{ String() string }); ok {
				key = scope + ":user:" + userID.String()
			} else {
				key = scope + ":ip:" + c.ClientIP()
			}
		} else {
			key = scope + ":ip:" + c.ClientIP()
		}
		if !rl.allow(c.Request.Context(), key, perMinute, perMinute/60.0) {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, models.ErrorResponse{
				Error: models.ErrorDetail{Code: "RATE_LIMITED", Message: "Too many requests, please try again later"},
			})
			return
		}
		c.Next()
	}
}
