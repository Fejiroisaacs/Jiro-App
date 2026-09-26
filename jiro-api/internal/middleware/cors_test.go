package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestCORSExposesTotalCount(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(CORS([]string{"http://allowed.test"}))
	r.GET("/x", func(c *gin.Context) { c.Status(http.StatusOK) })

	for origin, want := range map[string]string{
		"http://allowed.test": "X-Total-Count",
		"http://other.test":   "",
	} {
		req := httptest.NewRequest(http.MethodGet, "/x", nil)
		req.Header.Set("Origin", origin)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		if got := w.Header().Get("Access-Control-Expose-Headers"); got != want {
			t.Errorf("origin %s: Expose-Headers = %q, want %q", origin, got, want)
		}
	}
}

func TestCORSVariesOnOrigin(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(CORS([]string{"http://allowed.test"}))
	r.GET("/x", func(c *gin.Context) { c.Status(http.StatusOK) })

	for _, tc := range []struct{ method, origin string }{
		{http.MethodGet, "http://allowed.test"},
		{http.MethodGet, "http://other.test"},
		{http.MethodGet, ""},
		{http.MethodOptions, "http://allowed.test"},
	} {
		req := httptest.NewRequest(tc.method, "/x", nil)
		if tc.origin != "" {
			req.Header.Set("Origin", tc.origin)
		}
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		if got := w.Header().Values("Vary"); len(got) != 1 || got[0] != "Origin" {
			t.Errorf("%s origin %q: Vary = %q, want [Origin]", tc.method, tc.origin, got)
		}
	}
}
