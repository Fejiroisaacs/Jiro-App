package models

import (
	"time"

	"github.com/google/uuid"
)

type MealPlan struct {
	ID        uuid.UUID       `json:"id"`
	UserID    uuid.UUID       `json:"user_id"`
	WeekStart time.Time       `json:"week_start"`
	Entries   []MealPlanEntry `json:"entries"`
	CreatedAt time.Time       `json:"created_at"`
	UpdatedAt time.Time       `json:"updated_at"`
}

type MealPlanEntry struct {
	ID          uuid.UUID  `json:"id"`
	MealPlanID  uuid.UUID  `json:"meal_plan_id"`
	RecipeID    *uuid.UUID `json:"recipe_id"`
	RecipeTitle *string    `json:"recipe_title,omitempty"`
	DayOfWeek   int        `json:"day_of_week"` // 0=Mon … 6=Sun
	MealSlot    string     `json:"meal_slot"`   // breakfast|lunch|dinner|snack
	CustomLabel *string    `json:"custom_label,omitempty"`
	Position    int        `json:"position"`
	CreatedAt   time.Time  `json:"created_at"`
}

type AddMealPlanEntryRequest struct {
	RecipeID    *string `json:"recipe_id"`
	DayOfWeek   int     `json:"day_of_week"   binding:"min=0,max=6"`
	MealSlot    string  `json:"meal_slot"     binding:"required,oneof=breakfast lunch dinner snack"`
	CustomLabel *string `json:"custom_label"`
}
