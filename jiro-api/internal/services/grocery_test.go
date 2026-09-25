package services

import (
	"encoding/json"
	"testing"

	"github.com/google/uuid"
)

func TestNormalizeIngredientName(t *testing.T) {
	cases := map[string]string{
		"Feta":                "feta",
		"  feta ":             "feta",
		"Red   Onion":         "red onion",
		"\tCherry tomatoes\n": "cherry tomatoes",
		"":                    "",
	}
	for in, want := range cases {
		if got := normalizeIngredientName(in); got != want {
			t.Errorf("normalizeIngredientName(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestDedupeGroceryCandidates(t *testing.T) {
	r1, r2 := uuid.New(), uuid.New()
	title := "Tacos"
	c := func(item string, rid *uuid.UUID) groceryCandidate {
		src := groceryManualSource
		if rid != nil {
			src = groceryRecipeSource(*rid)
		}
		return groceryCandidate{Item: item, Amount: "1", RecipeID: rid, RecipeTitle: &title, Source: src}
	}
	in := []groceryCandidate{
		c("Feta", &r1),
		c("  feta ", &r1), // same recipe, same name: skipped
		c("Feta", &r2),    // another recipe: kept, the list groups by recipe
		c("Feta", nil),    // typed by hand: kept
		c("   ", &r1),     // no name: skipped
		c("Lime", &r1),
	}
	out, skipped := dedupeGroceryCandidates(in)
	if skipped != 2 {
		t.Errorf("skipped = %d, want 2", skipped)
	}
	var names []string
	for _, o := range out {
		names = append(names, o.Source+":"+o.Item)
	}
	want := []string{groceryRecipeSource(r1) + ":Feta", groceryRecipeSource(r2) + ":Feta", "manual:Feta", groceryRecipeSource(r1) + ":Lime"}
	if len(names) != len(want) {
		t.Fatalf("kept %v, want %v", names, want)
	}
	for i := range want {
		if names[i] != want[i] {
			t.Errorf("kept[%d] = %q, want %q", i, names[i], want[i])
		}
	}
}

func TestDedupeGroceryCandidatesTidiesFields(t *testing.T) {
	long := make([]rune, 300)
	for i := range long {
		long[i] = 'é'
	}
	blank := "   "
	out, _ := dedupeGroceryCandidates([]groceryCandidate{{
		Item: "  Red   onion ", Amount: " 2 ", RecipeTitle: &blank, Source: groceryManualSource,
	}, {
		Item: string(long), Amount: string(long), Source: groceryManualSource,
	}})
	if out[0].Item != "Red onion" || out[0].Amount != "2" || out[0].RecipeTitle != nil {
		t.Errorf("got %+v, want trimmed fields and no blank title", out[0])
	}
	if n := len([]rune(out[1].Item)); n != groceryItemMaxLen {
		t.Errorf("long item cut to %d characters, want %d", n, groceryItemMaxLen)
	}
	if n := len([]rune(out[1].Amount)); n != groceryAmountMaxLen {
		t.Errorf("long amount cut to %d characters, want %d", n, groceryAmountMaxLen)
	}
}

func TestRecipeGroceryCandidatesReadsAmountsLeniently(t *testing.T) {
	id := uuid.New()
	got := recipeGroceryCandidates(id, "Chili", json.RawMessage(`[{"item":"Beans","amount":2},{"item":"Salt"}]`))
	if len(got) != 2 || got[0].Amount != "2" || got[1].Amount != "" {
		t.Fatalf("got %+v", got)
	}
	if got[0].Source != groceryRecipeSource(id) || *got[0].RecipeTitle != "Chili" || *got[0].RecipeID != id {
		t.Errorf("candidate not tied to its recipe: %+v", got[0])
	}
	if groceryTitleSource("  Greek  Bowls ") != "title:greek bowls" {
		t.Errorf("title source not normalised: %q", groceryTitleSource("  Greek  Bowls "))
	}
}
