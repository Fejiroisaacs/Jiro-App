package handlers

import (
	"net/http"

	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/models"
	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/services"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type RecipeHandler struct {
	recipeService *services.RecipeService
}

func NewRecipeHandler(recipeService *services.RecipeService) *RecipeHandler {
	return &RecipeHandler{recipeService: recipeService}
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

	c.JSON(http.StatusOK, recipe)
}
