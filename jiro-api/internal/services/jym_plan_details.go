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
	return alias + ".target_reps_max, " + alias + ".target_rpe, " + alias + ".rest_seconds, " + alias + ".notes"
}

// planDest is where planColumns scan to.
func planDest(d *models.PlanDetails) []any {
	return []any{&d.TargetRepsMax, &d.TargetRPE, &d.RestSeconds, &d.Notes}
}

// planArgs are a PlanDetails' values in planColumns' order, for an INSERT.
func planArgs(d models.PlanDetails) []any {
	return []any{d.TargetRepsMax, d.TargetRPE, d.RestSeconds, d.Notes}
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
