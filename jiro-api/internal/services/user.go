package services

import (
	"context"
	"encoding/json"
	"errors"
	"regexp"
	"strings"

	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/models"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var usernameRegexp = regexp.MustCompile(`^[a-z0-9_]{3,30}$`)

var ErrUserNotFound = errors.New("user not found")

type UserService struct {
	db *pgxpool.Pool
}

func NewUserService(db *pgxpool.Pool) *UserService {
	return &UserService{db: db}
}

func (s *UserService) CreateUser(ctx context.Context, email, passwordHash, displayName string, username *string) (*models.User, error) {
	if username != nil {
		normalized := strings.ToLower(strings.TrimSpace(*username))
		username = &normalized
		if !usernameRegexp.MatchString(normalized) {
			return nil, ErrUsernameInvalid
		}
		var taken bool
		s.db.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM users WHERE username = $1)", normalized).Scan(&taken)
		if taken {
			return nil, ErrUsernameTaken
		}
	}

	user := &models.User{}
	err := s.db.QueryRow(ctx,
		`INSERT INTO users (email, password_hash, display_name, username, settings)
		 VALUES ($1, $2, $3, $4, '{}')
		 RETURNING id, email, username, display_name, email_verified, bio, settings, created_at, updated_at`,
		email, passwordHash, displayName, username,
	).Scan(&user.ID, &user.Email, &user.Username, &user.DisplayName, &user.EmailVerified, &user.Bio, &user.Settings, &user.CreatedAt, &user.UpdatedAt)

	if err != nil {
		return nil, err
	}
	return user, nil
}

func (s *UserService) GetByEmail(ctx context.Context, email string) (*models.User, error) {
	user := &models.User{}
	err := s.db.QueryRow(ctx,
		`SELECT id, email, password_hash, username, display_name, email_verified, bio, settings, created_at, updated_at
		 FROM users WHERE email = $1`,
		email,
	).Scan(&user.ID, &user.Email, &user.PasswordHash, &user.Username, &user.DisplayName, &user.EmailVerified, &user.Bio, &user.Settings, &user.CreatedAt, &user.UpdatedAt)

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
		`SELECT id, email, username, display_name, email_verified, bio, settings, created_at, updated_at
		 FROM users WHERE id = $1`,
		id,
	).Scan(&user.ID, &user.Email, &user.Username, &user.DisplayName, &user.EmailVerified, &user.Bio, &user.Settings, &user.CreatedAt, &user.UpdatedAt)

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
		 RETURNING id, email, username, display_name, email_verified, bio, settings, created_at, updated_at`,
		settingsJSON, userID,
	).Scan(&user.ID, &user.Email, &user.Username, &user.DisplayName, &user.EmailVerified, &user.Bio, &user.Settings, &user.CreatedAt, &user.UpdatedAt)

	if err != nil {
		return nil, err
	}
	return user, nil
}

var ErrUsernameTaken = errors.New("username already taken")
var ErrUsernameInvalid = errors.New("username must be 3-30 characters: lowercase letters, numbers, underscores only")

func (s *UserService) UpdateProfile(ctx context.Context, userID uuid.UUID, req *models.UpdateProfileRequest) (*models.User, error) {
	if req.Username != nil {
		normalized := strings.ToLower(strings.TrimSpace(*req.Username))
		req.Username = &normalized
		if !usernameRegexp.MatchString(normalized) {
			return nil, ErrUsernameInvalid
		}
		// Check uniqueness (exclude current user)
		var taken bool
		s.db.QueryRow(ctx,
			"SELECT EXISTS(SELECT 1 FROM users WHERE username = $1 AND id != $2)",
			normalized, userID,
		).Scan(&taken)
		if taken {
			return nil, ErrUsernameTaken
		}
	}

	user := &models.User{}
	err := s.db.QueryRow(ctx,
		`UPDATE users
		 SET username     = COALESCE($1, username),
		     display_name = COALESCE($2, display_name),
		     bio          = COALESCE($3, bio),
		     updated_at   = NOW()
		 WHERE id = $4
		 RETURNING id, email, username, display_name, email_verified, bio, settings, created_at, updated_at`,
		req.Username, req.DisplayName, req.Bio, userID,
	).Scan(&user.ID, &user.Email, &user.Username, &user.DisplayName, &user.EmailVerified, &user.Bio, &user.Settings, &user.CreatedAt, &user.UpdatedAt)

	if err != nil {
		return nil, err
	}
	return user, nil
}

func (s *UserService) GetByUsername(ctx context.Context, username string) (*models.PublicUser, error) {
	pub := &models.PublicUser{}
	err := s.db.QueryRow(ctx,
		`SELECT username, display_name, bio
		 FROM users WHERE username = $1`,
		strings.ToLower(username),
	).Scan(&pub.Username, &pub.DisplayName, &pub.Bio)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrUserNotFound
		}
		return nil, err
	}
	return pub, nil
}
