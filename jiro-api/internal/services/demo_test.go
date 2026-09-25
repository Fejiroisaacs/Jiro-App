package services

import (
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
)

func mustTime(t *testing.T, s string) time.Time {
	t.Helper()
	v, err := time.Parse(time.RFC3339, s)
	if err != nil {
		t.Fatal(err)
	}
	return v
}

func TestDemoDayShift(t *testing.T) {
	for _, tc := range []struct {
		anchor, now string
		want        int
	}{
		// The anchor is a date (UTC midnight of a New York date); now is an
		// instant, read in New York.
		{"2026-09-24T00:00:00Z", "2026-09-24T23:59:00Z", 0},  // 19:59 in New York, same day
		{"2026-09-24T00:00:00Z", "2026-09-25T03:59:00Z", 0},  // UTC is on the 25th, New York is not
		{"2026-09-24T00:00:00Z", "2026-09-25T04:00:00Z", 1},  // New York midnight (EDT)
		{"2026-09-14T00:00:00Z", "2026-09-24T16:00:00Z", 10}, // ten days
		{"2026-02-27T00:00:00Z", "2026-03-02T06:00:00Z", 3},  // across a month end (EST)
		{"2026-09-24T00:00:00Z", "2026-09-20T10:00:00Z", 0},  // clock went backwards
	} {
		if got := demoDayShift(mustTime(t, tc.anchor), mustTime(t, tc.now)); got != tc.want {
			t.Errorf("demoDayShift(%s, %s) = %d, want %d", tc.anchor, tc.now, got, tc.want)
		}
	}
}

// Every seeded instant must fall on the same calendar date in UTC and in the
// demo's timezone, or items drift to the previous New York evening (UTC hours
// 00-04) and break "yesterday" and the streaks.
func TestDemoTimesLandOnTheirNewYorkDay(t *testing.T) {
	loc, err := time.LoadLocation(demoTimeZone)
	if err != nil {
		t.Fatal(err)
	}
	for _, seed := range []string{"2026-09-25T00:00:00Z", "2026-01-15T00:00:00Z"} { // EDT and EST
		ds := buildDemoDataset(mustTime(t, seed))
		check := func(what string, ts time.Time) {
			if ts.IsZero() {
				return
			}
			if ts.UTC().Format("2006-01-02") != ts.In(loc).Format("2006-01-02") {
				t.Errorf("%s at %s is %s in New York", what, ts.UTC().Format(time.RFC3339), ts.In(loc).Format("2006-01-02 15:04"))
			}
		}
		for _, e := range ds.JournalEntries {
			check("journal entry", e.CreatedAt)
		}
		for _, tr := range ds.Trials {
			check("trial", tr.DateCooked)
		}
		for _, se := range ds.Sessions {
			check("session start", se.StartedAt)
		}
	}
}

func TestDemoDate(t *testing.T) {
	for in, want := range map[string]string{
		"2026-09-25T01:00:00Z": "2026-09-24", // 21:00 the evening before in New York
		"2026-09-25T04:00:00Z": "2026-09-25",
		"2026-01-15T04:59:00Z": "2026-01-14", // EST: UTC-5
	} {
		if got := demoDate(mustTime(t, in)).Format("2006-01-02"); got != want {
			t.Errorf("demoDate(%s) = %s, want %s", in, got, want)
		}
	}
}

func TestDemoWeekShift(t *testing.T) {
	for _, tc := range []struct {
		from, to string
		want     int
	}{
		{"2026-09-21T10:00:00Z", "2026-09-27T10:00:00Z", 0}, // Monday to Sunday, same week
		{"2026-09-27T10:00:00Z", "2026-09-28T10:00:00Z", 1}, // Sunday to Monday, one day but a new week
		{"2026-09-14T10:00:00Z", "2026-09-24T10:00:00Z", 1}, // ten days, one Monday boundary
		{"2026-09-24T10:00:00Z", "2026-10-15T10:00:00Z", 3}, // three weeks
		{"2026-09-22T10:00:00Z", "2026-10-02T10:00:00Z", 1}, // ten days from a Tuesday
		{"2026-09-24T10:00:00Z", "2026-09-24T12:00:00Z", 0},
	} {
		if got := demoWeekShift(mustTime(t, tc.from), mustTime(t, tc.to)); got != tc.want {
			t.Errorf("demoWeekShift(%s, %s) = %d, want %d", tc.from, tc.to, got, tc.want)
		}
	}
}

func TestMondayOf(t *testing.T) {
	for _, s := range []string{"2026-09-21T00:00:00Z", "2026-09-24T15:00:00Z", "2026-09-27T23:59:00Z"} {
		got := mondayOf(mustTime(t, s)).Format("2006-01-02")
		if got != "2026-09-21" {
			t.Errorf("mondayOf(%s) = %s, want 2026-09-21", s, got)
		}
	}
}

func TestReservedDemoEmail(t *testing.T) {
	for email, want := range map[string]bool{
		DemoEmail:              true,
		" Demo@JIRO.invalid ":  true,
		"anyone@jiro.invalid":  true,
		"demo@jiro.com":        false,
		"someone@example.com":  false,
		"demo@notjiro.invalid": false,
	} {
		if got := IsReservedDemoEmail(email); got != want {
			t.Errorf("IsReservedDemoEmail(%q) = %v, want %v", email, got, want)
		}
	}
}

// demoNow is a fixed seed moment: a Thursday afternoon.
var demoNow = time.Date(2026, 9, 24, 15, 30, 0, 0, time.UTC)

func TestDemoDatasetReferences(t *testing.T) {
	ds := buildDemoDataset(demoNow)

	exercises := map[uuid.UUID]bool{}
	names := map[string]bool{}
	for _, e := range ds.Exercises {
		exercises[e.ID] = true
		if names[e.Name] {
			t.Errorf("duplicate exercise name %q (exercises are UNIQUE(user_id, name))", e.Name)
		}
		names[e.Name] = true
	}
	routines := map[uuid.UUID]bool{}
	for _, r := range ds.Routines {
		routines[r.ID] = true
	}
	for _, it := range ds.RoutineItems {
		if !exercises[it.ExerciseID] || !routines[it.RoutineID] {
			t.Errorf("routine item references a missing routine or exercise")
		}
	}
	sessions := map[uuid.UUID]demoSession{}
	for _, s := range ds.Sessions {
		sessions[s.ID] = s
		if !routines[s.RoutineID] {
			t.Errorf("session references a missing routine")
		}
		if !s.EndedAt.After(s.StartedAt) {
			t.Errorf("session %s ends before it starts (or is left in progress)", s.StartedAt)
		}
	}
	prs := 0
	for _, set := range ds.Sets {
		sess, ok := sessions[set.SessionID]
		if !ok {
			t.Fatalf("set references a missing session")
		}
		if !exercises[set.ExerciseID] {
			t.Errorf("set references an exercise that is not seeded")
		}
		if set.CreatedAt.Before(sess.StartedAt) || set.CreatedAt.After(sess.EndedAt) {
			t.Errorf("set logged outside its session")
		}
		if set.IsPR && set.IsWarmup {
			t.Errorf("warm-up set marked as a PR")
		}
		if set.IsPR {
			prs++
		}
	}
	if prs < 5 || prs > 20 {
		t.Errorf("%d PR sets; want a few, not none and not every set", prs)
	}

	recipes := map[uuid.UUID]bool{}
	for _, r := range ds.Recipes {
		recipes[r.ID] = true
		var ing []demoIngredient
		if err := json.Unmarshal([]byte(r.Ingredients), &ing); err != nil || len(ing) == 0 {
			t.Errorf("recipe %q: ingredients are not a JSON array of {item, amount}: %v", r.Title, err)
		}
		for _, raw := range []string{r.Nutrition, r.DietaryFlags} {
			if !json.Valid([]byte(raw)) {
				t.Errorf("recipe %q: invalid JSON %q", r.Title, raw)
			}
		}
	}
	for _, tr := range ds.Trials {
		if !recipes[tr.RecipeID] {
			t.Errorf("trial references a missing recipe")
		}
		if tr.Rating < 1 || tr.Rating > 5 || !json.Valid([]byte(tr.Modifications)) {
			t.Errorf("trial has a bad rating or modifications")
		}
	}
	for _, c := range ds.RecipeCollections {
		for _, id := range c.RecipeIDs {
			if !recipes[id] {
				t.Errorf("recipe collection %q references a missing recipe", c.Name)
			}
		}
	}
	for _, e := range ds.MealPlanEntries {
		if e.RecipeID == nil && e.CustomLabel == "" {
			t.Errorf("meal plan entry has neither a recipe nor a label")
		}
		if e.RecipeID != nil && !recipes[*e.RecipeID] {
			t.Errorf("meal plan entry references a missing recipe")
		}
		if e.DayOfWeek < 0 || e.DayOfWeek > 6 {
			t.Errorf("meal plan day %d out of range", e.DayOfWeek)
		}
	}

	entries := map[uuid.UUID]bool{}
	moods := map[string]bool{"happy": true, "grateful": true, "energised": true, "calm": true, "tired": true, "sad": true, "anxious": true, "stressed": true}
	for _, e := range ds.JournalEntries {
		entries[e.ID] = true
		if !moods[e.Mood] {
			t.Errorf("journal mood %q is not one the UI knows", e.Mood)
		}
	}
	if len(ds.JournalCollected) == 0 {
		t.Errorf("journal collection is empty")
	}
	for _, id := range ds.JournalCollected {
		if !entries[id] {
			t.Errorf("journal collection references a missing entry")
		}
	}

	accounts := map[uuid.UUID]bool{}
	for _, a := range ds.Accounts {
		accounts[a.ID] = true
	}
	cats := map[uuid.UUID]string{}
	for _, c := range ds.Categories {
		cats[c.ID] = c.Type
	}
	for _, tx := range ds.Transactions {
		if !accounts[tx.AccountID] {
			t.Errorf("transaction %q references a missing account", tx.Description)
		}
		negative := strings.HasPrefix(tx.Amount, "-")
		switch tx.Type {
		case "expense":
			if !negative || tx.CategoryID == nil || cats[*tx.CategoryID] != "expense" {
				t.Errorf("expense %q: want a negative amount and an expense category", tx.Description)
			}
		case "income":
			if negative || tx.CategoryID == nil || cats[*tx.CategoryID] != "income" {
				t.Errorf("income %q: want a positive amount and an income category", tx.Description)
			}
		case "transfer":
			if tx.TransferTo == nil || !accounts[*tx.TransferTo] {
				t.Errorf("transfer %q: missing counterpart account", tx.Description)
			}
		}
	}
	for _, b := range ds.Budgets {
		if cats[b.CategoryID] != "expense" {
			t.Errorf("budget on a non-expense category")
		}
	}
}

// Everything must look recent at seed time and stay in the past after any
// whole-day slide: timestamps before the seed day, dates no later than it.
func TestDemoDatasetDatesRelativeToNow(t *testing.T) {
	ds := buildDemoDataset(demoNow)
	seedDay := utcDay(demoNow)
	if !ds.SeedDay.Equal(seedDay) {
		t.Fatalf("SeedDay = %s, want %s", ds.SeedDay, seedDay)
	}
	oldest := seedDay.AddDate(0, 0, -160)

	checkTS := func(what string, ts time.Time) {
		t.Helper()
		if !ts.Before(seedDay) || ts.Before(oldest) {
			t.Errorf("%s at %s: want before the seed day and within ~5 months", what, ts)
		}
	}
	checkDate := func(what, d string) {
		t.Helper()
		v, err := time.Parse("2006-01-02", d)
		if err != nil {
			t.Fatalf("%s: bad date %q", what, d)
		}
		if v.After(seedDay) || v.Before(oldest) {
			t.Errorf("%s on %s: want on or before the seed day and within ~5 months", what, d)
		}
	}

	for _, e := range ds.Exercises {
		checkTS("exercise", e.CreatedAt)
	}
	for _, r := range ds.Routines {
		checkTS("routine", r.CreatedAt)
	}
	checkTS("series", ds.SeriesStart)
	for _, s := range ds.Sessions {
		checkTS("session start", s.StartedAt)
		checkTS("session end", s.EndedAt)
	}
	for _, s := range ds.Sets {
		checkTS("set", s.CreatedAt)
	}
	for _, r := range ds.Recipes {
		checkTS("recipe", r.CreatedAt)
		checkTS("recipe update", r.UpdatedAt)
		if r.UpdatedAt.Before(r.CreatedAt) {
			t.Errorf("recipe %q updated before it was created", r.Title)
		}
	}
	for _, tr := range ds.Trials {
		checkTS("trial", tr.DateCooked)
	}
	for _, c := range ds.RecipeCollections {
		checkTS("recipe collection", c.CreatedAt)
	}
	for _, e := range ds.JournalEntries {
		checkTS("journal entry", e.CreatedAt)
	}
	for _, a := range ds.Accounts {
		checkTS("account", a.CreatedAt)
	}
	for _, tx := range ds.Transactions {
		checkDate("transaction "+tx.Description, tx.Date)
		checkTS("transaction", tx.CreatedAt)
	}
	for _, b := range ds.BodyWeights {
		checkDate("body weight", b.Date)
	}
	for _, b := range ds.Budgets {
		checkDate("budget", b.StartDate)
	}
	seenSnap := map[string]bool{}
	for _, s := range ds.Snapshots {
		checkDate("snapshot", s.Date)
		if seenSnap[s.Date] {
			t.Errorf("two snapshots on %s (UNIQUE(user_id, snapshot_date))", s.Date)
		}
		seenSnap[s.Date] = true
	}

	// The meal plan is this week's, and a Monday.
	if ds.MealPlanWeek != "2026-09-21" {
		t.Errorf("meal plan week = %s, want the seed week's Monday 2026-09-21", ds.MealPlanWeek)
	}

	// The most recent activity is yesterday, so the dashboard looks lived in.
	yesterday := seedDay.AddDate(0, 0, -1)
	last := ds.Sessions[len(ds.Sessions)-1].StartedAt
	if utcDay(last) != yesterday {
		t.Errorf("last session on %s, want yesterday %s", utcDay(last), yesterday)
	}
}

// Copy rules: no em or en dashes and no placeholder text in anything a
// visitor reads.
func TestDemoDatasetCopy(t *testing.T) {
	ds := buildDemoDataset(demoNow)
	var texts []string
	for _, e := range ds.Exercises {
		texts = append(texts, e.Name, e.Notes)
	}
	for _, s := range ds.Sessions {
		texts = append(texts, s.Notes)
	}
	for _, r := range ds.Recipes {
		texts = append(texts, r.Title, r.Description, r.Ingredients, r.Instructions)
	}
	for _, tr := range ds.Trials {
		texts = append(texts, tr.Notes, tr.Modifications)
	}
	for _, e := range ds.MealPlanEntries {
		texts = append(texts, e.CustomLabel)
	}
	for _, e := range ds.JournalEntries {
		texts = append(texts, e.Title, e.Body)
	}
	for _, tx := range ds.Transactions {
		texts = append(texts, tx.Description, tx.Notes)
	}
	for _, s := range texts {
		lower := strings.ToLower(s)
		if strings.ContainsAny(s, "—–") || strings.Contains(lower, "lorem") || strings.Contains(lower, "todo") {
			t.Errorf("copy rule broken in %q", s)
		}
	}
}
