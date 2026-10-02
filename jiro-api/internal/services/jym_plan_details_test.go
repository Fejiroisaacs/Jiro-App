package services

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/models"
	"github.com/google/uuid"
)

func ip(n int) *int         { return &n }
func strp(v string) *string { return &v }

// fullPlan is 3 × 8–12 at RPE 8, 2 min rest, with a cue.
func fullPlan(exerciseID uuid.UUID) models.ReplaceItemEntry {
	return models.ReplaceItemEntry{
		ExerciseID: exerciseID, TargetSets: 3, TargetReps: 8, Detailed: true,
		PlanDetails: models.PlanDetails{TargetRepsMax: ip(12), TargetRPE: ip(8), RestSeconds: ip(120), Notes: strp("  Pause at the bottom ")},
	}
}

// planString is "sets×reps-max@rpe/rest:note", "-" for an unset part.
func planString(sets, reps int, d models.PlanDetails) string {
	v := func(p *int) string {
		if p == nil {
			return "-"
		}
		return fmt.Sprint(*p)
	}
	note := "-"
	if d.Notes != nil {
		note = *d.Notes
	}
	return fmt.Sprintf("%dx%d-%s@%s/%s:%s", sets, reps, v(d.TargetRepsMax), v(d.TargetRPE), v(d.RestSeconds), note)
}

const wantFull = "3x8-12@8/120:Pause at the bottom"

// splitDay makes a split with one day holding these entries.
func splitDay(t *testing.T, svc *JymService, userID uuid.UUID, entries ...models.ReplaceItemEntry) (uuid.UUID, uuid.UUID) {
	t.Helper()
	ctx := context.Background()
	split, err := svc.CreateSplit(ctx, userID, &models.CreateSplitRequest{Name: "Detail " + uuid.NewString()[:6]})
	if err != nil {
		t.Fatalf("split: %v", err)
	}
	day, err := svc.CreateRoutine(ctx, userID, split.ID, &models.CreateRoutineRequest{Name: "Day", DayOrder: 1})
	if err != nil {
		t.Fatalf("day: %v", err)
	}
	if _, err := svc.ReplaceRoutineItems(ctx, userID, day.ID, entries); err != nil {
		t.Fatalf("items: %v", err)
	}
	return split.ID, day.ID
}

func dayItems(t *testing.T, svc *JymService, dayID uuid.UUID) []models.RoutineItemWithExercise {
	t.Helper()
	items, err := svc.listRoutineItems(context.Background(), dayID)
	if err != nil {
		t.Fatalf("items: %v", err)
	}
	return items
}

func TestPlanDetailsSaveAndSurviveAnOlderApp(t *testing.T) {
	svc, userID := testJymDB(t)
	ctx := context.Background()
	row := prTestSetup(t, svc, userID, "Row")
	curl := prTestSetup(t, svc, userID, "Curl")
	_, day := splitDay(t, svc, userID, fullPlan(row), models.ReplaceItemEntry{ExerciseID: curl, TargetSets: 2, TargetReps: 10, Detailed: true})

	items := dayItems(t, svc, day)
	if got := planString(items[0].TargetSets, items[0].TargetReps, items[0].PlanDetails); got != wantFull {
		t.Fatalf("saved = %q, want %q (note trimmed)", got, wantFull)
	}

	// An older app reorders the day and knows nothing of the details: they stay.
	if _, err := svc.ReplaceRoutineItems(ctx, userID, day, []models.ReplaceItemEntry{
		{ExerciseID: curl, TargetSets: 2, TargetReps: 10},
		{ExerciseID: row, TargetSets: 3, TargetReps: 8},
	}); err != nil {
		t.Fatalf("old-app save: %v", err)
	}
	items = dayItems(t, svc, day)
	if items[1].ExerciseID != row || planString(items[1].TargetSets, items[1].TargetReps, items[1].PlanDetails) != wantFull {
		t.Fatalf("after an old-app save: %+v", items[1])
	}

	// The new app clearing them clears them.
	if _, err := svc.ReplaceRoutineItems(ctx, userID, day, []models.ReplaceItemEntry{{ExerciseID: row, TargetSets: 3, TargetReps: 8, Detailed: true}}); err != nil {
		t.Fatalf("clear: %v", err)
	}
	if got := planString(3, 8, dayItems(t, svc, day)[0].PlanDetails); got != "3x8--@-/-:-" {
		t.Fatalf("cleared = %q", got)
	}
}

func TestPlanDetailsAreChecked(t *testing.T) {
	svc, userID := testJymDB(t)
	ctx := context.Background()
	ex := prTestSetup(t, svc, userID, "Press")
	_, day := splitDay(t, svc, userID)

	bad := models.ReplaceItemEntry{ExerciseID: ex, TargetSets: 3, TargetReps: 10, Detailed: true, PlanDetails: models.PlanDetails{TargetRepsMax: ip(8)}}
	if _, err := svc.ReplaceRoutineItems(ctx, userID, day, []models.ReplaceItemEntry{bad}); !errors.Is(err, ErrInvalidPlan) {
		t.Fatalf("10 up to 8: %v, want ErrInvalidPlan", err)
	}
	// "8 up to 8" is just 8; a blank note is none.
	same := models.ReplaceItemEntry{ExerciseID: ex, TargetSets: 3, TargetReps: 8, Detailed: true, PlanDetails: models.PlanDetails{TargetRepsMax: ip(8), Notes: strp("   ")}}
	if _, err := svc.ReplaceRoutineItems(ctx, userID, day, []models.ReplaceItemEntry{same}); err != nil {
		t.Fatalf("8 up to 8: %v", err)
	}
	if got := planString(3, 8, dayItems(t, svc, day)[0].PlanDetails); got != "3x8--@-/-:-" {
		t.Fatalf("8 up to 8 = %q", got)
	}
}

func TestWorkoutsKeepThePlanDetailsTheyStartedWith(t *testing.T) {
	svc, userID := testJymDB(t)
	ctx := context.Background()
	row := prTestSetup(t, svc, userID, "Row")
	_, day := splitDay(t, svc, userID, fullPlan(row))

	sess, err := svc.StartSession(ctx, userID, &models.CreateSessionRequest{RoutineID: &day, Force: true})
	if err != nil {
		t.Fatalf("start: %v", err)
	}
	x := sess.Exercises[0]
	if got := planString(*x.TargetSets, *x.TargetReps, x.PlanDetails); got != wantFull {
		t.Fatalf("start list = %q", got)
	}
	if got := planString(sess.Targets[0].TargetSets, sess.Targets[0].TargetReps, sess.Targets[0].PlanDetails); got != wantFull {
		t.Fatalf("targets (older apps) = %q", got)
	}
	// Editing the plan mid-workout leaves the workout alone.
	if _, err := svc.ReplaceRoutineItems(ctx, userID, day, []models.ReplaceItemEntry{{ExerciseID: row, TargetSets: 5, TargetReps: 5, Detailed: true}}); err != nil {
		t.Fatalf("edit: %v", err)
	}
	got, err := svc.GetSession(ctx, userID, sess.ID)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if s := planString(*got.Exercises[0].TargetSets, *got.Exercises[0].TargetReps, got.Exercises[0].PlanDetails); s != wantFull {
		t.Fatalf("after the edit = %q", s)
	}

	// Removed and added back, or started as a Repeat, it takes the routine's details as they are now.
	if _, err := svc.ReplaceRoutineItems(ctx, userID, day, []models.ReplaceItemEntry{fullPlan(row)}); err != nil {
		t.Fatalf("restore: %v", err)
	}
	if err := svc.DeleteSessionExercise(ctx, userID, sess.ID, row); err != nil {
		t.Fatalf("remove: %v", err)
	}
	back, err := svc.AddSessionExercise(ctx, userID, sess.ID, row)
	if err != nil {
		t.Fatalf("add back: %v", err)
	}
	if s := planString(*back.TargetSets, *back.TargetReps, back.PlanDetails); s != wantFull {
		t.Fatalf("added back = %q", s)
	}
	rep, err := svc.StartSession(ctx, userID, &models.CreateSessionRequest{RoutineID: &day, ExerciseIDs: []uuid.UUID{row}, Force: true})
	if err != nil {
		t.Fatalf("repeat: %v", err)
	}
	if s := planString(*rep.Exercises[0].TargetSets, *rep.Exercises[0].TargetReps, rep.Exercises[0].PlanDetails); s != wantFull {
		t.Fatalf("repeat = %q", s)
	}
}

func TestCopiesKeepPlanDetails(t *testing.T) {
	svc, owner := testJymDB(t)
	_, importer := testJymDB(t)
	ctx := context.Background()
	row := prTestSetup(t, svc, owner, "Row")
	split, day := splitDay(t, svc, owner, fullPlan(row))

	check := func(what string, splitID uuid.UUID, userID uuid.UUID) {
		t.Helper()
		sp, err := svc.GetSplitWithRoutines(ctx, userID, splitID)
		if err != nil {
			t.Fatalf("%s: %v", what, err)
		}
		it := sp.Routines[0].Items[0]
		if got := planString(it.TargetSets, it.TargetReps, it.PlanDetails); got != wantFull {
			t.Fatalf("%s = %q", what, got)
		}
	}
	check("the split", split, owner)

	share, err := svc.CreateShare(ctx, owner, split, "http://x")
	if err != nil {
		t.Fatalf("share: %v", err)
	}
	shareID := uuid.MustParse(share.ShareID)
	preview, err := svc.GetSharePreview(ctx, shareID)
	if err != nil {
		t.Fatalf("preview: %v", err)
	}
	pe := preview.Routines[0].Exercises[0]
	if got := planString(pe.TargetSets, pe.TargetReps, pe.PlanDetails); got != wantFull {
		t.Fatalf("share preview = %q", got)
	}
	copied, err := svc.ImportShare(ctx, importer, shareID)
	if err != nil {
		t.Fatalf("import share: %v", err)
	}
	check("a share import", copied, importer)

	public := "public"
	if _, err := svc.UpdateSplit(ctx, owner, split, &models.UpdateSplitRequest{Visibility: &public}); err != nil {
		t.Fatalf("publish: %v", err)
	}
	detail, err := svc.GetPublicSplit(ctx, split)
	if err != nil {
		t.Fatalf("public: %v", err)
	}
	de := detail.Routines[0].Exercises[0]
	if got := planString(de.TargetSets, de.TargetReps, de.PlanDetails); got != wantFull {
		t.Fatalf("public preview = %q", got)
	}
	_, other := testJymDB(t)
	pub, err := svc.ImportPublicSplit(ctx, other, split)
	if err != nil {
		t.Fatalf("import public: %v", err)
	}
	check("a public import", pub, other)

	// A template from a workout takes the workout's plan, not an average of what was done.
	sess, err := svc.StartSession(ctx, owner, &models.CreateSessionRequest{RoutineID: &day, Force: true})
	if err != nil {
		t.Fatalf("start: %v", err)
	}
	logSet(t, svc, owner, sess.ID, row, 1, 60, 11)
	tpl, err := svc.CreateTemplateFromSession(ctx, owner, sess.ID, "From the workout")
	if err != nil {
		t.Fatalf("template: %v", err)
	}
	ti := tpl.Items[0]
	if got := planString(ti.TargetSets, ti.TargetReps, ti.PlanDetails); got != wantFull {
		t.Fatalf("template = %q", got)
	}
	list, err := svc.ListTemplates(ctx, owner)
	if err != nil {
		t.Fatalf("templates: %v", err)
	}
	for _, l := range list {
		if l.ID == tpl.ID {
			if got := planString(l.Items[0].TargetSets, l.Items[0].TargetReps, l.Items[0].PlanDetails); got != wantFull {
				t.Fatalf("listed template = %q", got)
			}
		}
	}
}
