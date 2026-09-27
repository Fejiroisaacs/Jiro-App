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

func TestRoundWeightTiesStoredValue(t *testing.T) {
	// 175 lbs arrives as 79.3786... kg and is stored as 79.38.
	if got := roundWeight(175 / 2.20462); got != 79.38 {
		t.Fatalf("roundWeight(175 lbs) = %v, want 79.38", got)
	}
	if !isNewPR(roundWeight(175/2.20462), 6, false, 79.38, 5) {
		t.Fatalf("175 lbs x 6 after 175 lbs x 5 should be a PR")
	}
}

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

// testJymDB uses JIRO_TEST_DATABASE_URL and a throwaway user deleted when the test ends.
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

	// Marking the PR set a warm-up takes the badge away; unmarking earns it back.
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

func TestSplitShareUsable(t *testing.T) {
	now := time.Date(2026, 9, 26, 12, 0, 0, 0, time.UTC)
	at := func(d time.Duration) *time.Time { v := now.Add(d); return &v }
	for _, tc := range []struct {
		name      string
		expiresAt *time.Time
		want      bool
	}{
		{"legacy row without expiry", nil, true},
		{"fresh", at(SplitShareTTL), true},
		{"one second left", at(time.Second), true},
		{"expires exactly now", at(0), false},
		{"expired", at(-time.Hour), false},
	} {
		if got := splitShareUsable(tc.expiresAt, now); got != tc.want {
			t.Errorf("%s: usable = %v, want %v", tc.name, got, tc.want)
		}
	}
	if SplitShareTTL != 30*24*time.Hour {
		t.Errorf("SplitShareTTL = %v, want 30 days", SplitShareTTL)
	}
}

func TestSplitShareExpires(t *testing.T) {
	svc, userID := testJymDB(t)
	ctx := context.Background()

	split, err := svc.CreateSplit(ctx, userID, &models.CreateSplitRequest{Name: "Share Test"})
	if err != nil {
		t.Fatalf("create split: %v", err)
	}
	share, err := svc.CreateShare(ctx, userID, split.ID, "https://example.com")
	if err != nil {
		t.Fatalf("create share: %v", err)
	}
	if d := time.Until(share.ExpiresAt); d < SplitShareTTL-time.Minute || d > SplitShareTTL {
		t.Fatalf("expires in %v, want about %v", d, SplitShareTTL)
	}
	shareID := uuid.MustParse(share.ShareID)
	if _, err := svc.GetSharePreview(ctx, shareID); err != nil {
		t.Fatalf("preview fresh share: %v", err)
	}

	if _, err := svc.db.Exec(ctx, `UPDATE split_shares SET expires_at = NOW() - INTERVAL '1 minute' WHERE id = $1`, shareID); err != nil {
		t.Fatalf("expire share: %v", err)
	}
	if _, err := svc.GetSharePreview(ctx, shareID); !errors.Is(err, ErrShareExpired) {
		t.Fatalf("preview expired share: got %v, want ErrShareExpired", err)
	}
	if _, err := svc.ImportShare(ctx, userID, shareID); !errors.Is(err, ErrShareExpired) {
		t.Fatalf("import expired share: got %v, want ErrShareExpired", err)
	}

	// Rows from before the TTL have no expiry and keep working.
	if _, err := svc.db.Exec(ctx, `UPDATE split_shares SET expires_at = NULL WHERE id = $1`, shareID); err != nil {
		t.Fatalf("clear expiry: %v", err)
	}
	if _, err := svc.GetSharePreview(ctx, shareID); err != nil {
		t.Fatalf("preview legacy share: %v", err)
	}
}
