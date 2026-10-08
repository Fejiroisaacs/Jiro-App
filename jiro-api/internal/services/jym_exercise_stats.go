package services

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/models"
	"github.com/google/uuid"
)

// GetExerciseStats is an exercise's numbers per workout over all history, oldest first, plus its working weights.
func (s *JymService) GetExerciseStats(ctx context.Context, userID, exerciseID uuid.UUID) (*models.ExerciseStats, error) {
	if ok, err := s.ownsExercise(ctx, exerciseID, userID); err != nil {
		return nil, err
	} else if !ok {
		return nil, ErrExerciseNotFound
	}

	e1rm := e1rmSQL(loadSQL, "ss.reps_performed")
	// The best set orders like bestSet: estimated 1RM, then reps, then weight.
	bestOrder := `ORDER BY ` + e1rm + ` DESC NULLS LAST, ss.reps_performed DESC NULLS LAST, ss.weight DESC`
	rows, err := s.db.Query(ctx,
		`SELECT s.id, s.started_at, s.ended_at, s.session_type,
		        `+workingSetCountSQL+`,
		        COALESCE(MAX(ss.weight) FILTER (WHERE NOT ss.is_warmup), 0),
		        COALESCE(MAX(ss.reps_performed) FILTER (WHERE NOT ss.is_warmup), 0),
		        COALESCE(MAX(`+e1rm+`) FILTER (WHERE NOT ss.is_warmup), 0),
		        (array_agg(ss.weight `+bestOrder+`) FILTER (WHERE NOT ss.is_warmup))[1],
		        (array_agg(COALESCE(ss.reps_performed, 0) `+bestOrder+`) FILTER (WHERE NOT ss.is_warmup))[1],
		        `+workingVolumeSQL+`,
		        BOOL_OR(ss.is_pr),
		        COALESCE(MAX(ss.duration_s) FILTER (WHERE NOT ss.is_warmup AND ss.distance_m IS NULL), 0),
		        COALESCE(MAX(ss.distance_m) FILTER (WHERE NOT ss.is_warmup), 0)::float8,
		        MIN(ss.duration_s / (ss.distance_m / 1000)) FILTER (WHERE NOT ss.is_warmup AND ss.distance_m >= `+fmt.Sprint(minPaceDistanceM)+`)::float8,
		        (array_agg(ss.exercise_note ORDER BY ss.set_number, ss.created_at)
		           FILTER (WHERE NULLIF(TRIM(ss.exercise_note), '') IS NOT NULL))[1]
		 FROM session_sets ss
		 JOIN sessions s ON ss.session_id = s.id
		 WHERE ss.exercise_id = $1 AND s.user_id = $2
		 GROUP BY s.id
		 ORDER BY s.started_at, s.id`,
		exerciseID, userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	stats := &models.ExerciseStats{Workouts: []models.ExerciseStatsWorkout{}, Weights: []float64{}}
	for rows.Next() {
		var w models.ExerciseStatsWorkout
		var bestWeight *float64
		var bestReps *int
		if err := rows.Scan(&w.SessionID, &w.StartedAt, &w.EndedAt, &w.SessionType, &w.WorkingSets,
			&w.MaxWeight, &w.MaxReps, &w.BestE1RM, &bestWeight, &bestReps, &w.Volume, &w.HasPR,
			&w.MaxDurationS, &w.MaxDistanceM, &w.BestPaceSKm, &w.Note); err != nil {
			return nil, err
		}
		w.BestE1RM = roundTenth(w.BestE1RM)
		if w.BestPaceSKm != nil {
			p := roundTenth(*w.BestPaceSKm)
			w.BestPaceSKm = &p
		}
		// The best set's estimated 1RM is the workout's, body weight included.
		if bestWeight != nil && bestReps != nil && *bestReps > 0 {
			w.BestSet = &models.SetRef{Weight: *bestWeight, Reps: *bestReps, Est1RM: w.BestE1RM}
		}
		stats.Workouts = append(stats.Workouts, w)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	weights, err := s.db.Query(ctx,
		`SELECT DISTINCT ss.weight
		 FROM session_sets ss
		 JOIN sessions s ON ss.session_id = s.id
		 WHERE ss.exercise_id = $1 AND s.user_id = $2 AND NOT ss.is_warmup AND s.session_type <> 'deload'
		 ORDER BY ss.weight DESC`,
		exerciseID, userID,
	)
	if err != nil {
		return nil, err
	}
	defer weights.Close()
	for weights.Next() {
		var w float64
		if err := weights.Scan(&w); err != nil {
			return nil, err
		}
		stats.Weights = append(stats.Weights, w)
	}
	return stats, weights.Err()
}

// GetRepsAtWeight is each workout's working-set reps at one weight, outside deloads, oldest first.
func (s *JymService) GetRepsAtWeight(ctx context.Context, userID, exerciseID uuid.UUID, weight float64) ([]models.RepsAtWeight, error) {
	if ok, err := s.ownsExercise(ctx, exerciseID, userID); err != nil {
		return nil, err
	} else if !ok {
		return nil, ErrExerciseNotFound
	}
	rows, err := s.db.Query(ctx,
		`SELECT s.id, s.started_at, array_agg(ss.reps_performed ORDER BY ss.set_number, ss.created_at)
		 FROM session_sets ss
		 JOIN sessions s ON ss.session_id = s.id
		 WHERE ss.exercise_id = $1 AND s.user_id = $2 AND NOT ss.is_warmup AND s.session_type <> 'deload'
		   AND ss.reps_performed IS NOT NULL AND ABS(ss.weight - $3) < 0.01
		 GROUP BY s.id
		 ORDER BY s.started_at, s.id`,
		exerciseID, userID, weight,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.RepsAtWeight{}
	for rows.Next() {
		var r models.RepsAtWeight
		var reps []int32
		if err := rows.Scan(&r.SessionID, &r.StartedAt, &reps); err != nil {
			return nil, err
		}
		r.Reps = make([]int, len(reps))
		for i, n := range reps {
			r.Reps[i] = int(n)
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

// ListExerciseWorkouts pages back through the workouts that included an exercise, newest first, with its sets.
// before and beforeID continue after a page's last workout.
func (s *JymService) ListExerciseWorkouts(ctx context.Context, userID, exerciseID uuid.UUID, before *time.Time, beforeID uuid.UUID, limit int) ([]models.ExerciseWorkout, error) {
	if ok, err := s.ownsExercise(ctx, exerciseID, userID); err != nil {
		return nil, err
	} else if !ok {
		return nil, ErrExerciseNotFound
	}
	rows, err := s.db.Query(ctx,
		`WITH page AS (
		   SELECT s.id FROM sessions s
		   WHERE s.user_id = $2
		     AND EXISTS (SELECT 1 FROM session_sets x WHERE x.session_id = s.id AND x.exercise_id = $1)
		     AND ($3::timestamptz IS NULL OR (s.started_at, s.id) < ($3::timestamptz, $4::uuid))
		   ORDER BY s.started_at DESC, s.id DESC
		   LIMIT $5
		 )
		 SELECT s.id, s.started_at, s.ended_at, s.session_type, r.name,
		        ss.id, ss.set_number, ss.weight, COALESCE(ss.reps_performed, 0), ss.rpe, ss.is_warmup, ss.is_pr, ss.exercise_note,
		        ss.duration_s, ss.distance_m, ss.body_weight_kg, ss.pr_kind
		 FROM page
		 JOIN sessions s ON s.id = page.id
		 LEFT JOIN routines r ON s.routine_id = r.id
		 JOIN session_sets ss ON ss.session_id = s.id AND ss.exercise_id = $1
		 ORDER BY s.started_at DESC, s.id DESC, ss.set_number, ss.created_at`,
		exerciseID, userID, before, beforeID, limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []models.ExerciseWorkout{}
	for rows.Next() {
		var w models.ExerciseWorkout
		var set models.ExerciseWorkoutSet
		var note *string
		if err := rows.Scan(&w.SessionID, &w.StartedAt, &w.EndedAt, &w.SessionType, &w.RoutineName,
			&set.ID, &set.SetNumber, &set.Weight, &set.Reps, &set.RPE, &set.IsWarmup, &set.IsPR, &note,
			&set.DurationS, &set.DistanceM, &set.BodyWeightKg, &set.PRKind); err != nil {
			return nil, err
		}
		if set.Reps > 0 {
			set.Est1RM = epley1RM(set.Weight+defloat(set.BodyWeightKg), set.Reps)
		}
		if n := len(out); n == 0 || out[n-1].SessionID != w.SessionID {
			w.Sets = []models.ExerciseWorkoutSet{}
			out = append(out, w)
		}
		last := &out[len(out)-1]
		if last.Note == nil && note != nil && strings.TrimSpace(*note) != "" {
			last.Note = note
		}
		last.Sets = append(last.Sets, set)
	}
	return out, rows.Err()
}
