package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"testing"

	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/models"
	"github.com/google/uuid"
)

func widgetsJSON(n int) string {
	parts := make([]string, n)
	for i := range parts {
		parts[i] = fmt.Sprintf(`{"id":"w%d","visible":true}`, i)
	}
	return strings.Join(parts, ",")
}

func TestValidateDashboard(t *testing.T) {
	longID := "a" + strings.Repeat("b", 39)
	tooLongID := longID + "c"

	cases := []struct {
		name string
		raw  string
		ok   bool
	}{
		{"valid", `{"v":1,"widgets":[{"id":"workout","visible":true},{"id":"body_weight","visible":false}]}`, true},
		{"valid empty list", `{"v":1,"widgets":[]}`, true},
		{"valid 32 widgets", `{"v":1,"widgets":[` + widgetsJSON(32) + `]}`, true},
		{"valid 40 char id", `{"v":1,"widgets":[{"id":"` + longID + `","visible":true}]}`, true},
		{"duplicate id", `{"v":1,"widgets":[{"id":"workout","visible":true},{"id":"workout","visible":false}]}`, false},
		{"path traversal id", `{"v":1,"widgets":[{"id":"../x","visible":true}]}`, false},
		{"uppercase id", `{"v":1,"widgets":[{"id":"Workout","visible":true}]}`, false},
		{"leading digit id", `{"v":1,"widgets":[{"id":"1abc","visible":true}]}`, false},
		{"empty id", `{"v":1,"widgets":[{"id":"","visible":true}]}`, false},
		{"41 char id", `{"v":1,"widgets":[{"id":"` + tooLongID + `","visible":true}]}`, false},
		{"version 2", `{"v":2,"widgets":[]}`, false},
		{"missing version", `{"widgets":[]}`, false},
		{"33 widgets", `{"v":1,"widgets":[` + widgetsJSON(33) + `]}`, false},
		{"extra top-level field", `{"v":1,"widgets":[],"theme":"x"}`, false},
		{"extra widget field", `{"v":1,"widgets":[{"id":"workout","visible":true,"x":1}]}`, false},
		{"wrong type", `{"v":1,"widgets":"workout"}`, false},
		{"not an object", `[1,2]`, false},
		{"trailing data", `{"v":1,"widgets":[]}{"v":1}`, false},
		{"over 4 KB", `{"v":1,"widgets":[{"id":"workout","visible":true}]` + strings.Repeat(" ", 4096) + `}`, false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			out, err := validateDashboard(json.RawMessage(tc.raw))
			if tc.ok {
				if err != nil {
					t.Fatalf("expected valid, got %v", err)
				}
				return
			}
			if err == nil {
				t.Fatalf("expected an error, got %s", out)
			}
			if !errors.Is(err, ErrInvalidSettings) {
				t.Fatalf("expected ErrInvalidSettings, got %v", err)
			}
		})
	}
}

func TestValidatePlates(t *testing.T) {
	cases := []struct {
		name string
		raw  string
		ok   bool
	}{
		{"lbs", `{"lbs":{"bar":45,"sizes":[45,35,25,10,5,2.5]}}`, true},
		{"both units", `{"kg":{"bar":20,"sizes":[25,1.25]},"lbs":{"bar":45,"sizes":[45]}}`, true},
		{"no bar", `{"kg":{"bar":0,"sizes":[10]}}`, true},
		{"empty object", `{}`, false},
		{"unknown unit", `{"stone":{"bar":3,"sizes":[1]}}`, false},
		{"extra field", `{"kg":{"bar":20,"sizes":[10],"color":"red"}}`, false},
		{"no sizes", `{"kg":{"bar":20,"sizes":[]}}`, false},
		{"13 sizes", `{"kg":{"bar":20,"sizes":[1,2,3,4,5,6,7,8,9,10,11,12,13]}}`, false},
		{"duplicate size", `{"kg":{"bar":20,"sizes":[10,10]}}`, false},
		{"off the quarter grid", `{"kg":{"bar":20,"sizes":[1.1]}}`, false},
		{"zero plate", `{"kg":{"bar":20,"sizes":[0]}}`, false},
		{"heavy plate", `{"kg":{"bar":20,"sizes":[101]}}`, false},
		{"negative bar", `{"kg":{"bar":-1,"sizes":[10]}}`, false},
		{"heavy bar", `{"kg":{"bar":251,"sizes":[10]}}`, false},
		{"trailing data", `{"kg":{"bar":20,"sizes":[10]}}{}`, false},
		{"not an object", `[45]`, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			out, err := validatePlates(json.RawMessage(tc.raw))
			if tc.ok != (err == nil) {
				t.Fatalf("ok=%v, got %s, %v", tc.ok, out, err)
			}
			if err != nil && !errors.Is(err, ErrInvalidSettings) {
				t.Fatalf("expected ErrInvalidSettings, got %v", err)
			}
		})
	}
}

func TestValidatePlatesSortsHeaviestFirst(t *testing.T) {
	out, err := validatePlates(json.RawMessage(`{"kg":{"sizes":[1.25,25,10],"bar":20}}`))
	if err != nil {
		t.Fatal(err)
	}
	if want := `{"kg":{"bar":20,"sizes":[25,10,1.25]}}`; string(out) != want {
		t.Fatalf("got %s, want %s", out, want)
	}
}

func TestRestSecondsRange(t *testing.T) {
	// Out-of-range values are refused before the database is touched.
	svc := &UserService{}
	for _, secs := range []int{0, 14, 601} {
		if _, err := svc.UpdateSettings(context.Background(), uuid.Nil, &models.UpdateSettingsRequest{RestSeconds: &secs}); !errors.Is(err, ErrInvalidSettings) {
			t.Errorf("rest %d: got %v, want ErrInvalidSettings", secs, err)
		}
	}
}

func TestValidateDashboardReencodes(t *testing.T) {
	out, err := validateDashboard(json.RawMessage(`  {"widgets":[{"visible":false,"id":"journal"}], "v":1}  `))
	if err != nil {
		t.Fatal(err)
	}
	want := `{"v":1,"widgets":[{"id":"journal","visible":false}]}`
	if string(out) != want {
		t.Fatalf("got %s, want %s", out, want)
	}
}
