package middleware

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type fakeAccess struct {
	verified, demo bool
	err            error
	calls          int
}

func (f *fakeAccess) WriteAccess(context.Context, uuid.UUID) (bool, bool, error) {
	f.calls++
	return f.verified, f.demo, f.err
}

func gateRouter(f *fakeAccess) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	g := r.Group("/api/v1")
	g.Use(func(c *gin.Context) { c.Set("user_id", uuid.New()); c.Next() })
	g.Use(RequireWriteAccess(f))
	ok := func(c *gin.Context) { c.Status(http.StatusOK) }
	g.GET("/things", ok)
	g.POST("/things", ok)
	g.PUT("/things/:id", ok)
	g.PATCH("/things/:id", ok)
	g.DELETE("/things/:id", ok)
	g.POST("/auth/resend-verification", ok)
	return r
}

func do(r *gin.Engine, method, path string) (int, string) {
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(method, path, nil))
	var body models.ErrorResponse
	_ = json.Unmarshal(w.Body.Bytes(), &body)
	return w.Code, body.Error.Code
}

func TestWriteGateDemoIsReadOnly(t *testing.T) {
	f := &fakeAccess{verified: true, demo: true}
	r := gateRouter(f)

	if code, _ := do(r, http.MethodGet, "/api/v1/things"); code != http.StatusOK {
		t.Fatalf("demo GET = %d, want 200", code)
	}
	if f.calls != 0 {
		t.Errorf("GET hit the database %d times, want 0", f.calls)
	}
	for _, tc := range []struct{ method, path string }{
		{http.MethodPost, "/api/v1/things"},
		{http.MethodPut, "/api/v1/things/1"},
		{http.MethodPatch, "/api/v1/things/1"},
		{http.MethodDelete, "/api/v1/things/1"},
		// Exempt from verification, but not from the demo block.
		{http.MethodPost, "/api/v1/auth/resend-verification"},
	} {
		code, errCode := do(r, tc.method, tc.path)
		if code != http.StatusForbidden || errCode != "DEMO_READ_ONLY" {
			t.Errorf("demo %s %s = %d %s, want 403 DEMO_READ_ONLY", tc.method, tc.path, code, errCode)
		}
	}
}

func TestWriteGateNormalUsersUnchanged(t *testing.T) {
	verified := gateRouter(&fakeAccess{verified: true})
	for _, m := range []string{http.MethodPost, http.MethodPatch, http.MethodDelete} {
		path := "/api/v1/things/1"
		if m == http.MethodPost {
			path = "/api/v1/things"
		}
		if code, _ := do(verified, m, path); code != http.StatusOK {
			t.Errorf("verified %s = %d, want 200", m, code)
		}
	}

	unverified := gateRouter(&fakeAccess{verified: false})
	if code, errCode := do(unverified, http.MethodPost, "/api/v1/things"); code != http.StatusForbidden || errCode != "EMAIL_NOT_VERIFIED" {
		t.Errorf("unverified POST = %d %s, want 403 EMAIL_NOT_VERIFIED", code, errCode)
	}
	if code, _ := do(unverified, http.MethodGet, "/api/v1/things"); code != http.StatusOK {
		t.Errorf("unverified GET = %d, want 200", code)
	}
	if code, _ := do(unverified, http.MethodPost, "/api/v1/auth/resend-verification"); code != http.StatusOK {
		t.Errorf("unverified resend-verification = %d, want 200", code)
	}

	failing := gateRouter(&fakeAccess{err: errors.New("db down")})
	if code, errCode := do(failing, http.MethodPost, "/api/v1/things"); code != http.StatusForbidden || errCode != "EMAIL_NOT_VERIFIED" {
		t.Errorf("lookup failure = %d %s, want fail closed with 403 EMAIL_NOT_VERIFIED", code, errCode)
	}
}
