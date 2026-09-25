package services

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
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
		 VALUES ($1, $2, $3, $4, '{"weight_unit":"lbs"}')
		 RETURNING id, email, username, display_name, email_verified, bio, avatar_url, settings, created_at, updated_at`,
		email, passwordHash, displayName, username,
	).Scan(&user.ID, &user.Email, &user.Username, &user.DisplayName, &user.EmailVerified, &user.Bio, &user.AvatarUrl, &user.Settings, &user.CreatedAt, &user.UpdatedAt)

	if err != nil {
		return nil, err
	}
	return user, nil
}

func (s *UserService) GetByEmail(ctx context.Context, email string) (*models.User, error) {
	user := &models.User{}
	err := s.db.QueryRow(ctx,
		`SELECT id, email, password_hash, username, display_name, email_verified, is_admin, is_demo, bio, avatar_url, settings, created_at, updated_at
		 FROM users WHERE email = $1`,
		email,
	).Scan(&user.ID, &user.Email, &user.PasswordHash, &user.Username, &user.DisplayName, &user.EmailVerified, &user.IsAdmin, &user.IsDemo, &user.Bio, &user.AvatarUrl, &user.Settings, &user.CreatedAt, &user.UpdatedAt)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrUserNotFound
		}
		return nil, err
	}
	return user, nil
}

// IsAdmin is read per request rather than carried in the JWT, so revoking
// admin takes effect immediately instead of at the next token refresh.
func (s *UserService) IsAdmin(ctx context.Context, id uuid.UUID) (bool, error) {
	var isAdmin bool
	err := s.db.QueryRow(ctx, `SELECT is_admin FROM users WHERE id = $1`, id).Scan(&isAdmin)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return false, ErrUserNotFound
		}
		return false, err
	}
	return isAdmin, nil
}

// WriteAccess returns what the write gate needs in one query. It is read per
// request rather than carried in the JWT, so verifying takes effect
// immediately instead of at the next token refresh.
func (s *UserService) WriteAccess(ctx context.Context, id uuid.UUID) (verified, demo bool, err error) {
	err = s.db.QueryRow(ctx, `SELECT email_verified, is_demo FROM users WHERE id = $1`, id).Scan(&verified, &demo)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return false, false, ErrUserNotFound
		}
		return false, false, err
	}
	return verified, demo, nil
}

func (s *UserService) GetByID(ctx context.Context, id uuid.UUID) (*models.User, error) {
	user := &models.User{}
	err := s.db.QueryRow(ctx,
		`SELECT id, email, username, display_name, email_verified, is_admin, is_demo, bio, avatar_url, settings, created_at, updated_at
		 FROM users WHERE id = $1`,
		id,
	).Scan(&user.ID, &user.Email, &user.Username, &user.DisplayName, &user.EmailVerified, &user.IsAdmin, &user.IsDemo, &user.Bio, &user.AvatarUrl, &user.Settings, &user.CreatedAt, &user.UpdatedAt)

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

// ErrInvalidSettings wraps every settings validation failure; the handler maps
// it to 400 and shows the message, so messages must be safe to return.
var ErrInvalidSettings = errors.New("invalid settings")

const (
	maxThemeLen         = 32
	maxDashboardBytes   = 4 << 10
	maxDashboardWidgets = 32
	dashboardLayoutV    = 1
)

// Widget ids are checked by pattern, not against a list, so shipping a new
// widget in the UI never needs an API release.
var dashboardWidgetIDRegexp = regexp.MustCompile(`^[a-z][a-z0-9_]{0,39}$`)

func invalidSettings(msg string) error {
	return fmt.Errorf("%w: %s", ErrInvalidSettings, msg)
}

// validateDashboard strictly decodes a layout and returns it re-encoded, so
// what is stored is exactly the validated struct and never the caller's bytes.
func validateDashboard(raw json.RawMessage) (json.RawMessage, error) {
	if len(raw) > maxDashboardBytes {
		return nil, invalidSettings("dashboard layout is too large")
	}
	dec := json.NewDecoder(bytes.NewReader(raw))
	dec.DisallowUnknownFields()
	var layout models.DashboardLayout
	if err := dec.Decode(&layout); err != nil {
		return nil, invalidSettings("dashboard layout is not valid")
	}
	if dec.More() {
		return nil, invalidSettings("dashboard layout is not valid")
	}
	if layout.V != dashboardLayoutV {
		return nil, invalidSettings("dashboard layout version is not supported")
	}
	if layout.Widgets == nil {
		layout.Widgets = []models.DashboardWidget{}
	}
	if len(layout.Widgets) > maxDashboardWidgets {
		return nil, invalidSettings("dashboard layout has too many widgets")
	}
	seen := make(map[string]struct{}, len(layout.Widgets))
	for _, w := range layout.Widgets {
		if !dashboardWidgetIDRegexp.MatchString(w.ID) {
			return nil, invalidSettings("dashboard widget id is not valid")
		}
		if _, dup := seen[w.ID]; dup {
			return nil, invalidSettings("dashboard widget ids must be unique")
		}
		seen[w.ID] = struct{}{}
	}
	return json.Marshal(layout)
}

// UpdateSettings merges only the fields that were sent into the stored
// settings object in a single statement. Keys this code does not know about
// are preserved, and two concurrent saves of different keys cannot clobber
// each other the way a read-modify-write would.
func (s *UserService) UpdateSettings(ctx context.Context, userID uuid.UUID, req *models.UpdateSettingsRequest) (*models.User, error) {
	patch := map[string]any{}
	remove := []string{}

	if req.Theme != nil {
		if len(*req.Theme) > maxThemeLen {
			return nil, invalidSettings("theme is too long")
		}
		if *req.Theme == "" {
			remove = append(remove, "theme")
		} else {
			patch["theme"] = *req.Theme
		}
	}
	if req.WeightUnit != nil {
		if *req.WeightUnit != "lbs" && *req.WeightUnit != "kg" {
			return nil, invalidSettings("weight_unit must be lbs or kg")
		}
		patch["weight_unit"] = *req.WeightUnit
	}
	if req.Timezone != nil {
		if *req.Timezone == "" {
			remove = append(remove, "timezone")
		} else {
			patch["timezone"] = *req.Timezone
		}
	}
	if len(req.Dashboard) > 0 {
		if bytes.Equal(bytes.TrimSpace(req.Dashboard), []byte("null")) {
			remove = append(remove, "dashboard")
		} else {
			layout, err := validateDashboard(req.Dashboard)
			if err != nil {
				return nil, err
			}
			patch["dashboard"] = layout
		}
	}

	patchJSON, err := json.Marshal(patch)
	if err != nil {
		return nil, err
	}

	user := &models.User{}
	err = s.db.QueryRow(ctx,
		`UPDATE users SET settings = (COALESCE(settings, '{}'::jsonb) || $1::jsonb) - $2::text[], updated_at = NOW()
		 WHERE id = $3
		 RETURNING id, email, username, display_name, email_verified, bio, avatar_url, settings, created_at, updated_at`,
		string(patchJSON), remove, userID,
	).Scan(&user.ID, &user.Email, &user.Username, &user.DisplayName, &user.EmailVerified, &user.Bio, &user.AvatarUrl, &user.Settings, &user.CreatedAt, &user.UpdatedAt)

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
		 RETURNING id, email, username, display_name, email_verified, bio, avatar_url, settings, created_at, updated_at`,
		req.Username, req.DisplayName, req.Bio, userID,
	).Scan(&user.ID, &user.Email, &user.Username, &user.DisplayName, &user.EmailVerified, &user.Bio, &user.AvatarUrl, &user.Settings, &user.CreatedAt, &user.UpdatedAt)

	if err != nil {
		return nil, err
	}
	return user, nil
}

func (s *UserService) SetEmailVerified(ctx context.Context, userID uuid.UUID) error {
	_, err := s.db.Exec(ctx,
		"UPDATE users SET email_verified = true, updated_at = NOW() WHERE id = $1",
		userID,
	)
	return err
}

func (s *UserService) SetAvatarURL(ctx context.Context, userID uuid.UUID, avatarURL string) error {
	_, err := s.db.Exec(ctx,
		"UPDATE users SET avatar_url = $1, updated_at = NOW() WHERE id = $2",
		avatarURL, userID,
	)
	return err
}

func (s *UserService) ClearAvatarURL(ctx context.Context, userID uuid.UUID) error {
	_, err := s.db.Exec(ctx,
		"UPDATE users SET avatar_url = NULL, updated_at = NOW() WHERE id = $1",
		userID,
	)
	return err
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
