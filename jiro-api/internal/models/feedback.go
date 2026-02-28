package models

import (
	"time"

	"github.com/google/uuid"
)

type Feedback struct {
	ID        uuid.UUID `json:"id"`
	UserID    uuid.UUID `json:"user_id"`
	Type      string    `json:"type"`
	Message   string    `json:"message"`
	CreatedAt time.Time `json:"created_at"`
}

type FeedbackWithUser struct {
	Feedback
	Username string `json:"username"`
	Email    string `json:"email"`
}

type SubmitFeedbackRequest struct {
	Type    string `json:"type" binding:"required"`
	Message string `json:"message" binding:"required"`
}
