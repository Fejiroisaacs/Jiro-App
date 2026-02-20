package main

import (
	"context"
	"fmt"
	"os"
	"sort"
	"strings"

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

	// Create migrations tracking table
	_, err = pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version VARCHAR(255) PRIMARY KEY,
			applied_at TIMESTAMPTZ DEFAULT NOW()
		)`)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to create schema_migrations")
	}

	// Always seed: check which real migration filenames are already handled.
	// Uses ON CONFLICT DO NOTHING so it's safe to call every run.
	seedMigrations(ctx, pool)

	// Read applied migrations
	rows, err := pool.Query(ctx, `SELECT version FROM schema_migrations ORDER BY version`)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to query migrations")
	}
	applied := map[string]bool{}
	for rows.Next() {
		var v string
		rows.Scan(&v)
		applied[v] = true
	}
	rows.Close()

	// Read migration files
	entries, err := os.ReadDir("migrations")
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to read migrations dir")
	}

	var upFiles []string
	for _, e := range entries {
		if strings.HasSuffix(e.Name(), ".up.sql") {
			upFiles = append(upFiles, e.Name())
		}
	}
	sort.Strings(upFiles)

	for _, fname := range upFiles {
		version := strings.TrimSuffix(fname, ".up.sql")
		if applied[version] {
			fmt.Printf("  SKIP    %s\n", version)
			continue
		}

		sql, err := os.ReadFile("migrations/" + fname)
		if err != nil {
			log.Fatal().Err(err).Str("file", fname).Msg("Failed to read migration")
		}

		tx, err := pool.Begin(ctx)
		if err != nil {
			log.Fatal().Err(err).Msg("Failed to begin transaction")
		}

		if _, err := tx.Exec(ctx, string(sql)); err != nil {
			tx.Rollback(ctx)
			log.Fatal().Err(err).Str("file", fname).Msg("Migration failed")
		}

		if _, err := tx.Exec(ctx, `INSERT INTO schema_migrations (version) VALUES ($1)`, version); err != nil {
			tx.Rollback(ctx)
			log.Fatal().Err(err).Msg("Failed to record migration")
		}

		if err := tx.Commit(ctx); err != nil {
			log.Fatal().Err(err).Msg("Failed to commit migration")
		}

		fmt.Printf("  APPLIED %s\n", version)
	}

	fmt.Println("Migrations complete.")
}

// seedMigrations pre-populates schema_migrations based on whether key tables/columns exist.
// This handles the case where migrations were applied before the tracking table existed.
func seedMigrations(ctx context.Context, pool *pgxpool.Pool) {
	type check struct {
		version string
		query   string
	}

	checks := []check{
		{"000001_create_users",
			`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name='users')`},
		{"000002_create_refresh_tokens",
			`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name='refresh_tokens')`},
		{"000003_create_recipes",
			`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name='recipes')`},
		// Also record stale old-name entries so runner won't try to re-apply them
		// (they were seeded as "atlas" names in a previous run of this tool)
		{"000004_create_atlas_library",
			`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name='exercises')`},
		{"000005_create_atlas_routines",
			`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name='routines')`},
		{"000006_create_atlas_sessions",
			`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name='sessions')`},
		{"000007_atlas_session_type_bodyweight",
			`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name='body_weights')`},
		{"000008_atlas_split_series",
			`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name='split_series')`},
		{"000004_create_jym_library",
			`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name='exercises')`},
		{"000005_create_jym_routines",
			`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name='routines')`},
		{"000006_create_jym_sessions",
			`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name='sessions')`},
		{"000007_jym_session_type_bodyweight",
			`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name='body_weights')`},
		{"000008_jym_split_series",
			`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name='split_series')`},
	}

	for _, c := range checks {
		var exists bool
		pool.QueryRow(ctx, c.query).Scan(&exists)
		if exists {
			pool.Exec(ctx, `INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT DO NOTHING`, c.version)
			fmt.Printf("  SEEDED  %s\n", c.version)
		}
	}
}
