package services

import (
	"context"
	"errors"
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

func TestSeriesProgressionIsInDateOrder(t *testing.T) {
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
	ex := prTestSetup(t, svc, userID, "Test Squat")
	for i, w := range []float64{100, 105, 110, 115} {
		sess, err := svc.StartSession(ctx, userID, &models.CreateSessionRequest{SeriesID: &series.ID})
		if err != nil {
			t.Fatalf("start %d: %v", i, err)
		}
		logSet(t, svc, userID, sess.ID, ex, 1, w, 1)
		finishSession(t, svc, userID, sess.ID)
	}

	detail, err := svc.GetSeriesDetail(ctx, userID, series.ID)
	if err != nil {
		t.Fatalf("series detail: %v", err)
	}
	pts := detail.ExerciseProgressions[0].Points
	want := []float64{100, 105, 110, 115}
	if len(pts) != len(want) {
		t.Fatalf("got %d points, want %d", len(pts), len(want))
	}
	for i, p := range pts {
		if p.BestEst1RM != want[i] {
			t.Fatalf("points = %+v; want singles 100..115 in date order, a single's e1RM being its weight", pts)
		}
	}
}

func TestGetSessionListsExercisesInTheOrderDone(t *testing.T) {
	svc, userID := testJymDB(t)
	ctx := context.Background()
	a := prTestSetup(t, svc, userID, "Test A")
	b := prTestSetup(t, svc, userID, "Test B")
	// Do the exercise with the larger id first, so id order would put it second.
	first, second := a, b
	if a.String() < b.String() {
		first, second = b, a
	}
	sess := startSession(t, svc, userID, "")
	logSet(t, svc, userID, sess, first, 1, 50, 5)
	logSet(t, svc, userID, sess, second, 1, 60, 5)
	logSet(t, svc, userID, sess, first, 2, 50, 5)

	got, err := svc.GetSession(ctx, userID, sess)
	if err != nil {
		t.Fatalf("get session: %v", err)
	}
	order := []uuid.UUID{got.Sets[0].ExerciseID, got.Sets[1].ExerciseID, got.Sets[2].ExerciseID}
	if order[0] != first || order[1] != first || order[2] != second {
		t.Fatalf("set order by exercise = %v; want the first-done exercise's two sets, then the other", order)
	}
}

func TestStartSessionGuardsAnOpenWorkoutAndTheSeriesSplit(t *testing.T) {
	svc, userID := testJymDB(t)
	ctx := context.Background()
	first, err := svc.StartSession(ctx, userID, &models.CreateSessionRequest{})
	if err != nil {
		t.Fatalf("first start: %v", err)
	}
	_, err = svc.StartSession(ctx, userID, &models.CreateSessionRequest{})
	var open *SessionInProgressError
	if !errors.As(err, &open) || open.SessionID != first.ID {
		t.Fatalf("second start: got %v, want SessionInProgressError naming the first", err)
	}
	if _, err := svc.StartSession(ctx, userID, &models.CreateSessionRequest{Force: true}); err != nil {
		t.Fatalf("forced start: %v", err)
	}

	splitA, _ := svc.CreateSplit(ctx, userID, &models.CreateSplitRequest{Name: "A"})
	splitB, _ := svc.CreateSplit(ctx, userID, &models.CreateSplitRequest{Name: "B"})
	day, err := svc.CreateRoutine(ctx, userID, splitA.ID, &models.CreateRoutineRequest{Name: "Day 1", DayOrder: 1})
	if err != nil {
		t.Fatalf("create routine: %v", err)
	}
	seriesB, err := svc.CreateSeries(ctx, userID, &models.CreateSeriesRequest{SplitID: splitB.ID, Name: "B run", DurationType: "open"})
	if err != nil {
		t.Fatalf("create series: %v", err)
	}
	if _, err := svc.StartSession(ctx, userID, &models.CreateSessionRequest{RoutineID: &day.ID, SeriesID: &seriesB.ID, Force: true}); !errors.Is(err, ErrRoutineNotInSeries) {
		t.Fatalf("day of split A in a series of split B: got %v, want ErrRoutineNotInSeries", err)
	}
}
