package services

import (
	"context"
	"errors"
	"math"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// An exercise's kind says how its sets are logged (J21).
const (
	KindWeightReps = "weight_reps"
	KindBodyweight = "bodyweight"
	KindDuration   = "duration"
	KindDistance   = "distance"
)

var (
	// ErrSetFields is a set whose numbers don't fit its exercise's kind (reps for a plank, say).
	ErrSetFields = errors.New("those numbers don't fit this exercise's type")
	// ErrKindLocked is a change to or from duration or distance on an exercise with logged sets.
	ErrKindLocked = errors.New("this exercise has logged sets, so its type can only change between weight × reps and bodyweight")
)

// repKind is true for kinds logged in reps (and a load).
func repKind(kind string) bool {
	return kind == KindWeightReps || kind == KindBodyweight
}

// kindChangeAllowed: rep kinds swap freely; duration and distance only on an exercise with no sets.
func kindChangeAllowed(from, to string, hasSets bool) bool {
	return from == to || !hasSets || repKind(from) && repKind(to)
}

// setValues is what a set carries beyond its number; nil is not given.
type setValues struct {
	weight    *float64
	reps      *int
	durationS *int
	distanceM *float64
}

// checkSetFields says whether a new set's values fit the kind: rep kinds need reps and no time or distance,
// duration needs a time and no reps or distance, distance needs both distance and time and no reps or load.
func checkSetFields(kind string, v setValues) error {
	switch kind {
	case KindDuration:
		if v.durationS == nil || v.reps != nil || v.distanceM != nil {
			return ErrSetFields
		}
	case KindDistance:
		if v.distanceM == nil || v.durationS == nil || v.reps != nil || v.weight != nil && *v.weight != 0 {
			return ErrSetFields
		}
	default:
		if v.reps == nil || v.durationS != nil || v.distanceM != nil {
			return ErrSetFields
		}
	}
	return nil
}

// checkSetEdit says whether an edit's values fit the kind; fields left out keep what the set has.
func checkSetEdit(kind string, v setValues) error {
	switch kind {
	case KindDuration:
		if v.reps != nil || v.distanceM != nil {
			return ErrSetFields
		}
	case KindDistance:
		if v.reps != nil || v.weight != nil && *v.weight != 0 {
			return ErrSetFields
		}
	default:
		if v.durationS != nil || v.distanceM != nil {
			return ErrSetFields
		}
	}
	return nil
}

// minPaceDistanceM is the shortest distance whose pace can be a record, so a 50 m sprint can't set it.
const minPaceDistanceM = 400

// Record kinds beyond the plain PR, for distance exercises.
var (
	prKindDistance = "distance"
	prKindPace     = "pace"
)

// prSet is one set in logging order, as records see it. Counts is false for warm-ups and deload sets.
type prSet struct {
	session    uuid.UUID
	weight     float64
	reps       *int
	durationS  *int
	distanceM  *float64
	bodyWeight *float64
	counts     bool
}

// prResult is whether a set is a record, and for distance which one.
type prResult struct {
	pr   bool
	kind *string
}

// ratePRs decides every set's record flag for one exercise of the given kind, in logging order:
//   - weight × reps: more weight, or the same weight (within prTolerance) for more reps;
//   - bodyweight: the same on the estimated 1RM of body weight + load (load alone when body weight is unknown,
//     so unweighted sets compare by reps);
//   - duration: a longer hold than any earlier one at the same or more load;
//   - distance: a longer distance, or a faster pace over at least minPaceDistanceM.
//
// Sets that don't count are never records and don't raise the bar. The first workout with a counting set is the
// baseline: its sets raise the bar but are never records, since anything beats a best of nothing.
func ratePRs(kind string, sets []prSet) []prResult {
	out := ratePRsFromZero(kind, sets)
	for i, s := range sets {
		if s.counts {
			for j := i; j < len(sets); j++ {
				if sets[j].session == s.session {
					out[j] = prResult{}
				}
			}
			break
		}
	}
	return out
}

// ratePRsFromZero is ratePRs with no baseline workout: the first counting set is a record.
func ratePRsFromZero(kind string, sets []prSet) []prResult {
	out := make([]prResult, len(sets))
	switch kind {
	case KindDuration:
		var earlier []prSet
		for i, s := range sets {
			if !s.counts || s.durationS == nil {
				continue
			}
			best := 0
			for _, e := range earlier {
				if e.weight >= s.weight-prTolerance && *e.durationS > best {
					best = *e.durationS
				}
			}
			out[i].pr = *s.durationS > best
			earlier = append(earlier, s)
		}
	case KindDistance:
		bestDist, bestPace := 0.0, math.Inf(1)
		for i, s := range sets {
			if !s.counts || s.distanceM == nil || s.durationS == nil {
				continue
			}
			dist := *s.distanceM
			pace := float64(*s.durationS) / (dist / 1000)
			switch {
			case dist > bestDist+0.05:
				out[i] = prResult{pr: true, kind: &prKindDistance}
			case dist >= minPaceDistanceM && pace < bestPace-0.05:
				out[i] = prResult{pr: true, kind: &prKindPace}
			}
			bestDist = math.Max(bestDist, dist)
			if dist >= minPaceDistanceM {
				bestPace = math.Min(bestPace, pace)
			}
		}
	default:
		var bestValue float64
		var bestReps int
		for i, s := range sets {
			if !s.counts || s.reps == nil {
				continue
			}
			value := s.weight
			if kind == KindBodyweight {
				bw := 0.0
				if s.bodyWeight != nil {
					bw = *s.bodyWeight
				}
				value = epley1RM(s.weight+bw, *s.reps)
			}
			out[i].pr = isNewPR(value, *s.reps, false, bestValue, bestReps)
			switch {
			case value > bestValue+prTolerance:
				bestValue, bestReps = value, *s.reps
			case math.Abs(value-bestValue) <= prTolerance:
				bestValue = math.Max(bestValue, value)
				bestReps = max(bestReps, *s.reps)
			}
		}
	}
	return out
}

// refreshBodyWeightCopies sets body_weight_kg on the user's sets (one exercise's when exerciseID is given): the
// latest body weight on or before the workout's day for bodyweight sets, none for the rest. tz is the user's zone
// name. Returns the exercises whose copies changed, which need re-rating.
func refreshBodyWeightCopies(ctx context.Context, tx pgx.Tx, userID uuid.UUID, tz string, exerciseID *uuid.UUID) ([]uuid.UUID, error) {
	rows, err := tx.Query(ctx,
		`WITH want AS (
		   SELECT x.id,
		          CASE WHEN e.kind = 'bodyweight' THEN (
		            SELECT bw.weight_kg FROM body_weights bw
		            WHERE bw.user_id = s.user_id AND bw.recorded_at <= (s.started_at AT TIME ZONE $2)::date
		            ORDER BY bw.recorded_at DESC LIMIT 1)
		          END AS kg
		   FROM session_sets x
		   JOIN sessions s ON s.id = x.session_id
		   JOIN exercises e ON e.id = x.exercise_id
		   WHERE s.user_id = $1 AND ($3::uuid IS NULL OR x.exercise_id = $3)
		 )
		 UPDATE session_sets ss SET body_weight_kg = want.kg
		 FROM want
		 WHERE ss.id = want.id AND ss.body_weight_kg IS DISTINCT FROM want.kg
		 RETURNING ss.exercise_id`,
		userID, tz, exerciseID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	seen := map[uuid.UUID]bool{}
	var changed []uuid.UUID
	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		if !seen[id] {
			seen[id] = true
			changed = append(changed, id)
		}
	}
	return changed, rows.Err()
}

// refreshBodyWeights refreshes the user's body-weight copies and re-rates the exercises they changed, in one
// transaction; run after a body-weight entry is added, edited or deleted.
func (s *JymService) refreshBodyWeights(ctx context.Context, userID uuid.UUID) error {
	loc, err := userLocation(ctx, s.db, userID, "")
	if err != nil {
		return err
	}
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	changed, err := refreshBodyWeightCopies(ctx, tx, userID, loc.String(), nil)
	if err != nil {
		return err
	}
	for _, id := range changed {
		if _, err := rerateExercisePRs(ctx, tx, userID, id); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}
