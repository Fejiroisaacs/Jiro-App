package services

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/models"
	"github.com/google/uuid"
)

// startedDaysAgo moves a workout's start back, keeping it finished an hour later.
func startedDaysAgo(t *testing.T, svc *JymService, sessionID uuid.UUID, days int) {
	t.Helper()
	if _, err := svc.db.Exec(context.Background(),
		`UPDATE sessions SET started_at = NOW() - make_interval(days => $2), ended_at = NOW() - make_interval(days => $2) + INTERVAL '1 hour'
		 WHERE id = $1`, sessionID, days); err != nil {
		t.Fatalf("backdate: %v", err)
	}
}

func warmupSet(t *testing.T, svc *JymService, userID, sessionID, exerciseID uuid.UUID, n int, weight float64, reps int) {
	t.Helper()
	warm := true
	if _, err := svc.LogSet(context.Background(), userID, sessionID, &models.CreateSetRequest{
		ExerciseID: exerciseID, SetNumber: n, Weight: weight, RepsPerformed: ip(reps), IsWarmup: &warm,
	}); err != nil {
		t.Fatalf("warm-up: %v", err)
	}
}

func TestExerciseStatsFollowTheMetricRules(t *testing.T) {
	svc, userID := testJymDB(t)
	ctx := context.Background()
	bench := prTestSetup(t, svc, userID, "Bench")

	// Workout 1: a warm-up, then 100 × 5 and 90 × 12 (the cap counts 12 reps as 10).
	w1 := startSession(t, svc, userID, "")
	warmupSet(t, svc, userID, w1, bench, 1, 60, 10)
	logSet(t, svc, userID, w1, bench, 2, 100, 5)
	logSet(t, svc, userID, w1, bench, 3, 90, 12)
	finishSession(t, svc, userID, w1)
	startedDaysAgo(t, svc, w1, 30)

	// Workout 2: a deload, which is a row but keeps its weights out of the weight list.
	w2 := startSession(t, svc, userID, "deload")
	logSet(t, svc, userID, w2, bench, 1, 70, 5)
	finishSession(t, svc, userID, w2)
	startedDaysAgo(t, svc, w2, 20)

	// Workout 3: warm-ups only.
	w3 := startSession(t, svc, userID, "")
	warmupSet(t, svc, userID, w3, bench, 1, 50, 8)
	finishSession(t, svc, userID, w3)
	startedDaysAgo(t, svc, w3, 10)

	stats, err := svc.GetExerciseStats(ctx, userID, bench)
	if err != nil {
		t.Fatalf("stats: %v", err)
	}
	if len(stats.Workouts) != 3 {
		t.Fatalf("workouts = %d, want 3", len(stats.Workouts))
	}
	first := stats.Workouts[0]
	if first.SessionID != w1 || first.WorkingSets != 2 || first.MaxWeight != 100 || first.MaxReps != 12 {
		t.Fatalf("workout 1 = %+v", first)
	}
	// 90 × 12 counts as 90 × 10: 90 × (1 + 10/30) = 120; 100 × 5 = 116.7.
	if first.BestE1RM != 120 || first.BestSet == nil || first.BestSet.Weight != 90 || first.BestSet.Reps != 12 {
		t.Fatalf("workout 1 best = %v %+v, want 120 from 90 × 12", first.BestE1RM, first.BestSet)
	}
	if first.Volume != 100*5+90*12 {
		t.Fatalf("workout 1 volume = %v, want working sets only", first.Volume)
	}
	if first.HasPR {
		t.Fatalf("workout 1 is the baseline, not a record")
	}
	if d := stats.Workouts[1]; d.SessionID != w2 || d.SessionType != "deload" {
		t.Fatalf("workout 2 = %+v, want the deload", d)
	}
	if w := stats.Workouts[2]; w.SessionID != w3 || w.WorkingSets != 0 || w.BestSet != nil || w.BestE1RM != 0 {
		t.Fatalf("warm-up-only workout = %+v", w)
	}
	if len(stats.Weights) != 2 || stats.Weights[0] != 100 || stats.Weights[1] != 90 {
		t.Fatalf("weights = %v, want [100 90] (no warm-ups, no deload)", stats.Weights)
	}
}

func TestExerciseStatsCarryTheWorkoutsNote(t *testing.T) {
	svc, userID := testJymDB(t)
	ctx := context.Background()
	row := prTestSetup(t, svc, userID, "Row")
	w := startSession(t, svc, userID, "")
	note := "Elbows in"
	if _, err := svc.LogSet(ctx, userID, w, &models.CreateSetRequest{ExerciseID: row, SetNumber: 1, Weight: 60, RepsPerformed: ip(8), ExerciseNote: &note}); err != nil {
		t.Fatalf("log: %v", err)
	}
	stats, err := svc.GetExerciseStats(ctx, userID, row)
	if err != nil {
		t.Fatalf("stats: %v", err)
	}
	if got := stats.Workouts[0].Note; got == nil || *got != note {
		t.Fatalf("note = %v, want %q", got, note)
	}
}

func TestRepsAtWeightKeepsWorkingSetsAtThatWeight(t *testing.T) {
	svc, userID := testJymDB(t)
	ctx := context.Background()
	squat := prTestSetup(t, svc, userID, "Squat")
	w := startSession(t, svc, userID, "")
	warmupSet(t, svc, userID, w, squat, 1, 100, 3)
	logSet(t, svc, userID, w, squat, 2, 100, 5)
	logSet(t, svc, userID, w, squat, 3, 110, 3)
	logSet(t, svc, userID, w, squat, 4, 100, 4)
	d := startSession(t, svc, userID, "deload")
	logSet(t, svc, userID, d, squat, 1, 100, 5)

	got, err := svc.GetRepsAtWeight(ctx, userID, squat, 100)
	if err != nil {
		t.Fatalf("reps at: %v", err)
	}
	if len(got) != 1 || got[0].SessionID != w || len(got[0].Reps) != 2 || got[0].Reps[0] != 5 || got[0].Reps[1] != 4 {
		t.Fatalf("reps at 100 = %+v, want one workout with [5 4]", got)
	}
}

func TestExerciseWorkoutsPageWithoutGaps(t *testing.T) {
	svc, userID := testJymDB(t)
	ctx := context.Background()
	dead := prTestSetup(t, svc, userID, "Deadlift")
	other := prTestSetup(t, svc, userID, "Curl")
	var ids []uuid.UUID
	for i := 0; i < 5; i++ {
		w := startSession(t, svc, userID, "")
		logSet(t, svc, userID, w, dead, 1, 100+float64(i), 5)
		logSet(t, svc, userID, w, dead, 2, 100+float64(i), 5)
		finishSession(t, svc, userID, w)
		ids = append(ids, w)
	}
	// Two workouts start at the same moment: the id breaks the tie.
	if _, err := svc.db.Exec(ctx, `UPDATE sessions SET started_at = (SELECT started_at FROM sessions WHERE id = $1) WHERE id = $2`, ids[2], ids[3]); err != nil {
		t.Fatalf("tie: %v", err)
	}
	// A workout without the exercise is left out.
	skip := startSession(t, svc, userID, "")
	logSet(t, svc, userID, skip, other, 1, 20, 10)

	seen := map[uuid.UUID]int{}
	var before *time.Time
	beforeID := uuid.Nil
	for page := 0; page < 5; page++ {
		list, err := svc.ListExerciseWorkouts(ctx, userID, dead, before, beforeID, 2)
		if err != nil {
			t.Fatalf("page %d: %v", page, err)
		}
		if len(list) == 0 {
			break
		}
		for _, w := range list {
			seen[w.SessionID]++
			if len(w.Sets) != 2 {
				t.Fatalf("workout %v has %d sets, want 2", w.SessionID, len(w.Sets))
			}
		}
		last := list[len(list)-1]
		before, beforeID = &last.StartedAt, last.SessionID
	}
	if len(seen) != 5 || seen[skip] != 0 {
		t.Fatalf("seen %d workouts (%v), want the 5 with deadlifts", len(seen), seen)
	}
	for id, n := range seen {
		if n != 1 {
			t.Fatalf("workout %v listed %d times", id, n)
		}
	}
}

func TestExerciseReadsRefuseAnotherUsersExercise(t *testing.T) {
	svc, owner := testJymDB(t)
	_, stranger := testJymDB(t)
	ctx := context.Background()
	ex := prTestSetup(t, svc, owner, "Press")

	if _, err := svc.GetExerciseStats(ctx, stranger, ex); !errors.Is(err, ErrExerciseNotFound) {
		t.Fatalf("stats: %v, want not found", err)
	}
	if _, err := svc.GetRepsAtWeight(ctx, stranger, ex, 50); !errors.Is(err, ErrExerciseNotFound) {
		t.Fatalf("reps at: %v, want not found", err)
	}
	if _, err := svc.ListExerciseWorkouts(ctx, stranger, ex, nil, uuid.Nil, 10); !errors.Is(err, ErrExerciseNotFound) {
		t.Fatalf("workouts: %v, want not found", err)
	}
}
