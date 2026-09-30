package services

import (
	"context"
	"fmt"
	"os"
	"strings"
	"testing"

	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/models"
	"github.com/google/uuid"
)

// planDay makes a split day with these exercises, 3 × 5 each, in order.
func planDay(t *testing.T, svc *JymService, userID uuid.UUID, exercises ...uuid.UUID) uuid.UUID {
	t.Helper()
	ctx := context.Background()
	split, err := svc.CreateSplit(ctx, userID, &models.CreateSplitRequest{Name: "Plan " + uuid.NewString()[:6]})
	if err != nil {
		t.Fatalf("split: %v", err)
	}
	day, err := svc.CreateRoutine(ctx, userID, split.ID, &models.CreateRoutineRequest{Name: "Day", DayOrder: 1})
	if err != nil {
		t.Fatalf("day: %v", err)
	}
	items := []models.ReplaceItemEntry{}
	for _, id := range exercises {
		items = append(items, models.ReplaceItemEntry{ExerciseID: id, TargetSets: 3, TargetReps: 5})
	}
	if _, err := svc.ReplaceRoutineItems(ctx, userID, day.ID, items); err != nil {
		t.Fatalf("items: %v", err)
	}
	return day.ID
}

// listOf is a workout's list as "name:sets×reps" (or "name:-" outside the plan), in order.
func listOf(t *testing.T, svc *JymService, userID, sessionID uuid.UUID) string {
	t.Helper()
	sess, err := svc.GetSession(context.Background(), userID, sessionID)
	if err != nil {
		t.Fatalf("get session: %v", err)
	}
	return describe(sess.Exercises)
}

func describe(list []models.SessionExercise) string {
	parts := []string{}
	for _, x := range list {
		target := "-"
		if x.TargetSets != nil && x.TargetReps != nil {
			target = fmt.Sprintf("%dx%d", *x.TargetSets, *x.TargetReps)
		}
		parts = append(parts, x.ExerciseName+":"+target)
	}
	return strings.Join(parts, " ")
}

func TestStartKeepsTheWorkoutsOwnPlan(t *testing.T) {
	svc, userID := testJymDB(t)
	ctx := context.Background()
	squat := prTestSetup(t, svc, userID, "Squat")
	bench := prTestSetup(t, svc, userID, "Bench")
	day := planDay(t, svc, userID, squat, bench)

	sess, err := svc.StartSession(ctx, userID, &models.CreateSessionRequest{RoutineID: &day, Force: true})
	if err != nil {
		t.Fatalf("start: %v", err)
	}
	if got := describe(sess.Exercises); got != "Squat:3x5 Bench:3x5" {
		t.Fatalf("start list: %q", got)
	}
	// Editing the routine mid-workout leaves the workout alone.
	if _, err := svc.ReplaceRoutineItems(ctx, userID, day, []models.ReplaceItemEntry{{ExerciseID: bench, TargetSets: 5, TargetReps: 3}}); err != nil {
		t.Fatalf("edit routine: %v", err)
	}
	if got := listOf(t, svc, userID, sess.ID); got != "Squat:3x5 Bench:3x5" {
		t.Fatalf("after routine edit: %q", got)
	}
}

func TestRepeatSetsTheListAndOrder(t *testing.T) {
	svc, userID := testJymDB(t)
	ctx := context.Background()
	squat := prTestSetup(t, svc, userID, "Squat")
	bench := prTestSetup(t, svc, userID, "Bench")
	curl := prTestSetup(t, svc, userID, "Curl")
	day := planDay(t, svc, userID, squat, bench)

	// Curl first (added last time), then Squat; Bench was skipped. A repeated id counts once.
	sess, err := svc.StartSession(ctx, userID, &models.CreateSessionRequest{
		RoutineID: &day, Force: true, ExerciseIDs: []uuid.UUID{curl, squat, curl},
	})
	if err != nil {
		t.Fatalf("start: %v", err)
	}
	if got := describe(sess.Exercises); got != "Curl:- Squat:3x5" {
		t.Fatalf("repeat list: %q", got)
	}

	// Someone else's exercise refuses the start, and leaves no workout behind.
	_, otherUser := testJymDB(t)
	foreign := prTestSetup(t, svc, otherUser, "Theirs")
	before, _ := svc.ListSessions(ctx, userID, nil, uuid.Nil, 100)
	if _, err := svc.StartSession(ctx, userID, &models.CreateSessionRequest{Force: true, ExerciseIDs: []uuid.UUID{squat, foreign}}); err != ErrExerciseNotFound {
		t.Fatalf("foreign exercise: got %v, want ErrExerciseNotFound", err)
	}
	after, _ := svc.ListSessions(ctx, userID, nil, uuid.Nil, 100)
	if len(after) != len(before) {
		t.Fatalf("a refused start left a workout: %d then %d", len(before), len(after))
	}
}

func TestLoggingAnUnplannedExerciseAddsItLast(t *testing.T) {
	svc, userID := testJymDB(t)
	squat := prTestSetup(t, svc, userID, "Squat")
	curl := prTestSetup(t, svc, userID, "Curl")
	day := planDay(t, svc, userID, squat)
	sess, err := svc.StartSession(context.Background(), userID, &models.CreateSessionRequest{RoutineID: &day, Force: true})
	if err != nil {
		t.Fatalf("start: %v", err)
	}
	logSet(t, svc, userID, sess.ID, curl, 1, 20, 12)
	logSet(t, svc, userID, sess.ID, curl, 2, 20, 10)
	logSet(t, svc, userID, sess.ID, squat, 1, 100, 5)
	if got := listOf(t, svc, userID, sess.ID); got != "Squat:3x5 Curl:-" {
		t.Fatalf("list: %q", got)
	}
}

func TestAddIsIdempotentAndRemoveForgets(t *testing.T) {
	svc, userID := testJymDB(t)
	ctx := context.Background()
	squat := prTestSetup(t, svc, userID, "Squat")
	curl := prTestSetup(t, svc, userID, "Curl")
	day := planDay(t, svc, userID, squat)
	sess, err := svc.StartSession(ctx, userID, &models.CreateSessionRequest{RoutineID: &day, Force: true})
	if err != nil {
		t.Fatalf("start: %v", err)
	}
	for i := 0; i < 2; i++ {
		x, err := svc.AddSessionExercise(ctx, userID, sess.ID, curl)
		if err != nil || x.Position != 2 || x.TargetSets != nil {
			t.Fatalf("add #%d: %+v, %v", i+1, x, err)
		}
	}
	// A plan exercise removed and added back comes back with its plan, last.
	if err := svc.DeleteSessionExercise(ctx, userID, sess.ID, squat); err != nil {
		t.Fatalf("remove squat: %v", err)
	}
	if got := listOf(t, svc, userID, sess.ID); got != "Curl:-" {
		t.Fatalf("after removing squat: %q", got)
	}
	if _, err := svc.AddSessionExercise(ctx, userID, sess.ID, squat); err != nil {
		t.Fatalf("add squat back: %v", err)
	}
	if got := listOf(t, svc, userID, sess.ID); got != "Curl:- Squat:3x5" {
		t.Fatalf("after adding squat back: %q", got)
	}
	// Removing takes the logged sets too.
	logSet(t, svc, userID, sess.ID, curl, 1, 20, 12)
	if err := svc.DeleteSessionExercise(ctx, userID, sess.ID, curl); err != nil {
		t.Fatalf("remove curl: %v", err)
	}
	full, _ := svc.GetSession(ctx, userID, sess.ID)
	if describe(full.Exercises) != "Squat:3x5" || len(full.Sets) != 0 {
		t.Fatalf("after removing curl: %q, %d sets", describe(full.Exercises), len(full.Sets))
	}

	_, stranger := testJymDB(t)
	if _, err := svc.AddSessionExercise(ctx, stranger, sess.ID, curl); err != ErrSessionNotFound {
		t.Fatalf("stranger: got %v, want ErrSessionNotFound", err)
	}
	if _, err := svc.AddSessionExercise(ctx, userID, sess.ID, uuid.New()); err != ErrExerciseNotFound {
		t.Fatalf("unknown exercise: got %v, want ErrExerciseNotFound", err)
	}
}

// The migration's backfill, run again in a transaction that is rolled back.
func TestBackfillGivesOldWorkoutsTheirList(t *testing.T) {
	svc, userID := testJymDB(t)
	ctx := context.Background()
	squat := prTestSetup(t, svc, userID, "Squat")
	bench := prTestSetup(t, svc, userID, "Bench")
	row := prTestSetup(t, svc, userID, "Row")
	curl := prTestSetup(t, svc, userID, "Curl")
	day := planDay(t, svc, userID, squat, bench, row)

	// A finished workout: Curl (unplanned) done first, then Bench. An open one: Row logged, the rest still to do.
	done, _ := svc.StartSession(ctx, userID, &models.CreateSessionRequest{RoutineID: &day, Force: true})
	logSet(t, svc, userID, done.ID, curl, 1, 20, 12)
	logSet(t, svc, userID, done.ID, bench, 1, 80, 5)
	finishSession(t, svc, userID, done.ID)
	open, _ := svc.StartSession(ctx, userID, &models.CreateSessionRequest{RoutineID: &day, Force: true})
	logSet(t, svc, userID, open.ID, row, 1, 60, 8)

	raw, err := os.ReadFile("../../migrations/000039_session_exercises.up.sql")
	if err != nil {
		t.Fatalf("read migration: %v", err)
	}
	// The statements after CREATE TABLE, comment lines dropped (they may hold a semicolon).
	var lines []string
	for _, line := range strings.Split(string(raw)[strings.Index(string(raw), "-- Backfill 1"):], "\n") {
		if !strings.HasPrefix(strings.TrimSpace(line), "--") {
			lines = append(lines, line)
		}
	}
	backfill := strings.Join(lines, "\n")

	tx, err := svc.db.Begin(ctx)
	if err != nil {
		t.Fatalf("begin: %v", err)
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, `DELETE FROM session_exercises`); err != nil {
		t.Fatalf("clear: %v", err)
	}
	for _, stmt := range strings.Split(backfill, ";") {
		if strings.TrimSpace(stmt) == "" {
			continue
		}
		if _, err := tx.Exec(ctx, stmt); err != nil {
			t.Fatalf("backfill: %v", err)
		}
	}
	doneList, _ := listSessionExercises(ctx, tx, done.ID)
	if got := describe(doneList); got != "Curl:- Bench:3x5" {
		t.Fatalf("finished workout: %q", got)
	}
	openList, _ := listSessionExercises(ctx, tx, open.ID)
	if got := describe(openList); got != "Row:3x5 Squat:3x5 Bench:3x5" {
		t.Fatalf("open workout: %q", got)
	}
}
