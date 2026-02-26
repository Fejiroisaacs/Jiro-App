package handlers

import (
	"net/http"
	"path/filepath"
	"strings"

	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/models"
	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/services"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type UploadHandler struct {
	storage     *services.StorageService
	userService *services.UserService
}

func NewUploadHandler(storage *services.StorageService, userService *services.UserService) *UploadHandler {
	return &UploadHandler{storage: storage, userService: userService}
}

var allowedAvatarTypes = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/webp": ".webp",
}

const maxAvatarBytes = 5 * 1024 * 1024 // 5 MB

// POST /upload/avatar/presign
// Body: { "content_type": "image/jpeg", "content_length": 12345 }
// Returns: { "upload_url": "...", "object_key": "..." }
func (h *UploadHandler) PresignAvatar(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)

	var req struct {
		ContentType   string `json:"content_type" binding:"required"`
		ContentLength int64  `json:"content_length" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "VALIDATION_ERROR", Message: err.Error()},
		})
		return
	}

	ext, ok := allowedAvatarTypes[strings.ToLower(req.ContentType)]
	if !ok {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INVALID_TYPE", Message: "content_type must be image/jpeg, image/png, or image/webp"},
		})
		return
	}

	if req.ContentLength <= 0 || req.ContentLength > maxAvatarBytes {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INVALID_SIZE", Message: "file must be between 1 byte and 5 MB"},
		})
		return
	}

	uploadURL, objectKey, err := h.storage.PresignAvatarUpload(c.Request.Context(), userID, ext)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "STORAGE_ERROR", Message: "Failed to generate upload URL"},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"upload_url": uploadURL,
		"object_key": objectKey,
	})
}

// PATCH /upload/avatar/confirm
// Body: { "object_key": "avatars/..." }
// Sets avatar_url on the user record after a successful upload.
func (h *UploadHandler) ConfirmAvatar(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)

	var req struct {
		ObjectKey string `json:"object_key" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "VALIDATION_ERROR", Message: err.Error()},
		})
		return
	}

	// Validate the key belongs to this user (must start with avatars/<userID>/)
	expectedPrefix := "avatars/" + userID.String() + "/"
	if !strings.HasPrefix(req.ObjectKey, expectedPrefix) {
		c.JSON(http.StatusForbidden, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "FORBIDDEN", Message: "Invalid object key"},
		})
		return
	}

	// Validate extension
	ext := strings.ToLower(filepath.Ext(req.ObjectKey))
	if ext != ".jpg" && ext != ".png" && ext != ".webp" {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INVALID_TYPE", Message: "Invalid file extension"},
		})
		return
	}

	// Delete old avatar from storage if one exists
	user, err := h.userService.GetByID(c.Request.Context(), userID)
	if err == nil && user.AvatarUrl != nil && *user.AvatarUrl != "" {
		publicBase := h.storage.PublicURL("")
		oldKey := strings.TrimPrefix(*user.AvatarUrl, publicBase)
		oldKey = strings.TrimPrefix(oldKey, "/")
		h.storage.DeleteObject(c.Request.Context(), oldKey)
	}

	avatarURL := h.storage.PublicURL(req.ObjectKey)
	if err := h.userService.SetAvatarURL(c.Request.Context(), userID, avatarURL); err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to update avatar"},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"avatar_url": avatarURL})
}

// DELETE /upload/avatar
// Deletes the current user's avatar from storage and clears avatar_url.
func (h *UploadHandler) DeleteAvatar(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)

	user, err := h.userService.GetByID(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to fetch user"},
		})
		return
	}

	if user.AvatarUrl != nil && *user.AvatarUrl != "" {
		// Derive object key from public URL
		publicBase := h.storage.PublicURL("")
		objectKey := strings.TrimPrefix(*user.AvatarUrl, publicBase)
		objectKey = strings.TrimPrefix(objectKey, "/")
		h.storage.DeleteObject(c.Request.Context(), objectKey)
	}

	if err := h.userService.ClearAvatarURL(c.Request.Context(), userID); err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to clear avatar"},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "avatar deleted"})
}
