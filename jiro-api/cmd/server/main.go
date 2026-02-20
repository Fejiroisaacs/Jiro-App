package main

import (
	"os"
	"time"

	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/config"
	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/database"
	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/router"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

func main() {
	// Setup logging
	zerolog.TimeFieldFormat = time.RFC3339
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr})

	log.Info().Msg("Starting Jiro API...")

	// Load configuration
	cfg := config.Load()

	// Connect to database
	db, err := database.Connect(cfg.DatabaseURL)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to connect to database")
	}
	defer db.Close()

	// Setup router
	r := router.Setup(db, cfg)

	// Start server
	addr := ":" + cfg.Port
	log.Info().Str("address", addr).Str("environment", cfg.Environment).Msg("Server listening")

	if err := r.Run(addr); err != nil {
		log.Fatal().Err(err).Msg("Server failed to start")
	}
}
