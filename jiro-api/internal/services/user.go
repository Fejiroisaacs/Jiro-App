package services

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/models"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrUserNotFound = errors.New("user not found")

type UserService struct {
	db *pgxpool.Pool
}

func NewUserService(db *pgxpool.Pool) *UserService {
	return &UserService{db: db}
}

func (s *UserService) CreateUser(ctx context.Context, email, passwordHash string) (*models.User, error) {
	user := &models.User{}
	err := s.db.QueryRow(ctx,
		`INSERT INTO users (email, password_hash, settings)
		 VALUES ($1, $2, '{}')
		 RETURNING id, email, settings, created_at, updated_at`,
		email, passwordHash,
	).Scan(&user.ID, &user.Email, &user.Settings, &user.CreatedAt, &user.UpdatedAt)

	if err != nil {
		return nil, err
	}
	return user, nil
}

func (s *UserService) GetByEmail(ctx context.Context, email string) (*models.User, error) {
	user := &models.User{}
	err := s.db.QueryRow(ctx,
		`SELECT id, email, password_hash, settings, created_at, updated_at
		 FROM users WHERE email = $1`,
		email,
	).Scan(&user.ID, &user.Email, &user.PasswordHash, &user.Settings, &user.CreatedAt, &user.UpdatedAt)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrUserNotFound
		}
		return nil, err
	}
	return user, nil
}

func (s *UserService) GetByID(ctx context.Context, id uuid.UUID) (*models.User, error) {
	user := &models.User{}
	err := s.db.QueryRow(ctx,
		`SELECT id, email, settings, created_at, updated_at
		 FROM users WHERE id = $1`,
		id,
	).Scan(&user.ID, &user.Email, &user.Settings, &user.CreatedAt, &user.UpdatedAt)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrUserNotFound
		}
		return nil, err
	}
	return user, nil
}

func (s *UserService) EmailExists(ctx context.Context, email string) (bool, error) {
	var exists bool
	err := s.db.QueryRow(ctx,
		"SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)",
		email,
	).Scan(&exists)
	return exists, err
}

func (s *UserService) UpdateSettings(ctx context.Context, userID uuid.UUID, req *models.UpdateSettingsRequest) (*models.User, error) {
	// Get current settings
	var currentSettings json.RawMessage
	err := s.db.QueryRow(ctx, "SELECT settings FROM users WHERE id = $1", userID).Scan(&currentSettings)
	if err != nil {
		return nil, err
	}

	// Merge updates into current settings
	var settings models.UserSettings
	if len(currentSettings) > 0 {
		json.Unmarshal(currentSettings, &settings)
	}

	if req.Theme != nil {
		settings.Theme = *req.Theme
	}
	if req.AvatarURL != nil {
		settings.AvatarURL = *req.AvatarURL
	}
	if req.WeightUnit != nil {
		settings.WeightUnit = *req.WeightUnit
	}
	if req.Timezone != nil {
		settings.Timezone = *req.Timezone
	}

	settingsJSON, err := json.Marshal(settings)
	if err != nil {
		return nil, err
	}

	user := &models.User{}
	err = s.db.QueryRow(ctx,
		`UPDATE users SET settings = $1, updated_at = NOW()
		 WHERE id = $2
		 RETURNING id, email, settings, created_at, updated_at`,
		settingsJSON, userID,
	).Scan(&user.ID, &user.Email, &user.Settings, &user.CreatedAt, &user.UpdatedAt)

	if err != nil {
		return nil, err
	}
	return user, nil
}
