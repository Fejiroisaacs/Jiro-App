package services

import (
	"context"
	"errors"
	"slices"
	"strings"
	"testing"

	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/models"
)

func TestCatalogueIsValid(t *testing.T) {
	if len(catalogue) != 115 {
		t.Fatalf("%d exercises, want the reviewed 115", len(catalogue))
	}
	keys, names := map[string]bool{}, map[string]bool{}
	last := 0
	for _, c := range catalogue {
		if keys[c.Key] || names[strings.ToLower(c.Name)] {
			t.Errorf("%s: duplicate key or name", c.Name)
		}
		keys[c.Key], names[strings.ToLower(c.Name)] = true, true
		m, ok := canonicalMuscle(c.Muscle)
		if !ok || m != c.Muscle {
			t.Errorf("%s: main muscle %q isn't on the list", c.Name, c.Muscle)
		}
		// Grouped by main muscle, in the list's order.
		at := slices.Index(MuscleGroups, c.Muscle)
		if at < last {
			t.Errorf("%s: out of muscle order", c.Name)
		}
		last = at
		for _, s := range c.Secondary {
			if sm, ok := canonicalMuscle(s); !ok || sm != s || s == c.Muscle {
				t.Errorf("%s: secondary %q", c.Name, s)
			}
		}
		if !slices.Contains([]string{KindWeightReps, KindBodyweight, KindDuration, KindDistance}, c.Kind) {
			t.Errorf("%s: kind %q", c.Name, c.Kind)
		}
		if !slices.Contains(CatalogueEquipment, c.Equipment) {
			t.Errorf("%s: equipment %q", c.Name, c.Equipment)
		}
	}
}

func TestAddFromCatalogue(t *testing.T) {
	svc, userID := testJymDB(t)
	ctx := context.Background()
	// An existing exercise in another case counts as the catalogue's.
	if _, err := svc.CreateExercise(ctx, userID, &models.CreateExerciseRequest{Name: "barbell bench press"}); err != nil {
		t.Fatalf("create: %v", err)
	}
	list, err := svc.ListCatalogue(ctx, userID)
	if err != nil || len(list) != len(catalogue) {
		t.Fatalf("list: %v %d", err, len(list))
	}
	in := map[string]bool{}
	for _, c := range list {
		in[c.Key] = c.InLibrary
	}
	if !in["barbell-bench-press"] || in["pull-up"] {
		t.Fatalf("in_library: bench %v, pull-up %v", in["barbell-bench-press"], in["pull-up"])
	}

	res, err := svc.AddFromCatalogue(ctx, userID, []string{"barbell-bench-press", "pull-up", "plank", "lat-pulldown"})
	if err != nil {
		t.Fatalf("add: %v", err)
	}
	if len(res.Added) != 3 || strings.Join(res.Skipped, ",") != "Barbell Bench Press" {
		t.Fatalf("added %d, skipped %v", len(res.Added), res.Skipped)
	}
	by := map[string]models.Exercise{}
	for _, e := range res.Added {
		by[e.Name] = e
	}
	pull := by["Pull-up"]
	if pull.Kind != KindBodyweight || pull.MuscleGroup == nil || *pull.MuscleGroup != "Back" || strings.Join(pull.SecondaryMuscles, ",") != "Biceps" {
		t.Fatalf("pull-up %+v", pull)
	}
	if by["Plank"].Kind != KindDuration {
		t.Fatalf("plank kind %q", by["Plank"].Kind)
	}

	// A second add skips everything, and the list says so.
	again, err := svc.AddFromCatalogue(ctx, userID, []string{"pull-up", "plank"})
	if err != nil || len(again.Added) != 0 || len(again.Skipped) != 2 {
		t.Fatalf("again: %v %+v", err, again)
	}
	if _, err := svc.AddFromCatalogue(ctx, userID, []string{"pull-up", "no-such-lift"}); !errors.Is(err, ErrUnknownCatalogueKey) {
		t.Fatalf("unknown key: %v", err)
	}

	// Another user's library is untouched and unseen.
	other, otherID := testJymDB(t)
	theirs, err := other.ListCatalogue(ctx, otherID)
	if err != nil {
		t.Fatalf("other list: %v", err)
	}
	for _, c := range theirs {
		if c.InLibrary {
			t.Fatalf("%s shows in another user's library", c.Name)
		}
	}
}
