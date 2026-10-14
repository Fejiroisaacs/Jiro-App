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

// Record kinds (J16), in rank order: a set's badge names the first it earned.
const (
	prKindWeight   = "weight"
	prKindE1RM     = "e1rm"
	prKindReps     = "reps"
	prKindHold     = "hold"
	prKindDistance = "distance"
	prKindPace     = "pace"
)

// maxRepPR is the highest rep count with its own rep max.
const maxRepPR = 12

// prRank orders record kinds for a badge: lower ranks first.
func prRank(kind string) int {
	for i, k := range []string{prKindWeight, prKindE1RM, prKindReps, prKindHold, prKindDistance, prKindPace} {
		if k == kind {
			return i
		}
	}
	return 99
}

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

// prResult is whether a set is a record, and which kinds it set, in rank order.
type prResult struct {
	pr    bool
	kinds []string
}

// top is the record kind a badge names, or nil.
func (r prResult) top() *string {
	if len(r.kinds) == 0 {
		return nil
	}
	return &r.kinds[0]
}

func record(kinds ...string) prResult {
	if len(kinds) == 0 {
		return prResult{}
	}
	return prResult{pr: true, kinds: kinds}
}

// ratePRs decides every set's records for one exercise of the given kind, in logging order:
//   - weight × reps: weight (more weight, or the top weight for more reps), e1RM (a higher estimated 1RM) and reps
//     (for 1 to maxRepPR reps, more weight than any earlier set with at least as many reps; with no such set, the
//     first time at a rep count only sets that rep max);
//   - bodyweight: weight (a heavier added load), e1RM (of body weight + load) and reps (more reps than any earlier
//     set at the same or more load, which needs one to beat);
//   - duration: a longer hold than any earlier one at the same or more load;
//   - distance: a longer distance, and a faster pace over at least minPaceDistanceM.
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
			if *s.durationS > best {
				out[i] = record(prKindHold)
			}
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
			var kinds []string
			if dist > bestDist+0.05 {
				kinds = append(kinds, prKindDistance)
			}
			if dist >= minPaceDistanceM && pace < bestPace-0.05 {
				kinds = append(kinds, prKindPace)
			}
			out[i] = record(kinds...)
			bestDist = math.Max(bestDist, dist)
			if dist >= minPaceDistanceM {
				bestPace = math.Min(bestPace, pace)
			}
		}
	case KindBodyweight:
		var earlier []prSet
		var bestLoad, bestE1RM float64
		for i, s := range sets {
			if !s.counts || s.reps == nil {
				continue
			}
			reps := *s.reps
			e1rm := epley1RM(s.weight+defloat(s.bodyWeight), reps)
			var kinds []string
			if s.weight > bestLoad+prTolerance {
				kinds = append(kinds, prKindWeight)
			}
			if e1rm > bestE1RM+prTolerance {
				kinds = append(kinds, prKindE1RM)
			}
			// Most reps at this load or more, if an earlier set carried as much.
			mostReps, beaten := 0, false
			for _, e := range earlier {
				if e.weight >= s.weight-prTolerance {
					mostReps, beaten = max(mostReps, *e.reps), true
				}
			}
			if beaten && reps > mostReps {
				kinds = append(kinds, prKindReps)
			}
			out[i] = record(kinds...)
			bestLoad, bestE1RM = math.Max(bestLoad, s.weight), math.Max(bestE1RM, e1rm)
			earlier = append(earlier, s)
		}
	default:
		var earlier []prSet
		var bestWeight, bestE1RM float64
		var bestReps int
		for i, s := range sets {
			if !s.counts || s.reps == nil {
				continue
			}
			reps := *s.reps
			e1rm := epley1RM(s.weight, reps)
			var kinds []string
			if isNewPR(s.weight, reps, false, bestWeight, bestReps) {
				kinds = append(kinds, prKindWeight)
			}
			if e1rm > bestE1RM+prTolerance {
				kinds = append(kinds, prKindE1RM)
			}
			// The rep max at this many reps: the heaviest earlier set with at least as many.
			if reps >= 1 && reps <= maxRepPR {
				repMax, beaten := 0.0, false
				for _, e := range earlier {
					if *e.reps >= reps {
						repMax, beaten = math.Max(repMax, e.weight), true
					}
				}
				if beaten && s.weight > repMax+prTolerance {
					kinds = append(kinds, prKindReps)
				}
			}
			out[i] = record(kinds...)
			switch {
			case s.weight > bestWeight+prTolerance:
				bestWeight, bestReps = s.weight, reps
			case math.Abs(s.weight-bestWeight) <= prTolerance:
				bestWeight = math.Max(bestWeight, s.weight)
				bestReps = max(bestReps, reps)
			}
			bestE1RM = math.Max(bestE1RM, e1rm)
			earlier = append(earlier, s)
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
