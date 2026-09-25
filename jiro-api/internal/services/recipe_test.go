package services

import (
	"encoding/json"
	"testing"
)

func TestApplyModificationsMatchesNamesIgnoringCase(t *testing.T) {
	base := json.RawMessage(`[{"item":"Feta","amount":"100 g"},{"item":"Red onion","amount":"1"}]`)
	mods := json.RawMessage(`[{"item":"feta","change":"200 g"},{"item":"  red  ONION ","change":"2"},{"item":"Mint","change":"a handful"},{"item":"mint","change":"two handfuls"}]`)

	var got []struct{ Item, Amount string }
	if err := json.Unmarshal(applyModifications(base, mods), &got); err != nil {
		t.Fatal(err)
	}
	want := []struct{ Item, Amount string }{
		{"Feta", "200 g"},        // updated in place, the recipe's spelling kept
		{"Red onion", "2"},       // whitespace and case ignored
		{"Mint", "two handfuls"}, // added once, then updated by the second mention
	}
	if len(got) != len(want) {
		t.Fatalf("got %d ingredients %+v, want %+v", len(got), got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("ingredient %d = %+v, want %+v", i, got[i], want[i])
		}
	}
}
