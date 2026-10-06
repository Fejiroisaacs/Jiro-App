package services

import (
	"errors"
	"strings"
)

// MuscleGroups is the one muscle list, in display order; migration 000042 holds the same list in its CHECKs.
var MuscleGroups = []string{"Chest", "Back", "Shoulders", "Biceps", "Triceps", "Legs", "Glutes", "Core", "Cardio", "Other"}

// ErrInvalidMuscle is a muscle that isn't on the list.
var ErrInvalidMuscle = errors.New("muscle groups must be one of: " + strings.Join(MuscleGroups, ", "))

// muscleSynonyms are names the list folds into one of its own (as migration 000042 does).
var muscleSynonyms = map[string]string{"quadriceps": "Legs", "quads": "Legs", "hamstrings": "Legs", "calves": "Legs", "abs": "Core"}

// canonicalMuscle is a name's list spelling, ignoring case and spaces; false when it isn't on the list.
func canonicalMuscle(name string) (string, bool) {
	key := strings.ToLower(strings.TrimSpace(name))
	for _, m := range MuscleGroups {
		if strings.ToLower(m) == key {
			return m, true
		}
	}
	m, ok := muscleSynonyms[key]
	return m, ok
}

// cleanPrimary is the primary as saved: nil for nil, "" for blank (clear), else its list name, or ErrInvalidMuscle.
func cleanPrimary(name *string) (*string, error) {
	if name == nil {
		return nil, nil
	}
	if strings.TrimSpace(*name) == "" {
		blank := ""
		return &blank, nil
	}
	m, ok := canonicalMuscle(*name)
	if !ok {
		return nil, ErrInvalidMuscle
	}
	return &m, nil
}

// cleanSecondaries is the list spelling of each, without repeats or the primary, in the list's order.
func cleanSecondaries(names []string, primary string) ([]string, error) {
	want := map[string]bool{}
	for _, n := range names {
		m, ok := canonicalMuscle(n)
		if !ok {
			return nil, ErrInvalidMuscle
		}
		want[m] = true
	}
	out := []string{}
	for _, m := range MuscleGroups {
		if want[m] && m != primary {
			out = append(out, m)
		}
	}
	return out, nil
}
