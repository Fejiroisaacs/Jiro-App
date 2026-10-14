package services

import (
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestExerciseRecordsWeightReps(t *testing.T) {
	day := func(d int) time.Time { return time.Date(2026, 10, d, 9, 0, 0, 0, time.UTC) }
	sets := []recordSet{
		{session: uuid.New(), date: day(1), weight: 100, reps: 5},
		{session: uuid.New(), date: day(3), weight: 90, reps: 10},
		{session: uuid.New(), date: day(5), weight: 102.5, reps: 3},
		{session: uuid.New(), date: day(7), weight: 100, reps: 5}, // ties the 5-rep max: the first one keeps it
	}
	rec := exerciseRecords(KindWeightReps, sets)
	if rec.Weight.Weight != 102.5 || rec.E1RM.Weight != 90 || rec.E1RM.Est1RM != 120 || rec.MostReps != nil {
		t.Fatalf("weight %+v, e1rm %+v", rec.Weight, rec.E1RM)
	}
	if len(rec.RepMaxes) != maxRepPR {
		t.Fatalf("%d rep maxes", len(rec.RepMaxes))
	}
	want := map[int]float64{1: 102.5, 3: 102.5, 4: 100, 5: 100, 6: 90, 10: 90}
	for r, w := range want {
		if got := rec.RepMaxes[r-1]; got.Reps != r || got.Set == nil || got.Set.Weight != w {
			t.Fatalf("%d-rep max %+v, want %v", r, got.Set, w)
		}
	}
	if !rec.RepMaxes[4].Set.Date.Equal(day(1)) || *rec.RepMaxes[4].Set.SessionID != sets[0].session {
		t.Fatal("a tied rep max should keep the set that set it")
	}
	if rec.RepMaxes[10].Set != nil || rec.RepMaxes[11].Set != nil {
		t.Fatal("no set of 11 or 12 reps yet")
	}
}

func TestExerciseRecordsBodyweightAndOthers(t *testing.T) {
	bw := fp(80)
	sets := []recordSet{
		{date: time.Now(), weight: 0, reps: 8, bodyWeight: bw},
		{date: time.Now(), weight: 10, reps: 5, bodyWeight: bw},
		{date: time.Now(), weight: 0, reps: 12, bodyWeight: bw},
	}
	rec := exerciseRecords(KindBodyweight, sets)
	if rec.Weight.Weight != 10 || rec.MostReps.Reps != 12 || rec.E1RM.Reps != 12 || rec.RepMaxes != nil {
		t.Fatalf("bodyweight records %+v", rec)
	}
	if exerciseRecords(KindDuration, nil) != nil || exerciseRecords(KindWeightReps, nil).Weight != nil {
		t.Fatal("no records for holds, and none before any set")
	}
}
