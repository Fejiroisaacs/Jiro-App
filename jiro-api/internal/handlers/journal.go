package handlers

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/models"
	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/services"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

var allowedJournalImageTypes = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/webp": ".webp",
}

const maxJournalImageBytes = 10 * 1024 * 1024 // 10 MB

type JournalHandler struct {
	journalService *services.JournalService
	emailService   *services.EmailService
	storage        *services.StorageService
	appBaseURL     string
}

func NewJournalHandler(js *services.JournalService, es *services.EmailService, ss *services.StorageService, appBaseURL string) *JournalHandler {
	return &JournalHandler{journalService: js, emailService: es, storage: ss, appBaseURL: appBaseURL}
}

// ─── Entries ───────────────────────────────────────────────────────────────

// POST /journal/entries
func (h *JournalHandler) CreateEntry(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)

	var req models.CreateJournalEntryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "VALIDATION_ERROR", Message: err.Error()}})
		return
	}
	if req.Mood != nil && !h.journalService.ValidateMood(*req.Mood) {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "INVALID_MOOD", Message: "Invalid mood value"}})
		return
	}

	entry, err := h.journalService.CreateEntry(c.Request.Context(), userID, nil, &req)
	if err != nil {
		log.Error().Err(err).Msg("Failed to create journal entry")
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to create entry"}})
		return
	}
	c.JSON(http.StatusCreated, entry)
}

// GET /journal/entries
func (h *JournalHandler) ListEntries(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	entries, err := h.journalService.ListEntries(c.Request.Context(), userID,
		c.Query("mood"), c.Query("tag"), c.Query("q"),
		c.Query("from"), c.Query("to"),
		limit, offset)
	if err != nil {
		log.Error().Err(err).Msg("Failed to list journal entries")
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to list entries"}})
		return
	}
	c.JSON(http.StatusOK, entries)
}

// GET /journal/entries/:id
func (h *JournalHandler) GetEntry(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	entryID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid entry ID"}})
		return
	}

	entry, err := h.journalService.GetEntry(c.Request.Context(), userID, entryID)
	if err != nil {
		if err == services.ErrJournalEntryNotFound {
			c.JSON(http.StatusNotFound, models.ErrorResponse{Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "Entry not found"}})
			return
		}
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to get entry"}})
		return
	}
	c.JSON(http.StatusOK, entry)
}

// PUT /journal/entries/:id
func (h *JournalHandler) UpdateEntry(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	entryID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid entry ID"}})
		return
	}

	var req models.UpdateJournalEntryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "VALIDATION_ERROR", Message: err.Error()}})
		return
	}
	if req.Mood != nil && *req.Mood != "" && !h.journalService.ValidateMood(*req.Mood) {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "INVALID_MOOD", Message: "Invalid mood value"}})
		return
	}

	entry, err := h.journalService.UpdateEntry(c.Request.Context(), userID, entryID, &req)
	if err != nil {
		if err == services.ErrJournalEntryNotFound {
			c.JSON(http.StatusNotFound, models.ErrorResponse{Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "Entry not found"}})
			return
		}
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to update entry"}})
		return
	}
	c.JSON(http.StatusOK, entry)
}

// DELETE /journal/entries/:id
func (h *JournalHandler) DeleteEntry(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	entryID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid entry ID"}})
		return
	}

	objectKeys, err := h.journalService.DeleteEntry(c.Request.Context(), userID, entryID)
	if err != nil {
		if err == services.ErrJournalEntryNotFound {
			c.JSON(http.StatusNotFound, models.ErrorResponse{Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "Entry not found"}})
			return
		}
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to delete entry"}})
		return
	}

	// Clean up R2 objects asynchronously
	go func() {
		for _, key := range objectKeys {
			if err := h.storage.DeleteObject(context.Background(), key); err != nil {
				log.Error().Err(err).Str("key", key).Msg("Failed to delete journal image from R2")
			}
		}
	}()

	c.JSON(http.StatusOK, gin.H{"message": "Entry deleted"})
}

// ─── Streak & Calendar ─────────────────────────────────────────────────────

// GET /journal/streak
func (h *JournalHandler) GetStreak(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	resp, err := h.journalService.GetStreak(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to get streak"}})
		return
	}
	c.JSON(http.StatusOK, resp)
}

// GET /journal/calendar?year=2026&month=2
func (h *JournalHandler) GetCalendar(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	now := time.Now()
	year, _ := strconv.Atoi(c.DefaultQuery("year", strconv.Itoa(now.Year())))
	month, _ := strconv.Atoi(c.DefaultQuery("month", strconv.Itoa(int(now.Month()))))

	resp, err := h.journalService.GetCalendar(c.Request.Context(), userID, year, month, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to get calendar"}})
		return
	}
	c.JSON(http.StatusOK, resp)
}

// ─── Images ────────────────────────────────────────────────────────────────

// POST /journal/entries/:id/images/presign
func (h *JournalHandler) PresignImage(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	entryID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid entry ID"}})
		return
	}

	var req models.PresignJournalImageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "VALIDATION_ERROR", Message: err.Error()}})
		return
	}

	ext, ok := allowedJournalImageTypes[strings.ToLower(req.ContentType)]
	if !ok {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "INVALID_TYPE", Message: "content_type must be image/jpeg, image/png, or image/webp"}})
		return
	}
	if req.ContentLength <= 0 || req.ContentLength > maxJournalImageBytes {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "INVALID_SIZE", Message: "file must be between 1 byte and 10 MB"}})
		return
	}

	// Verify entry ownership
	entry, err := h.journalService.GetEntry(c.Request.Context(), userID, entryID)
	if err != nil || entry.UserID != userID {
		c.JSON(http.StatusNotFound, models.ErrorResponse{Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "Entry not found"}})
		return
	}

	count, _ := h.journalService.CountImages(c.Request.Context(), entryID)
	if count >= 3 {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "IMAGE_LIMIT", Message: "Entry already has 3 images"}})
		return
	}

	objectKey := services.JournalImageObjectKey(userID, entryID, ext)
	uploadURL, _, err := h.storage.PresignPutObject(c.Request.Context(), objectKey)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: models.ErrorDetail{Code: "STORAGE_ERROR", Message: "Failed to generate upload URL"}})
		return
	}

	c.JSON(http.StatusOK, gin.H{"upload_url": uploadURL, "object_key": objectKey})
}

// POST /journal/entries/:id/images/confirm
func (h *JournalHandler) ConfirmImage(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	entryID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid entry ID"}})
		return
	}

	var req models.ConfirmJournalImageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "VALIDATION_ERROR", Message: err.Error()}})
		return
	}

	expectedPrefix := fmt.Sprintf("journal/%s/%s/", userID, entryID)
	if !strings.HasPrefix(req.ObjectKey, expectedPrefix) {
		c.JSON(http.StatusForbidden, models.ErrorResponse{Error: models.ErrorDetail{Code: "FORBIDDEN", Message: "Invalid object key"}})
		return
	}

	fileURL := h.storage.PublicURL(req.ObjectKey)
	img, err := h.journalService.CreateImage(c.Request.Context(), entryID, userID, req.ObjectKey, fileURL)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to save image"}})
		return
	}
	c.JSON(http.StatusCreated, img)
}

// DELETE /journal/images/:image_id
func (h *JournalHandler) DeleteImage(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	imageID, err := uuid.Parse(c.Param("image_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid image ID"}})
		return
	}

	img, err := h.journalService.GetImage(c.Request.Context(), imageID)
	if err != nil {
		c.JSON(http.StatusNotFound, models.ErrorResponse{Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "Image not found"}})
		return
	}
	if img.UserID != userID {
		c.JSON(http.StatusForbidden, models.ErrorResponse{Error: models.ErrorDetail{Code: "FORBIDDEN", Message: "Not your image"}})
		return
	}

	go h.storage.DeleteObject(context.Background(), img.ObjectKey)
	h.journalService.DeleteImage(c.Request.Context(), imageID)
	c.JSON(http.StatusOK, gin.H{"message": "Image deleted"})
}

// ─── Groups ────────────────────────────────────────────────────────────────

// POST /journal/groups
func (h *JournalHandler) CreateGroup(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)

	var req models.CreateJournalGroupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "VALIDATION_ERROR", Message: err.Error()}})
		return
	}

	group, err := h.journalService.CreateGroup(c.Request.Context(), userID, req.Name)
	if err != nil {
		log.Error().Err(err).Msg("Failed to create journal group")
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to create group"}})
		return
	}
	c.JSON(http.StatusCreated, group)
}

// GET /journal/groups
func (h *JournalHandler) ListGroups(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	groups, err := h.journalService.ListGroups(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to list groups"}})
		return
	}
	c.JSON(http.StatusOK, groups)
}

// GET /journal/groups/:id
func (h *JournalHandler) GetGroup(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	groupID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid group ID"}})
		return
	}

	group, err := h.journalService.GetGroup(c.Request.Context(), userID, groupID)
	if err != nil {
		if err == services.ErrJournalGroupNotFound {
			c.JSON(http.StatusNotFound, models.ErrorResponse{Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "Group not found"}})
			return
		}
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to get group"}})
		return
	}
	c.JSON(http.StatusOK, group)
}

// PUT /journal/groups/:id
func (h *JournalHandler) UpdateGroup(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	groupID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid group ID"}})
		return
	}

	var req models.UpdateJournalGroupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "VALIDATION_ERROR", Message: err.Error()}})
		return
	}

	group, err := h.journalService.UpdateGroup(c.Request.Context(), userID, groupID, req.Name)
	if err != nil {
		if err == services.ErrJournalGroupNotFound {
			c.JSON(http.StatusNotFound, models.ErrorResponse{Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "Group not found"}})
			return
		}
		if err == services.ErrNotOwner {
			c.JSON(http.StatusForbidden, models.ErrorResponse{Error: models.ErrorDetail{Code: "FORBIDDEN", Message: "Only the group owner can rename it"}})
			return
		}
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to update group"}})
		return
	}
	c.JSON(http.StatusOK, group)
}

// DELETE /journal/groups/:id
func (h *JournalHandler) DeleteGroup(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	groupID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid group ID"}})
		return
	}

	if err := h.journalService.DeleteGroup(c.Request.Context(), userID, groupID); err != nil {
		if err == services.ErrJournalGroupNotFound {
			c.JSON(http.StatusNotFound, models.ErrorResponse{Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "Group not found"}})
			return
		}
		if err == services.ErrNotOwner {
			c.JSON(http.StatusForbidden, models.ErrorResponse{Error: models.ErrorDetail{Code: "FORBIDDEN", Message: "Only the group owner can delete it"}})
			return
		}
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to delete group"}})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Group deleted"})
}

// POST /journal/groups/:id/invite
func (h *JournalHandler) InviteMember(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	groupID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid group ID"}})
		return
	}

	var req models.InviteGroupMemberRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "VALIDATION_ERROR", Message: err.Error()}})
		return
	}

	// Verify inviter is a member
	group, err := h.journalService.GetGroup(c.Request.Context(), userID, groupID)
	if err != nil {
		c.JSON(http.StatusNotFound, models.ErrorResponse{Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "Group not found"}})
		return
	}

	// Look up invitee
	inviteeID, _, err := h.journalService.LookupUserByEmail(c.Request.Context(), req.Email)
	if err != nil {
		if err == services.ErrUserNotFound {
			c.JSON(http.StatusNotFound, models.ErrorResponse{Error: models.ErrorDetail{Code: "USER_NOT_FOUND", Message: "No Jiro account found with that email."}})
			return
		}
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to look up user"}})
		return
	}

	already, _ := h.journalService.IsMember(c.Request.Context(), groupID, inviteeID)
	if already {
		c.JSON(http.StatusConflict, models.ErrorResponse{Error: models.ErrorDetail{Code: "ALREADY_MEMBER", Message: "User is already a member of this group"}})
		return
	}

	rawToken, err := h.journalService.CreateGroupInvite(c.Request.Context(), groupID, req.Email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to create invite"}})
		return
	}

	h.journalService.EnsurePendingMember(c.Request.Context(), groupID, inviteeID, userID)

	// Send emails asynchronously
	go func() {
		inviteLink := fmt.Sprintf("%s/journal/join?token=%s", h.appBaseURL, rawToken)
		inviteBody := fmt.Sprintf(`<p>You've been invited to join <strong>%s</strong> on Journaly.</p><p><a href="%s">Accept Invite</a></p>`, group.Name, inviteLink)
		if err := h.emailService.Send(req.Email, fmt.Sprintf("Join %s on Journaly", group.Name), inviteBody); err != nil {
			log.Error().Err(err).Msg("Failed to send group invite email")
		}
	}()

	c.JSON(http.StatusOK, gin.H{"message": "Invite sent."})
}

// DELETE /journal/groups/:id/members/:user_id
func (h *JournalHandler) RemoveMember(c *gin.Context) {
	requesterID := c.MustGet("user_id").(uuid.UUID)
	groupID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid group ID"}})
		return
	}
	targetID, err := uuid.Parse(c.Param("user_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid user ID"}})
		return
	}

	if err := h.journalService.RemoveMember(c.Request.Context(), requesterID, groupID, targetID); err != nil {
		if err == services.ErrNotOwner {
			c.JSON(http.StatusForbidden, models.ErrorResponse{Error: models.ErrorDetail{Code: "FORBIDDEN", Message: err.Error()}})
			return
		}
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "BAD_REQUEST", Message: err.Error()}})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Member removed"})
}

// POST /journal/groups/join?token=xxx  (public route)
func (h *JournalHandler) JoinGroup(c *gin.Context) {
	rawToken := c.Query("token")
	if rawToken == "" {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "MISSING_TOKEN", Message: "Token is required"}})
		return
	}

	resp, err := h.journalService.AcceptInvite(c.Request.Context(), rawToken)
	if err != nil {
		if err == services.ErrInvalidToken {
			c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "INVALID_TOKEN", Message: "Invite link is invalid or has expired"}})
			return
		}
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to accept invite"}})
		return
	}
	c.JSON(http.StatusOK, resp)
}

// POST /journal/groups/:id/entries
func (h *JournalHandler) CreateGroupEntry(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	groupID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid group ID"}})
		return
	}

	var req models.CreateJournalEntryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "VALIDATION_ERROR", Message: err.Error()}})
		return
	}
	if req.Mood != nil && !h.journalService.ValidateMood(*req.Mood) {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "INVALID_MOOD", Message: "Invalid mood value"}})
		return
	}

	entry, err := h.journalService.CreateEntry(c.Request.Context(), userID, &groupID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to create entry"}})
		return
	}
	c.JSON(http.StatusCreated, entry)
}

// GET /journal/groups/:id/entries
func (h *JournalHandler) ListGroupEntries(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	groupID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid group ID"}})
		return
	}

	entries, err := h.journalService.ListGroupEntries(c.Request.Context(), userID, groupID)
	if err != nil {
		if err == services.ErrNotGroupMember {
			c.JSON(http.StatusForbidden, models.ErrorResponse{Error: models.ErrorDetail{Code: "FORBIDDEN", Message: "Not a member of this group"}})
			return
		}
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to list entries"}})
		return
	}
	c.JSON(http.StatusOK, entries)
}

// GET /journal/groups/:id/calendar
func (h *JournalHandler) GetGroupCalendar(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	groupID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid group ID"}})
		return
	}
	now := time.Now()
	year, _ := strconv.Atoi(c.DefaultQuery("year", strconv.Itoa(now.Year())))
	month, _ := strconv.Atoi(c.DefaultQuery("month", strconv.Itoa(int(now.Month()))))

	resp, err := h.journalService.GetCalendar(c.Request.Context(), userID, year, month, &groupID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to get calendar"}})
		return
	}
	c.JSON(http.StatusOK, resp)
}

// ─── Collections ───────────────────────────────────────────────────────────

// POST /journal/collections
func (h *JournalHandler) CreateCollection(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)

	var req models.CreateJournalCollectionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "VALIDATION_ERROR", Message: err.Error()}})
		return
	}

	col, err := h.journalService.CreateCollection(c.Request.Context(), userID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to create collection"}})
		return
	}
	c.JSON(http.StatusCreated, col)
}

// GET /journal/collections
func (h *JournalHandler) ListCollections(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	cols, err := h.journalService.ListCollections(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to list collections"}})
		return
	}
	c.JSON(http.StatusOK, cols)
}

// GET /journal/collections/:id
func (h *JournalHandler) GetCollection(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	colID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid collection ID"}})
		return
	}

	col, entries, err := h.journalService.GetCollection(c.Request.Context(), userID, colID)
	if err != nil {
		if err == services.ErrJournalCollectionNotFound {
			c.JSON(http.StatusNotFound, models.ErrorResponse{Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "Collection not found"}})
			return
		}
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to get collection"}})
		return
	}
	c.JSON(http.StatusOK, gin.H{"collection": col, "entries": entries})
}

// PUT /journal/collections/:id
func (h *JournalHandler) UpdateCollection(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	colID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid collection ID"}})
		return
	}

	var req models.UpdateJournalCollectionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "VALIDATION_ERROR", Message: err.Error()}})
		return
	}

	col, err := h.journalService.UpdateCollection(c.Request.Context(), userID, colID, &req)
	if err != nil {
		if err == services.ErrJournalCollectionNotFound {
			c.JSON(http.StatusNotFound, models.ErrorResponse{Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "Collection not found"}})
			return
		}
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to update collection"}})
		return
	}
	c.JSON(http.StatusOK, col)
}

// DELETE /journal/collections/:id
func (h *JournalHandler) DeleteCollection(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	colID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid collection ID"}})
		return
	}

	if err := h.journalService.DeleteCollection(c.Request.Context(), userID, colID); err != nil {
		if err == services.ErrJournalCollectionNotFound {
			c.JSON(http.StatusNotFound, models.ErrorResponse{Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "Collection not found"}})
			return
		}
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to delete collection"}})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Collection deleted"})
}

// POST /journal/collections/:id/entries
func (h *JournalHandler) AddEntryToCollection(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	colID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid collection ID"}})
		return
	}

	var req models.AddToCollectionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "VALIDATION_ERROR", Message: err.Error()}})
		return
	}

	if err := h.journalService.AddEntryToCollection(c.Request.Context(), userID, colID, req.EntryID); err != nil {
		if err == services.ErrJournalCollectionNotFound {
			c.JSON(http.StatusNotFound, models.ErrorResponse{Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "Collection not found"}})
			return
		}
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to add entry"}})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Entry added to collection"})
}

// DELETE /journal/collections/:id/entries/:entry_id
func (h *JournalHandler) RemoveEntryFromCollection(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	colID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid collection ID"}})
		return
	}
	entryID, err := uuid.Parse(c.Param("entry_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid entry ID"}})
		return
	}

	if err := h.journalService.RemoveEntryFromCollection(c.Request.Context(), userID, colID, entryID); err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to remove entry"}})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Entry removed from collection"})
}
