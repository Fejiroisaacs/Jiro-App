package models

import (
	"time"

	"github.com/google/uuid"
)

// SearchItem is one hit in a global-search group. Which optional fields are
// set depends on the group: recipes carry Date; exercises carry Subtitle
// (muscle group); sessions carry Subtitle (session type), Date and InProgress;
// journal entries carry Snippet, Date and GroupID. Title is always emitted —
// it is null for an untitled journal entry.
type SearchItem struct {
	ID         uuid.UUID  `json:"id"`
	Title      *string    `json:"title"`
	Subtitle   *string    `json:"subtitle,omitempty"`
	Snippet    *string    `json:"snippet,omitempty"`
	Date       *time.Time `json:"date,omitempty"`
	InProgress *bool      `json:"in_progress,omitempty"`
	GroupID    *uuid.UUID `json:"group_id,omitempty"`
}

type SearchGroup struct {
	Items   []SearchItem `json:"items"`
	HasMore bool         `json:"has_more"`
}

type SearchResponse struct {
	Query     string      `json:"query"`
	Recipes   SearchGroup `json:"recipes"`
	Exercises SearchGroup `json:"exercises"`
	Sessions  SearchGroup `json:"sessions"`
	Journal   SearchGroup `json:"journal"`
}
