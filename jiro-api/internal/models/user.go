package models

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type User struct {
	ID           uuid.UUID       `json:"id"`
	Email        string          `json:"email"`
	PasswordHash string          `json:"-"` // never expose in JSON
	Settings     json.RawMessage `json:"settings"`
	CreatedAt    time.Time       `json:"created_at"`
	UpdatedAt    time.Time       `json:"updated_at"`
}

type UserSettings struct {
	Theme      string `json:"theme,omitempty"`       // "earth", "clay", "sand", "forest"
	AvatarURL  string `json:"avatar_url,omitempty"`
	WeightUnit string `json:"weight_unit,omitempty"` // "lbs" or "kg"
	Timezone   string `json:"timezone,omitempty"`    // IANA timezone
}

type RefreshToken struct {
	ID        uuid.UUID `json:"id"`
	UserID    uuid.UUID `json:"user_id"`
	TokenHash string    `json:"-"`
	ExpiresAt time.Time `json:"expires_at"`
	CreatedAt time.Time `json:"created_at"`
}

// Request/response types

type RegisterRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=8"`
}

type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type UpdateSettingsRequest struct {
	Theme      *string `json:"theme,omitempty"`
	AvatarURL  *string `json:"avatar_url,omitempty"`
	WeightUnit *string `json:"weight_unit,omitempty"`
	Timezone   *string `json:"timezone,omitempty"`
}

type AuthResponse struct {
	AccessToken string `json:"access_token"`
	User        User   `json:"user"`
}

type ErrorResponse struct {
	Error ErrorDetail `json:"error"`
}

type ErrorDetail struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}
