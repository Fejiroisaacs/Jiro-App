package handlers

import (
	"context"
	"errors"
	"fmt"
	"net/http"

	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/analytics"
	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/config"
	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/middleware"
	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/models"
	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/services"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog/log"
)

type AuthHandler struct {
	authService   *services.AuthService
	userService   *services.UserService
	emailService  *services.EmailService
	ledgerService *services.LedgerService
	failTracker   *middleware.LoginFailTracker
	cfg           *config.Config
	appBaseURL    string
	db            *pgxpool.Pool
}

func NewAuthHandler(authService *services.AuthService, userService *services.UserService, emailService *services.EmailService, ledgerService *services.LedgerService, failTracker *middleware.LoginFailTracker, cfg *config.Config, db *pgxpool.Pool) *AuthHandler {
	return &AuthHandler{
		authService:   authService,
		userService:   userService,
		emailService:  emailService,
		ledgerService: ledgerService,
		failTracker:   failTracker,
		cfg:           cfg,
		appBaseURL:    cfg.AppBaseURL,
		db:            db,
	}
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
	analytics.TrackEvent(h.db, user.ID, "user.register", nil)

	// Seed default ledger categories asynchronously
	go h.ledgerService.SeedDefaultCategories(context.Background(), user.ID)

	// Send verification email asynchronously — don't block the response
	go func() {
		rawToken, err := h.authService.CreateEmailVerification(context.Background(), user.ID)
		if err != nil {
			log.Error().Err(err).Msg("Failed to create email verification token")
			return
		}
		link := fmt.Sprintf("%s/verify-email?token=%s", h.appBaseURL, rawToken)
		body := buildEmailHTML(
			"Welcome to Jiro! Made with ❤️ by Fejiro :)",
			"Thanks for signing up. Please verify your email address to get started.",
			link,
			"Verify Email",
			"If you didn't create a Jiro account, you can safely ignore this email.",
		)
		if err := h.emailService.Send(user.Email, "Verify your Jiro account", body); err != nil {
			log.Error().Err(err).Msg("Failed to send verification email")
		}
	}()

	c.JSON(http.StatusCreated, models.AuthResponse{
		AccessToken: accessToken,
		User:        *user,
	})
}

func (h *AuthHandler) Login(c *gin.Context) {
	ip := c.ClientIP()
	if h.failTracker.IsBlocked(ip) {
		c.JSON(http.StatusTooManyRequests, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "RATE_LIMITED", Message: "Too many failed attempts. Try again in 15 minutes."},
		})
		return
	}

	var req models.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "VALIDATION_ERROR", Message: err.Error()},
		})
		return
	}

	user, err := h.userService.GetByEmail(c.Request.Context(), req.Email)
	if err != nil {
		h.failTracker.RecordFail(ip)
		c.JSON(http.StatusUnauthorized, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INVALID_CREDENTIALS", Message: "Invalid email or password"},
		})
		return
	}

	if !h.authService.VerifyPassword(user.PasswordHash, req.Password) {
		h.failTracker.RecordFail(ip)
		c.JSON(http.StatusUnauthorized, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INVALID_CREDENTIALS", Message: "Invalid email or password"},
		})
		return
	}

	h.failTracker.RecordSuccess(ip)

	accessToken, err := h.authService.GenerateAccessToken(user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to generate token"},
		})
		return
	}

	h.setRefreshCookie(c, user.ID)
	analytics.TrackEvent(h.db, user.ID, "user.login", nil)

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
	c.SetSameSite(http.SameSiteStrictMode)
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
	c.SetSameSite(http.SameSiteStrictMode)
	c.SetCookie("refresh_token", rawToken, maxAge, "/api/v1/auth", "", secure, true)
}

func (h *AuthHandler) VerifyEmail(c *gin.Context) {
	var req models.VerifyEmailRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "VALIDATION_ERROR", Message: err.Error()},
		})
		return
	}

	userID, err := h.authService.VerifyEmailToken(c.Request.Context(), req.Token)
	if err != nil {
		if errors.Is(err, services.ErrTokenExpired) {
			c.JSON(http.StatusBadRequest, models.ErrorResponse{
				Error: models.ErrorDetail{Code: "EXPIRED_TOKEN", Message: "Verification link has expired"},
			})
			return
		}
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INVALID_TOKEN", Message: "Invalid verification link"},
		})
		return
	}

	if err := h.userService.SetEmailVerified(c.Request.Context(), userID); err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to verify email"},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Email verified successfully"})
}

func (h *AuthHandler) ResendVerification(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "UNAUTHORIZED", Message: "Not authenticated"},
		})
		return
	}

	user, err := h.userService.GetByID(c.Request.Context(), userID.(uuid.UUID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to fetch user"},
		})
		return
	}

	if user.EmailVerified {
		c.JSON(http.StatusOK, gin.H{"message": "Email is already verified"})
		return
	}

	rawToken, err := h.authService.CreateEmailVerification(c.Request.Context(), userID.(uuid.UUID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to create verification token"},
		})
		return
	}

	link := fmt.Sprintf("%s/verify-email?token=%s", h.appBaseURL, rawToken)
	body := buildEmailHTML(
		"Verify Your Email",
		"Here's a new verification link for your Jiro account.",
		link,
		"Verify Email",
		"If you didn't request this, you can safely ignore this email.",
	)
	go h.emailService.Send(user.Email, "Verify your Jiro account", body)

	c.JSON(http.StatusOK, gin.H{"message": "Verification email sent"})
}

func (h *AuthHandler) ForgotPassword(c *gin.Context) {
	var req models.ForgotPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		// Always return 200 to prevent email enumeration
		c.JSON(http.StatusOK, gin.H{"message": "If that email is registered, you'll receive a reset link"})
		return
	}

	user, err := h.userService.GetByEmail(c.Request.Context(), req.Email)
	if err != nil {
		// User not found — still return 200
		c.JSON(http.StatusOK, gin.H{"message": "If that email is registered, you'll receive a reset link"})
		return
	}

	rawToken, err := h.authService.CreatePasswordReset(c.Request.Context(), user.ID)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "If that email is registered, you'll receive a reset link"})
		return
	}

	link := fmt.Sprintf("%s/reset-password?token=%s", h.appBaseURL, rawToken)
	body := buildEmailHTML(
		"Reset Your Password",
		"You requested a password reset for your Jiro account. Click the button below to set a new password.",
		link,
		"Reset Password",
		"This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email.",
	)
	go h.emailService.Send(user.Email, "Reset your Jiro password", body)

	c.JSON(http.StatusOK, gin.H{"message": "If that email is registered, you'll receive a reset link"})
}

func (h *AuthHandler) ResetPassword(c *gin.Context) {
	var req models.ResetPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "VALIDATION_ERROR", Message: err.Error()},
		})
		return
	}

	newHash, err := h.authService.HashPassword(req.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to process password"},
		})
		return
	}

	if err := h.authService.ConsumePasswordReset(c.Request.Context(), req.Token, newHash); err != nil {
		if errors.Is(err, services.ErrTokenExpired) {
			c.JSON(http.StatusBadRequest, models.ErrorResponse{
				Error: models.ErrorDetail{Code: "EXPIRED_TOKEN", Message: "Reset link has expired"},
			})
			return
		}
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INVALID_TOKEN", Message: "Invalid or already used reset link"},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Password updated successfully"})
}

func buildEmailHTML(heading, message, actionURL, buttonText, footer string) string {
	return fmt.Sprintf(`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#1a1a1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background-color:#1a1a1a;padding:40px 20px;">
    <tr><td align="center">
      <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#252525;border-radius:12px;overflow:hidden;">
        <!-- Header -->
        <tr><td style="padding:32px 32px 0;text-align:center;">
          <h1 style="margin:0;font-size:28px;font-weight:700;color:#e8ddd3;letter-spacing:-0.5px;">Jiro</h1>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:24px 32px 32px;">
          <h2 style="margin:0 0 12px;font-size:20px;font-weight:600;color:#e0d4c8;">%s</h2>
          <p style="margin:0 0 28px;font-size:15px;line-height:1.6;color:#a39888;">%s</p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
            <tr><td style="border-radius:8px;background-color:#7a3b2e;">
              <a href="%s" target="_blank" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">%s</a>
            </td></tr>
          </table>
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:0 32px 28px;">
          <p style="margin:0;font-size:13px;line-height:1.5;color:#6b5e52;text-align:center;">%s</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`, heading, message, actionURL, buttonText, footer)
}
