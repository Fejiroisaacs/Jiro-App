package handlers

import (
	"net/http"

	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/analytics"
	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/models"
	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/services"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type RecipeHandler struct {
	recipeService *services.RecipeService
	db            *pgxpool.Pool
}

func NewRecipeHandler(recipeService *services.RecipeService, db *pgxpool.Pool) *RecipeHandler {
	return &RecipeHandler{recipeService: recipeService, db: db}
}

func (h *RecipeHandler) Create(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)

	var req models.CreateRecipeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "VALIDATION_ERROR", Message: err.Error()},
		})
		return
	}

	recipe, err := h.recipeService.CreateRecipe(c.Request.Context(), userID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to create recipe"},
		})
		return
	}

	analytics.TrackEvent(h.db, userID, "recipe.create", nil)
	c.JSON(http.StatusCreated, recipe)
}

func (h *RecipeHandler) List(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	search := c.Query("q")

	recipes, err := h.recipeService.ListRecipes(c.Request.Context(), userID, search)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to list recipes"},
		})
		return
	}

	c.JSON(http.StatusOK, recipes)
}

func (h *RecipeHandler) Get(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)

	recipeID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid recipe ID"},
		})
		return
	}

	recipe, err := h.recipeService.GetRecipe(c.Request.Context(), userID, recipeID)
	if err != nil {
		if err == services.ErrRecipeNotFound {
			c.JSON(http.StatusNotFound, models.ErrorResponse{
				Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "Recipe not found"},
			})
			return
		}
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to get recipe"},
		})
		return
	}

	c.JSON(http.StatusOK, recipe)
}

func (h *RecipeHandler) Update(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)

	recipeID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid recipe ID"},
		})
		return
	}

	var req models.UpdateRecipeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "VALIDATION_ERROR", Message: err.Error()},
		})
		return
	}

	recipe, err := h.recipeService.UpdateRecipe(c.Request.Context(), userID, recipeID, &req)
	if err != nil {
		if err == services.ErrRecipeNotFound {
			c.JSON(http.StatusNotFound, models.ErrorResponse{
				Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "Recipe not found"},
			})
			return
		}
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to update recipe"},
		})
		return
	}

	c.JSON(http.StatusOK, recipe)
}

func (h *RecipeHandler) Delete(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)

	recipeID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid recipe ID"},
		})
		return
	}

	if err := h.recipeService.DeleteRecipe(c.Request.Context(), userID, recipeID); err != nil {
		if err == services.ErrRecipeNotFound {
			c.JSON(http.StatusNotFound, models.ErrorResponse{
				Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "Recipe not found"},
			})
			return
		}
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to delete recipe"},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Recipe deleted"})
}

func (h *RecipeHandler) CreateTrial(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)

	recipeID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid recipe ID"},
		})
		return
	}

	var req models.CreateTrialRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "VALIDATION_ERROR", Message: err.Error()},
		})
		return
	}

	trial, err := h.recipeService.CreateTrial(c.Request.Context(), userID, recipeID, &req)
	if err != nil {
		if err == services.ErrRecipeNotFound {
			c.JSON(http.StatusNotFound, models.ErrorResponse{
				Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "Recipe not found"},
			})
			return
		}
		if err == services.ErrNotOwner {
			c.JSON(http.StatusForbidden, models.ErrorResponse{
				Error: models.ErrorDetail{Code: "FORBIDDEN", Message: "You do not own this recipe"},
			})
			return
		}
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to create trial"},
		})
		return
	}

	c.JSON(http.StatusCreated, trial)
}

func (h *RecipeHandler) UpdateTrial(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)

	trialID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid trial ID"},
		})
		return
	}

	var req models.UpdateTrialRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "VALIDATION_ERROR", Message: err.Error()},
		})
		return
	}

	trial, err := h.recipeService.UpdateTrial(c.Request.Context(), userID, trialID, &req)
	if err != nil {
		if err == services.ErrTrialNotFound {
			c.JSON(http.StatusNotFound, models.ErrorResponse{
				Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "Trial not found"},
			})
			return
		}
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to update trial"},
		})
		return
	}

	c.JSON(http.StatusOK, trial)
}

func (h *RecipeHandler) DeleteTrial(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)

	trialID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid trial ID"},
		})
		return
	}

	if err := h.recipeService.DeleteTrial(c.Request.Context(), userID, trialID); err != nil {
		if err == services.ErrTrialNotFound {
			c.JSON(http.StatusNotFound, models.ErrorResponse{
				Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "Trial not found"},
			})
			return
		}
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to delete trial"},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Trial deleted"})
}

func (h *RecipeHandler) Promote(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)

	trialID, err := uuid.Parse(c.Param("trial_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid trial ID"},
		})
		return
	}

	recipe, err := h.recipeService.PromoteTrial(c.Request.Context(), userID, trialID)
	if err != nil {
		if err == services.ErrTrialNotFound {
			c.JSON(http.StatusNotFound, models.ErrorResponse{
				Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "Trial not found"},
			})
			return
		}
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to promote trial"},
		})
		return
	}

	analytics.TrackEvent(h.db, userID, "recipe.cook", nil)
	c.JSON(http.StatusOK, recipe)
}

func (h *RecipeHandler) CookStreak(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)

	streak, err := h.recipeService.GetCookStreak(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to compute cook streak"},
		})
		return
	}

	c.JSON(http.StatusOK, streak)
}

// ─── Collections ────────────────────────────────────────────────────

func (h *RecipeHandler) ListCollections(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)

	collections, err := h.recipeService.ListCollections(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to list collections"},
		})
		return
	}

	c.JSON(http.StatusOK, collections)
}

func (h *RecipeHandler) CreateCollection(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)

	var req models.CreateCollectionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "VALIDATION_ERROR", Message: err.Error()},
		})
		return
	}

	collection, err := h.recipeService.CreateCollection(c.Request.Context(), userID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to create collection"},
		})
		return
	}

	c.JSON(http.StatusCreated, collection)
}

func (h *RecipeHandler) UpdateCollection(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	collectionID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid collection ID"},
		})
		return
	}

	var req models.UpdateCollectionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "VALIDATION_ERROR", Message: err.Error()},
		})
		return
	}

	collection, err := h.recipeService.UpdateCollection(c.Request.Context(), userID, collectionID, &req)
	if err != nil {
		c.JSON(http.StatusNotFound, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "Collection not found"},
		})
		return
	}

	c.JSON(http.StatusOK, collection)
}

func (h *RecipeHandler) DeleteCollection(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	collectionID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid collection ID"},
		})
		return
	}

	if err := h.recipeService.DeleteCollection(c.Request.Context(), userID, collectionID); err != nil {
		c.JSON(http.StatusNotFound, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "Collection not found"},
		})
		return
	}

	c.JSON(http.StatusNoContent, nil)
}

func (h *RecipeHandler) AddToCollection(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	collectionID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid collection ID"},
		})
		return
	}

	var body struct {
		RecipeID string `json:"recipe_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "VALIDATION_ERROR", Message: err.Error()},
		})
		return
	}

	recipeID, err := uuid.Parse(body.RecipeID)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid recipe ID"},
		})
		return
	}

	if err := h.recipeService.AddToCollection(c.Request.Context(), userID, collectionID, recipeID); err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to add recipe to collection"},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func (h *RecipeHandler) RemoveFromCollection(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	collectionID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid collection ID"},
		})
		return
	}

	recipeID, err := uuid.Parse(c.Param("recipe_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid recipe ID"},
		})
		return
	}

	if err := h.recipeService.RemoveFromCollection(c.Request.Context(), userID, collectionID, recipeID); err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to remove recipe from collection"},
		})
		return
	}

	c.JSON(http.StatusNoContent, nil)
}

func (h *RecipeHandler) GetCollectionRecipeIDs(c *gin.Context) {
	collectionID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid collection ID"},
		})
		return
	}

	ids, err := h.recipeService.GetCollectionRecipeIDs(c.Request.Context(), collectionID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to get recipe IDs"},
		})
		return
	}

	strIDs := make([]string, len(ids))
	for i, id := range ids {
		strIDs[i] = id.String()
	}
	if strIDs == nil {
		strIDs = []string{}
	}

	c.JSON(http.StatusOK, strIDs)
}
