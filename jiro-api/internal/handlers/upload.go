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
	storage       *services.StorageService
	userService   *services.UserService
	recipeService *services.RecipeService
	jymService    *services.JymService
}

func NewUploadHandler(storage *services.StorageService, userService *services.UserService, recipeService *services.RecipeService, jymService *services.JymService) *UploadHandler {
	return &UploadHandler{storage: storage, userService: userService, recipeService: recipeService, jymService: jymService}
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

// ─── Recipe image upload ───────────────────────────────────────────────────

const maxRecipeImageBytes = 5 * 1024 * 1024 // 5 MB

// POST /upload/recipe/:recipe_id/presign
// Body: { "content_type": "image/jpeg", "content_length": 12345 }
// Returns: { "upload_url": "...", "object_key": "..." }
func (h *UploadHandler) PresignRecipeImage(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)

	recipeID, err := uuid.Parse(c.Param("recipe_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid recipe ID"},
		})
		return
	}

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

	if req.ContentLength <= 0 || req.ContentLength > maxRecipeImageBytes {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INVALID_SIZE", Message: "file must be between 1 byte and 5 MB"},
		})
		return
	}

	// Verify ownership
	if _, err := h.recipeService.GetRecipe(c.Request.Context(), userID, recipeID); err != nil {
		c.JSON(http.StatusNotFound, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "Recipe not found"},
		})
		return
	}

	uploadURL, objectKey, err := h.storage.PresignRecipeUpload(c.Request.Context(), userID, recipeID, ext)
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

// PATCH /upload/recipe/:recipe_id/confirm
// Body: { "object_key": "recipes/..." }
// Saves cover_image_url on the recipe record after a successful upload.
func (h *UploadHandler) ConfirmRecipeImage(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)

	recipeID, err := uuid.Parse(c.Param("recipe_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid recipe ID"},
		})
		return
	}

	var req struct {
		ObjectKey string `json:"object_key" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "VALIDATION_ERROR", Message: err.Error()},
		})
		return
	}

	// Validate key belongs to this user + recipe
	expectedPrefix := "recipes/" + userID.String() + "/" + recipeID.String() + "/"
	if !strings.HasPrefix(req.ObjectKey, expectedPrefix) {
		c.JSON(http.StatusForbidden, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "FORBIDDEN", Message: "Invalid object key"},
		})
		return
	}

	ext := strings.ToLower(filepath.Ext(req.ObjectKey))
	if ext != ".jpg" && ext != ".png" && ext != ".webp" {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INVALID_TYPE", Message: "Invalid file extension"},
		})
		return
	}

	// Delete old cover image if one exists
	recipe, err := h.recipeService.GetRecipe(c.Request.Context(), userID, recipeID)
	if err == nil && recipe.CoverImageURL != nil && *recipe.CoverImageURL != "" {
		publicBase := h.storage.PublicURL("")
		oldKey := strings.TrimPrefix(*recipe.CoverImageURL, publicBase)
		oldKey = strings.TrimPrefix(oldKey, "/")
		h.storage.DeleteObject(c.Request.Context(), oldKey)
	}

	coverURL := h.storage.PublicURL(req.ObjectKey)
	if err := h.recipeService.SetCoverImageURL(c.Request.Context(), recipeID, coverURL); err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to update recipe"},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"cover_image_url": coverURL})
}

// DELETE /upload/recipe/:recipe_id/image
// Deletes the recipe's cover image from storage and clears cover_image_url.
func (h *UploadHandler) DeleteRecipeImage(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)

	recipeID, err := uuid.Parse(c.Param("recipe_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid recipe ID"},
		})
		return
	}

	recipe, err := h.recipeService.GetRecipe(c.Request.Context(), userID, recipeID)
	if err != nil {
		c.JSON(http.StatusNotFound, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "Recipe not found"},
		})
		return
	}

	if recipe.CoverImageURL != nil && *recipe.CoverImageURL != "" {
		publicBase := h.storage.PublicURL("")
		objectKey := strings.TrimPrefix(*recipe.CoverImageURL, publicBase)
		objectKey = strings.TrimPrefix(objectKey, "/")
		h.storage.DeleteObject(c.Request.Context(), objectKey)
	}

	if err := h.recipeService.ClearCoverImageURL(c.Request.Context(), recipeID); err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to clear cover image"},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "cover image deleted"})
}

// ─── Session attachment upload ─────────────────────────────────────────────

var allowedSessionAttachmentTypes = map[string]string{
	"video/mp4":  ".mp4",
	"video/webm": ".webm",
	"image/jpeg": ".jpg",
	"image/png":  ".png",
}

const maxSessionAttachmentBytes = 50 * 1024 * 1024 // 50 MB

// POST /upload/session/:session_id/presign
// Body: { "content_type": "video/mp4", "content_length": 12345 }
// Returns: { "upload_url": "...", "object_key": "..." }
func (h *UploadHandler) PresignSessionAttachment(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)

	sessionID, err := uuid.Parse(c.Param("session_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid session ID"},
		})
		return
	}

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

	ext, ok := allowedSessionAttachmentTypes[strings.ToLower(req.ContentType)]
	if !ok {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INVALID_TYPE", Message: "content_type must be video/mp4, video/webm, image/jpeg, or image/png"},
		})
		return
	}

	if req.ContentLength <= 0 || req.ContentLength > maxSessionAttachmentBytes {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INVALID_SIZE", Message: "file must be between 1 byte and 50 MB"},
		})
		return
	}

	// Verify session ownership
	if _, err := h.jymService.GetSession(c.Request.Context(), userID, sessionID); err != nil {
		c.JSON(http.StatusNotFound, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "Session not found"},
		})
		return
	}

	uploadURL, objectKey, err := h.storage.PresignSessionUpload(c.Request.Context(), userID, sessionID, ext)
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

// PATCH /upload/session/:session_id/confirm
// Body: { "object_key": "sessions/...", "label": "optional label" }
// Creates a session_attachments row after a successful upload.
func (h *UploadHandler) ConfirmSessionAttachment(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)

	sessionID, err := uuid.Parse(c.Param("session_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid session ID"},
		})
		return
	}

	var req struct {
		ObjectKey  string  `json:"object_key" binding:"required"`
		ExerciseID *string `json:"exercise_id"`
		Label      *string `json:"label"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "VALIDATION_ERROR", Message: err.Error()},
		})
		return
	}

	// Validate key prefix
	expectedPrefix := "sessions/" + userID.String() + "/" + sessionID.String() + "/"
	if !strings.HasPrefix(req.ObjectKey, expectedPrefix) {
		c.JSON(http.StatusForbidden, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "FORBIDDEN", Message: "Invalid object key"},
		})
		return
	}

	ext := strings.ToLower(filepath.Ext(req.ObjectKey))
	fileType, ok := map[string]string{
		".mp4":  "video/mp4",
		".webm": "video/webm",
		".jpg":  "image/jpeg",
		".png":  "image/png",
	}[ext]
	if !ok {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INVALID_TYPE", Message: "Invalid file extension"},
		})
		return
	}

	var exerciseID *uuid.UUID
	if req.ExerciseID != nil && *req.ExerciseID != "" {
		parsed, err := uuid.Parse(*req.ExerciseID)
		if err != nil {
			c.JSON(http.StatusBadRequest, models.ErrorResponse{
				Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid exercise_id"},
			})
			return
		}
		exerciseID = &parsed
	}

	fileURL := h.storage.PublicURL(req.ObjectKey)
	attachment, err := h.jymService.CreateAttachment(c.Request.Context(), userID, sessionID, exerciseID, req.ObjectKey, fileURL, fileType, req.Label)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Failed to save attachment"},
		})
		return
	}

	c.JSON(http.StatusCreated, attachment)
}

// DELETE /upload/session/attachments/:attachment_id
// Deletes the attachment from storage and DB.
func (h *UploadHandler) DeleteSessionAttachment(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)

	attachmentID, err := uuid.Parse(c.Param("attachment_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "INVALID_ID", Message: "Invalid attachment ID"},
		})
		return
	}

	attachment, err := h.jymService.DeleteAttachment(c.Request.Context(), userID, attachmentID)
	if err != nil {
		c.JSON(http.StatusNotFound, models.ErrorResponse{
			Error: models.ErrorDetail{Code: "NOT_FOUND", Message: "Attachment not found"},
		})
		return
	}

	h.storage.DeleteObject(c.Request.Context(), attachment.ObjectKey)

	c.JSON(http.StatusOK, gin.H{"message": "attachment deleted"})
}
