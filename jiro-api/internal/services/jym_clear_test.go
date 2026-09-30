package services

import (
	"context"
	"strings"
	"testing"

	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/models"
	"github.com/google/uuid"
)

func TestEmptyTextClearsExerciseFieldsAndSetNotes(t *testing.T) {
	svc, userID := testJymDB(t)
	ctx := context.Background()
	mg, notes, blank := "Chest", "Elbows in", ""
	ex, err := svc.CreateExercise(ctx, userID, &models.CreateExerciseRequest{Name: "Clear Me", MuscleGroup: &mg, Notes: &notes})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	// Leaving fields out keeps them.
	kept, err := svc.UpdateExercise(ctx, userID, ex.ID, &models.UpdateExerciseRequest{})
	if err != nil || kept.MuscleGroup == nil || *kept.MuscleGroup != "Chest" || kept.Notes == nil {
		t.Fatalf("empty update changed fields: %+v, %v", kept, err)
	}
	cleared, err := svc.UpdateExercise(ctx, userID, ex.ID, &models.UpdateExerciseRequest{MuscleGroup: &blank, Notes: &blank})
	if err != nil || cleared.MuscleGroup != nil || cleared.Notes != nil {
		t.Fatalf("'' did not clear: %+v, %v", cleared, err)
	}

	sess := startSession(t, svc, userID, "")
	note := "Felt heavy"
	set, err := svc.LogSet(ctx, userID, sess, &models.CreateSetRequest{ExerciseID: ex.ID, SetNumber: 1, Weight: 60, RepsPerformed: 5, ExerciseNote: &note})
	if err != nil {
		t.Fatalf("log: %v", err)
	}
	updated, err := svc.UpdateSet(ctx, userID, set.ID, &models.UpdateSetRequest{ExerciseNote: &blank})
	if err != nil || updated.ExerciseNote != nil {
		t.Fatalf("'' did not clear the set note: %+v, %v", updated, err)
	}
}

func TestMuscleGroupAndTagFiltersIgnoreCase(t *testing.T) {
	svc, userID := testJymDB(t)
	ctx := context.Background()
	for _, g := range []string{"Chest", "chest ", "Legs"} {
		mg := g
		if _, err := svc.CreateExercise(ctx, userID, &models.CreateExerciseRequest{Name: "Ex " + g + uuid.NewString()[:4], MuscleGroup: &mg}); err != nil {
			t.Fatalf("create: %v", err)
		}
	}
	got, err := svc.ListExercises(ctx, userID, "", "CHEST")
	if err != nil || len(got) != 2 {
		t.Fatalf("filter CHEST: %d exercises, %v; want 2", len(got), err)
	}

	tag := "Tag" + uuid.NewString()[:8]
	split, err := svc.CreateSplit(ctx, userID, &models.CreateSplitRequest{Name: "Tagged", Tags: []string{tag}})
	if err != nil {
		t.Fatalf("split: %v", err)
	}
	public := "public"
	if _, err := svc.UpdateSplit(ctx, userID, split.ID, &models.UpdateSplitRequest{Visibility: &public}); err != nil {
		t.Fatalf("publish: %v", err)
	}
	found, err := svc.ListPublicSplits(ctx, "", " "+strings.ToLower(tag)+" ", "", 20, 0)
	if err != nil || len(found) != 1 || found[0].ID != split.ID {
		t.Fatalf("tag in another case: %+v, %v", found, err)
	}
}
