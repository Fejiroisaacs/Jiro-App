package handlers

import (
	"errors"
	"net/http"

	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/models"
	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/services"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type UserHandler struct {
	userService *services.UserService
}

func NewUserHandler(userService *services.UserService) *UserHandler {
	return &UserHandler{userService: userService}
}

func (h *UserHandler) GetMe(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "UNAUTHORIZED", Message: "Not authenticated"},
		})
		return
	}

	user, err := h.userService.GetByID(c.Request.Context(), userID.(uuid.UUID))
	if err != nil {
		c.JSON(http.StatusNotFound, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "User not found"},
		})
		return
	}

	c.JSON(http.StatusOK, user)
}

// UpdateMe handles PATCH /user/me.
// Accepts settings fields (theme, weight_unit, timezone) and/or profile fields
// (username, display_name, bio) in the same request body.
func (h *UserHandler) UpdateMe(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "UNAUTHORIZED", Message: "Not authenticated"},
		})
		return
	}

	// Combined request struct so the caller can send any mix of fields.
	var req struct {
		// Settings fields
		Theme      *string `json:"theme"`
		WeightUnit *string `json:"weight_unit"`
		Timezone   *string `json:"timezone"`
		// Profile fields
		Username    *string `json:"username"`
		DisplayName *string `json:"display_name"`
		Bio         *string `json:"bio"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "VALIDATION_ERROR", Message: err.Error()},
		})
		return
	}

	uid := userID.(uuid.UUID)
	var user *models.User
	var err error

	// Apply settings update if any settings field is present.
	if req.Theme != nil || req.WeightUnit != nil || req.Timezone != nil {
		settingsReq := &models.UpdateSettingsRequest{
			Theme:      req.Theme,
			WeightUnit: req.WeightUnit,
			Timezone:   req.Timezone,
		}
		user, err = h.userService.UpdateSettings(c.Request.Context(), uid, settingsReq)
		if err != nil {
			c.JSON(http.StatusInternalServerError, models.ErrorResponse{
				Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to update settings"},
			})
			return
		}
	}

	// Apply profile update if any profile field is present.
	if req.Username != nil || req.DisplayName != nil || req.Bio != nil {
		profileReq := &models.UpdateProfileRequest{
			Username:    req.Username,
			DisplayName: req.DisplayName,
			Bio:         req.Bio,
		}
		user, err = h.userService.UpdateProfile(c.Request.Context(), uid, profileReq)
		if err != nil {
			if errors.Is(err, services.ErrUsernameTaken) {
				c.JSON(http.StatusConflict, models.ErrorResponse{
					Error: models.ErrorDetail{Code: "USERNAME_TAKEN", Message: "Username is already taken"},
				})
				return
			}
			if errors.Is(err, services.ErrUsernameInvalid) {
				c.JSON(http.StatusBadRequest, models.ErrorResponse{
					Error: models.ErrorDetail{Code: "USERNAME_INVALID", Message: err.Error()},
				})
				return
			}
			c.JSON(http.StatusInternalServerError, models.ErrorResponse{
				Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to update profile"},
			})
			return
		}
	}

	// If nothing was provided, just return the current user.
	if user == nil {
		user, err = h.userService.GetByID(c.Request.Context(), uid)
		if err != nil {
			c.JSON(http.StatusInternalServerError, models.ErrorResponse{
				Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to fetch user"},
			})
			return
		}
	}

	c.JSON(http.StatusOK, user)
}

// GetPublicProfile handles GET /profiles/:username — public, no auth required.
func (h *UserHandler) GetPublicProfile(c *gin.Context) {
	username := c.Param("username")
	pub, err := h.userService.GetByUsername(c.Request.Context(), username)
	if err != nil {
		if errors.Is(err, services.ErrUserNotFound) {
			c.JSON(http.StatusNotFound, models.ErrorResponse{
				Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "User not found"},
			})
			return
		}
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to fetch profile"},
		})
		return
	}

	c.JSON(http.StatusOK, pub)
}
