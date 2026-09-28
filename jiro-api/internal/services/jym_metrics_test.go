package services

import (
	"context"
	"testing"
	"time"

	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/models"
	"github.com/google/uuid"
)

func TestEpley1RM(t *testing.T) {
	for _, tc := range []struct {
		weight float64
		reps   int
		want   float64
	}{
		{100, 1, 100},
		{79.38, 1, 79.4},
		{100, 5, 116.7},
		{60, 10, 80},
		{340, 12, 453.3}, // counted as 10 reps
		{100, 30, 133.3},
	} {
		if got := epley1RM(tc.weight, tc.reps); got != tc.want {
			t.Errorf("epley1RM(%v, %d) = %v, want %v", tc.weight, tc.reps, got, tc.want)
		}
	}
}

func TestSessionListsCountWorkingSetsAndPRLifts(t *testing.T) {
	svc, userID := testJymDB(t)
	ctx := context.Background()
	bench := prTestSetup(t, svc, userID, "Test Bench")
	row := prTestSetup(t, svc, userID, "Test Row")
	sess := startSession(t, svc, userID, "")
	warm := true
	if _, err := svc.LogSet(ctx, userID, sess, &models.CreateSetRequest{
		ExerciseID: bench, SetNumber: 1, Weight: 60, RepsPerformed: 10, IsWarmup: &warm,
	}); err != nil {
		t.Fatalf("log warm-up: %v", err)
	}
	logSet(t, svc, userID, sess, bench, 2, 100, 5)
	logSet(t, svc, userID, sess, bench, 3, 105, 5) // a second record on the same lift
	logSet(t, svc, userID, sess, row, 1, 50, 10)
	finishSession(t, svc, userID, sess)

	page, err := svc.ListSessions(ctx, userID, nil, uuid.Nil, 10)
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	day, err := svc.ListSessionsBetween(ctx, userID, time.Now().Add(-time.Hour), time.Now().Add(time.Hour))
	if err != nil {
		t.Fatalf("list between: %v", err)
	}
	for name, rows := range map[string][]models.SessionSummary{"page": page, "day": day} {
		if len(rows) != 1 {
			t.Fatalf("%s: %d sessions, want 1", name, len(rows))
		}
		got := rows[0]
		if got.SetCount != 3 || got.TotalVolume != 1525 || got.PRCount != 2 {
			t.Fatalf("%s: sets %d, volume %v, PRs %d; want 3 working sets, 1525 kg and 2 lifts with a record",
				name, got.SetCount, got.TotalVolume, got.PRCount)
		}
	}
}

func TestHeaderAndSeriesE1RMUseTheCappedFormula(t *testing.T) {
	svc, userID := testJymDB(t)
	ctx := context.Background()
	split, err := svc.CreateSplit(ctx, userID, &models.CreateSplitRequest{Name: "Test Split"})
	if err != nil {
		t.Fatalf("create split: %v", err)
	}
	series, err := svc.CreateSeries(ctx, userID, &models.CreateSeriesRequest{SplitID: split.ID, Name: "Block", DurationType: "open"})
	if err != nil {
		t.Fatalf("create series: %v", err)
	}
	ex := prTestSetup(t, svc, userID, "Test Press")
	sess, err := svc.StartSession(ctx, userID, &models.CreateSessionRequest{SeriesID: &series.ID})
	if err != nil {
		t.Fatalf("start: %v", err)
	}
	logSet(t, svc, userID, sess.ID, ex, 1, 100, 1)
	logSet(t, svc, userID, sess.ID, ex, 2, 75, 5)
	logSet(t, svc, userID, sess.ID, ex, 3, 80, 12) // 106.7 capped; 112 without the cap
	finishSession(t, svc, userID, sess.ID)
	want := epley1RM(80, 12)

	got, err := svc.GetExerciseWithHistory(ctx, userID, ex, nil)
	if err != nil {
		t.Fatalf("history: %v", err)
	}
	if got.Est1RM != want {
		t.Fatalf("header e1RM %v, want %v", got.Est1RM, want)
	}
	for _, h := range got.History {
		if h.Est1RM != epley1RM(h.Weight, h.Reps) {
			t.Fatalf("history row %v x %d has e1RM %v", h.Weight, h.Reps, h.Est1RM)
		}
	}
	detail, err := svc.GetSeriesDetail(ctx, userID, series.ID)
	if err != nil {
		t.Fatalf("series detail: %v", err)
	}
	if pts := detail.ExerciseProgressions[0].Points; len(pts) != 1 || pts[0].BestEst1RM != want {
		t.Fatalf("series points %+v, want one at %v", pts, want)
	}
}

func TestExerciseHeaderLeavesOutDeloadsAndHistoryKnowsUnfinished(t *testing.T) {
	svc, userID := testJymDB(t)
	ctx := context.Background()
	ex := prTestSetup(t, svc, userID, "Test Squat")
	normal := startSession(t, svc, userID, "")
	logSet(t, svc, userID, normal, ex, 1, 100, 5)
	finishSession(t, svc, userID, normal)
	deload := startSession(t, svc, userID, "deload")
	logSet(t, svc, userID, deload, ex, 1, 120, 5)
	finishSession(t, svc, userID, deload)
	open := startSession(t, svc, userID, "")
	logSet(t, svc, userID, open, ex, 1, 90, 5)

	got, err := svc.GetExerciseWithHistory(ctx, userID, ex, nil)
	if err != nil {
		t.Fatalf("history: %v", err)
	}
	if got.BestWeight != 100 || got.Est1RM != epley1RM(100, 5) {
		t.Fatalf("header best %v, e1RM %v; want the normal session's 100 x 5", got.BestWeight, got.Est1RM)
	}
	for _, h := range got.History {
		if unfinished := h.SessionID == open; unfinished != (h.EndedAt == nil) {
			t.Fatalf("set from session %s: ended_at %v", h.SessionID, h.EndedAt)
		}
	}
}
