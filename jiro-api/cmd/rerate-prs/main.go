// rerate-prs recomputes every stored PR flag under the current rules. Run it once after deploying them.
package main

import (
	"context"
	"fmt"
	"os"

	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/services"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
	"github.com/rs/zerolog/log"
)

func main() {
	_ = godotenv.Load()
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal().Msg("DATABASE_URL not set")
	}

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to connect")
	}
	defer pool.Close()

	exercises, changed, err := services.NewJymService(pool).RerateAllPRs(ctx)
	if err != nil {
		log.Fatal().Err(err).Msg("Re-rating failed")
	}
	fmt.Printf("Re-rated %d exercises; %d PR flags changed.\n", exercises, changed)
}
