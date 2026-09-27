package services

// The Culinara grocery list; items are unique per source and normalised name (migration 000036).

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"unicode/utf8"

	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/models"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

var (
	ErrGroceryItemNotFound = errors.New("grocery item not found")
	ErrGroceryListFull     = errors.New("grocery list is full")
	ErrMealPlanNotFound    = errors.New("meal plan not found")
)

// groceryMaxItems caps one account's list so a script cannot grow it without bound.
const groceryMaxItems = 500

// Column limits, matching the CHECK constraints in migration 000036.
const (
	groceryItemMaxLen   = 200
	groceryAmountMaxLen = 100
	groceryTitleMaxLen  = 255
)

const groceryManualSource = "manual"

// normalizeIngredientName lowercases, trims and collapses whitespace, for comparing names.
func normalizeIngredientName(s string) string {
	return strings.ToLower(strings.Join(strings.Fields(s), " "))
}

func groceryRecipeSource(id uuid.UUID) string { return "recipe:" + id.String() }

func groceryTitleSource(title string) string { return "title:" + normalizeIngredientName(title) }

// truncateRunes cuts s to at most n runes so a long value still fits its column.
func truncateRunes(s string, n int) string {
	if utf8.RuneCountInString(s) <= n {
		return s
	}
	r := []rune(s)
	return string(r[:n])
}

// groceryCandidate is an item about to be added.
type groceryCandidate struct {
	Item        string
	Amount      string
	RecipeID    *uuid.UUID
	RecipeTitle *string
	Source      string
	Checked     bool
}

func (c groceryCandidate) key() string { return c.Source + "\x00" + normalizeIngredientName(c.Item) }

// dedupeGroceryCandidates trims, limits and de-duplicates a batch; the table's unique key catches the rest.
func dedupeGroceryCandidates(in []groceryCandidate) (out []groceryCandidate, skipped int) {
	seen := map[string]bool{}
	for _, c := range in {
		c.Item = truncateRunes(strings.Join(strings.Fields(c.Item), " "), groceryItemMaxLen)
		c.Amount = truncateRunes(strings.TrimSpace(c.Amount), groceryAmountMaxLen)
		if c.RecipeTitle != nil {
			t := truncateRunes(strings.TrimSpace(*c.RecipeTitle), groceryTitleMaxLen)
			if t == "" {
				c.RecipeTitle = nil
			} else {
				c.RecipeTitle = &t
			}
		}
		if c.Item == "" {
			skipped++
			continue
		}
		k := c.key()
		if seen[k] {
			skipped++
			continue
		}
		seen[k] = true
		out = append(out, c)
	}
	return out, skipped
}

// parseIngredients reads base_ingredients leniently, taking numeric amounts as text.
func parseIngredients(raw json.RawMessage) []struct{ Item, Amount string } {
	var rows []map[string]any
	if err := json.Unmarshal(raw, &rows); err != nil {
		return nil
	}
	text := func(v any) string {
		switch t := v.(type) {
		case nil:
			return ""
		case string:
			return t
		default:
			return fmt.Sprint(t)
		}
	}
	out := make([]struct{ Item, Amount string }, 0, len(rows))
	for _, r := range rows {
		out = append(out, struct{ Item, Amount string }{text(r["item"]), text(r["amount"])})
	}
	return out
}

func recipeGroceryCandidates(recipeID uuid.UUID, title string, ingredients json.RawMessage) []groceryCandidate {
	t := title
	var out []groceryCandidate
	for _, ing := range parseIngredients(ingredients) {
		id := recipeID
		out = append(out, groceryCandidate{
			Item: ing.Item, Amount: ing.Amount,
			RecipeID: &id, RecipeTitle: &t, Source: groceryRecipeSource(recipeID),
		})
	}
	return out
}

const groceryColumns = `id, item, amount, recipe_id, recipe_title, checked, position, created_at, updated_at`

func scanGroceryItem(row pgx.Row) (models.GroceryItem, error) {
	var it models.GroceryItem
	err := row.Scan(&it.ID, &it.Item, &it.Amount, &it.RecipeID, &it.RecipeTitle, &it.Checked, &it.Position, &it.CreatedAt, &it.UpdatedAt)
	return it, err
}

// querier is what both the pool and a transaction offer.
type querier interface {
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
}

func listGroceryItems(ctx context.Context, q querier, userID uuid.UUID) ([]models.GroceryItem, error) {
	rows, err := q.Query(ctx,
		`SELECT `+groceryColumns+` FROM grocery_items WHERE user_id = $1 ORDER BY position, created_at, id`,
		userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []models.GroceryItem{}
	for rows.Next() {
		it, err := scanGroceryItem(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, it)
	}
	return items, rows.Err()
}

// ListGroceryItems returns the list in the order items were added.
func (s *RecipeService) ListGroceryItems(ctx context.Context, userID uuid.UUID) ([]models.GroceryItem, error) {
	return listGroceryItems(ctx, s.db, userID)
}

// lockGroceryList serialises one user's grocery writes for the rest of tx, so the
// size cap, positions and import-if-empty check see a stable list.
func lockGroceryList(ctx context.Context, tx pgx.Tx, userID uuid.UUID) error {
	_, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtextextended('grocery:' || $1::text, 0))`, userID)
	return err
}

// addGroceryCandidates inserts the batch in one transaction; onlyIfEmpty adds nothing to a non-empty list.
func (s *RecipeService) addGroceryCandidates(ctx context.Context, userID uuid.UUID, cands []groceryCandidate, onlyIfEmpty bool) (*models.GroceryList, error) {
	cands, skipped := dedupeGroceryCandidates(cands)

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	if err := lockGroceryList(ctx, tx, userID); err != nil {
		return nil, err
	}

	var count, nextPos int
	if err := tx.QueryRow(ctx,
		`SELECT COUNT(*), COALESCE(MAX(position) + 1, 0) FROM grocery_items WHERE user_id = $1`, userID,
	).Scan(&count, &nextPos); err != nil {
		return nil, err
	}

	added := 0
	switch {
	case onlyIfEmpty && count > 0:
		skipped += len(cands)
	default:
		for _, c := range cands {
			if count+added >= groceryMaxItems {
				return nil, ErrGroceryListFull
			}
			tag, err := tx.Exec(ctx,
				`INSERT INTO grocery_items (user_id, item, amount, recipe_id, recipe_title, source_key, name_key, checked, position)
				 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
				 ON CONFLICT (user_id, source_key, name_key) DO NOTHING`,
				userID, c.Item, c.Amount, c.RecipeID, c.RecipeTitle, c.Source, normalizeIngredientName(c.Item), c.Checked, nextPos,
			)
			if err != nil {
				return nil, err
			}
			if tag.RowsAffected() == 1 {
				added++
				nextPos++
			} else {
				skipped++
			}
		}
	}

	items, err := listGroceryItems(ctx, tx, userID)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return &models.GroceryList{Items: items, Added: added, Skipped: skipped}, nil
}

// AddGroceryItem adds one item typed in by hand.
func (s *RecipeService) AddGroceryItem(ctx context.Context, userID uuid.UUID, req *models.AddGroceryItemRequest) (*models.GroceryList, error) {
	return s.addGroceryCandidates(ctx, userID, []groceryCandidate{{
		Item: req.Item, Amount: req.Amount, Source: groceryManualSource,
	}}, false)
}

// AddRecipeToGroceryList adds a recipe's base ingredients.
func (s *RecipeService) AddRecipeToGroceryList(ctx context.Context, userID, recipeID uuid.UUID) (*models.GroceryList, error) {
	var title string
	var ingredients json.RawMessage
	err := s.db.QueryRow(ctx,
		`SELECT title, base_ingredients FROM recipes WHERE id = $1 AND user_id = $2`, recipeID, userID,
	).Scan(&title, &ingredients)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrRecipeNotFound
	}
	if err != nil {
		return nil, err
	}
	return s.addGroceryCandidates(ctx, userID, recipeGroceryCandidates(recipeID, title, ingredients), false)
}

// AddMealPlanToGroceryList adds the ingredients of each recipe planned that week, once per recipe.
func (s *RecipeService) AddMealPlanToGroceryList(ctx context.Context, userID, planID uuid.UUID) (*models.GroceryList, error) {
	var owner uuid.UUID
	err := s.db.QueryRow(ctx, `SELECT user_id FROM meal_plans WHERE id = $1`, planID).Scan(&owner)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrMealPlanNotFound
	}
	if err != nil {
		return nil, err
	}
	if owner != userID {
		return nil, ErrNotOwner
	}

	rows, err := s.db.Query(ctx,
		`SELECT r.id, r.title, r.base_ingredients
		 FROM (
		   SELECT e.recipe_id, MIN(e.day_of_week * 1000
		            + CASE e.meal_slot WHEN 'breakfast' THEN 0 WHEN 'lunch' THEN 100 WHEN 'dinner' THEN 200 ELSE 300 END
		            + e.position) AS first_at
		   FROM meal_plan_entries e
		   WHERE e.meal_plan_id = $1 AND e.recipe_id IS NOT NULL
		   GROUP BY e.recipe_id
		 ) planned
		 JOIN recipes r ON r.id = planned.recipe_id AND r.user_id = $2
		 ORDER BY planned.first_at`,
		planID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var cands []groceryCandidate
	for rows.Next() {
		var id uuid.UUID
		var title string
		var ingredients json.RawMessage
		if err := rows.Scan(&id, &title, &ingredients); err != nil {
			return nil, err
		}
		cands = append(cands, recipeGroceryCandidates(id, title, ingredients)...)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	rows.Close()
	return s.addGroceryCandidates(ctx, userID, cands, false)
}

// ImportGroceryList uploads a browser-kept list, only into an empty list so it cannot import twice.
func (s *RecipeService) ImportGroceryList(ctx context.Context, userID uuid.UUID, items []models.ImportGroceryItem) (*models.GroceryList, error) {
	byTitle := map[string]uuid.UUID{}
	rows, err := s.db.Query(ctx, `SELECT id, title FROM recipes WHERE user_id = $1 ORDER BY created_at`, userID)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var id uuid.UUID
		var title string
		if err := rows.Scan(&id, &title); err != nil {
			rows.Close()
			return nil, err
		}
		if _, dup := byTitle[normalizeIngredientName(title)]; !dup {
			byTitle[normalizeIngredientName(title)] = id
		}
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}

	cands := make([]groceryCandidate, 0, len(items))
	for _, it := range items {
		c := groceryCandidate{Item: it.Item, Amount: it.Amount, Checked: it.Checked, Source: groceryManualSource}
		if title := strings.TrimSpace(it.RecipeTitle); title != "" {
			c.RecipeTitle = &title
			if id, ok := byTitle[normalizeIngredientName(title)]; ok {
				rid := id
				c.RecipeID = &rid
				c.Source = groceryRecipeSource(id)
			} else {
				c.Source = groceryTitleSource(title)
			}
		}
		cands = append(cands, c)
	}
	return s.addGroceryCandidates(ctx, userID, cands, true)
}

// SetGroceryItemChecked ticks or unticks one item.
func (s *RecipeService) SetGroceryItemChecked(ctx context.Context, userID, itemID uuid.UUID, checked bool) (*models.GroceryItem, error) {
	it, err := scanGroceryItem(s.db.QueryRow(ctx,
		`UPDATE grocery_items SET checked = $3, updated_at = NOW()
		 WHERE id = $1 AND user_id = $2
		 RETURNING `+groceryColumns,
		itemID, userID, checked))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrGroceryItemNotFound
	}
	if err != nil {
		return nil, err
	}
	return &it, nil
}

// SetGroceryChecked ticks or unticks the given items (all when ids is empty) and returns the list.
func (s *RecipeService) SetGroceryChecked(ctx context.Context, userID uuid.UUID, ids []uuid.UUID, checked bool) (*models.GroceryList, error) {
	var err error
	if len(ids) == 0 {
		_, err = s.db.Exec(ctx,
			`UPDATE grocery_items SET checked = $2, updated_at = NOW() WHERE user_id = $1 AND checked <> $2`,
			userID, checked)
	} else {
		_, err = s.db.Exec(ctx,
			`UPDATE grocery_items SET checked = $3, updated_at = NOW() WHERE user_id = $1 AND id = ANY($2) AND checked <> $3`,
			userID, ids, checked)
	}
	if err != nil {
		return nil, err
	}
	return s.groceryListResult(ctx, userID)
}

// DeleteGroceryItem removes one item.
func (s *RecipeService) DeleteGroceryItem(ctx context.Context, userID, itemID uuid.UUID) error {
	tag, err := s.db.Exec(ctx, `DELETE FROM grocery_items WHERE id = $1 AND user_id = $2`, itemID, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrGroceryItemNotFound
	}
	return nil
}

// ClearGroceryList removes the checked items (all when onlyChecked is false) and returns the rest.
func (s *RecipeService) ClearGroceryList(ctx context.Context, userID uuid.UUID, onlyChecked bool) (*models.GroceryList, error) {
	sql := `DELETE FROM grocery_items WHERE user_id = $1`
	if onlyChecked {
		sql += ` AND checked`
	}
	if _, err := s.db.Exec(ctx, sql, userID); err != nil {
		return nil, err
	}
	return s.groceryListResult(ctx, userID)
}

func (s *RecipeService) groceryListResult(ctx context.Context, userID uuid.UUID) (*models.GroceryList, error) {
	items, err := s.ListGroceryItems(ctx, userID)
	if err != nil {
		return nil, err
	}
	return &models.GroceryList{Items: items}, nil
}
