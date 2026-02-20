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
	Port            string
	DatabaseURL     string
	JWTSecret       string
	AccessTokenTTL  time.Duration
	RefreshTokenTTL time.Duration
	CORSOrigins     []string
	Environment     string // "development" or "production"
}

func Load() *Config {
	if err := godotenv.Load(); err != nil {
		log.Warn().Msg("No .env file found, using environment variables")
	}

	return &Config{
		Port:            getEnv("PORT", "8080"),
		DatabaseURL:     getEnv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/jiro?sslmode=disable"),
		JWTSecret:       getEnv("JWT_SECRET", "change-me-in-production"),
		AccessTokenTTL:  getDuration("JWT_ACCESS_TTL_MINUTES", 15),
		RefreshTokenTTL: getDuration("JWT_REFRESH_TTL_DAYS", 7*24*60), // 7 days in minutes
		CORSOrigins:     strings.Split(getEnv("CORS_ORIGINS", "http://localhost:4200"), ","),
		Environment:     getEnv("ENVIRONMENT", "development"),
	}
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
