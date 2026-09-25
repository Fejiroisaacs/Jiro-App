package services

import (
	"context"
	"errors"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/models"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrMealPlanEntryNotFound = errors.New("meal plan entry not found")
	// ErrMealPlanEntryEmpty is an entry with neither a recipe nor a label.
	ErrMealPlanEntryEmpty = errors.New("choose a recipe or write a note")
	ErrInvalidRecipeID    = errors.New("invalid recipe_id")
)

// mealPlanLabelMaxLen caps a custom label such as "Dinner out" (the column
// allows 255; a slot chip shows far less).
const mealPlanLabelMaxLen = 80

type MealPlanService struct {
	db *pgxpool.Pool
}

func NewMealPlanService(db *pgxpool.Pool) *MealPlanService {
	return &MealPlanService{db: db}
}

// Today is today's calendar date (at UTC midnight) in the user's location:
// settings timezone, else tzHint, else UTC.
func (s *MealPlanService) Today(ctx context.Context, userID uuid.UUID, tzHint string) (time.Time, error) {
	loc, err := userLocation(ctx, s.db, userID, tzHint)
	if err != nil {
		return time.Time{}, err
	}
	return calendarToday(time.Now(), loc), nil
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

// ListPlans returns every meal plan the user has, oldest week first, each with
// its entries.
//
// Read-only on purpose. GetOrCreatePlan upserts the row it returns, which is
// right for the planner page but wrong for the data export: fetching your own
// data should never create a plan for a week you never touched. Two queries
// rather than one per plan, so an account with years of plans still costs a
// fixed number of round trips.
func (s *MealPlanService) ListPlans(ctx context.Context, userID uuid.UUID) ([]models.MealPlan, error) {
	rows, err := s.db.Query(ctx,
		`SELECT id, user_id, week_start, created_at, updated_at
		 FROM meal_plans
		 WHERE user_id = $1
		 ORDER BY week_start`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	plans := []models.MealPlan{}
	for rows.Next() {
		var p models.MealPlan
		if err := rows.Scan(&p.ID, &p.UserID, &p.WeekStart, &p.CreatedAt, &p.UpdatedAt); err != nil {
			return nil, err
		}
		p.Entries = []models.MealPlanEntry{}
		plans = append(plans, p)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(plans) == 0 {
		return plans, nil
	}

	entryRows, err := s.db.Query(ctx,
		`SELECT e.id, e.meal_plan_id, e.recipe_id, r.title, e.day_of_week, e.meal_slot, e.custom_label, e.position, e.created_at
		 FROM meal_plan_entries e
		 JOIN meal_plans p ON p.id = e.meal_plan_id
		 LEFT JOIN recipes r ON r.id = e.recipe_id
		 WHERE p.user_id = $1
		 ORDER BY e.day_of_week, e.meal_slot, e.position`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer entryRows.Close()

	byPlan := map[uuid.UUID][]models.MealPlanEntry{}
	for entryRows.Next() {
		var e models.MealPlanEntry
		if err := entryRows.Scan(&e.ID, &e.MealPlanID, &e.RecipeID, &e.RecipeTitle,
			&e.DayOfWeek, &e.MealSlot, &e.CustomLabel, &e.Position, &e.CreatedAt); err != nil {
			return nil, err
		}
		byPlan[e.MealPlanID] = append(byPlan[e.MealPlanID], e)
	}
	if err := entryRows.Err(); err != nil {
		return nil, err
	}

	for i := range plans {
		if entries, ok := byPlan[plans[i].ID]; ok {
			plans[i].Entries = entries
		}
	}
	return plans, nil
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

	// A custom label is free text in place of a recipe ("Dinner out").
	// Blank means none; whitespace is tidied the way it will be shown.
	var label *string
	if req.CustomLabel != nil {
		if l := strings.Join(strings.Fields(*req.CustomLabel), " "); l != "" {
			if utf8.RuneCountInString(l) > mealPlanLabelMaxLen {
				l = string([]rune(l)[:mealPlanLabelMaxLen])
			}
			label = &l
		}
	}
	if (req.RecipeID == nil || *req.RecipeID == "") && label == nil {
		return nil, ErrMealPlanEntryEmpty
	}

	var recipeID *uuid.UUID
	if req.RecipeID != nil && *req.RecipeID != "" {
		id, err := uuid.Parse(*req.RecipeID)
		if err != nil {
			return nil, ErrInvalidRecipeID
		}
		recipeID = &id

		// Without this, another user's recipe can be pinned in and its title
		// read back from the listing.
		var owned bool
		if err := s.db.QueryRow(ctx,
			`SELECT EXISTS(SELECT 1 FROM recipes WHERE id = $1 AND user_id = $2)`,
			id, userID,
		).Scan(&owned); err != nil {
			return nil, err
		}
		if !owned {
			return nil, ErrNotOwner
		}
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
		planID, recipeID, req.DayOfWeek, req.MealSlot, label, pos,
	).Scan(&entry.ID, &entry.MealPlanID, &entry.RecipeID,
		&entry.DayOfWeek, &entry.MealSlot, &entry.CustomLabel, &entry.Position, &entry.CreatedAt)
	if err != nil {
		return nil, err
	}

	// Fetch recipe title if linked
	if entry.RecipeID != nil {
		var title string
		_ = s.db.QueryRow(ctx, "SELECT title FROM recipes WHERE id = $1 AND user_id = $2", *entry.RecipeID, userID).Scan(&title)
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
