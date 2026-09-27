package services

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"sync"
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
	ErrTokenReused        = errors.New("refresh token reused after rotation")
)

// refreshReuseGrace tolerates a rotated refresh token being presented again
// shortly after rotation — two browser tabs whose access tokens expire at
// the same moment both refresh with the same cookie, and one necessarily
// loses the race. A token reused well past this window can no longer be
// explained by that, and is treated as a stolen token being replayed.
const refreshReuseGrace = 30 * time.Second

const (
	jwtIssuer   = "jiro-api"
	jwtAudience = "jiro-app"
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

// Verified against when the email is unknown, so timing does not leak
// account existence.
var dummyHash struct {
	once sync.Once
	val  string
}

func (s *AuthService) VerifyPasswordDummy(password string) {
	dummyHash.once.Do(func() {
		if h, err := s.HashPassword("unused-placeholder"); err == nil {
			dummyHash.val = h
		}
	})
	if dummyHash.val != "" {
		s.VerifyPassword(dummyHash.val, password)
	}
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
	now := time.Now()
	claims := jwt.MapClaims{
		"sub": userID.String(),
		"iss": jwtIssuer,
		"aud": jwtAudience,
		"typ": "access",
		"jti": uuid.New().String(),
		"iat": now.Unix(),
		"exp": now.Add(s.cfg.AccessTokenTTL).Unix(),
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
	}, jwt.WithIssuer(jwtIssuer), jwt.WithAudience(jwtAudience))

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
	var usedAt *time.Time
	var isDemo bool
	err := s.db.QueryRow(ctx,
		`SELECT rt.user_id, rt.expires_at, rt.used_at, u.is_demo
		 FROM refresh_tokens rt JOIN users u ON u.id = rt.user_id
		 WHERE rt.token_hash = $1`,
		tokenHash,
	).Scan(&userID, &expiresAt, &usedAt, &isDemo)

	if err != nil {
		return uuid.Nil, "", ErrInvalidToken
	}

	if time.Now().After(expiresAt) {
		// Clean up expired token
		s.db.Exec(ctx, "DELETE FROM refresh_tokens WHERE token_hash = $1", tokenHash)
		return uuid.Nil, "", ErrInvalidToken
	}

	if usedAt != nil && time.Since(*usedAt) > refreshReuseGrace {
		// Rotated away more than the grace window ago and presented again: not
		// explainable by a concurrent-tab race, only by a copy of the token
		// surviving past its legitimate single use. Kill every session,
		// including whatever the thief rotated it into.
		// On the shared demo only this token dies, or one stale tab signs out every visitor.
		if isDemo {
			s.db.Exec(ctx, "DELETE FROM refresh_tokens WHERE token_hash = $1", tokenHash)
		} else {
			s.RevokeAllUserTokens(ctx, userID)
		}
		return userID, "", ErrTokenReused
	}

	return userID, tokenHash, nil
}

// RevokeRefreshToken retires a token by marking it used rather than deleting
// it outright, so a reuse shortly after — the concurrent-tab race described
// on refreshReuseGrace — can still be told apart from a token replayed long
// after its legitimate rotation. The IS NULL guard keeps used_at pinned to
// the first use: a second racing caller must not slide the grace window.
func (s *AuthService) RevokeRefreshToken(ctx context.Context, tokenHash string) error {
	_, err := s.db.Exec(ctx,
		"UPDATE refresh_tokens SET used_at = NOW() WHERE token_hash = $1 AND used_at IS NULL",
		tokenHash,
	)
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

	// One transaction: no double-consume, no password change without revocation.
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// used_at IS NULL is what makes this single-use; the read above is only an
	// expiry check, and two concurrent requests would both pass it.
	claim, err := tx.Exec(ctx,
		"UPDATE password_resets SET used_at = NOW() WHERE token_hash = $1 AND used_at IS NULL",
		tokenHash,
	)
	if err != nil {
		return err
	}
	if claim.RowsAffected() == 0 {
		return ErrInvalidToken
	}

	if _, err = tx.Exec(ctx,
		"UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2",
		newPasswordHash, userID,
	); err != nil {
		return err
	}

	// A reset after a compromise must end the attacker's session, or their
	// refresh token keeps minting access tokens for its full 7 days.
	if _, err = tx.Exec(ctx, "DELETE FROM refresh_tokens WHERE user_id = $1", userID); err != nil {
		return err
	}

	return tx.Commit(ctx)
}
