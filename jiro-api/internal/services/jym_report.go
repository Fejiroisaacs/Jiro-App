package services

import (
	"cmp"
	"context"
	"slices"
	"time"

	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/models"
	"github.com/google/uuid"
)

// GetSessionReport is a workout's summary: its totals, each lift's best set against last time, and sets per muscle.
// A lift that set a record shows its best record set; otherwise its best working set.
func (s *JymService) GetSessionReport(ctx context.Context, userID, sessionID uuid.UUID) (*models.SessionReport, error) {
	rows, err := s.db.Query(ctx,
		sessionSummarySelect+`WHERE s.id = $1 AND s.user_id = $2`+sessionSummaryGroup,
		sessionID, userID,
	)
	if err != nil {
		return nil, err
	}
	summaries, err := scanSessionSummaries(rows)
	if err != nil {
		return nil, err
	}
	if len(summaries) == 0 {
		return nil, ErrSessionNotFound
	}
	report := &models.SessionReport{
		SessionSummary: summaries[0],
		Exercises:      []models.ExerciseReport{},
		Muscles:        []models.MuscleShare{},
	}

	type lift struct {
		report    models.ExerciseReport
		sets, prs []models.SetRef
	}
	lifts := map[uuid.UUID]*lift{}
	var order []uuid.UUID
	muscleSets := map[string]int{}

	setRows, err := s.db.Query(ctx,
		`SELECT ss.exercise_id, e.name, e.muscle_group, ss.weight, ss.reps_performed, COALESCE(ss.is_pr, false)
		 FROM session_sets ss
		 JOIN exercises e ON e.id = ss.exercise_id
		 WHERE ss.session_id = $1 AND NOT ss.is_warmup
		 ORDER BY ss.created_at, ss.id`,
		sessionID,
	)
	if err != nil {
		return nil, err
	}
	defer setRows.Close()
	for setRows.Next() {
		var exID uuid.UUID
		var name string
		var group *string
		var weight float64
		var reps int
		var isPR bool
		if err := setRows.Scan(&exID, &name, &group, &weight, &reps, &isPR); err != nil {
			return nil, err
		}
		l, ok := lifts[exID]
		if !ok {
			l = &lift{report: models.ExerciseReport{ExerciseID: exID, Name: name, MuscleGroup: group}}
			lifts[exID] = l
			order = append(order, exID)
		}
		set := models.SetRef{Weight: weight, Reps: reps, Est1RM: epley1RM(weight, reps)}
		l.sets = append(l.sets, set)
		if isPR {
			l.prs = append(l.prs, set)
		}
		l.report.Sets++
		l.report.Volume += weight * float64(reps)
		muscleSets[muscleKey(group)]++
	}
	if err := setRows.Err(); err != nil {
		return nil, err
	}
	setRows.Close()

	previous, err := s.lastTimeSets(ctx, userID, sessionID, report.StartedAt, order)
	if err != nil {
		return nil, err
	}
	for _, id := range order {
		l := lifts[id]
		l.report.Volume = roundTenth(l.report.Volume)
		l.report.IsPR = len(l.prs) > 0
		if l.report.IsPR {
			l.report.Best = bestSet(l.prs)
		} else {
			l.report.Best = bestSet(l.sets)
		}
		l.report.Previous = bestSet(previous[id])
		report.Exercises = append(report.Exercises, l.report)
	}

	for group, n := range muscleSets {
		report.Muscles = append(report.Muscles, models.MuscleShare{MuscleGroup: group, Sets: n})
	}
	slices.SortFunc(report.Muscles, func(a, b models.MuscleShare) int {
		return cmp.Or(cmp.Compare(b.Sets, a.Sets), cmp.Compare(a.MuscleGroup, b.MuscleGroup))
	})
	return report, nil
}

// lastTimeSets is each lift's working sets from its latest finished normal workout that started before this one.
func (s *JymService) lastTimeSets(ctx context.Context, userID, sessionID uuid.UUID, startedAt time.Time, exerciseIDs []uuid.UUID) (map[uuid.UUID][]models.SetRef, error) {
	out := map[uuid.UUID][]models.SetRef{}
	if len(exerciseIDs) == 0 {
		return out, nil
	}
	rows, err := s.db.Query(ctx,
		`WITH prev AS (
		   SELECT DISTINCT ON (ss.exercise_id) ss.exercise_id, s.id AS session_id, s.started_at
		   FROM session_sets ss
		   JOIN sessions s ON s.id = ss.session_id
		   WHERE s.user_id = $1 AND ss.exercise_id = ANY($2::uuid[]) AND NOT ss.is_warmup
		     AND s.ended_at IS NOT NULL AND s.session_type = 'normal'
		     AND (s.started_at, s.id) < ($3::timestamptz, $4::uuid)
		   ORDER BY ss.exercise_id, s.started_at DESC, s.id DESC
		 )
		 SELECT prev.exercise_id, prev.started_at, ss.weight, ss.reps_performed
		 FROM prev
		 JOIN session_sets ss ON ss.session_id = prev.session_id AND ss.exercise_id = prev.exercise_id AND NOT ss.is_warmup`,
		userID, exerciseIDs, startedAt, sessionID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var exID uuid.UUID
		var date time.Time
		var weight float64
		var reps int
		if err := rows.Scan(&exID, &date, &weight, &reps); err != nil {
			return nil, err
		}
		out[exID] = append(out[exID], models.SetRef{Weight: weight, Reps: reps, Est1RM: epley1RM(weight, reps), Date: &date})
	}
	return out, rows.Err()
}
