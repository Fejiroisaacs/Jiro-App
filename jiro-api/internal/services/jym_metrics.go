package services

import (
	"fmt"
	"math"
	"strings"

	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/models"
)

// Jym's numbers, defined once. A working set is any set that isn't a warm-up.

// e1rmRepCap stops Epley overshooting on high-rep sets: 340 x 12 counts as 340 x 10.
const e1rmRepCap = 10

// epley1RM is a set's estimated one-rep max to 0.1 kg; a single is the weight itself.
func epley1RM(weight float64, reps int) float64 {
	if reps <= 1 {
		return roundTenth(weight)
	}
	return roundTenth(weight * (1 + float64(min(reps, e1rmRepCap))/30.0))
}

func roundTenth(v float64) float64 {
	return math.Round(v*10) / 10
}

// e1rmSQL is epley1RM in SQL, unrounded so it can sit inside MAX; round the result with roundTenth.
func e1rmSQL(weight, reps string) string {
	return fmt.Sprintf("CASE WHEN %[2]s <= 1 THEN %[1]s ELSE %[1]s * (1 + LEAST(%[2]s, %[3]d) / 30.0) END",
		weight, reps, e1rmRepCap)
}

// bestSet is the set with the highest estimated 1RM, then the most reps, so bodyweight sets compare by reps.
func bestSet(sets []models.SetRef) *models.SetRef {
	if len(sets) == 0 {
		return nil
	}
	best := sets[0]
	for _, s := range sets[1:] {
		if s.Est1RM > best.Est1RM ||
			s.Est1RM == best.Est1RM && (s.Reps > best.Reps || s.Reps == best.Reps && s.Weight > best.Weight) {
			best = s
		}
	}
	return &best
}

// muscleKey groups free-text muscle groups case-insensitively; a lift without one is "other".
func muscleKey(group *string) string {
	if group == nil || strings.TrimSpace(*group) == "" {
		return "other"
	}
	return strings.ToLower(strings.TrimSpace(*group))
}

// countedSessionSQL is true for a session that counts towards a series: finished, with a working set.
func countedSessionSQL(alias string) string {
	return fmt.Sprintf(`%[1]s.ended_at IS NOT NULL AND EXISTS (SELECT 1 FROM session_sets w WHERE w.session_id = %[1]s.id AND NOT w.is_warmup)`, alias)
}

// seriesSessionCountSQL counts a series' counted sessions; seriesID is an SQL expression such as sr.id or $1.
func seriesSessionCountSQL(seriesID string) string {
	return `(SELECT COUNT(*) FROM sessions c WHERE c.series_id = ` + seriesID + ` AND ` + countedSessionSQL("c") + `)`
}

// Session aggregates over session_sets ss (and exercises e): working sets only, and PRs counted as lifts with a new record.
const (
	workingSetCountSQL = `COUNT(ss.id) FILTER (WHERE NOT ss.is_warmup)`
	workingVolumeSQL   = `COALESCE(SUM(ss.weight * ss.reps_performed) FILTER (WHERE NOT ss.is_warmup), 0)`
	prLiftCountSQL     = `COUNT(DISTINCT ss.exercise_id) FILTER (WHERE ss.is_pr)`
	muscleGroupsSQL    = `COALESCE(array_agg(DISTINCT e.muscle_group) FILTER (WHERE e.muscle_group IS NOT NULL AND NOT ss.is_warmup), '{}'::text[])`
)

// sessionAggregatesSQL is the tail of a session list row: set_count, pr_count, total_volume, muscle_groups.
const sessionAggregatesSQL = workingSetCountSQL + ` AS set_count, ` +
	prLiftCountSQL + ` AS pr_count, ` +
	workingVolumeSQL + ` AS total_volume, ` +
	muscleGroupsSQL + ` AS muscle_groups`
