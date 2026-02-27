package models

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type User struct {
	ID            uuid.UUID       `json:"id"`
	Email         string          `json:"email"`
	PasswordHash  string          `json:"-"` // never expose in JSON
	Username      *string         `json:"username"`
	DisplayName   *string         `json:"display_name"`
	EmailVerified bool            `json:"email_verified"`
	Bio           *string         `json:"bio"`
	AvatarUrl     *string         `json:"avatar_url"`
	Settings      json.RawMessage `json:"settings"`
	CreatedAt     time.Time       `json:"created_at"`
	UpdatedAt     time.Time       `json:"updated_at"`
}

type UserSettings struct {
	Theme      string `json:"theme,omitempty"`       // "earth", "clay", "sand", "forest"
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
	Email       string  `json:"email" binding:"required,email"`
	Password    string  `json:"password" binding:"required,min=8"`
	DisplayName string  `json:"display_name" binding:"required"`
	Username    *string `json:"username,omitempty"`
}

type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type UpdateSettingsRequest struct {
	Theme      *string `json:"theme,omitempty"`
	WeightUnit *string `json:"weight_unit,omitempty"`
	Timezone   *string `json:"timezone,omitempty"`
}

type UpdateProfileRequest struct {
	Username    *string `json:"username,omitempty"`
	DisplayName *string `json:"display_name,omitempty"`
	Bio         *string `json:"bio,omitempty"`
}

type PublicUser struct {
	Username    string  `json:"username"`
	DisplayName *string `json:"display_name"`
	Bio         *string `json:"bio"`
}

type AuthResponse struct {
	AccessToken string `json:"access_token"`
	User        User   `json:"user"`
}

type VerifyEmailRequest struct {
	Token string `json:"token" binding:"required"`
}

type ForgotPasswordRequest struct {
	Email string `json:"email" binding:"required,email"`
}

type ResetPasswordRequest struct {
	Token    string `json:"token" binding:"required"`
	Password string `json:"password" binding:"required,min=8"`
}

type ErrorResponse struct {
	Error ErrorDetail `json:"error"`
}

type ErrorDetail struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}
