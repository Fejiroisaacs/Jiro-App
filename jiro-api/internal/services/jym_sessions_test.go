package services

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/models"
	"github.com/google/uuid"
)

func sessionIDs(list []models.SessionSummary) []uuid.UUID {
	ids := make([]uuid.UUID, len(list))
	for i, s := range list {
		ids[i] = s.ID
	}
	return ids
}

func TestListSessionsPagesWithACursor(t *testing.T) {
	svc, userID := testJymDB(t)
	ctx := context.Background()
	var ids []uuid.UUID
	for i := 0; i < 3; i++ {
		id := startSession(t, svc, userID, "")
		finishSession(t, svc, userID, id)
		ids = append(ids, id)
	}

	first, err := svc.ListSessions(ctx, userID, nil, uuid.Nil, 2)
	if err != nil {
		t.Fatalf("first page: %v", err)
	}
	if len(first) != 2 || first[0].ID != ids[2] || first[1].ID != ids[1] {
		t.Fatalf("first page = %v, want the two newest", sessionIDs(first))
	}
	last := first[len(first)-1]
	second, err := svc.ListSessions(ctx, userID, &last.StartedAt, last.ID, 2)
	if err != nil {
		t.Fatalf("second page: %v", err)
	}
	if len(second) != 1 || second[0].ID != ids[0] {
		t.Fatalf("second page = %v, want only the oldest", sessionIDs(second))
	}
}

func TestListSessionsSinceKeepsUnfinishedOnes(t *testing.T) {
	svc, userID := testJymDB(t)
	ctx := context.Background()
	oldDone := startSession(t, svc, userID, "")
	finishSession(t, svc, userID, oldDone)
	oldOpen := startSession(t, svc, userID, "")
	recent := startSession(t, svc, userID, "")
	for _, id := range []uuid.UUID{oldDone, oldOpen} {
		if _, err := svc.db.Exec(ctx, `UPDATE sessions SET started_at = NOW() - INTERVAL '200 days' WHERE id = $1`, id); err != nil {
			t.Fatalf("backdate: %v", err)
		}
	}

	since := time.Now().AddDate(0, 0, -112)
	got, err := svc.ListSessionsSince(ctx, userID, since, "UTC", models.SessionFilter{})
	if err != nil {
		t.Fatalf("list since: %v", err)
	}
	seen := map[uuid.UUID]bool{}
	for _, s := range got {
		seen[s.ID] = true
	}
	if !seen[recent] || !seen[oldOpen] || seen[oldDone] {
		t.Fatalf("since window = %v; want the recent and the old unfinished session, not the old finished one", sessionIDs(got))
	}
}

func TestExerciseHistoryHeaderCoversAllWorkingSets(t *testing.T) {
	svc, userID := testJymDB(t)
	ctx := context.Background()
	ex := prTestSetup(t, svc, userID, "Test Pull")
	sess := startSession(t, svc, userID, "")
	warm := true
	if _, err := svc.LogSet(ctx, userID, sess, &models.CreateSetRequest{
		ExerciseID: ex, SetNumber: 1, Weight: 200, RepsPerformed: 1, IsWarmup: &warm,
	}); err != nil {
		t.Fatalf("log warm-up: %v", err)
	}
	logSet(t, svc, userID, sess, ex, 2, 100, 5)
	logSet(t, svc, userID, sess, ex, 3, 90, 10)

	limit := 1
	got, err := svc.GetExerciseWithHistory(ctx, userID, ex, &limit)
	if err != nil {
		t.Fatalf("history: %v", err)
	}
	if got.BestWeight != 100 || got.Est1RM != 120 {
		t.Fatalf("header best %v, e1RM %v; want 100 and 120 from working sets only", got.BestWeight, got.Est1RM)
	}
	if len(got.History) != 1 {
		t.Fatalf("limit 1 returned %d sets", len(got.History))
	}
	all, err := svc.GetExerciseWithHistory(ctx, userID, ex, nil)
	if err != nil {
		t.Fatalf("full history: %v", err)
	}
	if len(all.History) != 3 || !all.History[0].IsWarmup || all.History[0].SetNumber != 1 {
		t.Fatalf("full history = %+v; want 3 sets in set order, the warm-up flagged", all.History)
	}
}

func TestSeriesProgressionIsInDateOrder(t *testing.T) {
	svc, userID := testJymDB(t)
	ctx := context.Background()
	split, err := svc.CreateSplit(ctx, userID, &models.CreateSplitRequest{Name: "Test Split"})
	if err != nil {
		t.Fatalf("create split: %v", err)
	}
	series, err := svc.CreateSeries(ctx, userID, &models.CreateSeriesRequest{SplitID: split.ID, Name: "Block", DurationType: "open"})
	if err != nil {
		t.Fatalf("create series: %v", err)
	}
	ex := prTestSetup(t, svc, userID, "Test Squat")
	for i, w := range []float64{100, 105, 110, 115} {
		sess, err := svc.StartSession(ctx, userID, &models.CreateSessionRequest{SeriesID: &series.ID})
		if err != nil {
			t.Fatalf("start %d: %v", i, err)
		}
		logSet(t, svc, userID, sess.ID, ex, 1, w, 1)
		finishSession(t, svc, userID, sess.ID)
	}

	detail, err := svc.GetSeriesDetail(ctx, userID, series.ID)
	if err != nil {
		t.Fatalf("series detail: %v", err)
	}
	pts := detail.ExerciseProgressions[0].Points
	want := []float64{100, 105, 110, 115}
	if len(pts) != len(want) {
		t.Fatalf("got %d points, want %d", len(pts), len(want))
	}
	for i, p := range pts {
		if p.BestEst1RM != want[i] {
			t.Fatalf("points = %+v; want singles 100..115 in date order, a single's e1RM being its weight", pts)
		}
	}
}

func TestGetSessionListsExercisesInTheOrderDone(t *testing.T) {
	svc, userID := testJymDB(t)
	ctx := context.Background()
	a := prTestSetup(t, svc, userID, "Test A")
	b := prTestSetup(t, svc, userID, "Test B")
	// Do the exercise with the larger id first, so id order would put it second.
	first, second := a, b
	if a.String() < b.String() {
		first, second = b, a
	}
	sess := startSession(t, svc, userID, "")
	logSet(t, svc, userID, sess, first, 1, 50, 5)
	logSet(t, svc, userID, sess, second, 1, 60, 5)
	logSet(t, svc, userID, sess, first, 2, 50, 5)

	got, err := svc.GetSession(ctx, userID, sess)
	if err != nil {
		t.Fatalf("get session: %v", err)
	}
	order := []uuid.UUID{got.Sets[0].ExerciseID, got.Sets[1].ExerciseID, got.Sets[2].ExerciseID}
	if order[0] != first || order[1] != first || order[2] != second {
		t.Fatalf("set order by exercise = %v; want the first-done exercise's two sets, then the other", order)
	}
}

func TestStartSessionGuardsAnOpenWorkoutAndTheSeriesSplit(t *testing.T) {
	svc, userID := testJymDB(t)
	ctx := context.Background()
	first, err := svc.StartSession(ctx, userID, &models.CreateSessionRequest{})
	if err != nil {
		t.Fatalf("first start: %v", err)
	}
	_, err = svc.StartSession(ctx, userID, &models.CreateSessionRequest{})
	var open *SessionInProgressError
	if !errors.As(err, &open) || open.SessionID != first.ID {
		t.Fatalf("second start: got %v, want SessionInProgressError naming the first", err)
	}
	if _, err := svc.StartSession(ctx, userID, &models.CreateSessionRequest{Force: true}); err != nil {
		t.Fatalf("forced start: %v", err)
	}

	splitA, _ := svc.CreateSplit(ctx, userID, &models.CreateSplitRequest{Name: "A"})
	splitB, _ := svc.CreateSplit(ctx, userID, &models.CreateSplitRequest{Name: "B"})
	day, err := svc.CreateRoutine(ctx, userID, splitA.ID, &models.CreateRoutineRequest{Name: "Day 1", DayOrder: 1})
	if err != nil {
		t.Fatalf("create routine: %v", err)
	}
	seriesB, err := svc.CreateSeries(ctx, userID, &models.CreateSeriesRequest{SplitID: splitB.ID, Name: "B run", DurationType: "open"})
	if err != nil {
		t.Fatalf("create series: %v", err)
	}
	if _, err := svc.StartSession(ctx, userID, &models.CreateSessionRequest{RoutineID: &day.ID, SeriesID: &seriesB.ID, Force: true}); !errors.Is(err, ErrRoutineNotInSeries) {
		t.Fatalf("day of split A in a series of split B: got %v, want ErrRoutineNotInSeries", err)
	}
}

func TestGetSessionCarriesTheRoutinePlan(t *testing.T) {
	svc, userID := testJymDB(t)
	ctx := context.Background()
	split, err := svc.CreateSplit(ctx, userID, &models.CreateSplitRequest{Name: "Plan"})
	if err != nil {
		t.Fatalf("create split: %v", err)
	}
	day, err := svc.CreateRoutine(ctx, userID, split.ID, &models.CreateRoutineRequest{Name: "Push", DayOrder: 1})
	if err != nil {
		t.Fatalf("create routine: %v", err)
	}
	ex := prTestSetup(t, svc, userID, "Test Bench")
	if _, err := svc.ReplaceRoutineItems(ctx, userID, day.ID, []models.ReplaceItemEntry{{ExerciseID: ex, TargetSets: 3, TargetReps: 8}}); err != nil {
		t.Fatalf("plan items: %v", err)
	}
	sess, err := svc.StartSession(ctx, userID, &models.CreateSessionRequest{RoutineID: &day.ID})
	if err != nil {
		t.Fatalf("start: %v", err)
	}
	got, err := svc.GetSession(ctx, userID, sess.ID)
	if err != nil {
		t.Fatalf("get session: %v", err)
	}
	if len(got.Targets) != 1 || got.Targets[0].ExerciseID != ex || got.Targets[0].TargetSets != 3 {
		t.Fatalf("targets = %+v; want the routine's 3 x 8", got.Targets)
	}
}

func TestSeriesNextDayAdvancesWrapsAndStartsLink(t *testing.T) {
	svc, userID := testJymDB(t)
	ctx := context.Background()
	split, err := svc.CreateSplit(ctx, userID, &models.CreateSplitRequest{Name: "PPL"})
	if err != nil {
		t.Fatalf("create split: %v", err)
	}
	var days []*models.Routine
	for i, name := range []string{"Push", "Pull", "Legs"} {
		r, err := svc.CreateRoutine(ctx, userID, split.ID, &models.CreateRoutineRequest{Name: name, DayOrder: i + 1})
		if err != nil {
			t.Fatalf("create %s: %v", name, err)
		}
		days = append(days, r)
	}
	series, err := svc.CreateSeries(ctx, userID, &models.CreateSeriesRequest{SplitID: split.ID, Name: "Run", DurationType: "open"})
	if err != nil {
		t.Fatalf("create series: %v", err)
	}
	next := func() string {
		n, err := svc.NextRoutine(ctx, series.ID, split.ID)
		if err != nil {
			t.Fatalf("next routine: %v", err)
		}
		if n == nil {
			return ""
		}
		return n.Name
	}
	if got := next(); got != "Push" {
		t.Fatalf("before any workout, next = %q, want Push", got)
	}

	// Starting Pull from the split, without naming the series, still files it under the active series.
	pull, err := svc.StartSession(ctx, userID, &models.CreateSessionRequest{RoutineID: &days[1].ID})
	if err != nil {
		t.Fatalf("start pull: %v", err)
	}
	if pull.SeriesID == nil || *pull.SeriesID != series.ID {
		t.Fatalf("a day started from its split was not linked to the active series")
	}
	finishSession(t, svc, userID, pull.ID)
	if got := next(); got != "Legs" {
		t.Fatalf("after Pull, next = %q, want Legs", got)
	}
	legs, err := svc.StartSession(ctx, userID, &models.CreateSessionRequest{RoutineID: &days[2].ID})
	if err != nil {
		t.Fatalf("start legs: %v", err)
	}
	finishSession(t, svc, userID, legs.ID)
	if got := next(); got != "Push" {
		t.Fatalf("after the last day, next = %q, want Push (wrap)", got)
	}
	list, err := svc.ListSeries(ctx, userID)
	if err != nil {
		t.Fatalf("list series: %v", err)
	}
	if len(list) != 1 || list[0].NextRoutine == nil || list[0].NextRoutine.Name != "Push" {
		t.Fatalf("list series next = %+v, want Push", list)
	}

	ended := time.Now()
	if _, err := svc.UpdateSeries(ctx, userID, series.ID, &models.UpdateSeriesRequest{EndedAt: &ended}); err != nil {
		t.Fatalf("end series: %v", err)
	}
	after, err := svc.StartSession(ctx, userID, &models.CreateSessionRequest{RoutineID: &days[0].ID})
	if err != nil {
		t.Fatalf("start after end: %v", err)
	}
	if after.SeriesID != nil {
		t.Fatalf("a workout was linked to an ended series")
	}
}

func TestListSessionsFiltersByExerciseAndType(t *testing.T) {
	svc, userID := testJymDB(t)
	ctx := context.Background()
	squat := prTestSetup(t, svc, userID, "Squat")
	curl := prTestSetup(t, svc, userID, "Curl")
	var squats []uuid.UUID
	for i := 0; i < 5; i++ {
		id := startSession(t, svc, userID, "")
		logSet(t, svc, userID, id, squat, 1, 100, 5)
		finishSession(t, svc, userID, id)
		squats = append(squats, id)
	}
	curls := startSession(t, svc, userID, "")
	logSet(t, svc, userID, curls, curl, 1, 20, 10)
	finishSession(t, svc, userID, curls)
	deload := startSession(t, svc, userID, "deload")
	logSet(t, svc, userID, deload, squat, 1, 60, 5)
	finishSession(t, svc, userID, deload)

	// Squat workouts, paged two at a time: all six (five normal, one deload), none twice, no curls.
	f := models.SessionFilter{ExerciseID: &squat}
	seen := map[uuid.UUID]bool{}
	var before *time.Time
	beforeID := uuid.Nil
	for page := 0; page < 5; page++ {
		list, err := svc.ListSessionsFiltered(ctx, userID, f, before, beforeID, 2)
		if err != nil {
			t.Fatalf("page %d: %v", page, err)
		}
		if len(list) == 0 {
			break
		}
		for _, s := range list {
			if seen[s.ID] {
				t.Fatalf("%v listed twice", s.ID)
			}
			seen[s.ID] = true
		}
		last := list[len(list)-1]
		before, beforeID = &last.StartedAt, last.ID
	}
	if len(seen) != 6 || seen[curls] || !seen[deload] {
		t.Fatalf("squat filter saw %d sessions (curls %v, deload %v); want 6, no curls", len(seen), seen[curls], seen[deload])
	}

	kind := "deload"
	got, err := svc.ListSessionsFiltered(ctx, userID, models.SessionFilter{ExerciseID: &squat, Type: &kind}, nil, uuid.Nil, 50)
	if err != nil {
		t.Fatalf("deload filter: %v", err)
	}
	if len(got) != 1 || got[0].ID != deload {
		t.Fatalf("squat deloads = %v, want only the deload", sessionIDs(got))
	}
}

func TestListSessionsInDaysUsesTheUsersZone(t *testing.T) {
	svc, userID := testJymDB(t)
	ctx := context.Background()
	if _, err := svc.db.Exec(ctx, `UPDATE users SET settings = COALESCE(settings, '{}'::jsonb) || '{"timezone":"America/New_York"}' WHERE id = $1`, userID); err != nil {
		t.Fatalf("zone: %v", err)
	}
	ny, _ := time.LoadLocation("America/New_York")
	place := func(at time.Time) uuid.UUID {
		id := startSession(t, svc, userID, "")
		if _, err := svc.db.Exec(ctx, `UPDATE sessions SET started_at = $2, ended_at = $2::timestamptz + INTERVAL '1 hour' WHERE id = $1`, id, at); err != nil {
			t.Fatalf("place: %v", err)
		}
		return id
	}
	// 11 pm on 30 Sep in New York is already 1 Oct in UTC; 1 am on 1 Oct there is October.
	lateSep := place(time.Date(2026, 9, 30, 23, 0, 0, 0, ny))
	earlyOct := place(time.Date(2026, 10, 1, 1, 0, 0, 0, ny))
	firstSep := place(time.Date(2026, 9, 1, 0, 30, 0, 0, ny))

	sep, err := svc.ListSessionsInDays(ctx, userID, time.Date(2026, 9, 1, 0, 0, 0, 0, time.UTC), time.Date(2026, 9, 30, 0, 0, 0, 0, time.UTC), "UTC", models.SessionFilter{})
	if err != nil {
		t.Fatalf("september: %v", err)
	}
	ids := map[uuid.UUID]bool{}
	for _, s := range sep {
		ids[s.ID] = true
	}
	if len(sep) != 2 || !ids[lateSep] || !ids[firstSep] || ids[earlyOct] {
		t.Fatalf("september = %v; want the late 30th and the 1st, not 1 Oct", sessionIDs(sep))
	}

	// Another user's exercise id finds nothing here.
	_, stranger := testJymDB(t)
	theirs := prTestSetup(t, svc, stranger, "Theirs")
	none, err := svc.ListSessionsInDays(ctx, userID, time.Date(2026, 9, 1, 0, 0, 0, 0, time.UTC), time.Date(2026, 10, 31, 0, 0, 0, 0, time.UTC), "UTC", models.SessionFilter{ExerciseID: &theirs})
	if err != nil {
		t.Fatalf("stranger filter: %v", err)
	}
	if len(none) != 0 {
		t.Fatalf("another user's exercise matched %d sessions", len(none))
	}
}
