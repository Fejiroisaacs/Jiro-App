package config

import (
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
	"github.com/rs/zerolog/log"
)

type Config struct {
	Port             string
	DatabaseURL      string
	JWTSecret        string
	AccessTokenTTL   time.Duration
	RefreshTokenTTL  time.Duration
	CORSOrigins      []string
	Environment      string // "development" or "production"
	ResendAPIKey     string
	EmailFrom        string
	AppBaseURL       string
	AdminSecret      string
	StorageEndpoint  string
	StorageBucket    string
	StorageAccessKey string
	StorageSecretKey string
	StoragePublicURL string
}

func Load() *Config {
	if err := godotenv.Load(); err != nil {
		log.Warn().Msg("No .env file found, using environment variables")
	}

	// Fail closed: an unset or misspelled ENVIRONMENT must not silently disable
	// hardening. Local development opts out explicitly via .env.
	env := getEnv("ENVIRONMENT", "production")
	isProd := env == "production"

	// No fallbacks. A missing secret must stop the server, not default to a
	// guessable value — these are read with os.Getenv rather than getEnv so
	// there is no placeholder to accidentally ship.
	jwtSecret := os.Getenv("JWT_SECRET")
	databaseURL := os.Getenv("DATABASE_URL")
	adminSecret := os.Getenv("ADMIN_SECRET")
	resendAPIKey := os.Getenv("RESEND_API_KEY")
	corsOrigins := parseCORSOrigins(os.Getenv("CORS_ORIGINS"))

	// Required in every environment, including development.
	if jwtSecret == "" {
		log.Fatal().Msg("JWT_SECRET must be set (generate with: openssl rand -hex 32)")
	}
	if len(jwtSecret) < 32 {
		log.Fatal().Msg("JWT_SECRET must be at least 32 characters (generate with: openssl rand -hex 32)")
	}
	if databaseURL == "" {
		log.Fatal().Msg("DATABASE_URL must be set")
	}
	if adminSecret == "" {
		log.Fatal().Msg("ADMIN_SECRET must be set — admin routes refuse to serve without it")
	}
	if len(corsOrigins) == 0 {
		log.Fatal().Msg("CORS_ORIGINS must be set (comma-separated list of allowed origins)")
	}

	if isProd {
		if strings.Contains(databaseURL, "localhost") || strings.Contains(databaseURL, "127.0.0.1") {
			log.Fatal().Msg("DATABASE_URL must point at a production database, not localhost")
		}
		if !hasSecureSSLMode(databaseURL) {
			log.Fatal().Msg("DATABASE_URL must set sslmode=require (or verify-ca/verify-full) in production")
		}
		if resendAPIKey == "" {
			// Without this the email service logs reset links instead of sending them.
			log.Fatal().Msg("RESEND_API_KEY must be set in production")
		}
		for _, o := range corsOrigins {
			if strings.Contains(o, "localhost") || strings.Contains(o, "127.0.0.1") {
				log.Fatal().Msgf("CORS_ORIGINS must not contain a local origin in production: %s", o)
			}
		}
	}

	return &Config{
		Port:             getEnv("PORT", "8080"),
		DatabaseURL:      databaseURL,
		JWTSecret:        jwtSecret,
		AccessTokenTTL:   getDuration("JWT_ACCESS_TTL_MINUTES", 15),
		RefreshTokenTTL:  getDuration("JWT_REFRESH_TTL_DAYS", 7*24*60), // 7 days in minutes
		CORSOrigins:      corsOrigins,
		Environment:      env,
		ResendAPIKey:     resendAPIKey,
		EmailFrom:        getEnv("EMAIL_FROM", "noreply@jiro.app"),
		AppBaseURL:       getEnv("APP_BASE_URL", "http://localhost:4200"),
		AdminSecret:      adminSecret,
		StorageEndpoint:  getEnv("STORAGE_ENDPOINT", ""),
		StorageBucket:    getEnv("STORAGE_BUCKET", ""),
		StorageAccessKey: getEnv("STORAGE_ACCESS_KEY", ""),
		StorageSecretKey: getEnv("STORAGE_SECRET_KEY", ""),
		StoragePublicURL: getEnv("STORAGE_PUBLIC_URL", ""),
	}
}

// parseCORSOrigins splits a comma-separated allowlist, trimming whitespace and
// dropping empty entries so a stray trailing comma cannot insert "" into the set.
func parseCORSOrigins(raw string) []string {
	var origins []string
	for _, part := range strings.Split(raw, ",") {
		if trimmed := strings.TrimSpace(part); trimmed != "" {
			origins = append(origins, trimmed)
		}
	}
	return origins
}

// hasSecureSSLMode reports whether the connection string requests a TLS mode
// that actually verifies the connection. "disable", "allow" and "prefer" all
// permit an unencrypted session, and an absent sslmode defaults to "prefer".
func hasSecureSSLMode(databaseURL string) bool {
	for _, mode := range []string{"sslmode=require", "sslmode=verify-ca", "sslmode=verify-full"} {
		if strings.Contains(databaseURL, mode) {
			return true
		}
	}
	return false
}

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}

func getDuration(key string, fallbackMinutes int) time.Duration {
	if val := os.Getenv(key); val != "" {
		if minutes, err := strconv.Atoi(val); err == nil {
			return time.Duration(minutes) * time.Minute
		}
	}
	return time.Duration(fallbackMinutes) * time.Minute
}
