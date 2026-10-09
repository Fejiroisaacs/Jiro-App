package services

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/models"
	"github.com/google/uuid"
)

func fp(v float64) *float64 { return &v }

// apart puts each set in a workout of its own, so only the first set is the baseline.
func apart(sets []prSet) []prSet {
	for i := range sets {
		sets[i].session = uuid.New()
	}
	return sets
}

// prFlags is ratePRs as one string: "-" for no record, "P" for a record, "d"/"p" for distance/pace records.
func prFlags(kind string, sets []prSet) string {
	out := ""
	for _, r := range ratePRs(kind, sets) {
		switch {
		case !r.pr:
			out += "-"
		case r.kind == nil:
			out += "P"
		case *r.kind == prKindDistance:
			out += "d"
		default:
			out += "p"
		}
	}
	return out
}

func TestRatePRsBodyweight(t *testing.T) {
	bw := fp(80)
	sets := apart([]prSet{
		{weight: 0, reps: ip(8), bodyWeight: bw, counts: true},   // first: the baseline
		{weight: 0, reps: ip(8), bodyWeight: bw, counts: true},   // same: no
		{weight: 0, reps: ip(10), bodyWeight: bw, counts: true},  // more reps, higher e1RM: yes
		{weight: 10, reps: ip(5), bodyWeight: bw, counts: true},  // 90 x 5 = 105 < 80 x 10 = 106.7: no
		{weight: 20, reps: ip(5), bodyWeight: bw, counts: true},  // 100 x 5 = 116.7: yes
		{weight: 50, reps: ip(5), bodyWeight: bw, counts: false}, // warm-up: never
	})
	if got := prFlags(KindBodyweight, sets); got != "--P-P-" {
		t.Fatalf("with body weight: %s", got)
	}
	// No body weight yet: unweighted sets compare by reps.
	none := apart([]prSet{{reps: ip(8), counts: true}, {reps: ip(8), counts: true}, {reps: ip(9), counts: true}})
	if got := prFlags(KindBodyweight, none); got != "--P" {
		t.Fatalf("without body weight: %s", got)
	}
}

func TestRatePRsDuration(t *testing.T) {
	sets := apart([]prSet{
		{durationS: ip(45), counts: true},             // first: the baseline
		{durationS: ip(40), counts: true},             // shorter
		{weight: 10, durationS: ip(30), counts: true}, // first hold at 10 kg: longer than none at that load
		{weight: 10, durationS: ip(30), counts: true}, // equal: no
		{durationS: ip(50), counts: true},             // longest unloaded
		{weight: 5, durationS: ip(40), counts: true},  // 10 kg held 30, 0 kg held 50 (less load): 40 at 5 kg beats 30
	})
	if got := prFlags(KindDuration, sets); got != "--P-PP" {
		t.Fatalf("duration: %s", got)
	}
}

func TestRatePRsDistance(t *testing.T) {
	sets := apart([]prSet{
		{distanceM: fp(5000), durationS: ip(1500), counts: true},  // first: the baseline (5:00 /km)
		{distanceM: fp(3000), durationS: ip(870), counts: true},   // shorter, 4:50 /km: pace
		{distanceM: fp(300), durationS: ip(60), counts: true},     // fast, but under 400 m: no
		{distanceM: fp(3000), durationS: ip(900), counts: true},   // slower and shorter: no
		{distanceM: fp(10000), durationS: ip(2800), counts: true}, // longest and fastest: distance wins the badge
		{distanceM: fp(400), durationS: ip(80), counts: false},    // a warm-up: never
	})
	if got := prFlags(KindDistance, sets); got != "-p--d-" {
		t.Fatalf("distance: %s", got)
	}
}

func TestRatePRsFirstWorkoutIsTheBaseline(t *testing.T) {
	warm, first, second := uuid.New(), uuid.New(), uuid.New()
	sets := []prSet{
		{session: warm, weight: 60, reps: ip(5), counts: false},  // warm-ups only: not the baseline
		{session: first, weight: 80, reps: ip(5), counts: true},  // the baseline workout
		{session: first, weight: 100, reps: ip(5), counts: true}, // heavier in it: still no record
		{session: second, weight: 95, reps: ip(5), counts: true}, // under the baseline's best: no
		{session: second, weight: 102.5, reps: ip(3), counts: true},
	}
	if got := prFlags(KindWeightReps, sets); got != "----P" {
		t.Fatalf("baseline: %s", got)
	}
}

func TestCheckSetFields(t *testing.T) {
	zero, load := 0.0, 20.0
	cases := []struct {
		kind string
		v    setValues
		ok   bool
	}{
		{KindWeightReps, setValues{weight: &load, reps: ip(5)}, true},
		{KindWeightReps, setValues{weight: &load}, false},
		{KindBodyweight, setValues{weight: &zero, reps: ip(8)}, true},
		{KindBodyweight, setValues{reps: ip(8), durationS: ip(30)}, false},
		{KindDuration, setValues{weight: &zero, durationS: ip(45)}, true},
		{KindDuration, setValues{durationS: ip(45), reps: ip(1)}, false},
		{KindDistance, setValues{weight: &zero, distanceM: fp(5000), durationS: ip(1500)}, true},
		{KindDistance, setValues{distanceM: fp(5000)}, false},
		{KindDistance, setValues{weight: &load, distanceM: fp(5000), durationS: ip(1500)}, false},
	}
	for i, c := range cases {
		if err := checkSetFields(c.kind, c.v); (err == nil) != c.ok {
			t.Errorf("case %d (%s): %v", i, c.kind, err)
		}
	}
	if !kindChangeAllowed(KindWeightReps, KindBodyweight, true) || kindChangeAllowed(KindWeightReps, KindDuration, true) ||
		!kindChangeAllowed(KindWeightReps, KindDistance, false) {
		t.Fatal("kind changes")
	}
}

// kindExercise makes an exercise of a kind for a DB test.
func kindExercise(t *testing.T, svc *JymService, userID uuid.UUID, name, kind string) uuid.UUID {
	t.Helper()
	ex, err := svc.CreateExercise(context.Background(), userID, &models.CreateExerciseRequest{Name: name, Kind: &kind})
	if err != nil {
		t.Fatalf("create %s: %v", name, err)
	}
	if ex.Kind != kind {
		t.Fatalf("%s kind %q", name, ex.Kind)
	}
	return ex.ID
}

func TestBodyweightSetsCountBodyWeight(t *testing.T) {
	svc, userID := testJymDB(t)
	ctx := context.Background()
	pull := kindExercise(t, svc, userID, "Pull-up", KindBodyweight)
	baselineWorkout(t, svc, userID, models.CreateSetRequest{ExerciseID: pull, Weight: 0, RepsPerformed: ip(3)})
	sess, err := svc.StartSession(ctx, userID, &models.CreateSessionRequest{})
	if err != nil {
		t.Fatalf("start: %v", err)
	}
	// No body weight yet: the set counts its load only.
	set, err := svc.LogSet(ctx, userID, sess.ID, &models.CreateSetRequest{ExerciseID: pull, SetNumber: 1, Weight: 10, RepsPerformed: ip(5)})
	if err != nil {
		t.Fatalf("log: %v", err)
	}
	if set.BodyWeightKg != nil || !set.IsPR {
		t.Fatalf("first set: bw %v pr %v", set.BodyWeightKg, set.IsPR)
	}
	// Logging today's body weight fills the copy in.
	today := sess.StartedAt.UTC().Format("2006-01-02")
	if _, err := svc.LogBodyWeight(ctx, userID, &models.LogBodyWeightRequest{RecordedAt: today, WeightKg: 80}); err != nil {
		t.Fatalf("body weight: %v", err)
	}
	got, err := svc.GetSession(ctx, userID, sess.ID)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	s0 := got.Sets[0]
	if s0.BodyWeightKg == nil || *s0.BodyWeightKg != 80 || s0.ExerciseKind != KindBodyweight {
		t.Fatalf("copy after logging body weight: %v %q", s0.BodyWeightKg, s0.ExerciseKind)
	}
	// Volume is (80 + 10) x 5.
	var volume float64
	if err := svc.db.QueryRow(ctx, `SELECT `+workingVolumeSQL+` FROM session_sets ss WHERE ss.session_id = $1`, sess.ID).Scan(&volume); err != nil {
		t.Fatalf("volume: %v", err)
	}
	if volume != 450 {
		t.Fatalf("volume %v", volume)
	}
	// A later set is logged with the copy straight away.
	set2, err := svc.LogSet(ctx, userID, sess.ID, &models.CreateSetRequest{ExerciseID: pull, SetNumber: 2, Weight: 0, RepsPerformed: ip(8)})
	if err != nil || set2.BodyWeightKg == nil || *set2.BodyWeightKg != 80 {
		t.Fatalf("second set: %v %v", err, set2)
	}
	// Deleting the entry takes the copies away again.
	bws, _ := svc.ListBodyWeights(ctx, userID)
	if err := svc.DeleteBodyWeight(ctx, userID, bws[0].ID); err != nil {
		t.Fatalf("delete body weight: %v", err)
	}
	got, _ = svc.GetSession(ctx, userID, sess.ID)
	if got.Sets[0].BodyWeightKg != nil || got.Sets[1].BodyWeightKg != nil {
		t.Fatal("copies should go with the entry")
	}
	// Reps without a weight would be refused for a plank.
	plank := kindExercise(t, svc, userID, "Plank", KindDuration)
	if _, err := svc.LogSet(ctx, userID, sess.ID, &models.CreateSetRequest{ExerciseID: plank, SetNumber: 1, RepsPerformed: ip(5)}); !errors.Is(err, ErrSetFields) {
		t.Fatalf("reps on a plank: %v", err)
	}
}

func TestDistanceAndDurationSets(t *testing.T) {
	svc, userID := testJymDB(t)
	ctx := context.Background()
	run := kindExercise(t, svc, userID, "Run", KindDistance)
	plank := kindExercise(t, svc, userID, "Plank", KindDuration)
	baselineWorkout(t, svc, userID,
		models.CreateSetRequest{ExerciseID: run, DistanceM: fp(1000), DurationS: ip(400)},
		models.CreateSetRequest{ExerciseID: plank, DurationS: ip(30)})
	sess, err := svc.StartSession(ctx, userID, &models.CreateSessionRequest{})
	if err != nil {
		t.Fatalf("start: %v", err)
	}
	r1, err := svc.LogSet(ctx, userID, sess.ID, &models.CreateSetRequest{ExerciseID: run, SetNumber: 1, DistanceM: fp(5000), DurationS: ip(1500)})
	if err != nil || !r1.IsPR || r1.PRKind == nil || *r1.PRKind != "distance" || r1.RepsPerformed != 0 {
		t.Fatalf("first run: %v %+v", err, r1)
	}
	r2, err := svc.LogSet(ctx, userID, sess.ID, &models.CreateSetRequest{ExerciseID: run, SetNumber: 2, DistanceM: fp(3000), DurationS: ip(870)})
	if err != nil || !r2.IsPR || r2.PRKind == nil || *r2.PRKind != "pace" {
		t.Fatalf("faster run: %v %+v", err, r2)
	}
	p1, err := svc.LogSet(ctx, userID, sess.ID, &models.CreateSetRequest{ExerciseID: plank, SetNumber: 1, DurationS: ip(45)})
	if err != nil || !p1.IsPR || p1.DurationS == nil || *p1.DurationS != 45 {
		t.Fatalf("plank: %v %+v", err, p1)
	}
	// Editing the hold down re-rates; reps can't be added to it.
	if _, err := svc.UpdateSet(ctx, userID, p1.ID, &models.UpdateSetRequest{RepsPerformed: ip(3)}); !errors.Is(err, ErrSetFields) {
		t.Fatalf("reps on a hold: %v", err)
	}
	upd, err := svc.UpdateSet(ctx, userID, p1.ID, &models.UpdateSetRequest{DurationS: ip(60)})
	if err != nil || *upd.DurationS != 60 || !upd.IsPR {
		t.Fatalf("edit hold: %v %+v", err, upd)
	}
	// No tonnage from either; the session still reads.
	var volume float64
	if err := svc.db.QueryRow(ctx, `SELECT `+workingVolumeSQL+` FROM session_sets ss WHERE ss.session_id = $1`, sess.ID).Scan(&volume); err != nil || volume != 0 {
		t.Fatalf("volume: %v %v", err, volume)
	}
	if _, err := svc.GetSession(ctx, userID, sess.ID); err != nil {
		t.Fatalf("get: %v", err)
	}
	if ws, err := svc.ListExerciseWorkouts(ctx, userID, run, nil, uuid.Nil, 10); err != nil || ws[0].Sets[1].PRKind == nil || *ws[0].Sets[1].PRKind != "pace" {
		t.Fatalf("listed run workouts: %v %+v", err, ws)
	}
	// With sets, a plank can't become a weight exercise; a pull-up can switch to weights and back.
	wr := KindWeightReps
	if _, err := svc.UpdateExercise(ctx, userID, plank, &models.UpdateExerciseRequest{Kind: &wr}); !errors.Is(err, ErrKindLocked) {
		t.Fatalf("plank to weights: %v", err)
	}
}

func TestSwitchingToBodyweightRerates(t *testing.T) {
	svc, userID := testJymDB(t)
	ctx := context.Background()
	dip := kindExercise(t, svc, userID, "Dip", KindWeightReps)
	sess, _ := svc.StartSession(ctx, userID, &models.CreateSessionRequest{})
	today := sess.StartedAt.UTC().Format("2006-01-02")
	if _, err := svc.LogBodyWeight(ctx, userID, &models.LogBodyWeightRequest{RecordedAt: today, WeightKg: 70}); err != nil {
		t.Fatalf("body weight: %v", err)
	}
	if _, err := svc.LogSet(ctx, userID, sess.ID, &models.CreateSetRequest{ExerciseID: dip, SetNumber: 1, Weight: 0, RepsPerformed: ip(10)}); err != nil {
		t.Fatalf("log: %v", err)
	}
	bw := KindBodyweight
	if _, err := svc.UpdateExercise(ctx, userID, dip, &models.UpdateExerciseRequest{Kind: &bw}); err != nil {
		t.Fatalf("to bodyweight: %v", err)
	}
	got, _ := svc.GetSession(ctx, userID, sess.ID)
	if got.Sets[0].BodyWeightKg == nil || *got.Sets[0].BodyWeightKg != 70 {
		t.Fatalf("copy after switching: %v", got.Sets[0].BodyWeightKg)
	}
	wr := KindWeightReps
	if _, err := svc.UpdateExercise(ctx, userID, dip, &models.UpdateExerciseRequest{Kind: &wr}); err != nil {
		t.Fatalf("back to weights: %v", err)
	}
	got, _ = svc.GetSession(ctx, userID, sess.ID)
	if got.Sets[0].BodyWeightKg != nil {
		t.Fatal("weights don't count body weight")
	}
}

func TestKindsInReportsStatsAndRecords(t *testing.T) {
	svc, userID := testJymDB(t)
	ctx := context.Background()
	run := kindExercise(t, svc, userID, "Run", KindDistance)
	plank := kindExercise(t, svc, userID, "Plank", KindDuration)
	pull := kindExercise(t, svc, userID, "Pull-up", KindBodyweight)
	sess, _ := svc.StartSession(ctx, userID, &models.CreateSessionRequest{})
	today := sess.StartedAt.UTC().Format("2006-01-02")
	if _, err := svc.LogBodyWeight(ctx, userID, &models.LogBodyWeightRequest{RecordedAt: today, WeightKg: 80}); err != nil {
		t.Fatalf("body weight: %v", err)
	}
	logs := []*models.CreateSetRequest{
		{ExerciseID: run, SetNumber: 1, DistanceM: fp(5000), DurationS: ip(1500)},
		{ExerciseID: run, SetNumber: 2, DistanceM: fp(1000), DurationS: ip(240)},
		{ExerciseID: plank, SetNumber: 1, DurationS: ip(45)},
		{ExerciseID: plank, SetNumber: 2, DurationS: ip(60)},
		{ExerciseID: pull, SetNumber: 1, Weight: 10, RepsPerformed: ip(5)},
	}
	for _, l := range logs {
		if _, err := svc.LogSet(ctx, userID, sess.ID, l); err != nil {
			t.Fatalf("log: %v", err)
		}
	}
	end := sess.StartedAt.Add(time.Hour)
	if _, err := svc.UpdateSession(ctx, userID, sess.ID, &models.UpdateSessionRequest{EndedAt: &end}); err != nil {
		t.Fatalf("finish: %v", err)
	}

	rep, err := svc.GetSessionReport(ctx, userID, sess.ID)
	if err != nil {
		t.Fatalf("report: %v", err)
	}
	// Volume is the pull-ups only, (80 + 10) x 5; 6 km run and 1:45 held.
	if rep.TotalVolume != 450 || rep.TotalDistanceM != 6000 || rep.TotalDurationS != 105 {
		t.Fatalf("totals: volume %v, distance %v, held %v", rep.TotalVolume, rep.TotalDistanceM, rep.TotalDurationS)
	}
	best := map[string]*models.SetRef{}
	for _, e := range rep.Exercises {
		best[e.Kind] = e.Best
		if !e.IsFirst || e.IsPR {
			t.Fatalf("%s: a first workout is the baseline, not a record", e.Name)
		}
	}
	if best[KindDistance] == nil || *best[KindDistance].DistanceM != 5000 || *best[KindDuration].DurationS != 60 || best[KindBodyweight].Est1RM != 105 {
		t.Fatalf("best sets: %+v %+v %+v", best[KindDistance], best[KindDuration], best[KindBodyweight])
	}

	prs, err := svc.GetPRs(ctx, userID)
	if err != nil {
		t.Fatalf("prs: %v", err)
	}
	byKind := map[string]models.ExercisePR{}
	for _, p := range prs {
		byKind[p.Kind] = p
	}
	// The run's best is its longest distance; its fastest pace is the 1 km at 4:00.
	if r := byKind[KindDistance]; r.DistanceM == nil || *r.DistanceM != 5000 || r.BestPaceSKm == nil || *r.BestPaceSKm != 240 {
		t.Fatalf("run record: %+v", r)
	}
	if p := byKind[KindDuration]; p.DurationS == nil || *p.DurationS != 60 {
		t.Fatalf("plank record: %+v", p)
	}
	if p := byKind[KindBodyweight]; p.Est1RM != 105 {
		t.Fatalf("pull-up record: %+v", p)
	}

	stats, err := svc.GetExerciseStats(ctx, userID, run)
	if err != nil || len(stats.Workouts) != 1 {
		t.Fatalf("stats: %v", err)
	}
	if w := stats.Workouts[0]; w.MaxDistanceM != 5000 || w.BestPaceSKm == nil || *w.BestPaceSKm != 240 || w.BestSet != nil {
		t.Fatalf("run stats: %+v", w)
	}
	ps, _ := svc.GetExerciseStats(ctx, userID, plank)
	if ps.Workouts[0].MaxDurationS != 60 {
		t.Fatalf("plank stats: %+v", ps.Workouts[0])
	}
	ws, err := svc.ListExerciseWorkouts(ctx, userID, run, nil, uuid.Nil, 10)
	if err != nil || len(ws) != 1 || ws[0].Sets[0].DistanceM == nil || ws[0].Sets[0].IsPR {
		t.Fatalf("run workouts: %v %+v", err, ws)
	}

	// A template from this workout keeps the hold and the distance.
	tmpl, err := svc.CreateTemplateFromSession(ctx, userID, sess.ID, "Mixed")
	if err != nil {
		t.Fatalf("template: %v", err)
	}
	for _, it := range tmpl.Items {
		switch it.ExerciseID {
		case run:
			if it.TargetDistanceM == nil || *it.TargetDistanceM != 3000 || it.TargetReps != 1 {
				t.Fatalf("run plan: %+v", it)
			}
		case plank:
			if it.TargetReps != 53 {
				t.Fatalf("plank plan: %+v", it)
			}
		}
	}
}
