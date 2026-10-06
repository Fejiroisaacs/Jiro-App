package services

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/models"
	"github.com/google/uuid"
)

// detailedDay makes a split day: Squat 4 × 6-10 at RPE 8, 2:00 rest, a cue, supersetted with Bench 3 × 5.
func detailedDay(t *testing.T, svc *JymService, userID uuid.UUID) (splitID, dayID uuid.UUID) {
	t.Helper()
	ctx := context.Background()
	squat := prTestSetup(t, svc, userID, "Squat")
	bench := prTestSetup(t, svc, userID, "Bench")
	split, err := svc.CreateSplit(ctx, userID, &models.CreateSplitRequest{Name: "Copy " + uuid.NewString()[:6]})
	if err != nil {
		t.Fatalf("split: %v", err)
	}
	day, err := svc.CreateRoutine(ctx, userID, split.ID, &models.CreateRoutineRequest{Name: "Legs", DayOrder: 1})
	if err != nil {
		t.Fatalf("day: %v", err)
	}
	items := []models.ReplaceItemEntry{
		{ExerciseID: squat, TargetSets: 4, TargetReps: 6, Detailed: true, PlanDetails: models.PlanDetails{
			TargetRepsMax: ip(10), TargetRPE: ip(8), RestSeconds: ip(120), Notes: strp("Brace"), SupersetGroup: ip(1)}},
		{ExerciseID: bench, TargetSets: 3, TargetReps: 5, Detailed: true, PlanDetails: models.PlanDetails{SupersetGroup: ip(1)}},
	}
	if _, err := svc.ReplaceRoutineItems(ctx, userID, day.ID, items); err != nil {
		t.Fatalf("items: %v", err)
	}
	return split.ID, day.ID
}

// planOf is a routine's items as one comparable string.
func planOf(r *models.RoutineWithItems) string {
	out := ""
	for _, it := range r.Items {
		out += fmt.Sprintf("%s:%dx%d-%v rpe%v rest%v ss%v %v|", it.ExerciseName, it.TargetSets, it.TargetReps,
			orNil(it.TargetRepsMax), orNil(it.TargetRPE), orNil(it.RestSeconds), orNil(it.SupersetGroup), orNil(it.Notes))
	}
	return out
}

func orNil[T any](p *T) any {
	if p == nil {
		return nil
	}
	return *p
}

func TestSaveDayAsTemplateCopiesTheWholePlan(t *testing.T) {
	svc, userID := testJymDB(t)
	ctx := context.Background()
	splitID, dayID := detailedDay(t, svc, userID)

	tmpl, err := svc.CopyRoutine(ctx, userID, dayID, nil, nil)
	if err != nil {
		t.Fatalf("copy: %v", err)
	}
	if tmpl.SplitID != nil || tmpl.Name != "Legs" || tmpl.ID == dayID {
		t.Fatalf("template: split %v name %q id %v", tmpl.SplitID, tmpl.Name, tmpl.ID)
	}
	split, err := svc.GetSplitWithRoutines(ctx, userID, splitID)
	if err != nil {
		t.Fatalf("split: %v", err)
	}
	day := split.Routines[0]
	if len(split.Routines) != 1 || planOf(&day) != planOf(tmpl) {
		t.Fatalf("day %q, template %q", planOf(&day), planOf(tmpl))
	}
	got, err := svc.GetTemplate(ctx, userID, tmpl.ID)
	if err != nil || planOf(got) != planOf(tmpl) {
		t.Fatalf("get template: %v %q", err, planOf(got))
	}
	// Editing the template leaves the day alone.
	if _, err := svc.ReplaceRoutineItems(ctx, userID, tmpl.ID, nil); err != nil {
		t.Fatalf("clear template: %v", err)
	}
	split, _ = svc.GetSplitWithRoutines(ctx, userID, splitID)
	if len(split.Routines[0].Items) != 2 {
		t.Fatalf("day lost its items: %d", len(split.Routines[0].Items))
	}
}

func TestAddTemplateToSplitLandsLast(t *testing.T) {
	svc, userID := testJymDB(t)
	ctx := context.Background()
	splitID, dayID := detailedDay(t, svc, userID)
	tmpl, err := svc.CopyRoutine(ctx, userID, dayID, nil, strp("  Legs B  "))
	if err != nil {
		t.Fatalf("to template: %v", err)
	}
	if tmpl.Name != "Legs B" {
		t.Fatalf("name %q", tmpl.Name)
	}
	added, err := svc.CopyRoutine(ctx, userID, tmpl.ID, &splitID, nil)
	if err != nil {
		t.Fatalf("to split: %v", err)
	}
	if added.SplitID == nil || *added.SplitID != splitID || added.DayOrder != 2 || added.Name != "Legs B" {
		t.Fatalf("added: %+v", added.Routine)
	}
	if planOf(added) != planOf(tmpl) {
		t.Fatalf("plan %q vs %q", planOf(added), planOf(tmpl))
	}
	templates, _ := svc.ListTemplates(ctx, userID)
	if len(templates) != 1 || templates[0].ID != tmpl.ID {
		t.Fatalf("the template should stay: %d", len(templates))
	}
	if _, err := svc.GetTemplate(ctx, userID, added.ID); !errors.Is(err, ErrRoutineNotFound) {
		t.Fatalf("a split day is not a template: %v", err)
	}
}

func TestRenameTemplate(t *testing.T) {
	svc, userID := testJymDB(t)
	ctx := context.Background()
	_, dayID := detailedDay(t, svc, userID)
	tmpl, err := svc.CopyRoutine(ctx, userID, dayID, nil, nil)
	if err != nil {
		t.Fatalf("copy: %v", err)
	}
	rt, err := svc.UpdateRoutine(ctx, userID, tmpl.ID, &models.UpdateRoutineRequest{Name: strp("Lower")})
	if err != nil || rt.Name != "Lower" {
		t.Fatalf("rename: %v %+v", err, rt)
	}
}

func TestCopyRefusesOthersDaysAndSplits(t *testing.T) {
	svc, userID := testJymDB(t)
	other, otherID := testJymDB(t)
	ctx := context.Background()
	_, dayID := detailedDay(t, svc, userID)
	otherSplit, otherDay := detailedDay(t, other, otherID)

	if _, err := svc.CopyRoutine(ctx, userID, otherDay, nil, nil); !errors.Is(err, ErrRoutineNotFound) {
		t.Fatalf("copying another's day: %v", err)
	}
	if _, err := svc.CopyRoutine(ctx, userID, dayID, &otherSplit, nil); !errors.Is(err, ErrSplitNotFound) {
		t.Fatalf("copying into another's split: %v", err)
	}
	if _, err := svc.UpdateRoutine(ctx, userID, otherDay, &models.UpdateRoutineRequest{Name: strp("x")}); !errors.Is(err, ErrRoutineNotFound) {
		t.Fatalf("renaming another's day: %v", err)
	}
	if _, err := svc.GetTemplate(ctx, otherID, dayID); !errors.Is(err, ErrRoutineNotFound) {
		t.Fatalf("reading another's: %v", err)
	}
}
