package services

import (
	"context"
	"errors"
	"strings"

	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/models"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// ErrInvalidPlan is a plan item whose rep range ends below where it starts.
var ErrInvalidPlan = errors.New("a rep range must end at or above where it starts")

// planColumns lists PlanDetails' columns on a table alias, in planDest's order.
func planColumns(alias string) string {
	return alias + ".target_reps_max, " + alias + ".target_rpe, " + alias + ".rest_seconds, " + alias + ".notes, " + alias + ".superset_group, " +
		alias + ".target_distance_m"
}

// planDest is where planColumns scan to.
func planDest(d *models.PlanDetails) []any {
	return []any{&d.TargetRepsMax, &d.TargetRPE, &d.RestSeconds, &d.Notes, &d.SupersetGroup, &d.TargetDistanceM}
}

// planArgs are a PlanDetails' values in planColumns' order, for an INSERT.
func planArgs(d models.PlanDetails) []any {
	return []any{d.TargetRepsMax, d.TargetRPE, d.RestSeconds, d.Notes, d.SupersetGroup, d.TargetDistanceM}
}

// normalizeGroups keeps a superset only where its members sit together: each run of two or more equal
// groups becomes one superset, numbered 1, 2, 3 in order; a member on its own is ungrouped.
func normalizeGroups(groups []*int) []*int {
	out := make([]*int, len(groups))
	next := 1
	for i := 0; i < len(groups); {
		if groups[i] == nil {
			i++
			continue
		}
		j := i
		for j+1 < len(groups) && groups[j+1] != nil && *groups[j+1] == *groups[i] {
			j++
		}
		if j > i {
			for k := i; k <= j; k++ {
				g := next
				out[k] = &g
			}
			next++
		}
		i = j + 1
	}
	return out
}

func sameGroup(a, b *int) bool {
	return (a == nil && b == nil) || (a != nil && b != nil && *a == *b)
}

// normalizeSessionGroups applies normalizeGroups to a workout's list after its order or members change.
func normalizeSessionGroups(ctx context.Context, tx pgx.Tx, sessionID uuid.UUID) error {
	list, err := listSessionExercises(ctx, tx, sessionID)
	if err != nil {
		return err
	}
	groups := make([]*int, len(list))
	for i, x := range list {
		groups[i] = x.SupersetGroup
	}
	for i, g := range normalizeGroups(groups) {
		if sameGroup(g, list[i].SupersetGroup) {
			continue
		}
		if _, err := tx.Exec(ctx,
			`UPDATE session_exercises SET superset_group = $3 WHERE session_id = $1 AND exercise_id = $2`,
			sessionID, list[i].ExerciseID, g,
		); err != nil {
			return err
		}
	}
	return nil
}

// cleanPlan trims the note (blank is none) and checks the range against the reps it starts at.
func cleanPlan(d models.PlanDetails, reps int) (models.PlanDetails, error) {
	if d.Notes != nil {
		if t := strings.TrimSpace(*d.Notes); t == "" {
			d.Notes = nil
		} else {
			d.Notes = &t
		}
	}
	if d.TargetRepsMax != nil && *d.TargetRepsMax < reps {
		return d, ErrInvalidPlan
	}
	// A range of one number is just the reps.
	if d.TargetRepsMax != nil && *d.TargetRepsMax == reps {
		d.TargetRepsMax = nil
	}
	return d, nil
}

// routinePlanDetails is each exercise's PlanDetails in a routine (its first item), for saves from older apps.
func routinePlanDetails(ctx context.Context, tx pgx.Tx, routineID uuid.UUID) (map[uuid.UUID]models.PlanDetails, error) {
	rows, err := tx.Query(ctx,
		`SELECT DISTINCT ON (exercise_id) exercise_id, `+planColumns("ri")+`
		 FROM routine_items ri WHERE routine_id = $1
		 ORDER BY exercise_id, order_index, id`,
		routineID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[uuid.UUID]models.PlanDetails{}
	for rows.Next() {
		var id uuid.UUID
		var d models.PlanDetails
		if err := rows.Scan(append([]any{&id}, planDest(&d)...)...); err != nil {
			return nil, err
		}
		out[id] = d
	}
	return out, rows.Err()
}
