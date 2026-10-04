package services

import (
	"context"
	"errors"
	"os"
	"strings"
	"testing"

	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/models"
	"github.com/google/uuid"
)

func createWith(t *testing.T, svc *JymService, userID uuid.UUID, name, primary string, secondaries ...string) (*models.Exercise, error) {
	t.Helper()
	return svc.CreateExercise(context.Background(), userID, &models.CreateExerciseRequest{
		Name: name + " " + uuid.NewString()[:4], MuscleGroup: &primary, SecondaryMuscles: secondaries,
	})
}

func muscles(ex *models.Exercise) string {
	p := "-"
	if ex.MuscleGroup != nil {
		p = *ex.MuscleGroup
	}
	return p + "|" + strings.Join(ex.SecondaryMuscles, ",")
}

func TestMusclesAreSavedFromTheList(t *testing.T) {
	svc, userID := testJymDB(t)
	ex, err := createWith(t, svc, userID, "Bench", " chest ", "shoulders", "Triceps", "triceps", "Chest")
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	// List spelling, no repeats, list order, and never the primary.
	if got := muscles(ex); got != "Chest|Shoulders,Triceps" {
		t.Fatalf("saved %q, want Chest|Shoulders,Triceps", got)
	}
	if _, err := createWith(t, svc, userID, "Pulldown", "Lats"); !errors.Is(err, ErrInvalidMuscle) {
		t.Fatalf("Lats as primary: %v, want ErrInvalidMuscle", err)
	}
	if _, err := createWith(t, svc, userID, "Row", "Back", "Lats"); !errors.Is(err, ErrInvalidMuscle) {
		t.Fatalf("Lats as secondary: %v, want ErrInvalidMuscle", err)
	}
	// A synonym folds into its group; no primary means no secondaries.
	squat, err := createWith(t, svc, userID, "Squat", "Quads", "glutes")
	if err != nil || muscles(squat) != "Legs|Glutes" {
		t.Fatalf("quads = %q, %v; want Legs|Glutes", muscles(squat), err)
	}
	none, err := createWith(t, svc, userID, "Mobility", "", "Core")
	if err != nil || muscles(none) != "-|" {
		t.Fatalf("no primary = %q, %v; want no muscles at all", muscles(none), err)
	}
}

func TestUpdatingMuscles(t *testing.T) {
	svc, userID := testJymDB(t)
	ctx := context.Background()
	ex, err := createWith(t, svc, userID, "Dip", "Chest", "Triceps", "Shoulders")
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	// Left out, the secondaries stay; a new primary leaves them.
	tri := "triceps"
	got, err := svc.UpdateExercise(ctx, userID, ex.ID, &models.UpdateExerciseRequest{MuscleGroup: &tri})
	if err != nil || muscles(got) != "Triceps|Shoulders" {
		t.Fatalf("primary to triceps = %q, %v; want Triceps|Shoulders", muscles(got), err)
	}
	got, err = svc.UpdateExercise(ctx, userID, ex.ID, &models.UpdateExerciseRequest{SecondaryMuscles: []string{"Chest", "Triceps"}})
	if err != nil || muscles(got) != "Triceps|Chest" {
		t.Fatalf("new secondaries = %q, %v; want Triceps|Chest", muscles(got), err)
	}
	got, err = svc.UpdateExercise(ctx, userID, ex.ID, &models.UpdateExerciseRequest{SecondaryMuscles: []string{}})
	if err != nil || muscles(got) != "Triceps|" {
		t.Fatalf("[] = %q, %v; want none", muscles(got), err)
	}
	// Clearing the primary clears the secondaries too.
	if _, err := svc.UpdateExercise(ctx, userID, ex.ID, &models.UpdateExerciseRequest{SecondaryMuscles: []string{"Chest"}}); err != nil {
		t.Fatalf("set: %v", err)
	}
	blank := ""
	got, err = svc.UpdateExercise(ctx, userID, ex.ID, &models.UpdateExerciseRequest{MuscleGroup: &blank})
	if err != nil || muscles(got) != "-|" {
		t.Fatalf("cleared primary = %q, %v; want no muscles", muscles(got), err)
	}
	bad := "Lats"
	if _, err := svc.UpdateExercise(ctx, userID, ex.ID, &models.UpdateExerciseRequest{MuscleGroup: &bad}); !errors.Is(err, ErrInvalidMuscle) {
		t.Fatalf("Lats: %v, want ErrInvalidMuscle", err)
	}
}

func TestLibraryFilterFindsSecondaries(t *testing.T) {
	svc, userID := testJymDB(t)
	ctx := context.Background()
	bench, _ := createWith(t, svc, userID, "Bench", "Chest", "Triceps")
	push, _ := createWith(t, svc, userID, "Pushdown", "Triceps")
	curl, _ := createWith(t, svc, userID, "Curl", "Biceps")
	got, err := svc.ListExercises(ctx, userID, "", "triceps")
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	ids := map[uuid.UUID]bool{}
	for _, e := range got {
		ids[e.ID] = true
	}
	if len(got) != 2 || !ids[bench.ID] || !ids[push.ID] || ids[curl.ID] {
		t.Fatalf("triceps filter found %d; want the pushdown and the bench (secondary)", len(got))
	}
	// Getting one carries its secondaries.
	one, err := svc.GetExerciseWithHistory(ctx, userID, bench.ID, nil)
	if err != nil || strings.Join(one.SecondaryMuscles, ",") != "Triceps" {
		t.Fatalf("get = %v, %v", one.SecondaryMuscles, err)
	}
}

func TestImportsKeepSecondaryMuscles(t *testing.T) {
	svc, owner := testJymDB(t)
	_, importer := testJymDB(t)
	ctx := context.Background()
	bench, _ := createWith(t, svc, owner, "Bench", "Chest", "Triceps", "Shoulders")
	split, _ := splitDay(t, svc, owner, models.ReplaceItemEntry{ExerciseID: bench.ID, TargetSets: 3, TargetReps: 8, Detailed: true})
	share, err := svc.CreateShare(ctx, owner, split, "http://x")
	if err != nil {
		t.Fatalf("share: %v", err)
	}
	if _, err := svc.ImportShare(ctx, importer, uuid.MustParse(share.ShareID)); err != nil {
		t.Fatalf("import: %v", err)
	}
	list, err := svc.ListExercises(ctx, importer, "", "")
	if err != nil || len(list) != 1 || muscles(&list[0]) != "Chest|Shoulders,Triceps" {
		t.Fatalf("imported exercises %+v, %v; want Chest|Shoulders,Triceps", list, err)
	}
}

// The migration's mapping, run again in a transaction that is rolled back.
func TestMigrationMapsStoredMuscleNames(t *testing.T) {
	svc, userID := testJymDB(t)
	ctx := context.Background()
	raw, err := os.ReadFile("../../migrations/000042_secondary_muscles.up.sql")
	if err != nil {
		t.Fatalf("read migration: %v", err)
	}
	lines := []string{}
	for _, l := range strings.Split(string(raw), "\n") {
		if !strings.HasPrefix(strings.TrimSpace(l), "--") {
			lines = append(lines, l)
		}
	}
	update := strings.TrimSpace(strings.Split(strings.Join(lines, "\n"), ";")[0])
	if !strings.HasPrefix(update, "UPDATE exercises") {
		t.Fatalf("first statement is not the mapping: %.60s", update)
	}

	tx, err := svc.db.Begin(ctx)
	if err != nil {
		t.Fatalf("begin: %v", err)
	}
	defer tx.Rollback(ctx)
	// Stored names from before the list.
	if _, err := tx.Exec(ctx, `ALTER TABLE exercises DROP CONSTRAINT exercises_muscle_group_listed`); err != nil {
		t.Fatalf("drop check: %v", err)
	}
	for _, c := range [][2]string{{"a", "chest "}, {"b", "CHEST"}, {"c", "Hamstrings"}, {"d", "Lats"}, {"e", "  "}} {
		if _, err := tx.Exec(ctx, `INSERT INTO exercises (user_id, name, muscle_group) VALUES ($1, $2, $3)`, userID, "M "+c[0], c[1]); err != nil {
			t.Fatalf("seed %s: %v", c[0], err)
		}
	}
	if _, err := tx.Exec(ctx, update); err != nil {
		t.Fatalf("mapping: %v", err)
	}
	rows, err := tx.Query(ctx, `SELECT name, COALESCE(muscle_group, '-') FROM exercises WHERE user_id = $1 AND name LIKE 'M %' ORDER BY name`, userID)
	if err != nil {
		t.Fatalf("read: %v", err)
	}
	got := []string{}
	for rows.Next() {
		var n, g string
		if err := rows.Scan(&n, &g); err != nil {
			t.Fatalf("scan: %v", err)
		}
		got = append(got, strings.TrimPrefix(n, "M ")+":"+g)
	}
	rows.Close()
	if want := "a:Chest b:Chest c:Legs d:Other e:-"; strings.Join(got, " ") != want {
		t.Fatalf("mapped %q, want %q", strings.Join(got, " "), want)
	}
}
