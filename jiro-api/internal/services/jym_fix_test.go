package services

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/models"
	"github.com/google/uuid"
)

// pastWorkout logs a finished workout that ran for an hour, starting `hoursAgo` hours ago.
func pastWorkout(t *testing.T, svc *JymService, userID uuid.UUID, hoursAgo int, routineID *uuid.UUID) *models.StartSessionResponse {
	t.Helper()
	start := time.Now().Add(-time.Duration(hoursAgo) * time.Hour).Truncate(time.Second)
	end := start.Add(time.Hour)
	sess, err := svc.StartSession(context.Background(), userID, &models.CreateSessionRequest{RoutineID: routineID, StartedAt: &start, EndedAt: &end})
	if err != nil {
		t.Fatalf("past workout: %v", err)
	}
	return sess
}

func fixSet(t *testing.T, svc *JymService, userID, sessionID, exerciseID uuid.UUID, n int, weight float64, reps int) *models.SessionSet {
	t.Helper()
	set, err := svc.LogSet(context.Background(), userID, sessionID, &models.CreateSetRequest{
		ExerciseID: exerciseID, SetNumber: n, Weight: weight, RepsPerformed: ip(reps), Fix: true,
	})
	if err != nil {
		t.Fatalf("fix %v x %d: %v", weight, reps, err)
	}
	return set
}

func TestPastWorkoutIsCreatedFinished(t *testing.T) {
	svc, userID := testJymDB(t)
	ctx := context.Background()
	startSession(t, svc, userID, "") // an open workout doesn't block logging a past one

	past := pastWorkout(t, svc, userID, 26, nil)
	if past.EndedAt == nil || past.EndedAt.Sub(past.StartedAt) != time.Hour {
		t.Fatalf("past workout: started %v, ended %v; want finished an hour later", past.StartedAt, past.EndedAt)
	}

	at := func(h float64) *time.Time { v := time.Now().Add(time.Duration(h * float64(time.Hour))); return &v }
	for name, c := range map[string]struct{ start, end *time.Time }{
		"start only":       {at(-2), nil},
		"end before start": {at(-2), at(-3)},
		"in the future":    {at(-1), at(1)},
		"over 24 hours":    {at(-30), at(-2)},
		"over a year ago":  {at(-24 * 400), at(-24*400 + 1)},
	} {
		var timesErr *SessionTimesError
		if _, err := svc.StartSession(ctx, userID, &models.CreateSessionRequest{StartedAt: c.start, EndedAt: c.end}); !errors.As(err, &timesErr) {
			t.Errorf("%s: got %v, want a SessionTimesError", name, err)
		}
	}
}

func TestFixAddsASetInsideTheWorkout(t *testing.T) {
	svc, userID := testJymDB(t)
	ctx := context.Background()
	ex := prTestSetup(t, svc, userID, "Fix Squat")
	past := pastWorkout(t, svc, userID, 30, nil)

	if _, err := svc.LogSet(ctx, userID, past.ID, &models.CreateSetRequest{ExerciseID: ex, SetNumber: 1, Weight: 100, RepsPerformed: ip(5)}); !errors.Is(err, ErrSessionEnded) {
		t.Fatalf("without fix: got %v, want ErrSessionEnded", err)
	}
	first := fixSet(t, svc, userID, past.ID, ex, 1, 100, 5)
	second := fixSet(t, svc, userID, past.ID, ex, 2, 100, 5)
	if first.CreatedAt.Before(past.StartedAt) || first.CreatedAt.After(*past.EndedAt) || !second.CreatedAt.After(first.CreatedAt) {
		t.Fatalf("fixed sets at %v and %v, want inside %v to %v and in order", first.CreatedAt, second.CreatedAt, past.StartedAt, *past.EndedAt)
	}

	// The workout's times still hold its sets, so Edit times keeps working.
	end := past.StartedAt.Add(30 * time.Minute)
	if _, err := svc.UpdateSessionTimes(ctx, userID, past.ID, &models.UpdateSessionTimesRequest{EndedAt: &end}); err != nil {
		t.Fatalf("edit times after a fix: %v", err)
	}
}

func TestFixedSetsAreRatedInTheirOwnTime(t *testing.T) {
	svc, userID := testJymDB(t)
	ex := prTestSetup(t, svc, userID, "Fix Bench")

	today := startSession(t, svc, userID, "")
	todays := logSet(t, svc, userID, today, ex, 1, 100, 5)

	// Last week's lighter set was a record then, and today's heavier set still is.
	lastWeek := pastWorkout(t, svc, userID, 24*7, nil)
	light := fixSet(t, svc, userID, lastWeek.ID, ex, 1, 80, 5)
	if !storedSet(t, svc, userID, lastWeek.ID, light.ID).IsPR || !storedSet(t, svc, userID, today, todays.ID).IsPR {
		t.Fatal("a lighter set logged into last week should be its own PR and leave today's")
	}

	// Two weeks ago it turns out you lifted more: that is the record, and today's 100 is not.
	twoWeeks := pastWorkout(t, svc, userID, 24*14, nil)
	heavy := fixSet(t, svc, userID, twoWeeks.ID, ex, 1, 120, 5)
	if !storedSet(t, svc, userID, twoWeeks.ID, heavy.ID).IsPR || storedSet(t, svc, userID, today, todays.ID).IsPR {
		t.Fatal("a heavier set logged into two weeks ago should take the PR from today's")
	}
}

func TestPastWorkoutJoinsASeriesOnlyInsideIt(t *testing.T) {
	svc, userID := testJymDB(t)
	ctx := context.Background()
	split, _ := svc.CreateSplit(ctx, userID, &models.CreateSplitRequest{Name: "Fix split"})
	day, err := svc.CreateRoutine(ctx, userID, split.ID, &models.CreateRoutineRequest{Name: "Day 1", DayOrder: 1})
	if err != nil {
		t.Fatalf("routine: %v", err)
	}
	series, err := svc.CreateSeries(ctx, userID, &models.CreateSeriesRequest{SplitID: split.ID, Name: "Block", DurationType: "open"})
	if err != nil {
		t.Fatalf("series: %v", err)
	}
	if _, err := svc.db.Exec(ctx, `UPDATE split_series SET started_at = NOW() - interval '3 days' WHERE id = $1`, series.ID); err != nil {
		t.Fatalf("backdate series: %v", err)
	}
	inside := pastWorkout(t, svc, userID, 24, &day.ID)
	before := pastWorkout(t, svc, userID, 24*5, &day.ID)
	if inside.SeriesID == nil || *inside.SeriesID != series.ID {
		t.Errorf("a past workout inside the series should join it, got %v", inside.SeriesID)
	}
	if before.SeriesID != nil {
		t.Errorf("a past workout before the series started should not join it, got %v", *before.SeriesID)
	}
}
