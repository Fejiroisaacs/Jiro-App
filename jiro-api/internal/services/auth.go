package services

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/config"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/argon2"
)

var (
	ErrInvalidCredentials = errors.New("invalid email or password")
	ErrEmailTaken         = errors.New("email already registered")
	ErrInvalidToken       = errors.New("invalid or expired token")
)

type AuthService struct {
	db  *pgxpool.Pool
	cfg *config.Config
}

func NewAuthService(db *pgxpool.Pool, cfg *config.Config) *AuthService {
	return &AuthService{db: db, cfg: cfg}
}

// Password hashing with Argon2id

const (
	argonTime    = 1
	argonMemory  = 64 * 1024
	argonThreads = 4
	argonKeyLen  = 32
	saltLen      = 16
)

func (s *AuthService) HashPassword(password string) (string, error) {
	salt := make([]byte, saltLen)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}

	hash := argon2.IDKey([]byte(password), salt, argonTime, argonMemory, argonThreads, argonKeyLen)

	// Store as: salt$hash (both hex-encoded)
	return fmt.Sprintf("%s$%s", hex.EncodeToString(salt), hex.EncodeToString(hash)), nil
}

func (s *AuthService) VerifyPassword(encoded, password string) bool {
	var saltHex, hashHex string
	n, _ := fmt.Sscanf(encoded, "%32s", &saltHex)
	if n == 0 {
		return false
	}

	// Split on $
	for i, c := range encoded {
		if c == '$' {
			saltHex = encoded[:i]
			hashHex = encoded[i+1:]
			break
		}
	}

	salt, err := hex.DecodeString(saltHex)
	if err != nil {
		return false
	}

	expectedHash, err := hex.DecodeString(hashHex)
	if err != nil {
		return false
	}

	computedHash := argon2.IDKey([]byte(password), salt, argonTime, argonMemory, argonThreads, argonKeyLen)

	// Constant-time comparison
	if len(expectedHash) != len(computedHash) {
		return false
	}
	result := byte(0)
	for i := range expectedHash {
		result |= expectedHash[i] ^ computedHash[i]
	}
	return result == 0
}

// JWT access token

func (s *AuthService) GenerateAccessToken(userID uuid.UUID) (string, error) {
	claims := jwt.MapClaims{
		"sub": userID.String(),
		"exp": time.Now().Add(s.cfg.AccessTokenTTL).Unix(),
		"iat": time.Now().Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(s.cfg.JWTSecret))
}

func (s *AuthService) ValidateAccessToken(tokenStr string) (uuid.UUID, error) {
	token, err := jwt.Parse(tokenStr, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(s.cfg.JWTSecret), nil
	})

	if err != nil || !token.Valid {
		return uuid.Nil, ErrInvalidToken
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return uuid.Nil, ErrInvalidToken
	}

	sub, ok := claims["sub"].(string)
	if !ok {
		return uuid.Nil, ErrInvalidToken
	}

	return uuid.Parse(sub)
}

// Refresh tokens

func (s *AuthService) GenerateRefreshToken() (rawToken string, tokenHash string, err error) {
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return "", "", err
	}

	rawToken = hex.EncodeToString(raw)
	hash := sha256.Sum256([]byte(rawToken))
	tokenHash = hex.EncodeToString(hash[:])

	return rawToken, tokenHash, nil
}

func (s *AuthService) StoreRefreshToken(ctx context.Context, userID uuid.UUID, tokenHash string) error {
	expiresAt := time.Now().Add(s.cfg.RefreshTokenTTL)
	_, err := s.db.Exec(ctx,
		"INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)",
		userID, tokenHash, expiresAt,
	)
	return err
}

func (s *AuthService) ValidateRefreshToken(ctx context.Context, rawToken string) (uuid.UUID, string, error) {
	hash := sha256.Sum256([]byte(rawToken))
	tokenHash := hex.EncodeToString(hash[:])

	var userID uuid.UUID
	var expiresAt time.Time
	err := s.db.QueryRow(ctx,
		"SELECT user_id, expires_at FROM refresh_tokens WHERE token_hash = $1",
		tokenHash,
	).Scan(&userID, &expiresAt)

	if err != nil {
		return uuid.Nil, "", ErrInvalidToken
	}

	if time.Now().After(expiresAt) {
		// Clean up expired token
		s.db.Exec(ctx, "DELETE FROM refresh_tokens WHERE token_hash = $1", tokenHash)
		return uuid.Nil, "", ErrInvalidToken
	}

	return userID, tokenHash, nil
}

func (s *AuthService) RevokeRefreshToken(ctx context.Context, tokenHash string) error {
	_, err := s.db.Exec(ctx, "DELETE FROM refresh_tokens WHERE token_hash = $1", tokenHash)
	return err
}

func (s *AuthService) RevokeAllUserTokens(ctx context.Context, userID uuid.UUID) error {
	_, err := s.db.Exec(ctx, "DELETE FROM refresh_tokens WHERE user_id = $1", userID)
	return err
}

// Email verification tokens

var ErrTokenExpired = errors.New("token has expired")

func generateHexToken() (rawToken, tokenHash string, err error) {
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return "", "", err
	}
	rawToken = hex.EncodeToString(raw)
	h := sha256.Sum256([]byte(rawToken))
	tokenHash = hex.EncodeToString(h[:])
	return rawToken, tokenHash, nil
}

func (s *AuthService) CreateEmailVerification(ctx context.Context, userID uuid.UUID) (string, error) {
	rawToken, tokenHash, err := generateHexToken()
	if err != nil {
		return "", err
	}

	// Delete any existing verification tokens for this user
	s.db.Exec(ctx, "DELETE FROM email_verifications WHERE user_id = $1", userID)

	expiresAt := time.Now().Add(24 * time.Hour)
	_, err = s.db.Exec(ctx,
		"INSERT INTO email_verifications (user_id, token_hash, expires_at) VALUES ($1, $2, $3)",
		userID, tokenHash, expiresAt,
	)
	if err != nil {
		return "", err
	}
	return rawToken, nil
}

func (s *AuthService) VerifyEmailToken(ctx context.Context, rawToken string) (uuid.UUID, error) {
	h := sha256.Sum256([]byte(rawToken))
	tokenHash := hex.EncodeToString(h[:])

	var userID uuid.UUID
	var expiresAt time.Time
	err := s.db.QueryRow(ctx,
		"SELECT user_id, expires_at FROM email_verifications WHERE token_hash = $1",
		tokenHash,
	).Scan(&userID, &expiresAt)
	if err != nil {
		return uuid.Nil, ErrInvalidToken
	}

	if time.Now().After(expiresAt) {
		s.db.Exec(ctx, "DELETE FROM email_verifications WHERE token_hash = $1", tokenHash)
		return uuid.Nil, ErrTokenExpired
	}

	s.db.Exec(ctx, "DELETE FROM email_verifications WHERE token_hash = $1", tokenHash)
	return userID, nil
}

// Password reset tokens

func (s *AuthService) CreatePasswordReset(ctx context.Context, userID uuid.UUID) (string, error) {
	rawToken, tokenHash, err := generateHexToken()
	if err != nil {
		return "", err
	}

	// Delete any existing reset tokens for this user
	s.db.Exec(ctx, "DELETE FROM password_resets WHERE user_id = $1", userID)

	expiresAt := time.Now().Add(1 * time.Hour)
	_, err = s.db.Exec(ctx,
		"INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES ($1, $2, $3)",
		userID, tokenHash, expiresAt,
	)
	if err != nil {
		return "", err
	}
	return rawToken, nil
}

func (s *AuthService) ConsumePasswordReset(ctx context.Context, rawToken, newPasswordHash string) error {
	h := sha256.Sum256([]byte(rawToken))
	tokenHash := hex.EncodeToString(h[:])

	var userID uuid.UUID
	var expiresAt time.Time
	var usedAt *time.Time
	err := s.db.QueryRow(ctx,
		"SELECT user_id, expires_at, used_at FROM password_resets WHERE token_hash = $1",
		tokenHash,
	).Scan(&userID, &expiresAt, &usedAt)
	if err != nil {
		return ErrInvalidToken
	}

	if usedAt != nil {
		return ErrInvalidToken
	}

	if time.Now().After(expiresAt) {
		return ErrTokenExpired
	}

	// Mark token as used
	s.db.Exec(ctx, "UPDATE password_resets SET used_at = NOW() WHERE token_hash = $1", tokenHash)

	// Update password
	_, err = s.db.Exec(ctx,
		"UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2",
		newPasswordHash, userID,
	)
	return err
}
