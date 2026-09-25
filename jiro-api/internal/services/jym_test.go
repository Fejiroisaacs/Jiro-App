package services

import (
	"context"
	"errors"
	"os"
	"testing"
	"time"

	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/models"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestIsNewPR(t *testing.T) {
	cases := []struct {
		name       string
		weight     float64
		reps       int
		warmup     bool
		bestWeight float64
		bestReps   int
		want       bool
	}{
		{"heavier working set", 105, 5, false, 100, 5, true},
		{"same weight more reps", 100, 6, false, 100, 5, true},
		{"same weight same reps", 100, 5, false, 100, 5, false},
		{"lighter", 95, 12, false, 100, 5, false},
		{"first ever working set", 20, 10, false, 0, 0, true},
		{"heavier warm-up", 140, 1, true, 100, 5, false},
		{"first ever set is a warm-up", 20, 10, true, 0, 0, false},
		{"warm-up same weight more reps", 100, 8, true, 100, 5, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := isNewPR(tc.weight, tc.reps, tc.warmup, tc.bestWeight, tc.bestReps)
			if got != tc.want {
				t.Fatalf("isNewPR(%v, %d, warmup=%v, best %v x %d) = %v, want %v",
					tc.weight, tc.reps, tc.warmup, tc.bestWeight, tc.bestReps, got, tc.want)
			}
		})
	}
}

// testJymDB connects to a real database when JIRO_TEST_DATABASE_URL is set
// (the app role is enough) and creates a throwaway user that is deleted,
// with everything it owns, when the test ends.
func testJymDB(t *testing.T) (*JymService, uuid.UUID) {
	t.Helper()
	url := os.Getenv("JIRO_TEST_DATABASE_URL")
	if url == "" {
		t.Skip("JIRO_TEST_DATABASE_URL not set")
	}
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	userID := uuid.New()
	if _, err := pool.Exec(ctx,
		`INSERT INTO users (id, email, password_hash) VALUES ($1, $2, 'x')`,
		userID, "jym-test-"+userID.String()+"@example.com",
	); err != nil {
		pool.Close()
		t.Fatalf("create user: %v", err)
	}
	t.Cleanup(func() {
		pool.Exec(context.Background(), `DELETE FROM users WHERE id = $1`, userID)
		pool.Close()
	})
	return NewJymService(pool), userID
}

func TestLogSetRefusesEndedSession(t *testing.T) {
	svc, userID := testJymDB(t)
	ctx := context.Background()

	ex, err := svc.CreateExercise(ctx, userID, &models.CreateExerciseRequest{Name: "Test Squat"})
	if err != nil {
		t.Fatalf("create exercise: %v", err)
	}
	started, err := svc.StartSession(ctx, userID, &models.CreateSessionRequest{})
	if err != nil {
		t.Fatalf("start session: %v", err)
	}
	set := &models.CreateSetRequest{ExerciseID: ex.ID, SetNumber: 1, Weight: 100, RepsPerformed: 5}
	if _, err := svc.LogSet(ctx, userID, started.ID, set); err != nil {
		t.Fatalf("log set on live session: %v", err)
	}

	// Saving notes mid-workout must not finish the session.
	notes := "felt strong"
	if sess, err := svc.UpdateSession(ctx, userID, started.ID, &models.UpdateSessionRequest{Notes: &notes}); err != nil {
		t.Fatalf("save notes: %v", err)
	} else if sess.EndedAt != nil {
		t.Fatalf("saving notes ended the session")
	}

	now := time.Now()
	if _, err := svc.UpdateSession(ctx, userID, started.ID, &models.UpdateSessionRequest{EndedAt: &now}); err != nil {
		t.Fatalf("finish: %v", err)
	}
	set.SetNumber = 2
	if _, err := svc.LogSet(ctx, userID, started.ID, set); !errors.Is(err, ErrSessionEnded) {
		t.Fatalf("log set on ended session: got %v, want ErrSessionEnded", err)
	}
	later := now.Add(time.Hour)
	if _, err := svc.UpdateSession(ctx, userID, started.ID, &models.UpdateSessionRequest{EndedAt: &later}); !errors.Is(err, ErrSessionEnded) {
		t.Fatalf("finish twice: got %v, want ErrSessionEnded", err)
	}
	// Notes on a finished session are still editable.
	if _, err := svc.UpdateSession(ctx, userID, started.ID, &models.UpdateSessionRequest{Notes: &notes}); err != nil {
		t.Fatalf("notes after finish: %v", err)
	}
}

func TestWarmupIsNeverPR(t *testing.T) {
	svc, userID := testJymDB(t)
	ctx := context.Background()

	ex, err := svc.CreateExercise(ctx, userID, &models.CreateExerciseRequest{Name: "Test Bench"})
	if err != nil {
		t.Fatalf("create exercise: %v", err)
	}
	started, err := svc.StartSession(ctx, userID, &models.CreateSessionRequest{})
	if err != nil {
		t.Fatalf("start session: %v", err)
	}
	warm := true
	first, err := svc.LogSet(ctx, userID, started.ID, &models.CreateSetRequest{
		ExerciseID: ex.ID, SetNumber: 1, Weight: 60, RepsPerformed: 10, IsWarmup: &warm,
	})
	if err != nil {
		t.Fatalf("log warm-up: %v", err)
	}
	if first.IsPR {
		t.Fatalf("first-ever warm-up was marked a PR")
	}
	work, err := svc.LogSet(ctx, userID, started.ID, &models.CreateSetRequest{
		ExerciseID: ex.ID, SetNumber: 2, Weight: 80, RepsPerformed: 5,
	})
	if err != nil {
		t.Fatalf("log working set: %v", err)
	}
	if !work.IsPR {
		t.Fatalf("first working set should be a PR")
	}
	heavyWarm, err := svc.LogSet(ctx, userID, started.ID, &models.CreateSetRequest{
		ExerciseID: ex.ID, SetNumber: 3, Weight: 120, RepsPerformed: 1, IsWarmup: &warm,
	})
	if err != nil {
		t.Fatalf("log heavy warm-up: %v", err)
	}
	if heavyWarm.IsPR {
		t.Fatalf("warm-up at a new top weight was marked a PR")
	}

	// Marking the PR set as a warm-up takes the badge away; unmarking it
	// earns it back.
	upd, err := svc.UpdateSet(ctx, userID, work.ID, &models.UpdateSetRequest{IsWarmup: &warm})
	if err != nil {
		t.Fatalf("mark as warm-up: %v", err)
	}
	if upd.IsPR {
		t.Fatalf("set still a PR after being marked a warm-up")
	}
	notWarm := false
	upd, err = svc.UpdateSet(ctx, userID, work.ID, &models.UpdateSetRequest{IsWarmup: &notWarm})
	if err != nil {
		t.Fatalf("unmark warm-up: %v", err)
	}
	if !upd.IsPR {
		t.Fatalf("working set should be a PR again")
	}
}
