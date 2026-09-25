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

// At 02:00 UTC on 25 Sep it is still the evening of 24 Sep in New York, so
// "today" depends on the location now is expressed in.
func TestDayStreaksTodayIsTheUsersDay(t *testing.T) {
	ny, err := time.LoadLocation("America/New_York")
	if err != nil {
		t.Fatal(err)
	}
	kiri, err := time.LoadLocation("Pacific/Kiritimati") // UTC+14
	if err != nil {
		t.Fatal(err)
	}
	instant := time.Date(2026, 9, 25, 2, 0, 0, 0, time.UTC)
	cases := []struct {
		name             string
		days             []string
		now              time.Time
		current, longest int
	}{
		// New York days (entries written on the evenings of 22-24 Sep local).
		{"NY: run through its today", []string{"2026-09-24", "2026-09-23", "2026-09-22"}, instant.In(ny), 3, 3},
		// The same days read against UTC's today (25 Sep) are still alive via yesterday.
		{"UTC: same run via yesterday", []string{"2026-09-24", "2026-09-23", "2026-09-22"}, instant, 3, 3},
		// A New York run ending 23 Sep: UTC's today is 25 Sep, so it has lapsed
		// there, but in New York 23 Sep is yesterday and the streak lives.
		{"NY: yesterday keeps it alive", []string{"2026-09-23", "2026-09-22"}, instant.In(ny), 2, 2},
		{"UTC: the same days have lapsed", []string{"2026-09-23", "2026-09-22"}, instant, 0, 2},
		// A day that is today in NY (24 Sep) is not "tomorrow" there.
		{"NY: 25 Sep is not yet a day", []string{"2026-09-25"}, instant.In(ny), 0, 1},
		// At UTC+14 it is already 25 Sep afternoon.
		{"Kiritimati: today is 25 Sep", []string{"2026-09-25", "2026-09-24"}, instant.In(kiri), 2, 2},
	}
	for _, tc := range cases {
		cur, long := dayStreaks(tc.days, tc.now)
		if cur != tc.current || long != tc.longest {
			t.Errorf("%s: got current=%d longest=%d, want %d %d", tc.name, cur, long, tc.current, tc.longest)
		}
	}
}
