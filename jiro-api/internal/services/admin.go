package services

import (
	"context"
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type AdminService struct {
	db *pgxpool.Pool
}

func NewAdminService(db *pgxpool.Pool) *AdminService {
	return &AdminService{db: db}
}

// ─── Stats ────────────────────────────────────────────────────────────────────

type AdminStats struct {
	TotalUsers    int            `json:"total_users"`
	TotalSessions int            `json:"total_sessions"`
	TotalRecipes  int            `json:"total_recipes"`
	EventsByDay   []EventDayStat `json:"events_by_day"`
}

type EventDayStat struct {
	Date  string `json:"date"`
	Event string `json:"event"`
	Count int    `json:"count"`
}

func (s *AdminService) GetStats(ctx context.Context) (*AdminStats, error) {
	stats := &AdminStats{EventsByDay: []EventDayStat{}}

	if err := s.db.QueryRow(ctx, `SELECT COUNT(*) FROM users`).Scan(&stats.TotalUsers); err != nil {
		return nil, err
	}
	if err := s.db.QueryRow(ctx, `SELECT COUNT(*) FROM sessions`).Scan(&stats.TotalSessions); err != nil {
		return nil, err
	}
	if err := s.db.QueryRow(ctx, `SELECT COUNT(*) FROM recipes`).Scan(&stats.TotalRecipes); err != nil {
		return nil, err
	}

	rows, err := s.db.Query(ctx, `
		SELECT
			to_char(date_trunc('day', occurred_at), 'YYYY-MM-DD') AS date,
			event,
			COUNT(*) AS count
		FROM analytics_events
		WHERE occurred_at >= NOW() - INTERVAL '30 days'
		GROUP BY 1, 2
		ORDER BY 1 ASC, 2 ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var d EventDayStat
		if err := rows.Scan(&d.Date, &d.Event, &d.Count); err != nil {
			return nil, err
		}
		stats.EventsByDay = append(stats.EventsByDay, d)
	}
	return stats, nil
}

// ─── Users ────────────────────────────────────────────────────────────────────

type AdminUserSummary struct {
	ID            uuid.UUID  `json:"id"`
	Email         string     `json:"email"`
	Username      *string    `json:"username"`
	DisplayName   *string    `json:"display_name"`
	EmailVerified bool       `json:"email_verified"`
	SessionCount  int        `json:"session_count"`
	RecipeCount   int        `json:"recipe_count"`
	SplitCount    int        `json:"split_count"`
	CreatedAt     time.Time  `json:"created_at"`
	LastLoginAt   *time.Time `json:"last_login_at"`
}

type AdminUserDetail struct {
	AdminUserSummary
	LastSessionAt *time.Time `json:"last_session_at"`
}

func (s *AdminService) ListUsers(ctx context.Context, search string, limit, offset int) ([]AdminUserSummary, error) {
	rows, err := s.db.Query(ctx, `
		SELECT
			u.id, u.email, u.username, u.display_name, u.email_verified, u.created_at,
			(SELECT COUNT(*) FROM sessions     WHERE user_id = u.id) AS session_count,
			(SELECT COUNT(*) FROM recipes      WHERE user_id = u.id) AS recipe_count,
			(SELECT COUNT(*) FROM splits       WHERE user_id = u.id) AS split_count,
			(SELECT MAX(occurred_at) FROM analytics_events WHERE user_id = u.id AND event = 'user.login') AS last_login_at
		FROM users u
		WHERE ($1 = '' OR u.email ILIKE '%' || $1 || '%' OR u.username ILIKE '%' || $1 || '%')
		ORDER BY u.created_at DESC
		LIMIT $2 OFFSET $3
	`, search, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []AdminUserSummary
	for rows.Next() {
		var u AdminUserSummary
		if err := rows.Scan(
			&u.ID, &u.Email, &u.Username, &u.DisplayName, &u.EmailVerified, &u.CreatedAt,
			&u.SessionCount, &u.RecipeCount, &u.SplitCount, &u.LastLoginAt,
		); err != nil {
			return nil, err
		}
		users = append(users, u)
	}
	if users == nil {
		users = []AdminUserSummary{}
	}
	return users, nil
}

func (s *AdminService) GetUser(ctx context.Context, userID uuid.UUID) (*AdminUserDetail, error) {
	var u AdminUserDetail
	err := s.db.QueryRow(ctx, `
		SELECT
			u.id, u.email, u.username, u.display_name, u.email_verified, u.created_at,
			(SELECT COUNT(*) FROM sessions     WHERE user_id = u.id) AS session_count,
			(SELECT COUNT(*) FROM recipes      WHERE user_id = u.id) AS recipe_count,
			(SELECT COUNT(*) FROM splits       WHERE user_id = u.id) AS split_count,
			(SELECT MAX(occurred_at) FROM analytics_events WHERE user_id = u.id AND event = 'user.login') AS last_login_at,
			(SELECT MAX(ended_at)   FROM sessions           WHERE user_id = u.id) AS last_session_at
		FROM users u
		WHERE u.id = $1
	`, userID).Scan(
		&u.ID, &u.Email, &u.Username, &u.DisplayName, &u.EmailVerified, &u.CreatedAt,
		&u.SessionCount, &u.RecipeCount, &u.SplitCount, &u.LastLoginAt, &u.LastSessionAt,
	)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (s *AdminService) DeleteUser(ctx context.Context, userID uuid.UUID) error {
	_, err := s.db.Exec(ctx, `DELETE FROM users WHERE id = $1`, userID)
	return err
}

func (s *AdminService) RevokeUserSessions(ctx context.Context, userID uuid.UUID) error {
	_, err := s.db.Exec(ctx, `DELETE FROM refresh_tokens WHERE user_id = $1`, userID)
	return err
}

// ─── Events ───────────────────────────────────────────────────────────────────

type AnalyticsEvent struct {
	ID         uuid.UUID       `json:"id"`
	UserID     *uuid.UUID      `json:"user_id"`
	UserEmail  *string         `json:"user_email"`
	Username   *string         `json:"username"`
	Event      string          `json:"event"`
	Properties json.RawMessage `json:"properties"`
	OccurredAt time.Time       `json:"occurred_at"`
}

func (s *AdminService) ListEvents(ctx context.Context, event, userIDStr string, limit, offset int) ([]AnalyticsEvent, error) {
	var userID *uuid.UUID
	if userIDStr != "" {
		if id, err := uuid.Parse(userIDStr); err == nil {
			userID = &id
		}
	}

	rows, err := s.db.Query(ctx, `
		SELECT a.id, a.user_id, u.email, u.username, a.event, a.properties, a.occurred_at
		FROM analytics_events a
		LEFT JOIN users u ON u.id = a.user_id
		WHERE ($1 = '' OR a.event = $1)
		  AND ($2::uuid IS NULL OR a.user_id = $2)
		ORDER BY a.occurred_at DESC
		LIMIT $3 OFFSET $4
	`, event, userID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var events []AnalyticsEvent
	for rows.Next() {
		var e AnalyticsEvent
		if err := rows.Scan(&e.ID, &e.UserID, &e.UserEmail, &e.Username, &e.Event, &e.Properties, &e.OccurredAt); err != nil {
			return nil, err
		}
		events = append(events, e)
	}
	if events == nil {
		events = []AnalyticsEvent{}
	}
	return events, nil
}
