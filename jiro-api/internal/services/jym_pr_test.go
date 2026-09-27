package services

import (
	"context"
	"testing"
	"time"

	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/models"
	"github.com/google/uuid"
)

// prTestSetup creates a fresh exercise for a PR test.
func prTestSetup(t *testing.T, svc *JymService, userID uuid.UUID, name string) uuid.UUID {
	t.Helper()
	ex, err := svc.CreateExercise(context.Background(), userID, &models.CreateExerciseRequest{Name: name})
	if err != nil {
		t.Fatalf("create exercise: %v", err)
	}
	return ex.ID
}

func startSession(t *testing.T, svc *JymService, userID uuid.UUID, sessionType string) uuid.UUID {
	t.Helper()
	req := &models.CreateSessionRequest{}
	if sessionType != "" {
		req.SessionType = &sessionType
	}
	sess, err := svc.StartSession(context.Background(), userID, req)
	if err != nil {
		t.Fatalf("start session: %v", err)
	}
	return sess.ID
}

func finishSession(t *testing.T, svc *JymService, userID, sessionID uuid.UUID) {
	t.Helper()
	now := time.Now()
	if _, err := svc.UpdateSession(context.Background(), userID, sessionID, &models.UpdateSessionRequest{EndedAt: &now}); err != nil {
		t.Fatalf("finish session: %v", err)
	}
}

func logSet(t *testing.T, svc *JymService, userID, sessionID, exerciseID uuid.UUID, n int, weight float64, reps int) *models.SessionSet {
	t.Helper()
	set, err := svc.LogSet(context.Background(), userID, sessionID, &models.CreateSetRequest{
		ExerciseID: exerciseID, SetNumber: n, Weight: weight, RepsPerformed: reps,
	})
	if err != nil {
		t.Fatalf("log %v x %d: %v", weight, reps, err)
	}
	return set
}

// storedSet reads one set back from its session, where the stored PR flag and number live.
func storedSet(t *testing.T, svc *JymService, userID, sessionID, setID uuid.UUID) models.SessionSetWithExercise {
	t.Helper()
	sess, err := svc.GetSession(context.Background(), userID, sessionID)
	if err != nil {
		t.Fatalf("get session: %v", err)
	}
	for _, s := range sess.Sets {
		if s.ID == setID {
			return s
		}
	}
	t.Fatalf("set %s not in session", setID)
	return models.SessionSetWithExercise{}
}

func TestPRToleranceBothWays(t *testing.T) {
	svc, userID := testJymDB(t)
	ex := prTestSetup(t, svc, userID, "Test Press")
	sess := startSession(t, svc, userID, "")

	if !logSet(t, svc, userID, sess, ex, 1, 100, 5).IsPR {
		t.Fatalf("first working set should be a PR")
	}
	// 100 kg shown as 220.5 lb and typed back stores 100.02 kg: the same lift, not a PR.
	if logSet(t, svc, userID, sess, ex, 2, 100.02, 5).IsPR {
		t.Fatalf("100.02 x 5 after 100 x 5 was a phantom PR")
	}
	// 155 kg typed back as 341.7 lb stores 154.99 kg: the same weight, so more reps is a PR.
	if !logSet(t, svc, userID, sess, ex, 3, 99.99, 6).IsPR {
		t.Fatalf("99.99 x 6 after 100 x 5 should be a rep PR")
	}
}

func TestDeletingATypoReratesLaterSets(t *testing.T) {
	svc, userID := testJymDB(t)
	ctx := context.Background()
	ex := prTestSetup(t, svc, userID, "Test Deadlift")
	sess := startSession(t, svc, userID, "")

	typo := logSet(t, svc, userID, sess, ex, 1, 1000, 5)
	real := logSet(t, svc, userID, sess, ex, 2, 100, 5)
	if real.IsPR {
		t.Fatalf("100 x 5 should not beat the 1000 x 5 typo yet")
	}
	if err := svc.DeleteSet(ctx, userID, typo.ID); err != nil {
		t.Fatalf("delete typo: %v", err)
	}
	got := storedSet(t, svc, userID, sess, real.ID)
	if !got.IsPR {
		t.Fatalf("100 x 5 should be the PR once the typo is gone")
	}
	if got.SetNumber != 1 {
		t.Fatalf("remaining set is number %d, want 1 after renumbering", got.SetNumber)
	}
}

func TestDeloadSetsNeverPRAndDontRaiseTheBar(t *testing.T) {
	svc, userID := testJymDB(t)
	ctx := context.Background()
	ex := prTestSetup(t, svc, userID, "Test Row")

	first := startSession(t, svc, userID, "")
	logSet(t, svc, userID, first, ex, 1, 100, 5)
	finishSession(t, svc, userID, first)

	deload := startSession(t, svc, userID, "deload")
	heavy := logSet(t, svc, userID, deload, ex, 1, 120, 5)
	if heavy.IsPR {
		t.Fatalf("a deload set was flagged a PR")
	}
	finishSession(t, svc, userID, deload)

	next := startSession(t, svc, userID, "")
	mid := logSet(t, svc, userID, next, ex, 1, 110, 5)
	if !mid.IsPR {
		t.Fatalf("110 x 5 should beat 100 x 5; the deload's 120 must not raise the bar")
	}
	finishSession(t, svc, userID, next)

	// Calling the deload a normal session makes its 120 the PR and 110 no longer one.
	normal := "normal"
	if _, err := svc.UpdateSession(ctx, userID, deload, &models.UpdateSessionRequest{SessionType: &normal}); err != nil {
		t.Fatalf("switch type: %v", err)
	}
	if !storedSet(t, svc, userID, deload, heavy.ID).IsPR {
		t.Fatalf("120 x 5 should be a PR once its session is normal")
	}
	if storedSet(t, svc, userID, next, mid.ID).IsPR {
		t.Fatalf("110 x 5 should lose its PR to the earlier 120 x 5")
	}
}

func TestGetPRsPrefersMoreRepsAtTheSameWeight(t *testing.T) {
	svc, userID := testJymDB(t)
	ctx := context.Background()
	ex := prTestSetup(t, svc, userID, "Test Curl")
	sess := startSession(t, svc, userID, "")
	logSet(t, svc, userID, sess, ex, 1, 100, 5)
	logSet(t, svc, userID, sess, ex, 2, 100, 6)

	prs, err := svc.GetPRs(ctx, userID)
	if err != nil {
		t.Fatalf("get PRs: %v", err)
	}
	if len(prs) != 1 || prs[0].Reps != 6 {
		t.Fatalf("PR wall shows %+v, want 100 x 6", prs)
	}
}
