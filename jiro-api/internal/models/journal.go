package models

import (
	"time"

	"github.com/google/uuid"
)

// ─── Domain structs ────────────────────────────────────────────────────────

type JournalEntry struct {
	ID        uuid.UUID      `json:"id"`
	UserID    uuid.UUID      `json:"user_id"`
	GroupID   *uuid.UUID     `json:"group_id"`
	Title     *string        `json:"title"`
	Body      string         `json:"body"`
	Mood      *string        `json:"mood"`
	Tags      []string       `json:"tags"`
	Images    []JournalImage `json:"images,omitempty"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
}

type JournalImage struct {
	ID        uuid.UUID `json:"id"`
	EntryID   uuid.UUID `json:"entry_id"`
	UserID    uuid.UUID `json:"user_id"`
	ObjectKey string    `json:"object_key"`
	FileURL   string    `json:"file_url"`
	CreatedAt time.Time `json:"created_at"`
}

type JournalGroup struct {
	ID          uuid.UUID            `json:"id"`
	OwnerID     uuid.UUID            `json:"owner_id"`
	Name        string               `json:"name"`
	Members     []JournalGroupMember `json:"members,omitempty"`
	MemberCount int                  `json:"member_count"`
	CreatedAt   time.Time            `json:"created_at"`
	UpdatedAt   time.Time            `json:"updated_at"`
}

type JournalGroupMember struct {
	ID        uuid.UUID  `json:"id"`
	GroupID   uuid.UUID  `json:"group_id"`
	UserID    uuid.UUID  `json:"user_id"`
	InvitedBy uuid.UUID  `json:"invited_by"`
	Status    string     `json:"status"`
	JoinedAt  *time.Time `json:"joined_at"`
	CreatedAt time.Time  `json:"created_at"`
	// Populated from join
	UserEmail    *string `json:"email,omitempty"`
	UserUsername *string `json:"username,omitempty"`
}

type JournalCollection struct {
	ID            uuid.UUID `json:"id"`
	UserID        uuid.UUID `json:"user_id"`
	Name          string    `json:"name"`
	Description   *string   `json:"description"`
	CoverImageURL *string   `json:"cover_image_url"`
	EntryCount    int       `json:"entry_count"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

// ─── Request types ─────────────────────────────────────────────────────────

type CreateJournalEntryRequest struct {
	Title     *string  `json:"title"`
	Body      string   `json:"body" binding:"required"`
	Mood      *string  `json:"mood"`
	Tags      []string `json:"tags"`
	CreatedAt *string  `json:"created_at"`
}

type UpdateJournalEntryRequest struct {
	Title *string  `json:"title"`
	Body  *string  `json:"body"`
	Mood  *string  `json:"mood"`
	Tags  []string `json:"tags"`
}

type CreateJournalGroupRequest struct {
	Name string `json:"name" binding:"required,max=100"`
}

type UpdateJournalGroupRequest struct {
	Name string `json:"name" binding:"required,max=100"`
}

type InviteGroupMemberRequest struct {
	Email string `json:"email" binding:"required,email"`
}

type CreateJournalCollectionRequest struct {
	Name        string  `json:"name" binding:"required,max=100"`
	Description *string `json:"description"`
}

type UpdateJournalCollectionRequest struct {
	Name        *string `json:"name"`
	Description *string `json:"description"`
}

type AddToCollectionRequest struct {
	EntryID uuid.UUID `json:"entry_id" binding:"required"`
}

type PresignJournalImageRequest struct {
	ContentType   string `json:"content_type" binding:"required"`
	ContentLength int64  `json:"content_length" binding:"required"`
}

type ConfirmJournalImageRequest struct {
	ObjectKey string `json:"object_key" binding:"required"`
}

// ─── Response types ────────────────────────────────────────────────────────

type JournalStreakResponse struct {
	CurrentStreak int        `json:"current_streak"`
	LongestStreak int        `json:"longest_streak"`
	TotalEntries  int        `json:"total_entries"`
	LastEntryAt   *time.Time `json:"last_entry_at"`
}

type JournalCalendarResponse struct {
	Year  int   `json:"year"`
	Month int   `json:"month"`
	Days  []int `json:"days"` // day numbers that have entries
}

type JoinGroupResponse struct {
	GroupID   uuid.UUID `json:"group_id"`
	GroupName string    `json:"group_name"`
}
