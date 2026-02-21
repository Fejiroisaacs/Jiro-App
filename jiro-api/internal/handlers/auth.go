package handlers

import (
	"errors"
	"net/http"

	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/config"
	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/models"
	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/services"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type AuthHandler struct {
	authService *services.AuthService
	userService *services.UserService
	cfg         *config.Config
}

func NewAuthHandler(authService *services.AuthService, userService *services.UserService, cfg *config.Config) *AuthHandler {
	return &AuthHandler{authService: authService, userService: userService, cfg: cfg}
}

func (h *AuthHandler) Register(c *gin.Context) {
	var req models.RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "VALIDATION_ERROR", Message: err.Error()},
		})
		return
	}

	exists, err := h.userService.EmailExists(c.Request.Context(), req.Email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to check email availability"},
		})
		return
	}
	if exists {
		c.JSON(http.StatusConflict, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "EMAIL_TAKEN", Message: "Email is already registered"},
		})
		return
	}

	hash, err := h.authService.HashPassword(req.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to process password"},
		})
		return
	}

	user, err := h.userService.CreateUser(c.Request.Context(), req.Email, hash, req.DisplayName, req.Username)
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
			Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to create user"},
		})
		return
	}

	accessToken, err := h.authService.GenerateAccessToken(user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to generate token"},
		})
		return
	}

	h.setRefreshCookie(c, user.ID)

	c.JSON(http.StatusCreated, models.AuthResponse{
		AccessToken: accessToken,
		User:        *user,
	})
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req models.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "VALIDATION_ERROR", Message: err.Error()},
		})
		return
	}

	user, err := h.userService.GetByEmail(c.Request.Context(), req.Email)
	if err != nil {
		c.JSON(http.StatusUnauthorized, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INVALID_CREDENTIALS", Message: "Invalid email or password"},
		})
		return
	}

	if !h.authService.VerifyPassword(user.PasswordHash, req.Password) {
		c.JSON(http.StatusUnauthorized, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INVALID_CREDENTIALS", Message: "Invalid email or password"},
		})
		return
	}

	accessToken, err := h.authService.GenerateAccessToken(user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to generate token"},
		})
		return
	}

	h.setRefreshCookie(c, user.ID)

	user.PasswordHash = ""
	c.JSON(http.StatusOK, models.AuthResponse{
		AccessToken: accessToken,
		User:        *user,
	})
}

func (h *AuthHandler) Refresh(c *gin.Context) {
	rawToken, err := c.Cookie("refresh_token")
	if err != nil {
		c.JSON(http.StatusUnauthorized, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "NO_REFRESH_TOKEN", Message: "No refresh token provided"},
		})
		return
	}

	userID, oldHash, err := h.authService.ValidateRefreshToken(c.Request.Context(), rawToken)
	if err != nil {
		c.JSON(http.StatusUnauthorized, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INVALID_TOKEN", Message: "Invalid or expired refresh token"},
		})
		return
	}

	h.authService.RevokeRefreshToken(c.Request.Context(), oldHash)

	accessToken, err := h.authService.GenerateAccessToken(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to generate token"},
		})
		return
	}

	h.setRefreshCookie(c, userID)

	user, err := h.userService.GetByID(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to fetch user"},
		})
		return
	}

	c.JSON(http.StatusOK, models.AuthResponse{
		AccessToken: accessToken,
		User:        *user,
	})
}

func (h *AuthHandler) Logout(c *gin.Context) {
	rawToken, err := c.Cookie("refresh_token")
	if err == nil {
		if _, hash, err := h.authService.ValidateRefreshToken(c.Request.Context(), rawToken); err == nil {
			h.authService.RevokeRefreshToken(c.Request.Context(), hash)
		}
	}

	secure := h.cfg.Environment == "production"
	c.SetCookie("refresh_token", "", -1, "/api/v1/auth", "", secure, true)
	c.JSON(http.StatusOK, gin.H{"message": "Logged out successfully"})
}

func (h *AuthHandler) setRefreshCookie(c *gin.Context, userID uuid.UUID) {
	rawToken, tokenHash, err := h.authService.GenerateRefreshToken()
	if err != nil {
		return
	}

	h.authService.StoreRefreshToken(c.Request.Context(), userID, tokenHash)

	maxAge := int(h.cfg.RefreshTokenTTL.Seconds())
	secure := h.cfg.Environment == "production"
	c.SetCookie("refresh_token", rawToken, maxAge, "/api/v1/auth", "", secure, true)
}
