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
	IsAdmin       bool            `json:"is_admin"`
	IsDemo        bool            `json:"is_demo"` // the shared, look-only sample account (DemoService)
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
	Password    string  `json:"password" binding:"required,min=8,max=128"`
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
	// Currency is the ISO 4217 code every Ledger amount is shown in.
	Currency *string `json:"currency,omitempty"`
	// Dashboard is tri-state: empty means "leave alone", the literal `null`
	// removes the key (back to the default layout), anything else is a layout.
	Dashboard json.RawMessage `json:"dashboard,omitempty"`
	// RestSeconds is how long Jym's rest timer runs after each logged set.
	RestSeconds *int `json:"rest_seconds,omitempty"`
	// Plates is tri-state like Dashboard: a Plates object, or `null` for the defaults.
	Plates json.RawMessage `json:"plates,omitempty"`
}

// PlateSet is a bar and the plate sizes on hand, in one weight unit.
type PlateSet struct {
	Bar   float64   `json:"bar"`
	Sizes []float64 `json:"sizes"`
}

// Plates is a PlateSet per unit; a unit left out uses the app's defaults.
type Plates struct {
	Kg  *PlateSet `json:"kg,omitempty"`
	Lbs *PlateSet `json:"lbs,omitempty"`
}

// DashboardLayout is the stored order and visibility of dashboard widgets.
// Hidden widgets are kept (visible:false) so that an id missing from the list
// means "a widget added after this layout was saved".
type DashboardLayout struct {
	V       int               `json:"v"`
	Widgets []DashboardWidget `json:"widgets"`
}

type DashboardWidget struct {
	ID      string `json:"id"`
	Visible bool   `json:"visible"`
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
	// Also set as a cookie; the app keeps this copy because Safari drops the API's cross-site cookie.
	RefreshToken string `json:"refresh_token,omitempty"`
	User         User   `json:"user"`
}

// RefreshRequest carries the app's copy of the refresh token; without one the cookie is used.
type RefreshRequest struct {
	RefreshToken string `json:"refresh_token"`
}

type VerifyEmailRequest struct {
	Token string `json:"token" binding:"required"`
}

type ForgotPasswordRequest struct {
	Email string `json:"email" binding:"required,email"`
}

type ResetPasswordRequest struct {
	Token    string `json:"token" binding:"required"`
	Password string `json:"password" binding:"required,min=8,max=128"`
}

type ErrorResponse struct {
	Error ErrorDetail `json:"error"`
}

type ErrorDetail struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}
