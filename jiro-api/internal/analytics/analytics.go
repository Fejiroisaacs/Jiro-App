package analytics

import (
	"context"
	"encoding/json"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog/log"
)

// TrackEvent records an analytics event asynchronously (fire-and-forget).
// userID may be uuid.Nil for anonymous events.
func TrackEvent(db *pgxpool.Pool, userID uuid.UUID, event string, properties map[string]any) {
	go func() {
		var propsJSON []byte
		if len(properties) > 0 {
			b, err := json.Marshal(properties)
			if err == nil {
				propsJSON = b
			}
		}

		var err error
		if userID == uuid.Nil {
			_, err = db.Exec(context.Background(),
				`INSERT INTO analytics_events (event, properties) VALUES ($1, $2)`,
				event, propsJSON,
			)
		} else {
			_, err = db.Exec(context.Background(),
				`INSERT INTO analytics_events (user_id, event, properties) VALUES ($1, $2, $3)`,
				userID, event, propsJSON,
			)
		}
		if err != nil {
			log.Warn().Err(err).Str("event", event).Msg("analytics: failed to insert event")
		}
	}()
}
