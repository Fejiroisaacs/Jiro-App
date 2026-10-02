package services

import (
	"context"
	"fmt"
	"strings"
	"testing"

	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/models"
	"github.com/google/uuid"
)

// groupsOf reads groups as "1 1 - 2 2" (- for none).
func groupsOf(groups []*int) string {
	parts := make([]string, len(groups))
	for i, g := range groups {
		parts[i] = "-"
		if g != nil {
			parts[i] = fmt.Sprint(*g)
		}
	}
	return strings.Join(parts, " ")
}

// parseGroups is groupsOf backwards.
func parseGroups(s string) []*int {
	out := []*int{}
	for _, f := range strings.Fields(s) {
		if f == "-" {
			out = append(out, nil)
			continue
		}
		var n int
		fmt.Sscan(f, &n)
		out = append(out, &n)
	}
	return out
}

func TestNormalizeGroups(t *testing.T) {
	for _, c := range []struct{ in, want string }{
		{"- -", "- -"},
		{"1 1", "1 1"},
		{"7 7 7", "1 1 1"},         // a circuit
		{"1", "-"},                 // alone is no superset
		{"2 2 1 1", "1 1 2 2"},     // numbered in order
		{"5 5 - 5 5", "1 1 - 2 2"}, // two runs of one number are two supersets
		{"1 2 1", "- - -"},         // members apart
		{"3 3 - 4", "1 1 - -"},
	} {
		if got := groupsOf(normalizeGroups(parseGroups(c.in))); got != c.want {
			t.Errorf("normalizeGroups(%s) = %s, want %s", c.in, got, c.want)
		}
	}
}

func routineGroups(t *testing.T, svc *JymService, dayID uuid.UUID) string {
	t.Helper()
	items := dayItems(t, svc, dayID)
	groups := make([]*int, len(items))
	for i, it := range items {
		groups[i] = it.SupersetGroup
	}
	return groupsOf(groups)
}

func listGroups(t *testing.T, svc *JymService, userID, sessionID uuid.UUID) string {
	t.Helper()
	sess, err := svc.GetSession(context.Background(), userID, sessionID)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	parts := []string{}
	for _, x := range sess.Exercises {
		g := "-"
		if x.SupersetGroup != nil {
			g = fmt.Sprint(*x.SupersetGroup)
		}
		parts = append(parts, x.ExerciseName+":"+g)
	}
	return strings.Join(parts, " ")
}

func grouped(id uuid.UUID, g int) models.ReplaceItemEntry {
	return models.ReplaceItemEntry{ExerciseID: id, TargetSets: 3, TargetReps: 8, Detailed: true, PlanDetails: models.PlanDetails{SupersetGroup: &g}}
}

func TestRoutineSupersetsAreNormalizedOnSave(t *testing.T) {
	svc, userID := testJymDB(t)
	ctx := context.Background()
	a := prTestSetup(t, svc, userID, "A")
	b := prTestSetup(t, svc, userID, "B")
	c := prTestSetup(t, svc, userID, "C")
	d := prTestSetup(t, svc, userID, "D")
	_, day := splitDay(t, svc, userID, grouped(a, 7), grouped(b, 7), models.ReplaceItemEntry{ExerciseID: c, TargetSets: 3, TargetReps: 8, Detailed: true}, grouped(d, 7))
	if got := routineGroups(t, svc, day); got != "1 1 - -" {
		t.Fatalf("saved groups = %s, want 1 1 - - (D is cut off from the run)", got)
	}
	// An older app reorders B, C, A: it keeps their groups, but apart they're no superset.
	if _, err := svc.ReplaceRoutineItems(ctx, userID, day, []models.ReplaceItemEntry{
		{ExerciseID: b, TargetSets: 3, TargetReps: 8}, {ExerciseID: c, TargetSets: 3, TargetReps: 8}, {ExerciseID: a, TargetSets: 3, TargetReps: 8},
	}); err != nil {
		t.Fatalf("old-app save: %v", err)
	}
	if got := routineGroups(t, svc, day); got != "- - -" {
		t.Fatalf("after the old app split them = %s", got)
	}
}

func TestWorkoutSupersets(t *testing.T) {
	svc, userID := testJymDB(t)
	ctx := context.Background()
	a := prTestSetup(t, svc, userID, "A")
	b := prTestSetup(t, svc, userID, "B")
	c := prTestSetup(t, svc, userID, "C")
	_, day := splitDay(t, svc, userID, grouped(a, 2), grouped(b, 2), models.ReplaceItemEntry{ExerciseID: c, TargetSets: 3, TargetReps: 8, Detailed: true})

	sess, err := svc.StartSession(ctx, userID, &models.CreateSessionRequest{RoutineID: &day, Force: true})
	if err != nil {
		t.Fatalf("start: %v", err)
	}
	if got := listGroups(t, svc, userID, sess.ID); got != "A:1 B:1 C:-" {
		t.Fatalf("start = %s", got)
	}
	// Order and groups together.
	if err := svc.ReorderSessionExercises(ctx, userID, sess.ID, []uuid.UUID{c, a, b}, parseGroups("- 1 1")); err != nil {
		t.Fatalf("reorder with groups: %v", err)
	}
	if got := listGroups(t, svc, userID, sess.ID); got != "C:- A:1 B:1" {
		t.Fatalf("after reorder with groups = %s", got)
	}
	// An older app moves C between them: the pair is split.
	if err := svc.ReorderSessionExercises(ctx, userID, sess.ID, []uuid.UUID{a, c, b}, nil); err != nil {
		t.Fatalf("reorder: %v", err)
	}
	if got := listGroups(t, svc, userID, sess.ID); got != "A:- C:- B:-" {
		t.Fatalf("after C moved between = %s", got)
	}
	// Link A and C, then remove C: A is left alone, so ungrouped.
	if err := svc.ReorderSessionExercises(ctx, userID, sess.ID, []uuid.UUID{a, c, b}, parseGroups("4 4 -")); err != nil {
		t.Fatalf("link: %v", err)
	}
	if got := listGroups(t, svc, userID, sess.ID); got != "A:1 C:1 B:-" {
		t.Fatalf("linked = %s", got)
	}
	if err := svc.DeleteSessionExercise(ctx, userID, sess.ID, c); err != nil {
		t.Fatalf("remove: %v", err)
	}
	if got := listGroups(t, svc, userID, sess.ID); got != "A:- B:-" {
		t.Fatalf("after removing C = %s", got)
	}
	if err := svc.ReorderSessionExercises(ctx, userID, sess.ID, []uuid.UUID{a, b}, parseGroups("1 1")); err != nil {
		t.Fatalf("relink: %v", err)
	}
	// B is in the routine's superset, but added back mid-workout it goes last and ungrouped.
	if err := svc.DeleteSessionExercise(ctx, userID, sess.ID, b); err != nil {
		t.Fatalf("remove b: %v", err)
	}
	back, err := svc.AddSessionExercise(ctx, userID, sess.ID, b)
	if err != nil {
		t.Fatalf("add b back: %v", err)
	}
	if back.SupersetGroup != nil {
		t.Fatalf("B added back mid-workout has group %d; want none", *back.SupersetGroup)
	}

	// Repeat keeps the groups it's given; mismatched lengths are refused.
	rep, err := svc.StartSession(ctx, userID, &models.CreateSessionRequest{RoutineID: &day, ExerciseIDs: []uuid.UUID{c, a, b}, SupersetGroups: parseGroups("- 9 9"), Force: true})
	if err != nil {
		t.Fatalf("repeat: %v", err)
	}
	if got := listGroups(t, svc, userID, rep.ID); got != "C:- A:1 B:1" {
		t.Fatalf("repeat = %s", got)
	}
	if _, err := svc.StartSession(ctx, userID, &models.CreateSessionRequest{ExerciseIDs: []uuid.UUID{a, b}, SupersetGroups: parseGroups("1"), Force: true}); err != ErrExerciseOrder {
		t.Fatalf("mismatched groups: %v, want ErrExerciseOrder", err)
	}
	if err := svc.ReorderSessionExercises(ctx, userID, rep.ID, []uuid.UUID{c, a, b}, parseGroups("1 1")); err != ErrExerciseOrder {
		t.Fatalf("mismatched reorder groups: %v, want ErrExerciseOrder", err)
	}
}

func TestCopiesKeepSupersets(t *testing.T) {
	svc, owner := testJymDB(t)
	_, importer := testJymDB(t)
	ctx := context.Background()
	a := prTestSetup(t, svc, owner, "A")
	b := prTestSetup(t, svc, owner, "B")
	split, _ := splitDay(t, svc, owner, grouped(a, 1), grouped(b, 1))
	share, err := svc.CreateShare(ctx, owner, split, "http://x")
	if err != nil {
		t.Fatalf("share: %v", err)
	}
	copied, err := svc.ImportShare(ctx, importer, uuid.MustParse(share.ShareID))
	if err != nil {
		t.Fatalf("import: %v", err)
	}
	sp, err := svc.GetSplitWithRoutines(ctx, importer, copied)
	if err != nil {
		t.Fatalf("copy: %v", err)
	}
	items := sp.Routines[0].Items
	got := groupsOf([]*int{items[0].SupersetGroup, items[1].SupersetGroup})
	if got != "1 1" {
		t.Fatalf("imported groups = %s", got)
	}
}
