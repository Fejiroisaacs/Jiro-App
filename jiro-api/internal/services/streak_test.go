package services

import (
	"testing"
	"time"
)

func TestDayStreaks(t *testing.T) {
	now := time.Date(2026, 9, 24, 15, 0, 0, 0, time.UTC)
	cases := []struct {
		name             string
		days             []string
		current, longest int
	}{
		{"none", nil, 0, 0},
		{"today only", []string{"2026-09-24"}, 1, 1},
		{"yesterday keeps it alive", []string{"2026-09-23", "2026-09-22", "2026-09-21"}, 3, 3},
		{"run through today", []string{"2026-09-24", "2026-09-23"}, 2, 2},
		{"lapsed run is not current", []string{"2026-09-20", "2026-09-19", "2026-09-18"}, 0, 3},
		{"older run is longest", []string{"2026-09-23", "2026-09-22", "2026-09-12", "2026-09-11", "2026-09-10", "2026-09-09"}, 2, 4},
		{"gap breaks the current run", []string{"2026-09-24", "2026-09-22"}, 1, 1},
		{"time suffix is ignored", []string{"2026-09-24T00:00:00Z", "2026-09-23T00:00:00Z"}, 2, 2},
	}
	for _, tc := range cases {
		cur, long := dayStreaks(tc.days, now)
		if cur != tc.current || long != tc.longest {
			t.Errorf("%s: got current=%d longest=%d, want %d %d", tc.name, cur, long, tc.current, tc.longest)
		}
	}
}
