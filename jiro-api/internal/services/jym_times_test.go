package services

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/models"
	"github.com/google/uuid"
)

// setLoggedAt pins a set's log time, which the server otherwise stamps with NOW().
func setLoggedAt(t *testing.T, svc *JymService, setID uuid.UUID, at time.Time) {
	t.Helper()
	if _, err := svc.db.Exec(context.Background(), `UPDATE session_sets SET created_at = $2 WHERE id = $1`, setID, at); err != nil {
		t.Fatalf("set log time: %v", err)
	}
}

func setStartedAt(t *testing.T, svc *JymService, sessionID uuid.UUID, at time.Time) {
	t.Helper()
	if _, err := svc.db.Exec(context.Background(), `UPDATE sessions SET started_at = $2 WHERE id = $1`, sessionID, at); err != nil {
		t.Fatalf("set start: %v", err)
	}
}

func sameInstant(a *time.Time, b time.Time) bool {
	return a != nil && a.Truncate(time.Microsecond).Equal(b.Truncate(time.Microsecond))
}

func TestSessionListsCarryFirstAndLastSetTimes(t *testing.T) {
	svc, userID := testJymDB(t)
	ctx := context.Background()
	ex := prTestSetup(t, svc, userID, "Times Squat")
	base := time.Now().Add(-2 * time.Hour).Truncate(time.Second)

	sess := startSession(t, svc, userID, "")
	setStartedAt(t, svc, sess, base.Add(-10*time.Minute))
	warm := logSet(t, svc, userID, sess, ex, 1, 60, 5)
	work := logSet(t, svc, userID, sess, ex, 2, 100, 5)
	setLoggedAt(t, svc, warm.ID, base)
	setLoggedAt(t, svc, work.ID, base.Add(40*time.Minute))
	empty := startSession(t, svc, userID, "")

	page, err := svc.ListSessions(ctx, userID, nil, uuid.Nil, 10)
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	day, err := svc.ListSessionsBetween(ctx, userID, base.Add(-time.Hour), time.Now().Add(time.Hour))
	if err != nil {
		t.Fatalf("between: %v", err)
	}
	for name, rows := range map[string][]models.SessionSummary{"page": page, "day": day} {
		for _, row := range rows {
			switch row.ID {
			case sess:
				if !sameInstant(row.FirstSetAt, base) || !sameInstant(row.LastSetAt, base.Add(40*time.Minute)) {
					t.Errorf("%s: set times %v to %v, want %v to %v", name, row.FirstSetAt, row.LastSetAt, base, base.Add(40*time.Minute))
				}
			case empty:
				if row.FirstSetAt != nil || row.LastSetAt != nil {
					t.Errorf("%s: a workout with no sets has set times %v, %v", name, row.FirstSetAt, row.LastSetAt)
				}
			}
		}
	}

	report, err := svc.GetSessionReport(ctx, userID, sess)
	if err != nil {
		t.Fatalf("report: %v", err)
	}
	if !sameInstant(report.LastSetAt, base.Add(40*time.Minute)) {
		t.Errorf("report last set %v, want %v", report.LastSetAt, base.Add(40*time.Minute))
	}
}

func TestOpenWorkoutConflictNamesItsSets(t *testing.T) {
	svc, userID := testJymDB(t)
	ctx := context.Background()
	ex := prTestSetup(t, svc, userID, "Times Bench")

	open := startSession(t, svc, userID, "")
	first := logSet(t, svc, userID, open, ex, 1, 80, 8)
	last := logSet(t, svc, userID, open, ex, 2, 80, 8)
	lastAt := time.Now().Add(-5 * time.Hour).Truncate(time.Second)
	setLoggedAt(t, svc, first.ID, lastAt.Add(-10*time.Minute))
	setLoggedAt(t, svc, last.ID, lastAt)

	_, err := svc.StartSession(ctx, userID, &models.CreateSessionRequest{})
	var busy *SessionInProgressError
	if !errors.As(err, &busy) {
		t.Fatalf("start: got %v, want SessionInProgressError", err)
	}
	if busy.SetCount != 2 || !sameInstant(busy.LastSetAt, lastAt) {
		t.Errorf("conflict names %d sets, last at %v; want 2 at %v", busy.SetCount, busy.LastSetAt, lastAt)
	}
}

func TestUpdateSessionTimes(t *testing.T) {
	svc, userID := testJymDB(t)
	ctx := context.Background()
	ex := prTestSetup(t, svc, userID, "Times Row")
	firstAt := time.Now().Add(-3 * time.Hour).Truncate(time.Second)
	lastAt := firstAt.Add(time.Hour).Add(31 * time.Second)

	sess := startSession(t, svc, userID, "")
	setStartedAt(t, svc, sess, firstAt.Add(-10*time.Minute))
	setLoggedAt(t, svc, logSet(t, svc, userID, sess, ex, 1, 70, 10).ID, firstAt)
	setLoggedAt(t, svc, logSet(t, svc, userID, sess, ex, 2, 70, 10).ID, lastAt)

	edit := func(start, end *time.Time) (*models.Session, error) {
		return svc.UpdateSessionTimes(ctx, userID, sess, &models.UpdateSessionTimesRequest{StartedAt: start, EndedAt: end})
	}
	at := func(tm time.Time) *time.Time { return &tm }

	if _, err := edit(at(firstAt), nil); !errors.Is(err, ErrSessionNotFinished) {
		t.Fatalf("open workout: got %v, want ErrSessionNotFinished", err)
	}
	finishSession(t, svc, userID, sess)

	// The end typed in whole minutes lands just before the last set; the slack lets it save.
	minuteEnd := lastAt.Truncate(time.Minute)
	got, err := edit(nil, &minuteEnd)
	if err != nil || !sameInstant(got.EndedAt, minuteEnd) {
		t.Fatalf("end only: %v, %v", got, err)
	}
	newStart := firstAt.Add(-30 * time.Minute)
	got, err = edit(&newStart, nil)
	if err != nil || !got.StartedAt.Equal(newStart) || !sameInstant(got.EndedAt, minuteEnd) {
		t.Fatalf("start only: %+v, %v", got, err)
	}

	for name, c := range map[string]struct{ start, end *time.Time }{
		"nothing sent":         {nil, nil},
		"start after 1st set":  {at(firstAt.Add(5 * time.Minute)), nil},
		"end before last set":  {nil, at(lastAt.Add(-5 * time.Minute))},
		"end in the future":    {nil, at(time.Now().Add(time.Hour))},
		"end before the start": {at(firstAt.Add(-time.Minute)), at(firstAt.Add(-2 * time.Minute))},
		"over 24 hours":        {at(lastAt.Add(-25 * time.Hour)), nil},
	} {
		var timesErr *SessionTimesError
		if _, err := edit(c.start, c.end); !errors.As(err, &timesErr) {
			t.Errorf("%s: got %v, want a SessionTimesError", name, err)
		}
	}

	stranger := uuid.New()
	if _, err := svc.UpdateSessionTimes(ctx, stranger, sess, &models.UpdateSessionTimesRequest{StartedAt: &newStart}); !errors.Is(err, ErrSessionNotFound) {
		t.Errorf("another user's workout: got %v, want ErrSessionNotFound", err)
	}
}
