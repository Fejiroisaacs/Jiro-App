package handlers

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/config"
	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/middleware"
	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/services"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

const testPassword = "correct horse battery"

// testAuthRoutes serves login, refresh and logout over JIRO_TEST_DATABASE_URL, for a throwaway user.
func testAuthRoutes(t *testing.T) (*gin.Engine, *pgxpool.Pool, string) {
	t.Helper()
	url := os.Getenv("JIRO_TEST_DATABASE_URL")
	if url == "" {
		t.Skip("JIRO_TEST_DATABASE_URL not set")
	}
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	cfg := &config.Config{
		JWTSecret:       "test-secret-that-is-at-least-32-characters",
		AccessTokenTTL:  15 * time.Minute,
		RefreshTokenTTL: 7 * 24 * time.Hour,
		Environment:     "development",
	}
	authService := services.NewAuthService(pool, cfg)
	userService := services.NewUserService(pool)

	hash, err := authService.HashPassword(testPassword)
	if err != nil {
		t.Fatalf("hash: %v", err)
	}
	email := "auth-test-" + uuid.NewString() + "@example.com"
	user, err := userService.CreateUser(ctx, email, hash, "Auth Test", nil)
	if err != nil {
		pool.Close()
		t.Fatalf("create user: %v", err)
	}
	t.Cleanup(func() {
		ctx := context.Background()
		pool.Exec(ctx, `DELETE FROM analytics_events WHERE user_id = $1`, user.ID)
		pool.Exec(ctx, `DELETE FROM users WHERE id = $1`, user.ID)
		pool.Close()
	})

	h := NewAuthHandler(authService, userService, services.NewEmailService("", ""), services.NewLedgerService(pool),
		services.NewDemoService(pool, authService), middleware.NewLoginFailTracker(pool), cfg, pool)
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.POST("/login", h.Login)
	r.POST("/refresh", h.Refresh)
	r.POST("/logout", h.Logout)
	return r, pool, email
}

// postJSON sends body, and the refresh cookie when one is given.
func postJSON(r *gin.Engine, path, body, cookie string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPost, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	if cookie != "" {
		req.AddCookie(&http.Cookie{Name: refreshCookie, Value: cookie})
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func tokenBody(token string) string {
	return fmt.Sprintf(`{"refresh_token":%q}`, token)
}

func bodyToken(t *testing.T, w *httptest.ResponseRecorder) string {
	t.Helper()
	var res struct {
		RefreshToken string `json:"refresh_token"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &res); err != nil {
		t.Fatalf("decode %q: %v", w.Body.String(), err)
	}
	return res.RefreshToken
}

func cookieToken(w *httptest.ResponseRecorder) string {
	for _, c := range w.Result().Cookies() {
		if c.Name == refreshCookie {
			return c.Value
		}
	}
	return ""
}

func signIn(t *testing.T, r *gin.Engine, email string) string {
	t.Helper()
	w := postJSON(r, "/login", fmt.Sprintf(`{"email":%q,"password":%q}`, email, testPassword), "")
	if w.Code != http.StatusOK {
		t.Fatalf("login = %d %s", w.Code, w.Body.String())
	}
	return bodyToken(t, w)
}

func TestLoginReturnsTheRefreshTokenInTheBodyAndCookie(t *testing.T) {
	r, _, email := testAuthRoutes(t)
	w := postJSON(r, "/login", fmt.Sprintf(`{"email":%q,"password":%q}`, email, testPassword), "")
	if w.Code != http.StatusOK {
		t.Fatalf("login = %d %s", w.Code, w.Body.String())
	}
	token := bodyToken(t, w)
	if len(token) != 64 {
		t.Fatalf("body refresh_token has length %d, want 64", len(token))
	}
	if cookieToken(w) != token {
		t.Fatal("the cookie and the body carry different tokens")
	}
}

func TestRefreshWithTheBodyTokenRotatesIt(t *testing.T) {
	r, _, email := testAuthRoutes(t)
	first := signIn(t, r, email)

	w := postJSON(r, "/refresh", tokenBody(first), "")
	if w.Code != http.StatusOK {
		t.Fatalf("refresh = %d %s", w.Code, w.Body.String())
	}
	next := bodyToken(t, w)
	if next == "" || next == first {
		t.Fatal("refresh did not return a new token")
	}
	if cookieToken(w) != next {
		t.Fatal("the cookie was not rotated with the body")
	}
}

func TestRefreshFallsBackToTheCookie(t *testing.T) {
	r, _, email := testAuthRoutes(t)
	token := signIn(t, r, email)

	w := postJSON(r, "/refresh", `{}`, token)
	if w.Code != http.StatusOK {
		t.Fatalf("refresh with the cookie only = %d %s", w.Code, w.Body.String())
	}
	next := bodyToken(t, w)
	if w := postJSON(r, "/refresh", ``, next); w.Code != http.StatusOK {
		t.Fatalf("refresh with no body = %d %s", w.Code, w.Body.String())
	}
}

func TestRefreshPrefersTheBodyToken(t *testing.T) {
	r, _, email := testAuthRoutes(t)
	token := signIn(t, r, email)

	if w := postJSON(r, "/refresh", tokenBody(token), "not-a-token"); w.Code != http.StatusOK {
		t.Fatalf("refresh = %d %s", w.Code, w.Body.String())
	}
}

func TestRefreshWithoutATokenIs401(t *testing.T) {
	r, _, _ := testAuthRoutes(t)
	w := postJSON(r, "/refresh", `{}`, "")
	if w.Code != http.StatusUnauthorized || !strings.Contains(w.Body.String(), "NO_REFRESH_TOKEN") {
		t.Fatalf("refresh = %d %s, want 401 NO_REFRESH_TOKEN", w.Code, w.Body.String())
	}
}

func TestLogoutEndsTheSessionAtOnce(t *testing.T) {
	r, _, email := testAuthRoutes(t)
	token := signIn(t, r, email)

	if w := postJSON(r, "/logout", tokenBody(token), ""); w.Code != http.StatusOK {
		t.Fatalf("logout = %d %s", w.Code, w.Body.String())
	}
	// No 30 s grace after sign-out, unlike a rotation.
	if w := postJSON(r, "/refresh", tokenBody(token), ""); w.Code != http.StatusUnauthorized {
		t.Fatalf("refresh after logout = %d, want 401", w.Code)
	}
}

func TestAReplayedBodyTokenRevokesEverySession(t *testing.T) {
	r, pool, email := testAuthRoutes(t)
	first := signIn(t, r, email)
	otherDevice := signIn(t, r, email)

	if w := postJSON(r, "/refresh", tokenBody(first), ""); w.Code != http.StatusOK {
		t.Fatalf("refresh = %d %s", w.Code, w.Body.String())
	}
	// Move the rotation past the grace window, then replay the rotated-away token.
	sum := sha256.Sum256([]byte(first))
	if _, err := pool.Exec(context.Background(),
		`UPDATE refresh_tokens SET used_at = now() - interval '1 minute' WHERE token_hash = $1`,
		hex.EncodeToString(sum[:])); err != nil {
		t.Fatalf("age the rotation: %v", err)
	}
	if w := postJSON(r, "/refresh", tokenBody(first), ""); w.Code != http.StatusUnauthorized {
		t.Fatalf("replay = %d, want 401", w.Code)
	}
	if w := postJSON(r, "/refresh", tokenBody(otherDevice), ""); w.Code != http.StatusUnauthorized {
		t.Fatalf("another session survived the replay: %d", w.Code)
	}
}
