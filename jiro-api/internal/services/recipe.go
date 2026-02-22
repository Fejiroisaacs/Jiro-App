package services

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/models"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrRecipeNotFound = errors.New("recipe not found")
	ErrTrialNotFound  = errors.New("trial not found")
	ErrNotOwner       = errors.New("you do not own this resource")
)

type RecipeService struct {
	db *pgxpool.Pool
}

func NewRecipeService(db *pgxpool.Pool) *RecipeService {
	return &RecipeService{db: db}
}

func (s *RecipeService) CreateRecipe(ctx context.Context, userID uuid.UUID, req *models.CreateRecipeRequest) (*models.Recipe, error) {
	ingredients := req.BaseIngredients
	if ingredients == nil {
		ingredients = json.RawMessage("[]")
	}
	tags := req.Tags
	if tags == nil {
		tags = []string{}
	}

	recipe := &models.Recipe{}
	err := s.db.QueryRow(ctx,
		`INSERT INTO recipes (user_id, title, description, target_image_url, base_ingredients, instructions, tags, nutrition, dietary_flags)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		 RETURNING id, user_id, title, description, target_image_url, base_ingredients, instructions, tags, nutrition, dietary_flags, created_at, updated_at`,
		userID, req.Title, req.Description, req.TargetImageURL, ingredients, req.Instructions, tags, req.Nutrition, req.DietaryFlags,
	).Scan(&recipe.ID, &recipe.UserID, &recipe.Title, &recipe.Description, &recipe.TargetImageURL,
		&recipe.BaseIngredients, &recipe.Instructions, &recipe.Tags, &recipe.Nutrition, &recipe.DietaryFlags, &recipe.CreatedAt, &recipe.UpdatedAt)

	if err != nil {
		return nil, err
	}
	return recipe, nil
}

func (s *RecipeService) ListRecipes(ctx context.Context, userID uuid.UUID, search string) ([]models.Recipe, error) {
	query := `
		SELECT r.id, r.user_id, r.title, r.description, r.target_image_url, r.base_ingredients, r.instructions, r.tags,
		       r.nutrition, r.dietary_flags,
		       r.created_at, r.updated_at,
		       (SELECT rt.rating FROM recipe_trials rt WHERE rt.recipe_id = r.id ORDER BY rt.date_cooked DESC LIMIT 1) as latest_rating,
		       (SELECT COUNT(*) FROM recipe_trials rt WHERE rt.recipe_id = r.id) as trial_count,
		       (SELECT MAX(rt.date_cooked) FROM recipe_trials rt WHERE rt.recipe_id = r.id) as last_cooked
		FROM recipes r
		WHERE r.user_id = $1`

	args := []interface{}{userID}

	if search != "" {
		query += ` AND r.title ILIKE $2`
		args = append(args, "%"+search+"%")
	}

	query += ` ORDER BY r.updated_at DESC`

	rows, err := s.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var recipes []models.Recipe
	for rows.Next() {
		var r models.Recipe
		err := rows.Scan(&r.ID, &r.UserID, &r.Title, &r.Description, &r.TargetImageURL,
			&r.BaseIngredients, &r.Instructions, &r.Tags, &r.Nutrition, &r.DietaryFlags,
			&r.CreatedAt, &r.UpdatedAt,
			&r.LatestRating, &r.TrialCount, &r.LastCooked)
		if err != nil {
			return nil, err
		}
		if r.Tags == nil {
			r.Tags = []string{}
		}
		recipes = append(recipes, r)
	}

	if recipes == nil {
		recipes = []models.Recipe{}
	}
	return recipes, nil
}

func (s *RecipeService) GetRecipe(ctx context.Context, userID, recipeID uuid.UUID) (*models.RecipeWithTrials, error) {
	recipe := &models.RecipeWithTrials{}
	err := s.db.QueryRow(ctx,
		`SELECT id, user_id, title, description, target_image_url, base_ingredients, instructions, tags, nutrition, dietary_flags, created_at, updated_at
		 FROM recipes WHERE id = $1 AND user_id = $2`,
		recipeID, userID,
	).Scan(&recipe.ID, &recipe.UserID, &recipe.Title, &recipe.Description, &recipe.TargetImageURL,
		&recipe.BaseIngredients, &recipe.Instructions, &recipe.Tags, &recipe.Nutrition, &recipe.DietaryFlags, &recipe.CreatedAt, &recipe.UpdatedAt)
	if recipe.Tags == nil {
		recipe.Tags = []string{}
	}

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrRecipeNotFound
		}
		return nil, err
	}

	// Fetch trials
	rows, err := s.db.Query(ctx,
		`SELECT id, recipe_id, date_cooked, result_image_url, notes, modifications, rating, created_at
		 FROM recipe_trials WHERE recipe_id = $1 ORDER BY date_cooked DESC`,
		recipeID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	recipe.Trials = []models.RecipeTrial{}
	for rows.Next() {
		var t models.RecipeTrial
		err := rows.Scan(&t.ID, &t.RecipeID, &t.DateCooked, &t.ResultImageURL, &t.Notes,
			&t.Modifications, &t.Rating, &t.CreatedAt)
		if err != nil {
			return nil, err
		}
		recipe.Trials = append(recipe.Trials, t)
	}

	return recipe, nil
}

func (s *RecipeService) UpdateRecipe(ctx context.Context, userID, recipeID uuid.UUID, req *models.UpdateRecipeRequest) (*models.Recipe, error) {
	// Tags: nil means "don't change"; non-nil (even empty) means overwrite
	var tagsArg interface{}
	if req.Tags != nil {
		tagsArg = req.Tags
	}

	recipe := &models.Recipe{}
	err := s.db.QueryRow(ctx,
		`UPDATE recipes SET
			title = COALESCE($3, title),
			description = COALESCE($4, description),
			target_image_url = COALESCE($5, target_image_url),
			base_ingredients = COALESCE($6, base_ingredients),
			instructions = COALESCE($7, instructions),
			tags = COALESCE($8, tags),
			nutrition = COALESCE($9, nutrition),
			dietary_flags = COALESCE($10, dietary_flags),
			updated_at = NOW()
		 WHERE id = $1 AND user_id = $2
		 RETURNING id, user_id, title, description, target_image_url, base_ingredients, instructions, tags, nutrition, dietary_flags, created_at, updated_at`,
		recipeID, userID, req.Title, req.Description, req.TargetImageURL, req.BaseIngredients, req.Instructions, tagsArg, req.Nutrition, req.DietaryFlags,
	).Scan(&recipe.ID, &recipe.UserID, &recipe.Title, &recipe.Description, &recipe.TargetImageURL,
		&recipe.BaseIngredients, &recipe.Instructions, &recipe.Tags, &recipe.Nutrition, &recipe.DietaryFlags, &recipe.CreatedAt, &recipe.UpdatedAt)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrRecipeNotFound
		}
		return nil, err
	}
	if recipe.Tags == nil {
		recipe.Tags = []string{}
	}
	return recipe, nil
}

func (s *RecipeService) DeleteRecipe(ctx context.Context, userID, recipeID uuid.UUID) error {
	result, err := s.db.Exec(ctx,
		"DELETE FROM recipes WHERE id = $1 AND user_id = $2",
		recipeID, userID,
	)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrRecipeNotFound
	}
	return nil
}

func (s *RecipeService) CreateTrial(ctx context.Context, userID, recipeID uuid.UUID, req *models.CreateTrialRequest) (*models.RecipeTrial, error) {
	// Verify recipe ownership
	var ownerID uuid.UUID
	err := s.db.QueryRow(ctx, "SELECT user_id FROM recipes WHERE id = $1", recipeID).Scan(&ownerID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrRecipeNotFound
		}
		return nil, err
	}
	if ownerID != userID {
		return nil, ErrNotOwner
	}

	modifications := req.Modifications
	if modifications == nil {
		modifications = json.RawMessage("[]")
	}

	dateCooked := req.DateCooked
	var dateCookedVal interface{}
	if dateCooked != nil {
		dateCookedVal = *dateCooked
	}

	trial := &models.RecipeTrial{}
	err = s.db.QueryRow(ctx,
		`INSERT INTO recipe_trials (recipe_id, date_cooked, result_image_url, notes, modifications, rating)
		 VALUES ($1, COALESCE($2, NOW()), $3, $4, $5, $6)
		 RETURNING id, recipe_id, date_cooked, result_image_url, notes, modifications, rating, created_at`,
		recipeID, dateCookedVal, req.ResultImageURL, req.Notes, modifications, req.Rating,
	).Scan(&trial.ID, &trial.RecipeID, &trial.DateCooked, &trial.ResultImageURL, &trial.Notes,
		&trial.Modifications, &trial.Rating, &trial.CreatedAt)

	if err != nil {
		return nil, err
	}
	return trial, nil
}

func (s *RecipeService) DeleteTrial(ctx context.Context, userID, trialID uuid.UUID) error {
	// Verify ownership via JOIN
	result, err := s.db.Exec(ctx,
		`DELETE FROM recipe_trials rt
		 USING recipes r
		 WHERE rt.id = $1 AND rt.recipe_id = r.id AND r.user_id = $2`,
		trialID, userID,
	)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrTrialNotFound
	}
	return nil
}

func (s *RecipeService) UpdateTrial(ctx context.Context, userID, trialID uuid.UUID, req *models.UpdateTrialRequest) (*models.RecipeTrial, error) {
	modifications := req.Modifications
	if modifications == nil {
		modifications = json.RawMessage("[]")
	}

	var dateCookedVal interface{}
	if req.DateCooked != nil {
		dateCookedVal = *req.DateCooked
	}

	trial := &models.RecipeTrial{}
	err := s.db.QueryRow(ctx,
		`UPDATE recipe_trials rt SET
			date_cooked  = COALESCE($3, rt.date_cooked),
			notes        = COALESCE($4, rt.notes),
			modifications = $5,
			rating       = COALESCE($6, rt.rating)
		 FROM recipes r
		 WHERE rt.id = $1 AND rt.recipe_id = r.id AND r.user_id = $2
		 RETURNING rt.id, rt.recipe_id, rt.date_cooked, rt.result_image_url, rt.notes, rt.modifications, rt.rating, rt.created_at`,
		trialID, userID, dateCookedVal, req.Notes, modifications, req.Rating,
	).Scan(&trial.ID, &trial.RecipeID, &trial.DateCooked, &trial.ResultImageURL, &trial.Notes,
		&trial.Modifications, &trial.Rating, &trial.CreatedAt)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrTrialNotFound
		}
		return nil, err
	}
	return trial, nil
}

func (s *RecipeService) PromoteTrial(ctx context.Context, userID, trialID uuid.UUID) (*models.Recipe, error) {
	// Get trial + verify ownership
	var recipeID uuid.UUID
	var modifications json.RawMessage
	err := s.db.QueryRow(ctx,
		`SELECT rt.recipe_id, rt.modifications
		 FROM recipe_trials rt
		 JOIN recipes r ON rt.recipe_id = r.id
		 WHERE rt.id = $1 AND r.user_id = $2`,
		trialID, userID,
	).Scan(&recipeID, &modifications)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrTrialNotFound
		}
		return nil, err
	}

	// Get current ingredients
	var currentIngredients json.RawMessage
	err = s.db.QueryRow(ctx, "SELECT base_ingredients FROM recipes WHERE id = $1", recipeID).Scan(&currentIngredients)
	if err != nil {
		return nil, err
	}

	// Apply modifications to ingredients
	newIngredients := applyModifications(currentIngredients, modifications)

	// Update the recipe
	recipe := &models.Recipe{}
	err = s.db.QueryRow(ctx,
		`UPDATE recipes SET base_ingredients = $1, updated_at = NOW()
		 WHERE id = $2
		 RETURNING id, user_id, title, description, target_image_url, base_ingredients, instructions, created_at, updated_at`,
		newIngredients, recipeID,
	).Scan(&recipe.ID, &recipe.UserID, &recipe.Title, &recipe.Description, &recipe.TargetImageURL,
		&recipe.BaseIngredients, &recipe.Instructions, &recipe.CreatedAt, &recipe.UpdatedAt)

	if err != nil {
		return nil, err
	}
	return recipe, nil
}

// applyModifications merges trial modifications into the base ingredients list.
// Each modification has an "item" and "change" field. If the item exists in base,
// update its amount with the change value. Otherwise append it.
func applyModifications(base, mods json.RawMessage) json.RawMessage {
	type Ingredient struct {
		Item   string `json:"item"`
		Amount string `json:"amount"`
	}
	type Modification struct {
		Item   string `json:"item"`
		Change string `json:"change"`
	}

	var ingredients []Ingredient
	var modifications []Modification

	json.Unmarshal(base, &ingredients)
	json.Unmarshal(mods, &modifications)

	if len(modifications) == 0 {
		return base
	}

	// Build a map for fast lookup
	idx := make(map[string]int)
	for i, ing := range ingredients {
		idx[ing.Item] = i
	}

	for _, mod := range modifications {
		if i, exists := idx[mod.Item]; exists {
			ingredients[i].Amount = mod.Change
		} else {
			ingredients = append(ingredients, Ingredient{Item: mod.Item, Amount: mod.Change})
		}
	}

	result, _ := json.Marshal(ingredients)
	return result
}
