package services

import (
	"context"
	"time"

	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/models"
	"github.com/google/uuid"
)

// recordSet is one working set as the Records panel sees it.
type recordSet struct {
	session    uuid.UUID
	date       time.Time
	weight     float64
	reps       int
	bodyWeight *float64
}

func (r recordSet) ref() *models.SetRef {
	ref := setRef(r.weight, r.reps, nil, nil, r.bodyWeight)
	ref.Date, ref.SessionID = &r.date, &r.session
	return &ref
}

// exerciseRecords is a rep exercise's standing records from its working sets, oldest first: the heaviest weight
// (added load for bodyweight), the best estimated 1RM, and either the rep maxes from 1 to maxRepPR (weight × reps)
// or the most reps (bodyweight). A tie keeps the earlier set, the one that set the record. Nil for other kinds.
func exerciseRecords(kind string, sets []recordSet) *models.ExerciseRecords {
	if !repKind(kind) {
		return nil
	}
	rec := &models.ExerciseRecords{}
	var heaviest, best, most *recordSet
	repMax := make([]*recordSet, maxRepPR+1)
	for i := range sets {
		s := &sets[i]
		if heaviest == nil || s.weight > heaviest.weight+prTolerance ||
			s.weight > heaviest.weight-prTolerance && s.reps > heaviest.reps {
			heaviest = s
		}
		if best == nil || epley1RM(s.weight+defloat(s.bodyWeight), s.reps) > epley1RM(best.weight+defloat(best.bodyWeight), best.reps)+prTolerance {
			best = s
		}
		if most == nil || s.reps > most.reps {
			most = s
		}
		for r := 1; r <= min(s.reps, maxRepPR); r++ {
			if repMax[r] == nil || s.weight > repMax[r].weight+prTolerance {
				repMax[r] = s
			}
		}
	}
	if heaviest == nil {
		return rec
	}
	rec.Weight, rec.E1RM = heaviest.ref(), best.ref()
	if kind == KindBodyweight {
		rec.MostReps = most.ref()
		return rec
	}
	rec.RepMaxes = make([]models.RepMax, 0, maxRepPR)
	for r := 1; r <= maxRepPR; r++ {
		rm := models.RepMax{Reps: r}
		if repMax[r] != nil {
			rm.Set = repMax[r].ref()
		}
		rec.RepMaxes = append(rec.RepMaxes, rm)
	}
	return rec
}

// loadRecords reads an exercise's working sets outside deloads, in logging order, for exerciseRecords.
func (s *JymService) loadRecords(ctx context.Context, userID, exerciseID uuid.UUID, kind string) (*models.ExerciseRecords, error) {
	if !repKind(kind) {
		return nil, nil
	}
	rows, err := s.db.Query(ctx,
		`SELECT s.id, s.started_at, ss.weight, ss.reps_performed, ss.body_weight_kg
		 FROM session_sets ss
		 JOIN sessions s ON s.id = ss.session_id
		 WHERE ss.exercise_id = $1 AND s.user_id = $2 AND NOT ss.is_warmup AND s.session_type <> 'deload'
		   AND ss.reps_performed IS NOT NULL
		 ORDER BY ss.created_at, ss.id`,
		exerciseID, userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var sets []recordSet
	for rows.Next() {
		var r recordSet
		if err := rows.Scan(&r.session, &r.date, &r.weight, &r.reps, &r.bodyWeight); err != nil {
			return nil, err
		}
		sets = append(sets, r)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return exerciseRecords(kind, sets), nil
}
