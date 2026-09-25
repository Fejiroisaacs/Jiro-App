package models

import (
	"time"

	"github.com/google/uuid"
)

// GroceryItem is one line of the account's grocery list.
type GroceryItem struct {
	ID          uuid.UUID  `json:"id"`
	Item        string     `json:"item"`
	Amount      string     `json:"amount"`
	RecipeID    *uuid.UUID `json:"recipe_id"`
	RecipeTitle *string    `json:"recipe_title"`
	Checked     bool       `json:"checked"`
	Position    int        `json:"position"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

// GroceryList is what every grocery endpoint that changes the list returns:
// the whole list afterwards, plus how many items the call added and how many
// it skipped as already on the list.
type GroceryList struct {
	Items   []GroceryItem `json:"items"`
	Added   int           `json:"added"`
	Skipped int           `json:"skipped"`
}

type AddGroceryItemRequest struct {
	Item   string `json:"item" binding:"required,max=200"`
	Amount string `json:"amount" binding:"max=100"`
}

type UpdateGroceryItemRequest struct {
	Checked *bool `json:"checked" binding:"required"`
}

// SetGroceryCheckedRequest checks (or unchecks) several items at once: the
// given ids, or every item when ids is empty.
type SetGroceryCheckedRequest struct {
	IDs     []uuid.UUID `json:"ids" binding:"max=1000"`
	Checked bool        `json:"checked"`
}

// ImportGroceryItem is one item of a grocery list kept in the browser before
// the list moved to the account.
type ImportGroceryItem struct {
	Item        string `json:"item" binding:"max=200"`
	Amount      string `json:"amount" binding:"max=100"`
	RecipeTitle string `json:"recipe_title" binding:"max=255"`
	Checked     bool   `json:"checked"`
}

type ImportGroceryRequest struct {
	Items []ImportGroceryItem `json:"items" binding:"required,max=500,dive"`
}
