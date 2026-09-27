package handlers

import (
	"errors"
	"net/http"

	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/models"
	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/services"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

const invalidInviteMessage = "This invite link is invalid, has expired or was turned off. Ask the group owner for a new one."

// inviteLinkError answers the owner-only link routes' shared failures.
func (h *JournalHandler) inviteLinkError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, services.ErrJournalGroupNotFound):
		c.JSON(http.StatusNotFound, models.ErrorResponse{Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "Group not found"}})
	case errors.Is(err, services.ErrNotOwner):
		c.JSON(http.StatusForbidden, models.ErrorResponse{Error: models.ErrorDetail{Code: "NOT_OWNER", Message: "Only the group owner can manage the invite link"}})
	default:
		log.Error().Err(err).Msg("journal invite link request failed")
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Something went wrong with the invite link"}})
	}
}

func groupIDParam(c *gin.Context) (uuid.UUID, bool) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid group ID"}})
		return uuid.Nil, false
	}
	return id, true
}

// CreateInviteLink handles POST /journal/groups/:id/invite-link; the raw token is in this response only.
func (h *JournalHandler) CreateInviteLink(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	groupID, ok := groupIDParam(c)
	if !ok {
		return
	}
	link, err := h.journalService.CreateInviteLink(c.Request.Context(), userID, groupID)
	if err != nil {
		h.inviteLinkError(c, err)
		return
	}
	c.JSON(http.StatusCreated, link)
}

// GetInviteLink handles GET /journal/groups/:id/invite-link: the working link (never its token) or null.
func (h *JournalHandler) GetInviteLink(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	groupID, ok := groupIDParam(c)
	if !ok {
		return
	}
	link, err := h.journalService.GetInviteLink(c.Request.Context(), userID, groupID)
	if err != nil {
		h.inviteLinkError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"link": link})
}

// DELETE /journal/groups/:id/invite-link
func (h *JournalHandler) RevokeInviteLink(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	groupID, ok := groupIDParam(c)
	if !ok {
		return
	}
	if err := h.journalService.RevokeInviteLink(c.Request.Context(), userID, groupID); err != nil {
		h.inviteLinkError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Invite link turned off"})
}

// PreviewInvite handles GET /journal/groups/join/preview?token=: what a token opens, before joining.
func (h *JournalHandler) PreviewInvite(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	rawToken := c.Query("token")
	if rawToken == "" {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "MISSING_TOKEN", Message: "Token is required"}})
		return
	}
	p, err := h.journalService.PreviewInvite(c.Request.Context(), rawToken, userID)
	if err != nil {
		switch {
		case errors.Is(err, services.ErrInvalidToken):
			c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "INVALID_TOKEN", Message: invalidInviteMessage}})
		case errors.Is(err, services.ErrInviteEmailMismatch):
			c.JSON(http.StatusForbidden, models.ErrorResponse{Error: models.ErrorDetail{Code: "INVITE_EMAIL_MISMATCH", Message: "This invite was sent to a different email address"}})
		default:
			log.Error().Err(err).Msg("journal invite preview failed")
			c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Could not read the invite"}})
		}
		return
	}
	c.JSON(http.StatusOK, p)
}
