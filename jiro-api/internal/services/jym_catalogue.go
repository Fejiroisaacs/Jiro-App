package services

import (
	"context"
	"errors"
	"strings"

	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/models"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// CatalogueExercise is one built-in exercise users can copy into their library (J20). Equipment is a catalogue-only
// label until exercises have one (J19).
type CatalogueExercise struct {
	Key       string
	Name      string
	Muscle    string
	Secondary []string
	Kind      string
	Equipment string
}

// CatalogueEquipment is the equipment chips' order.
var CatalogueEquipment = []string{"Barbell", "Dumbbell", "Kettlebell", "Machine", "Cable", "Bodyweight", "Other"}

// ErrUnknownCatalogueKey is an add naming an exercise the catalogue doesn't have.
var ErrUnknownCatalogueKey = errors.New("unknown catalogue exercise")

// catalogue is the reviewed list in docs/JYM-CATALOGUE.md, grouped by main muscle in MuscleGroups order.
var catalogue = []CatalogueExercise{
	{Key: "barbell-bench-press", Name: "Barbell Bench Press", Muscle: "Chest", Secondary: []string{"Triceps", "Shoulders"}, Kind: KindWeightReps, Equipment: "Barbell"},
	{Key: "incline-barbell-bench-press", Name: "Incline Barbell Bench Press", Muscle: "Chest", Secondary: []string{"Shoulders", "Triceps"}, Kind: KindWeightReps, Equipment: "Barbell"},
	{Key: "decline-barbell-bench-press", Name: "Decline Barbell Bench Press", Muscle: "Chest", Secondary: []string{"Triceps"}, Kind: KindWeightReps, Equipment: "Barbell"},
	{Key: "dumbbell-bench-press", Name: "Dumbbell Bench Press", Muscle: "Chest", Secondary: []string{"Triceps", "Shoulders"}, Kind: KindWeightReps, Equipment: "Dumbbell"},
	{Key: "incline-dumbbell-bench-press", Name: "Incline Dumbbell Bench Press", Muscle: "Chest", Secondary: []string{"Shoulders", "Triceps"}, Kind: KindWeightReps, Equipment: "Dumbbell"},
	{Key: "dumbbell-fly", Name: "Dumbbell Fly", Muscle: "Chest", Secondary: nil, Kind: KindWeightReps, Equipment: "Dumbbell"},
	{Key: "incline-dumbbell-fly", Name: "Incline Dumbbell Fly", Muscle: "Chest", Secondary: []string{"Shoulders"}, Kind: KindWeightReps, Equipment: "Dumbbell"},
	{Key: "machine-chest-press", Name: "Machine Chest Press", Muscle: "Chest", Secondary: []string{"Triceps", "Shoulders"}, Kind: KindWeightReps, Equipment: "Machine"},
	{Key: "smith-machine-bench-press", Name: "Smith Machine Bench Press", Muscle: "Chest", Secondary: []string{"Triceps", "Shoulders"}, Kind: KindWeightReps, Equipment: "Machine"},
	{Key: "pec-deck", Name: "Pec Deck", Muscle: "Chest", Secondary: nil, Kind: KindWeightReps, Equipment: "Machine"},
	{Key: "cable-fly", Name: "Cable Fly", Muscle: "Chest", Secondary: nil, Kind: KindWeightReps, Equipment: "Cable"},
	{Key: "low-to-high-cable-fly", Name: "Low-to-High Cable Fly", Muscle: "Chest", Secondary: []string{"Shoulders"}, Kind: KindWeightReps, Equipment: "Cable"},
	{Key: "push-up", Name: "Push-up", Muscle: "Chest", Secondary: []string{"Triceps", "Shoulders", "Core"}, Kind: KindBodyweight, Equipment: "Bodyweight"},
	{Key: "chest-dip", Name: "Chest Dip", Muscle: "Chest", Secondary: []string{"Triceps", "Shoulders"}, Kind: KindBodyweight, Equipment: "Bodyweight"},
	{Key: "deadlift", Name: "Deadlift", Muscle: "Back", Secondary: []string{"Legs", "Glutes"}, Kind: KindWeightReps, Equipment: "Barbell"},
	{Key: "barbell-row", Name: "Barbell Row", Muscle: "Back", Secondary: []string{"Biceps"}, Kind: KindWeightReps, Equipment: "Barbell"},
	{Key: "pendlay-row", Name: "Pendlay Row", Muscle: "Back", Secondary: []string{"Biceps"}, Kind: KindWeightReps, Equipment: "Barbell"},
	{Key: "t-bar-row", Name: "T-Bar Row", Muscle: "Back", Secondary: []string{"Biceps"}, Kind: KindWeightReps, Equipment: "Barbell"},
	{Key: "rack-pull", Name: "Rack Pull", Muscle: "Back", Secondary: []string{"Glutes"}, Kind: KindWeightReps, Equipment: "Barbell"},
	{Key: "barbell-shrug", Name: "Barbell Shrug", Muscle: "Back", Secondary: nil, Kind: KindWeightReps, Equipment: "Barbell"},
	{Key: "dumbbell-row", Name: "Dumbbell Row", Muscle: "Back", Secondary: []string{"Biceps"}, Kind: KindWeightReps, Equipment: "Dumbbell"},
	{Key: "chest-supported-dumbbell-row", Name: "Chest-Supported Dumbbell Row", Muscle: "Back", Secondary: []string{"Biceps"}, Kind: KindWeightReps, Equipment: "Dumbbell"},
	{Key: "dumbbell-shrug", Name: "Dumbbell Shrug", Muscle: "Back", Secondary: nil, Kind: KindWeightReps, Equipment: "Dumbbell"},
	{Key: "pull-up", Name: "Pull-up", Muscle: "Back", Secondary: []string{"Biceps"}, Kind: KindBodyweight, Equipment: "Bodyweight"},
	{Key: "chin-up", Name: "Chin-up", Muscle: "Back", Secondary: []string{"Biceps"}, Kind: KindBodyweight, Equipment: "Bodyweight"},
	{Key: "inverted-row", Name: "Inverted Row", Muscle: "Back", Secondary: []string{"Biceps"}, Kind: KindBodyweight, Equipment: "Bodyweight"},
	{Key: "back-extension", Name: "Back Extension", Muscle: "Back", Secondary: []string{"Glutes"}, Kind: KindBodyweight, Equipment: "Bodyweight"},
	{Key: "lat-pulldown", Name: "Lat Pulldown", Muscle: "Back", Secondary: []string{"Biceps"}, Kind: KindWeightReps, Equipment: "Cable"},
	{Key: "close-grip-lat-pulldown", Name: "Close-Grip Lat Pulldown", Muscle: "Back", Secondary: []string{"Biceps"}, Kind: KindWeightReps, Equipment: "Cable"},
	{Key: "seated-cable-row", Name: "Seated Cable Row", Muscle: "Back", Secondary: []string{"Biceps"}, Kind: KindWeightReps, Equipment: "Cable"},
	{Key: "straight-arm-pulldown", Name: "Straight-Arm Pulldown", Muscle: "Back", Secondary: nil, Kind: KindWeightReps, Equipment: "Cable"},
	{Key: "machine-row", Name: "Machine Row", Muscle: "Back", Secondary: []string{"Biceps"}, Kind: KindWeightReps, Equipment: "Machine"},
	{Key: "overhead-press", Name: "Overhead Press", Muscle: "Shoulders", Secondary: []string{"Triceps"}, Kind: KindWeightReps, Equipment: "Barbell"},
	{Key: "upright-row", Name: "Upright Row", Muscle: "Shoulders", Secondary: []string{"Back"}, Kind: KindWeightReps, Equipment: "Barbell"},
	{Key: "seated-dumbbell-shoulder-press", Name: "Seated Dumbbell Shoulder Press", Muscle: "Shoulders", Secondary: []string{"Triceps"}, Kind: KindWeightReps, Equipment: "Dumbbell"},
	{Key: "arnold-press", Name: "Arnold Press", Muscle: "Shoulders", Secondary: []string{"Triceps"}, Kind: KindWeightReps, Equipment: "Dumbbell"},
	{Key: "dumbbell-lateral-raise", Name: "Dumbbell Lateral Raise", Muscle: "Shoulders", Secondary: nil, Kind: KindWeightReps, Equipment: "Dumbbell"},
	{Key: "dumbbell-front-raise", Name: "Dumbbell Front Raise", Muscle: "Shoulders", Secondary: nil, Kind: KindWeightReps, Equipment: "Dumbbell"},
	{Key: "dumbbell-reverse-fly", Name: "Dumbbell Reverse Fly", Muscle: "Shoulders", Secondary: []string{"Back"}, Kind: KindWeightReps, Equipment: "Dumbbell"},
	{Key: "machine-shoulder-press", Name: "Machine Shoulder Press", Muscle: "Shoulders", Secondary: []string{"Triceps"}, Kind: KindWeightReps, Equipment: "Machine"},
	{Key: "machine-lateral-raise", Name: "Machine Lateral Raise", Muscle: "Shoulders", Secondary: nil, Kind: KindWeightReps, Equipment: "Machine"},
	{Key: "reverse-pec-deck", Name: "Reverse Pec Deck", Muscle: "Shoulders", Secondary: []string{"Back"}, Kind: KindWeightReps, Equipment: "Machine"},
	{Key: "cable-lateral-raise", Name: "Cable Lateral Raise", Muscle: "Shoulders", Secondary: nil, Kind: KindWeightReps, Equipment: "Cable"},
	{Key: "face-pull", Name: "Face Pull", Muscle: "Shoulders", Secondary: []string{"Back"}, Kind: KindWeightReps, Equipment: "Cable"},
	{Key: "barbell-curl", Name: "Barbell Curl", Muscle: "Biceps", Secondary: nil, Kind: KindWeightReps, Equipment: "Barbell"},
	{Key: "ez-bar-curl", Name: "EZ-Bar Curl", Muscle: "Biceps", Secondary: nil, Kind: KindWeightReps, Equipment: "Barbell"},
	{Key: "preacher-curl", Name: "Preacher Curl", Muscle: "Biceps", Secondary: nil, Kind: KindWeightReps, Equipment: "Barbell"},
	{Key: "dumbbell-curl", Name: "Dumbbell Curl", Muscle: "Biceps", Secondary: nil, Kind: KindWeightReps, Equipment: "Dumbbell"},
	{Key: "hammer-curl", Name: "Hammer Curl", Muscle: "Biceps", Secondary: nil, Kind: KindWeightReps, Equipment: "Dumbbell"},
	{Key: "incline-dumbbell-curl", Name: "Incline Dumbbell Curl", Muscle: "Biceps", Secondary: nil, Kind: KindWeightReps, Equipment: "Dumbbell"},
	{Key: "concentration-curl", Name: "Concentration Curl", Muscle: "Biceps", Secondary: nil, Kind: KindWeightReps, Equipment: "Dumbbell"},
	{Key: "cable-curl", Name: "Cable Curl", Muscle: "Biceps", Secondary: nil, Kind: KindWeightReps, Equipment: "Cable"},
	{Key: "machine-preacher-curl", Name: "Machine Preacher Curl", Muscle: "Biceps", Secondary: nil, Kind: KindWeightReps, Equipment: "Machine"},
	{Key: "close-grip-bench-press", Name: "Close-Grip Bench Press", Muscle: "Triceps", Secondary: []string{"Chest"}, Kind: KindWeightReps, Equipment: "Barbell"},
	{Key: "skull-crusher", Name: "Skull Crusher", Muscle: "Triceps", Secondary: nil, Kind: KindWeightReps, Equipment: "Barbell"},
	{Key: "overhead-dumbbell-tricep-extension", Name: "Overhead Dumbbell Tricep Extension", Muscle: "Triceps", Secondary: nil, Kind: KindWeightReps, Equipment: "Dumbbell"},
	{Key: "tricep-pushdown", Name: "Tricep Pushdown", Muscle: "Triceps", Secondary: nil, Kind: KindWeightReps, Equipment: "Cable"},
	{Key: "rope-pushdown", Name: "Rope Pushdown", Muscle: "Triceps", Secondary: nil, Kind: KindWeightReps, Equipment: "Cable"},
	{Key: "overhead-cable-tricep-extension", Name: "Overhead Cable Tricep Extension", Muscle: "Triceps", Secondary: nil, Kind: KindWeightReps, Equipment: "Cable"},
	{Key: "machine-dip", Name: "Machine Dip", Muscle: "Triceps", Secondary: []string{"Chest"}, Kind: KindWeightReps, Equipment: "Machine"},
	{Key: "dip", Name: "Dip", Muscle: "Triceps", Secondary: []string{"Chest", "Shoulders"}, Kind: KindBodyweight, Equipment: "Bodyweight"},
	{Key: "bench-dip", Name: "Bench Dip", Muscle: "Triceps", Secondary: nil, Kind: KindBodyweight, Equipment: "Bodyweight"},
	{Key: "back-squat", Name: "Back Squat", Muscle: "Legs", Secondary: []string{"Glutes", "Core"}, Kind: KindWeightReps, Equipment: "Barbell"},
	{Key: "front-squat", Name: "Front Squat", Muscle: "Legs", Secondary: []string{"Glutes", "Core"}, Kind: KindWeightReps, Equipment: "Barbell"},
	{Key: "romanian-deadlift", Name: "Romanian Deadlift", Muscle: "Legs", Secondary: []string{"Glutes", "Back"}, Kind: KindWeightReps, Equipment: "Barbell"},
	{Key: "goblet-squat", Name: "Goblet Squat", Muscle: "Legs", Secondary: []string{"Glutes"}, Kind: KindWeightReps, Equipment: "Dumbbell"},
	{Key: "bulgarian-split-squat", Name: "Bulgarian Split Squat", Muscle: "Legs", Secondary: []string{"Glutes"}, Kind: KindWeightReps, Equipment: "Dumbbell"},
	{Key: "dumbbell-lunge", Name: "Dumbbell Lunge", Muscle: "Legs", Secondary: []string{"Glutes"}, Kind: KindWeightReps, Equipment: "Dumbbell"},
	{Key: "walking-lunge", Name: "Walking Lunge", Muscle: "Legs", Secondary: []string{"Glutes"}, Kind: KindWeightReps, Equipment: "Dumbbell"},
	{Key: "step-up", Name: "Step-up", Muscle: "Legs", Secondary: []string{"Glutes"}, Kind: KindWeightReps, Equipment: "Dumbbell"},
	{Key: "dumbbell-romanian-deadlift", Name: "Dumbbell Romanian Deadlift", Muscle: "Legs", Secondary: []string{"Glutes"}, Kind: KindWeightReps, Equipment: "Dumbbell"},
	{Key: "leg-press", Name: "Leg Press", Muscle: "Legs", Secondary: []string{"Glutes"}, Kind: KindWeightReps, Equipment: "Machine"},
	{Key: "hack-squat", Name: "Hack Squat", Muscle: "Legs", Secondary: []string{"Glutes"}, Kind: KindWeightReps, Equipment: "Machine"},
	{Key: "smith-machine-squat", Name: "Smith Machine Squat", Muscle: "Legs", Secondary: []string{"Glutes"}, Kind: KindWeightReps, Equipment: "Machine"},
	{Key: "leg-extension", Name: "Leg Extension", Muscle: "Legs", Secondary: nil, Kind: KindWeightReps, Equipment: "Machine"},
	{Key: "lying-leg-curl", Name: "Lying Leg Curl", Muscle: "Legs", Secondary: nil, Kind: KindWeightReps, Equipment: "Machine"},
	{Key: "seated-leg-curl", Name: "Seated Leg Curl", Muscle: "Legs", Secondary: nil, Kind: KindWeightReps, Equipment: "Machine"},
	{Key: "standing-calf-raise", Name: "Standing Calf Raise", Muscle: "Legs", Secondary: nil, Kind: KindWeightReps, Equipment: "Machine"},
	{Key: "seated-calf-raise", Name: "Seated Calf Raise", Muscle: "Legs", Secondary: nil, Kind: KindWeightReps, Equipment: "Machine"},
	{Key: "hip-adduction", Name: "Hip Adduction", Muscle: "Legs", Secondary: nil, Kind: KindWeightReps, Equipment: "Machine"},
	{Key: "bodyweight-squat", Name: "Bodyweight Squat", Muscle: "Legs", Secondary: []string{"Glutes"}, Kind: KindBodyweight, Equipment: "Bodyweight"},
	{Key: "nordic-curl", Name: "Nordic Curl", Muscle: "Legs", Secondary: nil, Kind: KindBodyweight, Equipment: "Bodyweight"},
	{Key: "wall-sit", Name: "Wall Sit", Muscle: "Legs", Secondary: []string{"Glutes"}, Kind: KindDuration, Equipment: "Bodyweight"},
	{Key: "barbell-hip-thrust", Name: "Barbell Hip Thrust", Muscle: "Glutes", Secondary: []string{"Legs"}, Kind: KindWeightReps, Equipment: "Barbell"},
	{Key: "sumo-deadlift", Name: "Sumo Deadlift", Muscle: "Glutes", Secondary: []string{"Legs", "Back"}, Kind: KindWeightReps, Equipment: "Barbell"},
	{Key: "good-morning", Name: "Good Morning", Muscle: "Glutes", Secondary: []string{"Legs", "Back"}, Kind: KindWeightReps, Equipment: "Barbell"},
	{Key: "kettlebell-swing", Name: "Kettlebell Swing", Muscle: "Glutes", Secondary: []string{"Legs", "Back"}, Kind: KindWeightReps, Equipment: "Kettlebell"},
	{Key: "machine-hip-thrust", Name: "Machine Hip Thrust", Muscle: "Glutes", Secondary: []string{"Legs"}, Kind: KindWeightReps, Equipment: "Machine"},
	{Key: "hip-abduction", Name: "Hip Abduction", Muscle: "Glutes", Secondary: nil, Kind: KindWeightReps, Equipment: "Machine"},
	{Key: "cable-kickback", Name: "Cable Kickback", Muscle: "Glutes", Secondary: nil, Kind: KindWeightReps, Equipment: "Cable"},
	{Key: "glute-bridge", Name: "Glute Bridge", Muscle: "Glutes", Secondary: []string{"Legs"}, Kind: KindBodyweight, Equipment: "Bodyweight"},
	{Key: "plank", Name: "Plank", Muscle: "Core", Secondary: nil, Kind: KindDuration, Equipment: "Bodyweight"},
	{Key: "side-plank", Name: "Side Plank", Muscle: "Core", Secondary: nil, Kind: KindDuration, Equipment: "Bodyweight"},
	{Key: "hollow-hold", Name: "Hollow Hold", Muscle: "Core", Secondary: nil, Kind: KindDuration, Equipment: "Bodyweight"},
	{Key: "hanging-leg-raise", Name: "Hanging Leg Raise", Muscle: "Core", Secondary: nil, Kind: KindBodyweight, Equipment: "Bodyweight"},
	{Key: "hanging-knee-raise", Name: "Hanging Knee Raise", Muscle: "Core", Secondary: nil, Kind: KindBodyweight, Equipment: "Bodyweight"},
	{Key: "crunch", Name: "Crunch", Muscle: "Core", Secondary: nil, Kind: KindBodyweight, Equipment: "Bodyweight"},
	{Key: "sit-up", Name: "Sit-up", Muscle: "Core", Secondary: nil, Kind: KindBodyweight, Equipment: "Bodyweight"},
	{Key: "ab-wheel-rollout", Name: "Ab Wheel Rollout", Muscle: "Core", Secondary: []string{"Shoulders"}, Kind: KindBodyweight, Equipment: "Bodyweight"},
	{Key: "russian-twist", Name: "Russian Twist", Muscle: "Core", Secondary: nil, Kind: KindBodyweight, Equipment: "Bodyweight"},
	{Key: "dead-bug", Name: "Dead Bug", Muscle: "Core", Secondary: nil, Kind: KindBodyweight, Equipment: "Bodyweight"},
	{Key: "cable-crunch", Name: "Cable Crunch", Muscle: "Core", Secondary: nil, Kind: KindWeightReps, Equipment: "Cable"},
	{Key: "pallof-press", Name: "Pallof Press", Muscle: "Core", Secondary: nil, Kind: KindWeightReps, Equipment: "Cable"},
	{Key: "machine-crunch", Name: "Machine Crunch", Muscle: "Core", Secondary: nil, Kind: KindWeightReps, Equipment: "Machine"},
	{Key: "run", Name: "Run", Muscle: "Cardio", Secondary: []string{"Legs"}, Kind: KindDistance, Equipment: "Bodyweight"},
	{Key: "walk", Name: "Walk", Muscle: "Cardio", Secondary: []string{"Legs"}, Kind: KindDistance, Equipment: "Bodyweight"},
	{Key: "swim", Name: "Swim", Muscle: "Cardio", Secondary: []string{"Back", "Shoulders"}, Kind: KindDistance, Equipment: "Bodyweight"},
	{Key: "treadmill-run", Name: "Treadmill Run", Muscle: "Cardio", Secondary: []string{"Legs"}, Kind: KindDistance, Equipment: "Machine"},
	{Key: "rowing-machine", Name: "Rowing Machine", Muscle: "Cardio", Secondary: []string{"Back", "Legs"}, Kind: KindDistance, Equipment: "Machine"},
	{Key: "stationary-bike", Name: "Stationary Bike", Muscle: "Cardio", Secondary: []string{"Legs"}, Kind: KindDistance, Equipment: "Machine"},
	{Key: "elliptical", Name: "Elliptical", Muscle: "Cardio", Secondary: []string{"Legs"}, Kind: KindDistance, Equipment: "Machine"},
	{Key: "stair-climber", Name: "Stair Climber", Muscle: "Cardio", Secondary: []string{"Legs", "Glutes"}, Kind: KindDuration, Equipment: "Machine"},
	{Key: "cycling", Name: "Cycling", Muscle: "Cardio", Secondary: []string{"Legs"}, Kind: KindDistance, Equipment: "Other"},
	{Key: "jump-rope", Name: "Jump Rope", Muscle: "Cardio", Secondary: []string{"Legs"}, Kind: KindDuration, Equipment: "Other"},
	{Key: "farmer-s-carry", Name: "Farmer's Carry", Muscle: "Other", Secondary: []string{"Back", "Core"}, Kind: KindDuration, Equipment: "Dumbbell"},
}

var catalogueByKey = func() map[string]CatalogueExercise {
	m := make(map[string]CatalogueExercise, len(catalogue))
	for _, c := range catalogue {
		m[c.Key] = c
	}
	return m
}()

// libraryNames is the user's exercise names, lower-cased: a catalogue entry with one of them is already added.
func libraryNames(ctx context.Context, q querier, userID uuid.UUID) (map[string]bool, error) {
	rows, err := q.Query(ctx, `SELECT lower(name) FROM exercises WHERE user_id = $1`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	names := map[string]bool{}
	for rows.Next() {
		var n string
		if err := rows.Scan(&n); err != nil {
			return nil, err
		}
		names[n] = true
	}
	return names, rows.Err()
}

// ListCatalogue is the whole catalogue, each entry marked in_library when the user has an exercise of that name.
func (s *JymService) ListCatalogue(ctx context.Context, userID uuid.UUID) ([]models.CatalogueExercise, error) {
	names, err := libraryNames(ctx, s.db, userID)
	if err != nil {
		return nil, err
	}
	out := make([]models.CatalogueExercise, 0, len(catalogue))
	for _, c := range catalogue {
		out = append(out, models.CatalogueExercise{
			Key: c.Key, Name: c.Name, MuscleGroup: c.Muscle, SecondaryMuscles: append([]string{}, c.Secondary...),
			Kind: c.Kind, Equipment: c.Equipment, InLibrary: names[strings.ToLower(c.Name)],
		})
	}
	return out, nil
}

// AddFromCatalogue copies the chosen catalogue exercises into the user's library, skipping names already there.
// Muscles go through the same checks as a created exercise.
func (s *JymService) AddFromCatalogue(ctx context.Context, userID uuid.UUID, keys []string) (*models.AddFromCatalogueResult, error) {
	chosen := make([]CatalogueExercise, 0, len(keys))
	for _, k := range keys {
		c, ok := catalogueByKey[k]
		if !ok {
			return nil, ErrUnknownCatalogueKey
		}
		chosen = append(chosen, c)
	}
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	names, err := libraryNames(ctx, tx, userID)
	if err != nil {
		return nil, err
	}
	res := &models.AddFromCatalogueResult{Added: []models.Exercise{}, Skipped: []string{}}
	for _, c := range chosen {
		if names[strings.ToLower(c.Name)] {
			res.Skipped = append(res.Skipped, c.Name)
			continue
		}
		primary, err := cleanPrimary(&c.Muscle)
		if err != nil {
			return nil, err
		}
		secondaries, err := cleanSecondaries(c.Secondary, *primary)
		if err != nil {
			return nil, err
		}
		// A name added meanwhile (another tab) is skipped, not an error.
		var ex models.Exercise
		err = tx.QueryRow(ctx,
			`INSERT INTO exercises (user_id, name, muscle_group, secondary_muscles, kind)
			 VALUES ($1, $2, $3, $4, $5)
			 ON CONFLICT DO NOTHING
			 RETURNING `+exerciseColumns,
			userID, c.Name, primary, secondaries, c.Kind,
		).Scan(exerciseDest(&ex)...)
		if errors.Is(err, pgx.ErrNoRows) {
			res.Skipped = append(res.Skipped, c.Name)
			continue
		}
		if err != nil {
			return nil, err
		}
		names[strings.ToLower(c.Name)] = true
		res.Added = append(res.Added, ex)
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return res, nil
}
