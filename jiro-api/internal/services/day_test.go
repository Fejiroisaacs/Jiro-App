package services

import (
	"errors"
	"testing"
	"time"
)

func mustLoc(t *testing.T, name string) *time.Location {
	t.Helper()
	loc, got := UserLocation(name)
	if got != name {
		t.Fatalf("UserLocation(%q) fell back to %q", name, got)
	}
	return loc
}

func TestDayWindow(t *testing.T) {
	ny := mustLoc(t, "America/New_York")
	cases := []struct {
		name      string
		y         int
		m         time.Month
		d         int
		wantStart string // RFC3339 in UTC
		wantHours float64
	}{
		{"normal day", 2026, time.September, 23, "2026-09-23T04:00:00Z", 24},
		{"spring forward", 2026, time.March, 8, "2026-03-08T05:00:00Z", 23},
		{"fall back", 2026, time.November, 1, "2026-11-01T04:00:00Z", 25},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			start, end := DayWindow(c.y, c.m, c.d, ny)
			if got := start.UTC().Format(time.RFC3339); got != c.wantStart {
				t.Errorf("start = %s, want %s", got, c.wantStart)
			}
			if h := end.Sub(start).Hours(); h != c.wantHours {
				t.Errorf("window = %vh, want %vh", h, c.wantHours)
			}
			if e := end.In(ny); e.Hour() != 0 || e.Minute() != 0 || e.Day() != c.d+1 {
				t.Errorf("end = %s, want local midnight of the next day", e)
			}
		})
	}
}

func TestUserLocationFallsBackToUTC(t *testing.T) {
	for _, name := range []string{"", "Local", "Mars/Olympus_Mons", "not a zone"} {
		loc, got := UserLocation(name)
		if loc != time.UTC || got != "UTC" {
			t.Errorf("UserLocation(%q) = %v, %q; want UTC", name, loc, got)
		}
	}
	// And a UTC window is exactly 24h from UTC midnight.
	start, end := DayWindow(2026, time.March, 8, time.UTC)
	if start.Format(time.RFC3339) != "2026-03-08T00:00:00Z" || end.Sub(start) != 24*time.Hour {
		t.Errorf("UTC window = %s .. %s", start, end)
	}
}

func TestResolveDay(t *testing.T) {
	ny := mustLoc(t, "America/New_York")
	// 01:30 UTC on the 24th is 21:30 on the 23rd in New York.
	now := time.Date(2026, 9, 24, 1, 30, 0, 0, time.UTC)

	d, err := ResolveDay("", ny, now)
	if err != nil || d.Format(dayLayout) != "2026-09-23" {
		t.Fatalf("empty date = %v, %v; want 2026-09-23 (today in New York)", d, err)
	}
	d, err = ResolveDay("", time.UTC, now)
	if err != nil || d.Format(dayLayout) != "2026-09-24" {
		t.Fatalf("empty date in UTC = %v, %v; want 2026-09-24", d, err)
	}
	if _, err := ResolveDay("2026-09-24", ny, now); !errors.Is(err, ErrFutureDay) {
		t.Errorf("tomorrow in New York: err = %v, want ErrFutureDay", err)
	}
	if _, err := ResolveDay("2026-09-24", time.UTC, now); err != nil {
		t.Errorf("today in UTC: err = %v", err)
	}
	if d, err := ResolveDay("2020-02-29", ny, now); err != nil || d.Format(dayLayout) != "2020-02-29" {
		t.Errorf("past date = %v, %v", d, err)
	}
	for _, bad := range []string{"2026-9-1", "2026-02-30", "yesterday", "2026-09-23T00:00:00Z", "20260923"} {
		if _, err := ResolveDay(bad, ny, now); !errors.Is(err, ErrInvalidDay) {
			t.Errorf("ResolveDay(%q) err = %v, want ErrInvalidDay", bad, err)
		}
	}
}

func TestWeekdayIndexAndMonday(t *testing.T) {
	cases := map[string]struct {
		monday string
		idx    int
	}{
		"2026-09-21": {"2026-09-21", 0}, // Monday
		"2026-09-23": {"2026-09-21", 2}, // Wednesday
		"2026-09-27": {"2026-09-21", 6}, // Sunday
		"2026-03-01": {"2026-02-23", 6}, // Sunday across a month
	}
	for date, want := range cases {
		d, _ := time.Parse(dayLayout, date)
		if got := mondayOf(d).Format(dayLayout); got != want.monday {
			t.Errorf("mondayOf(%s) = %s, want %s", date, got, want.monday)
		}
		if got := weekdayIndex(d); got != want.idx {
			t.Errorf("weekdayIndex(%s) = %d, want %d", date, got, want.idx)
		}
	}
}

func TestPickLocation(t *testing.T) {
	cases := []struct{ setting, hint, want string }{
		{"America/New_York", "Asia/Tokyo", "America/New_York"}, // the setting wins
		{"", "Asia/Tokyo", "Asia/Tokyo"},                       // no setting: the client's zone
		{"Not/AZone", "Asia/Tokyo", "Asia/Tokyo"},              // invalid setting: same
		{"UTC", "Asia/Tokyo", "UTC"},                           // UTC chosen on purpose
		{"", "", "UTC"},
		{"", "garbage", "UTC"},
	}
	for _, c := range cases {
		if _, got := PickLocation(c.setting, c.hint); got != c.want {
			t.Errorf("PickLocation(%q, %q) = %q, want %q", c.setting, c.hint, got, c.want)
		}
	}
}
