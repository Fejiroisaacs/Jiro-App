package services

import (
	"context"
	"errors"
	"time"

	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/models"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrMealPlanEntryNotFound = errors.New("meal plan entry not found")

type MealPlanService struct {
	db *pgxpool.Pool
}

func NewMealPlanService(db *pgxpool.Pool) *MealPlanService {
	return &MealPlanService{db: db}
}

// GetOrCreatePlan returns the meal plan for the given week, creating it if needed.
// weekStart must be a Monday (normalised by the handler).
func (s *MealPlanService) GetOrCreatePlan(ctx context.Context, userID uuid.UUID, weekStart time.Time) (*models.MealPlan, error) {
	plan := &models.MealPlan{}

	err := s.db.QueryRow(ctx,
		`INSERT INTO meal_plans (user_id, week_start)
		 VALUES ($1, $2)
		 ON CONFLICT (user_id, week_start) DO UPDATE SET updated_at = NOW()
		 RETURNING id, user_id, week_start, created_at, updated_at`,
		userID, weekStart,
	).Scan(&plan.ID, &plan.UserID, &plan.WeekStart, &plan.CreatedAt, &plan.UpdatedAt)
	if err != nil {
		return nil, err
	}

	entries, err := s.listEntries(ctx, plan.ID)
	if err != nil {
		return nil, err
	}
	plan.Entries = entries
	return plan, nil
}

func (s *MealPlanService) listEntries(ctx context.Context, planID uuid.UUID) ([]models.MealPlanEntry, error) {
	rows, err := s.db.Query(ctx,
		`SELECT e.id, e.meal_plan_id, e.recipe_id, r.title, e.day_of_week, e.meal_slot, e.custom_label, e.position, e.created_at
		 FROM meal_plan_entries e
		 LEFT JOIN recipes r ON r.id = e.recipe_id
		 WHERE e.meal_plan_id = $1
		 ORDER BY e.day_of_week, e.meal_slot, e.position`,
		planID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var entries []models.MealPlanEntry
	for rows.Next() {
		var e models.MealPlanEntry
		if err := rows.Scan(&e.ID, &e.MealPlanID, &e.RecipeID, &e.RecipeTitle,
			&e.DayOfWeek, &e.MealSlot, &e.CustomLabel, &e.Position, &e.CreatedAt); err != nil {
			return nil, err
		}
		entries = append(entries, e)
	}
	if entries == nil {
		entries = []models.MealPlanEntry{}
	}
	return entries, rows.Err()
}

// AddEntry adds a recipe (or custom label) to a specific day+slot in the plan.
func (s *MealPlanService) AddEntry(ctx context.Context, userID uuid.UUID, planID uuid.UUID, req *models.AddMealPlanEntryRequest) (*models.MealPlanEntry, error) {
	// Verify the plan belongs to the user
	var ownerID uuid.UUID
	err := s.db.QueryRow(ctx, "SELECT user_id FROM meal_plans WHERE id = $1", planID).Scan(&ownerID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotOwner
		}
		return nil, err
	}
	if ownerID != userID {
		return nil, ErrNotOwner
	}

	var recipeID *uuid.UUID
	if req.RecipeID != nil && *req.RecipeID != "" {
		id, err := uuid.Parse(*req.RecipeID)
		if err != nil {
			return nil, errors.New("invalid recipe_id")
		}
		recipeID = &id
	}

	// Determine position (append after existing entries in same day+slot)
	var pos int
	_ = s.db.QueryRow(ctx,
		`SELECT COALESCE(MAX(position)+1, 0) FROM meal_plan_entries
		 WHERE meal_plan_id = $1 AND day_of_week = $2 AND meal_slot = $3`,
		planID, req.DayOfWeek, req.MealSlot,
	).Scan(&pos)

	entry := &models.MealPlanEntry{}
	err = s.db.QueryRow(ctx,
		`INSERT INTO meal_plan_entries (meal_plan_id, recipe_id, day_of_week, meal_slot, custom_label, position)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 RETURNING id, meal_plan_id, recipe_id, day_of_week, meal_slot, custom_label, position, created_at`,
		planID, recipeID, req.DayOfWeek, req.MealSlot, req.CustomLabel, pos,
	).Scan(&entry.ID, &entry.MealPlanID, &entry.RecipeID,
		&entry.DayOfWeek, &entry.MealSlot, &entry.CustomLabel, &entry.Position, &entry.CreatedAt)
	if err != nil {
		return nil, err
	}

	// Fetch recipe title if linked
	if entry.RecipeID != nil {
		var title string
		_ = s.db.QueryRow(ctx, "SELECT title FROM recipes WHERE id = $1", *entry.RecipeID).Scan(&title)
		entry.RecipeTitle = &title
	}

	return entry, nil
}

// RemoveEntry deletes an entry, verifying the requesting user owns the plan.
func (s *MealPlanService) RemoveEntry(ctx context.Context, userID uuid.UUID, entryID uuid.UUID) error {
	var ownerID uuid.UUID
	err := s.db.QueryRow(ctx,
		`SELECT mp.user_id FROM meal_plan_entries e
		 JOIN meal_plans mp ON mp.id = e.meal_plan_id
		 WHERE e.id = $1`,
		entryID,
	).Scan(&ownerID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrMealPlanEntryNotFound
		}
		return err
	}
	if ownerID != userID {
		return ErrNotOwner
	}
	_, err = s.db.Exec(ctx, "DELETE FROM meal_plan_entries WHERE id = $1", entryID)
	return err
}
