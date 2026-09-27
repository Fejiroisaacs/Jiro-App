package services

import (
	"context"
	"testing"
	"time"

	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/models"
	"github.com/google/uuid"
)

func sessionIDs(list []models.SessionSummary) []uuid.UUID {
	ids := make([]uuid.UUID, len(list))
	for i, s := range list {
		ids[i] = s.ID
	}
	return ids
}

func TestListSessionsPagesWithACursor(t *testing.T) {
	svc, userID := testJymDB(t)
	ctx := context.Background()
	var ids []uuid.UUID
	for i := 0; i < 3; i++ {
		id := startSession(t, svc, userID, "")
		finishSession(t, svc, userID, id)
		ids = append(ids, id)
	}

	first, err := svc.ListSessions(ctx, userID, nil, uuid.Nil, 2)
	if err != nil {
		t.Fatalf("first page: %v", err)
	}
	if len(first) != 2 || first[0].ID != ids[2] || first[1].ID != ids[1] {
		t.Fatalf("first page = %v, want the two newest", sessionIDs(first))
	}
	last := first[len(first)-1]
	second, err := svc.ListSessions(ctx, userID, &last.StartedAt, last.ID, 2)
	if err != nil {
		t.Fatalf("second page: %v", err)
	}
	if len(second) != 1 || second[0].ID != ids[0] {
		t.Fatalf("second page = %v, want only the oldest", sessionIDs(second))
	}
}

func TestListSessionsSinceKeepsUnfinishedOnes(t *testing.T) {
	svc, userID := testJymDB(t)
	ctx := context.Background()
	oldDone := startSession(t, svc, userID, "")
	finishSession(t, svc, userID, oldDone)
	oldOpen := startSession(t, svc, userID, "")
	recent := startSession(t, svc, userID, "")
	for _, id := range []uuid.UUID{oldDone, oldOpen} {
		if _, err := svc.db.Exec(ctx, `UPDATE sessions SET started_at = NOW() - INTERVAL '200 days' WHERE id = $1`, id); err != nil {
			t.Fatalf("backdate: %v", err)
		}
	}

	since := time.Now().AddDate(0, 0, -112)
	got, err := svc.ListSessionsSince(ctx, userID, since, "UTC")
	if err != nil {
		t.Fatalf("list since: %v", err)
	}
	seen := map[uuid.UUID]bool{}
	for _, s := range got {
		seen[s.ID] = true
	}
	if !seen[recent] || !seen[oldOpen] || seen[oldDone] {
		t.Fatalf("since window = %v; want the recent and the old unfinished session, not the old finished one", sessionIDs(got))
	}
}

func TestExerciseHistoryHeaderCoversAllWorkingSets(t *testing.T) {
	svc, userID := testJymDB(t)
	ctx := context.Background()
	ex := prTestSetup(t, svc, userID, "Test Pull")
	sess := startSession(t, svc, userID, "")
	warm := true
	if _, err := svc.LogSet(ctx, userID, sess, &models.CreateSetRequest{
		ExerciseID: ex, SetNumber: 1, Weight: 200, RepsPerformed: 1, IsWarmup: &warm,
	}); err != nil {
		t.Fatalf("log warm-up: %v", err)
	}
	logSet(t, svc, userID, sess, ex, 2, 100, 5)
	logSet(t, svc, userID, sess, ex, 3, 90, 10)

	limit := 1
	got, err := svc.GetExerciseWithHistory(ctx, userID, ex, &limit)
	if err != nil {
		t.Fatalf("history: %v", err)
	}
	if got.BestWeight != 100 || got.Est1RM != 120 {
		t.Fatalf("header best %v, e1RM %v; want 100 and 120 from working sets only", got.BestWeight, got.Est1RM)
	}
	if len(got.History) != 1 {
		t.Fatalf("limit 1 returned %d sets", len(got.History))
	}
	all, err := svc.GetExerciseWithHistory(ctx, userID, ex, nil)
	if err != nil {
		t.Fatalf("full history: %v", err)
	}
	if len(all.History) != 3 || !all.History[0].IsWarmup || all.History[0].SetNumber != 1 {
		t.Fatalf("full history = %+v; want 3 sets in set order, the warm-up flagged", all.History)
	}
}
