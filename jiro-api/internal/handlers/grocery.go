package handlers

// Grocery list endpoints (Culinara). Every write returns the whole list.

import (
	"errors"
	"net/http"

	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/models"
	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/services"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func groceryError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, services.ErrGroceryItemNotFound):
		c.JSON(http.StatusNotFound, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "Grocery item not found"},
		})
	case errors.Is(err, services.ErrRecipeNotFound):
		c.JSON(http.StatusNotFound, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "Recipe not found"},
		})
	case errors.Is(err, services.ErrMealPlanNotFound), errors.Is(err, services.ErrNotOwner):
		c.JSON(http.StatusNotFound, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "Meal plan not found"},
		})
	case errors.Is(err, services.ErrGroceryListFull):
		c.JSON(http.StatusUnprocessableEntity, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "GROCERY_LIST_FULL", Message: "Your grocery list is full. Clear some items first."},
		})
	default:
		respondInternal(c, err, "grocery list request failed")
	}
}

func groceryBadRequest(c *gin.Context, msg string) {
	c.JSON(http.StatusBadRequest, models.ErrorResponse{
		Error: models.ErrorDetail{Code: "VALIDATION_ERROR", Message: msg},
	})
}

func groceryParamID(c *gin.Context, name string) (uuid.UUID, bool) {
	id, err := uuid.Parse(c.Param(name))
	if err != nil {
		groceryBadRequest(c, "Invalid "+name)
		return uuid.Nil, false
	}
	return id, true
}

// GET /culinara/grocery-list
func (h *RecipeHandler) ListGroceryItems(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	items, err := h.recipeService.ListGroceryItems(c.Request.Context(), userID)
	if err != nil {
		groceryError(c, err)
		return
	}
	c.JSON(http.StatusOK, models.GroceryList{Items: items})
}

// POST /culinara/grocery-list/items  {item, amount}
func (h *RecipeHandler) AddGroceryItem(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	var req models.AddGroceryItemRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		groceryBadRequest(c, err.Error())
		return
	}
	list, err := h.recipeService.AddGroceryItem(c.Request.Context(), userID, &req)
	if err != nil {
		groceryError(c, err)
		return
	}
	c.JSON(http.StatusOK, list)
}

// POST /culinara/grocery-list/recipes/:recipe_id
func (h *RecipeHandler) AddRecipeToGroceryList(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	recipeID, ok := groceryParamID(c, "recipe_id")
	if !ok {
		return
	}
	list, err := h.recipeService.AddRecipeToGroceryList(c.Request.Context(), userID, recipeID)
	if err != nil {
		groceryError(c, err)
		return
	}
	c.JSON(http.StatusOK, list)
}

// POST /culinara/grocery-list/meal-plan/:plan_id
func (h *RecipeHandler) AddMealPlanToGroceryList(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	planID, ok := groceryParamID(c, "plan_id")
	if !ok {
		return
	}
	list, err := h.recipeService.AddMealPlanToGroceryList(c.Request.Context(), userID, planID)
	if err != nil {
		groceryError(c, err)
		return
	}
	c.JSON(http.StatusOK, list)
}

// ImportGroceryList handles POST /culinara/grocery-list/import: a one-off browser upload, no-op if a list exists.
func (h *RecipeHandler) ImportGroceryList(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	var req models.ImportGroceryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		groceryBadRequest(c, err.Error())
		return
	}
	list, err := h.recipeService.ImportGroceryList(c.Request.Context(), userID, req.Items)
	if err != nil {
		groceryError(c, err)
		return
	}
	c.JSON(http.StatusOK, list)
}

// PATCH /culinara/grocery-list/items/:id  {checked}
func (h *RecipeHandler) UpdateGroceryItem(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	id, ok := groceryParamID(c, "id")
	if !ok {
		return
	}
	var req models.UpdateGroceryItemRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		groceryBadRequest(c, err.Error())
		return
	}
	item, err := h.recipeService.SetGroceryItemChecked(c.Request.Context(), userID, id, *req.Checked)
	if err != nil {
		groceryError(c, err)
		return
	}
	c.JSON(http.StatusOK, item)
}

// SetGroceryChecked handles POST /culinara/grocery-list/check for the given ids, or every item when empty.
func (h *RecipeHandler) SetGroceryChecked(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	var req models.SetGroceryCheckedRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		groceryBadRequest(c, err.Error())
		return
	}
	list, err := h.recipeService.SetGroceryChecked(c.Request.Context(), userID, req.IDs, req.Checked)
	if err != nil {
		groceryError(c, err)
		return
	}
	c.JSON(http.StatusOK, list)
}

// DELETE /culinara/grocery-list/items/:id
func (h *RecipeHandler) DeleteGroceryItem(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	id, ok := groceryParamID(c, "id")
	if !ok {
		return
	}
	if err := h.recipeService.DeleteGroceryItem(c.Request.Context(), userID, id); err != nil {
		groceryError(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

// DELETE /culinara/grocery-list/checked
func (h *RecipeHandler) ClearCheckedGroceryItems(c *gin.Context) {
	h.clearGroceryList(c, true)
}

// DELETE /culinara/grocery-list
func (h *RecipeHandler) ClearGroceryList(c *gin.Context) {
	h.clearGroceryList(c, false)
}

func (h *RecipeHandler) clearGroceryList(c *gin.Context, onlyChecked bool) {
	userID := c.MustGet("user_id").(uuid.UUID)
	list, err := h.recipeService.ClearGroceryList(c.Request.Context(), userID, onlyChecked)
	if err != nil {
		groceryError(c, err)
		return
	}
	c.JSON(http.StatusOK, list)
}
