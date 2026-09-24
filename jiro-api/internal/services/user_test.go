package services

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"testing"
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
