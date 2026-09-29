package services

import (
	"context"
	"errors"
	"testing"

	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/models"
	"github.com/google/uuid"
)

// startedHoursAgo pins a session's start so tests can order workouts exactly.
func startedHoursAgo(t *testing.T, svc *JymService, sessionID uuid.UUID, hours int) {
	t.Helper()
	if _, err := svc.db.Exec(context.Background(),
		`UPDATE sessions SET started_at = NOW() - make_interval(hours => $2) WHERE id = $1`, sessionID, hours,
	); err != nil {
		t.Fatalf("backdate: %v", err)
	}
}

func exerciseIn(t *testing.T, svc *JymService, userID uuid.UUID, name, group string) uuid.UUID {
	t.Helper()
	req := &models.CreateExerciseRequest{Name: name}
	if group != "" {
		req.MuscleGroup = &group
	}
	ex, err := svc.CreateExercise(context.Background(), userID, req)
	if err != nil {
		t.Fatalf("create exercise: %v", err)
	}
	return ex.ID
}

func TestSessionReportLastTimeIsLikeForLike(t *testing.T) {
	svc, userID := testJymDB(t)
	ctx := context.Background()
	ex := prTestSetup(t, svc, userID, "Test Bench")
	warm := true

	earlier := startSession(t, svc, userID, "")
	if _, err := svc.LogSet(ctx, userID, earlier, &models.CreateSetRequest{
		ExerciseID: ex, SetNumber: 1, Weight: 140, RepsPerformed: 1, IsWarmup: &warm,
	}); err != nil {
		t.Fatalf("log warm-up: %v", err)
	}
	logSet(t, svc, userID, earlier, ex, 2, 100, 5)
	logSet(t, svc, userID, earlier, ex, 3, 95, 5)
	finishSession(t, svc, userID, earlier)
	startedHoursAgo(t, svc, earlier, 6)

	// Newer than "earlier" but never last time: a test day, a deload, an unfinished workout.
	for i, kind := range []string{"test", "deload", ""} {
		sess := startSession(t, svc, userID, kind)
		logSet(t, svc, userID, sess, ex, 1, 110, 5)
		if kind != "" {
			finishSession(t, svc, userID, sess)
		}
		startedHoursAgo(t, svc, sess, 5-i)
	}

	current := startSession(t, svc, userID, "")
	logSet(t, svc, userID, current, ex, 1, 102.5, 5)
	finishSession(t, svc, userID, current)
	startedHoursAgo(t, svc, current, 2)

	later := startSession(t, svc, userID, "")
	logSet(t, svc, userID, later, ex, 1, 120, 5)
	finishSession(t, svc, userID, later)
	startedHoursAgo(t, svc, later, 1)

	report, err := svc.GetSessionReport(ctx, userID, current)
	if err != nil {
		t.Fatalf("report: %v", err)
	}
	prev := report.Exercises[0].Previous
	if prev == nil || prev.Weight != 100 || prev.Reps != 5 || prev.Est1RM != epley1RM(100, 5) {
		t.Fatalf("last time = %+v; want the earlier normal workout's best working set, 100 x 5", prev)
	}
}

func TestSessionReportBestSetsTotalsAndMuscles(t *testing.T) {
	svc, userID := testJymDB(t)
	ctx := context.Background()
	split, err := svc.CreateSplit(ctx, userID, &models.CreateSplitRequest{Name: "Upper Lower"})
	if err != nil {
		t.Fatalf("create split: %v", err)
	}
	day, err := svc.CreateRoutine(ctx, userID, split.ID, &models.CreateRoutineRequest{Name: "Upper A", DayOrder: 1})
	if err != nil {
		t.Fatalf("create routine: %v", err)
	}
	bench := exerciseIn(t, svc, userID, "Test Bench", "Chest")
	pullUp := exerciseIn(t, svc, userID, "Test Pull-up", "back")
	curl := exerciseIn(t, svc, userID, "Test Curl", "")

	started, err := svc.StartSession(ctx, userID, &models.CreateSessionRequest{RoutineID: &day.ID, Force: true})
	if err != nil {
		t.Fatalf("start: %v", err)
	}
	sess := started.ID
	warm := true
	if _, err := svc.LogSet(ctx, userID, sess, &models.CreateSetRequest{
		ExerciseID: bench, SetNumber: 1, Weight: 60, RepsPerformed: 10, IsWarmup: &warm,
	}); err != nil {
		t.Fatalf("log warm-up: %v", err)
	}
	logSet(t, svc, userID, sess, bench, 2, 100, 5) // the record
	logSet(t, svc, userID, sess, bench, 3, 95, 10) // a higher e1RM, but not a record
	logSet(t, svc, userID, sess, pullUp, 1, 0, 8)
	logSet(t, svc, userID, sess, pullUp, 2, 0, 10)
	logSet(t, svc, userID, sess, curl, 1, 20, 12)
	finishSession(t, svc, userID, sess)

	report, err := svc.GetSessionReport(ctx, userID, sess)
	if err != nil {
		t.Fatalf("report: %v", err)
	}
	if report.RoutineName == nil || *report.RoutineName != "Upper A" {
		t.Fatalf("routine name %v, want Upper A", report.RoutineName)
	}
	if report.SetCount != 5 || report.TotalVolume != 1690 || report.PRCount != 3 {
		t.Fatalf("sets %d, volume %v, PRs %d; want 5 working sets, 1690 kg, 3 lifts with a record",
			report.SetCount, report.TotalVolume, report.PRCount)
	}
	if len(report.Exercises) != 3 {
		t.Fatalf("%d exercises, want 3", len(report.Exercises))
	}
	b, p := report.Exercises[0], report.Exercises[1]
	if b.ExerciseID != bench || b.Sets != 2 || !b.IsPR || b.Best == nil || b.Best.Weight != 100 || b.Best.Reps != 5 {
		t.Fatalf("bench = %+v, best %+v; want 2 sets, the 100 x 5 record shown", b, b.Best)
	}
	if p.Best == nil || p.Best.Reps != 10 {
		t.Fatalf("pull-up best %+v; want the 10-rep set", p.Best)
	}
	want := []models.MuscleShare{{MuscleGroup: "back", Sets: 2}, {MuscleGroup: "chest", Sets: 2}, {MuscleGroup: "other", Sets: 1}}
	if len(report.Muscles) != len(want) {
		t.Fatalf("muscles %+v, want %+v", report.Muscles, want)
	}
	for i := range want {
		if report.Muscles[i] != want[i] {
			t.Fatalf("muscles %+v, want %+v", report.Muscles, want)
		}
	}
}

func TestSessionReportIsOnlyTheOwners(t *testing.T) {
	svc, userID := testJymDB(t)
	other, otherID := testJymDB(t)
	ex := prTestSetup(t, svc, userID, "Test Row")
	sess := startSession(t, svc, userID, "")
	logSet(t, svc, userID, sess, ex, 1, 50, 10)

	if _, err := other.GetSessionReport(context.Background(), otherID, sess); !errors.Is(err, ErrSessionNotFound) {
		t.Fatalf("another user's report: err %v, want ErrSessionNotFound", err)
	}
	if _, err := svc.GetSessionReport(context.Background(), userID, uuid.New()); !errors.Is(err, ErrSessionNotFound) {
		t.Fatalf("unknown session: err %v, want ErrSessionNotFound", err)
	}
}
