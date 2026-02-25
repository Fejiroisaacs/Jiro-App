package handlers

import (
	"fmt"
	"net/http"
	"strconv"

	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/services"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

type AdminHandler struct {
	adminService *services.AdminService
	authService  *services.AuthService
	userService  *services.UserService
	emailService *services.EmailService
	appBaseURL   string
}

func NewAdminHandler(adminService *services.AdminService, authService *services.AuthService, userService *services.UserService, emailService *services.EmailService, appBaseURL string) *AdminHandler {
	return &AdminHandler{
		adminService: adminService,
		authService:  authService,
		userService:  userService,
		emailService: emailService,
		appBaseURL:   appBaseURL,
	}
}

func (h *AdminHandler) GetStats(c *gin.Context) {
	stats, err := h.adminService.GetStats(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch stats"})
		return
	}
	c.JSON(http.StatusOK, stats)
}

func (h *AdminHandler) ListUsers(c *gin.Context) {
	search := c.Query("q")
	limit, offset := paginate(c)

	users, err := h.adminService.ListUsers(c.Request.Context(), search, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list users"})
		return
	}
	c.JSON(http.StatusOK, users)
}

func (h *AdminHandler) GetUser(c *gin.Context) {
	userID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}
	user, err := h.adminService.GetUser(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}
	c.JSON(http.StatusOK, user)
}

func (h *AdminHandler) DeleteUser(c *gin.Context) {
	userID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}
	if err := h.adminService.DeleteUser(c.Request.Context(), userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete user"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "User deleted"})
}

// SendPasswordReset triggers a password-reset email for the user.
// The admin never sees or sets the password — the user resets it themselves.
func (h *AdminHandler) SendPasswordReset(c *gin.Context) {
	userID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}
	user, err := h.userService.GetByID(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}
	rawToken, err := h.authService.CreatePasswordReset(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create reset token"})
		return
	}
	link := fmt.Sprintf("%s/reset-password?token=%s", h.appBaseURL, rawToken)
	body := buildEmailHTML(
		"Reset Your Password",
		"An admin has initiated a password reset for your Jiro account. Click below to set a new password.",
		link,
		"Reset Password",
		"This link expires in 1 hour. If you did not expect this, contact support.",
	)
	go func() {
		if err := h.emailService.Send(user.Email, "Reset your Jiro password", body); err != nil {
			log.Error().Err(err).Msg("admin: failed to send password reset email")
		}
	}()
	c.JSON(http.StatusOK, gin.H{"message": "Password reset email sent"})
}

func (h *AdminHandler) RevokeUserSessions(c *gin.Context) {
	userID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}
	if err := h.adminService.RevokeUserSessions(c.Request.Context(), userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to revoke sessions"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Sessions revoked"})
}

func (h *AdminHandler) ListEvents(c *gin.Context) {
	event := c.Query("event")
	userIDStr := c.Query("user_id")
	limit, offset := paginate(c)

	events, err := h.adminService.ListEvents(c.Request.Context(), event, userIDStr, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list events"})
		return
	}
	c.JSON(http.StatusOK, events)
}

func paginate(c *gin.Context) (limit, offset int) {
	limit = 50
	page := 1
	if l := c.Query("limit"); l != "" {
		if n, err := strconv.Atoi(l); err == nil && n > 0 && n <= 200 {
			limit = n
		}
	}
	if p := c.Query("page"); p != "" {
		if n, err := strconv.Atoi(p); err == nil && n > 1 {
			page = n
		}
	}
	return limit, (page - 1) * limit
}
