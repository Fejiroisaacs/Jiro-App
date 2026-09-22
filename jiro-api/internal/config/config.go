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
	StorageEndpoint  string
	StorageBucket    string
	StorageAccessKey string
	StorageSecretKey string
	StoragePublicURL string
	// StoragePrivateBucket holds journal images, collection covers and session
	// attachments — content with no discover/share feature, unlike recipe
	// covers and avatars, which stay in StorageBucket and stay public. Empty
	// until that bucket exists and this stays wired to StorageBucket, keeping
	// today's behaviour rather than breaking on missing config.
	StoragePrivateBucket string
}

func Load() *Config {
	if err := godotenv.Load(); err != nil {
		log.Warn().Msg("No .env file found, using environment variables")
	}

	// Fail closed: an unset ENVIRONMENT must not disable hardening.
	env := getEnv("ENVIRONMENT", "production")
	isProd := env == "production"

	// os.Getenv, not getEnv: no placeholder to accidentally ship.
	jwtSecret := os.Getenv("JWT_SECRET")
	databaseURL := os.Getenv("DATABASE_URL")
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

	if appDatabaseURL := os.Getenv("APP_DATABASE_URL"); appDatabaseURL != "" {
		databaseURL = appDatabaseURL
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
		Port:                 getEnv("PORT", "8080"),
		DatabaseURL:          databaseURL,
		JWTSecret:            jwtSecret,
		AccessTokenTTL:       getDuration("JWT_ACCESS_TTL_MINUTES", 15),
		RefreshTokenTTL:      getDurationDays("JWT_REFRESH_TTL_DAYS", 7),
		CORSOrigins:          corsOrigins,
		Environment:          env,
		ResendAPIKey:         resendAPIKey,
		EmailFrom:            getEnv("EMAIL_FROM", "noreply@jiro.app"),
		AppBaseURL:           getEnv("APP_BASE_URL", "http://localhost:4200"),
		StorageEndpoint:      getEnv("STORAGE_ENDPOINT", ""),
		StorageBucket:        getEnv("STORAGE_BUCKET", ""),
		StorageAccessKey:     getEnv("STORAGE_ACCESS_KEY", ""),
		StorageSecretKey:     getEnv("STORAGE_SECRET_KEY", ""),
		StoragePublicURL:     getEnv("STORAGE_PUBLIC_URL", ""),
		StoragePrivateBucket: getEnv("STORAGE_BUCKET_PRIVATE", ""),
	}
}

// Drops empty entries so a trailing comma cannot insert "" into the allowlist.
func parseCORSOrigins(raw string) []string {
	var origins []string
	for _, part := range strings.Split(raw, ",") {
		if trimmed := strings.TrimSpace(part); trimmed != "" {
			origins = append(origins, trimmed)
		}
	}
	return origins
}

// "disable", "allow" and "prefer" all permit an unencrypted session, and an
// absent sslmode defaults to "prefer".
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

// getDurationDays exists so a "_DAYS" env var actually means days: getDuration
// silently reads any key as minutes regardless of its name, which previously
// made JWT_REFRESH_TTL_DAYS=7 (the value the README tells you to set) produce
// a 7-minute refresh token instead of 7 days.
func getDurationDays(key string, fallbackDays int) time.Duration {
	if val := os.Getenv(key); val != "" {
		if days, err := strconv.Atoi(val); err == nil {
			return time.Duration(days) * 24 * time.Hour
		}
	}
	return time.Duration(fallbackDays) * 24 * time.Hour
}
