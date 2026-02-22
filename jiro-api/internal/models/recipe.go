package models

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type Recipe struct {
	ID              uuid.UUID       `json:"id"`
	UserID          uuid.UUID       `json:"user_id"`
	Title           string          `json:"title"`
	Description     *string         `json:"description"`
	TargetImageURL  *string         `json:"target_image_url"`
	BaseIngredients json.RawMessage `json:"base_ingredients"`
	Instructions    *string         `json:"instructions"`
	Tags            []string        `json:"tags"`
	Nutrition       json.RawMessage `json:"nutrition"`
	DietaryFlags    json.RawMessage `json:"dietary_flags"`
	CreatedAt       time.Time       `json:"created_at"`
	UpdatedAt       time.Time       `json:"updated_at"`
	// Computed fields (from list query)
	LatestRating *int       `json:"latest_rating,omitempty"`
	TrialCount   *int       `json:"trial_count,omitempty"`
	LastCooked   *time.Time `json:"last_cooked,omitempty"`
}

type RecipeTrial struct {
	ID             uuid.UUID       `json:"id"`
	RecipeID       uuid.UUID       `json:"recipe_id"`
	DateCooked     time.Time       `json:"date_cooked"`
	ResultImageURL *string         `json:"result_image_url"`
	Notes          *string         `json:"notes"`
	Modifications  json.RawMessage `json:"modifications"`
	Rating         *int            `json:"rating"`
	CreatedAt      time.Time       `json:"created_at"`
}

type RecipeWithTrials struct {
	Recipe
	Trials []RecipeTrial `json:"trials"`
}

// Request types

type CreateRecipeRequest struct {
	Title           string          `json:"title" binding:"required"`
	Description     *string         `json:"description"`
	TargetImageURL  *string         `json:"target_image_url"`
	BaseIngredients json.RawMessage `json:"base_ingredients"`
	Instructions    *string         `json:"instructions"`
	Tags            []string        `json:"tags"`
	Nutrition       json.RawMessage `json:"nutrition"`
	DietaryFlags    json.RawMessage `json:"dietary_flags"`
}

type UpdateRecipeRequest struct {
	Title           *string         `json:"title"`
	Description     *string         `json:"description"`
	TargetImageURL  *string         `json:"target_image_url"`
	BaseIngredients json.RawMessage `json:"base_ingredients"`
	Instructions    *string         `json:"instructions"`
	Tags            []string        `json:"tags"`
	Nutrition       json.RawMessage `json:"nutrition"`
	DietaryFlags    json.RawMessage `json:"dietary_flags"`
}

type CreateTrialRequest struct {
	DateCooked     *time.Time      `json:"date_cooked"`
	ResultImageURL *string         `json:"result_image_url"`
	Notes          *string         `json:"notes"`
	Modifications  json.RawMessage `json:"modifications"`
	Rating         *int            `json:"rating" binding:"omitempty,min=1,max=5"`
}

type UpdateTrialRequest struct {
	DateCooked    *time.Time      `json:"date_cooked"`
	Notes         *string         `json:"notes"`
	Modifications json.RawMessage `json:"modifications"`
	Rating        *int            `json:"rating" binding:"omitempty,min=1,max=5"`
}
