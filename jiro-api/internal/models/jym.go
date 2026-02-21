package models

import (
	"time"

	"github.com/google/uuid"
)

// ─── Exercise ────────────────────────────────────────────────────────────────

type Exercise struct {
	ID          uuid.UUID `json:"id"`
	UserID      uuid.UUID `json:"user_id"`
	Name        string    `json:"name"`
	MuscleGroup *string   `json:"muscle_group"`
	Notes       *string   `json:"notes"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// SetHistory is one logged set from history, enriched with computed 1RM.
type SetHistory struct {
	SessionID   uuid.UUID `json:"session_id"`
	Date        time.Time `json:"date"`
	Weight      float64   `json:"weight"`
	Reps        int       `json:"reps"`
	Est1RM      float64   `json:"est_1rm"`
	IsPR        bool      `json:"is_pr"`
	SessionType string    `json:"session_type"`
}

type ExerciseWithHistory struct {
	Exercise
	BestWeight float64      `json:"best_weight"`
	Est1RM     float64      `json:"est_1rm"`
	History    []SetHistory `json:"history"`
}

// ExercisePR is the best (highest-weight PR) set for a single exercise.
type ExercisePR struct {
	ExerciseID  uuid.UUID `json:"exercise_id"`
	Name        string    `json:"name"`
	MuscleGroup *string   `json:"muscle_group"`
	Weight      float64   `json:"weight"`
	Reps        int       `json:"reps"`
	Est1RM      float64   `json:"est_1rm"`
	Date        time.Time `json:"date"`
}

type CreateExerciseRequest struct {
	Name        string  `json:"name" binding:"required"`
	MuscleGroup *string `json:"muscle_group"`
	Notes       *string `json:"notes"`
}

type UpdateExerciseRequest struct {
	Name        *string `json:"name"`
	MuscleGroup *string `json:"muscle_group"`
	Notes       *string `json:"notes"`
}

// ─── Split ───────────────────────────────────────────────────────────────────

type Split struct {
	ID           uuid.UUID `json:"id"`
	UserID       uuid.UUID `json:"user_id"`
	Name         string    `json:"name"`
	Description  *string   `json:"description"`
	Visibility   string    `json:"visibility"`
	Tags         []string  `json:"tags"`
	RoutineCount int       `json:"routine_count,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type SplitWithRoutines struct {
	Split
	Routines []RoutineWithItems `json:"routines"`
}

type CreateSplitRequest struct {
	Name        string   `json:"name" binding:"required"`
	Description *string  `json:"description"`
	Tags        []string `json:"tags"`
}

type UpdateSplitRequest struct {
	Name        *string   `json:"name"`
	Description *string   `json:"description"`
	Visibility  *string   `json:"visibility"`
	Tags        *[]string `json:"tags"`
}

// ─── Public Split Discovery ───────────────────────────────────────────────────

type PublicSplitSummary struct {
	ID           uuid.UUID `json:"id"`
	Name         string    `json:"name"`
	Description  *string   `json:"description"`
	Tags         []string  `json:"tags"`
	RoutineCount int       `json:"routine_count"`
	CreatedAt    time.Time `json:"created_at"`
}

type PublicSplitDetail struct {
	SplitID   string                `json:"split_id"`
	SplitName string                `json:"split_name"`
	Tags      []string              `json:"tags"`
	Routines  []ShareRoutinePreview `json:"routines"`
}

// ─── Routine ─────────────────────────────────────────────────────────────────

type Routine struct {
	ID        uuid.UUID `json:"id"`
	SplitID   uuid.UUID `json:"split_id"`
	Name      string    `json:"name"`
	DayOrder  int       `json:"day_order"`
	CreatedAt time.Time `json:"created_at"`
}

type RoutineWithItems struct {
	Routine
	Items []RoutineItemWithExercise `json:"items"`
}

type RoutineItem struct {
	ID          uuid.UUID `json:"id"`
	RoutineID   uuid.UUID `json:"routine_id"`
	ExerciseID  uuid.UUID `json:"exercise_id"`
	TargetSets  int       `json:"target_sets"`
	TargetReps  int       `json:"target_reps"`
	OrderIndex  int       `json:"order_index"`
}

type RoutineItemWithExercise struct {
	RoutineItem
	ExerciseName string  `json:"exercise_name"`
	MuscleGroup  *string `json:"muscle_group"`
}

type CreateRoutineRequest struct {
	Name     string `json:"name" binding:"required"`
	DayOrder int    `json:"day_order"`
}

type UpdateRoutineRequest struct {
	Name     *string `json:"name"`
	DayOrder *int    `json:"day_order"`
}

// ReplaceRoutineItemsRequest is an ordered list for bulk replace after drag-drop.
type ReplaceItemEntry struct {
	ExerciseID uuid.UUID `json:"exercise_id" binding:"required"`
	TargetSets int       `json:"target_sets"`
	TargetReps int       `json:"target_reps"`
}

// ─── Body Weight ──────────────────────────────────────────────────────────────

type BodyWeight struct {
	ID         uuid.UUID `json:"id"`
	UserID     uuid.UUID `json:"user_id"`
	RecordedAt time.Time `json:"recorded_at"`
	WeightKg   float64   `json:"weight_kg"`
	CreatedAt  time.Time `json:"created_at"`
}

type LogBodyWeightRequest struct {
	RecordedAt string  `json:"recorded_at" binding:"required"` // YYYY-MM-DD
	WeightKg   float64 `json:"weight_kg" binding:"required,gt=0"`
}

// ─── Split Series ─────────────────────────────────────────────────────────────

type SplitSeries struct {
	ID             uuid.UUID  `json:"id"`
	UserID         uuid.UUID  `json:"user_id"`
	SplitID        uuid.UUID  `json:"split_id"`
	Name           string     `json:"name"`
	DurationType   string     `json:"duration_type"` // "weeks" | "sessions" | "open"
	TargetWeeks    *int       `json:"target_weeks"`
	TargetSessions *int       `json:"target_sessions"`
	StartedAt      time.Time  `json:"started_at"`
	EndedAt        *time.Time `json:"ended_at"`
	CreatedAt      time.Time  `json:"created_at"`
}

type SplitSeriesSummary struct {
	SplitSeries
	SplitName    string `json:"split_name"`
	SessionCount int    `json:"session_count"`
}

type SeriesSessionPoint struct {
	SessionID   uuid.UUID `json:"session_id"`
	Date        time.Time `json:"date"`
	SessionType string    `json:"session_type"`
	TotalVolume float64   `json:"total_volume"`
	SetCount    int       `json:"set_count"`
}

type ProgressionPoint struct {
	SessionID  uuid.UUID `json:"session_id"`
	Date       time.Time `json:"date"`
	BestEst1RM float64   `json:"best_est_1rm"`
}

type ExerciseProgression struct {
	ExerciseID   uuid.UUID          `json:"exercise_id"`
	ExerciseName string             `json:"exercise_name"`
	MuscleGroup  *string            `json:"muscle_group"`
	Points       []ProgressionPoint `json:"points"`
}

type SplitSeriesDetail struct {
	SplitSeriesSummary
	Sessions             []SeriesSessionPoint  `json:"sessions"`
	ExerciseProgressions []ExerciseProgression `json:"exercise_progressions"`
}

type CreateSeriesRequest struct {
	SplitID        uuid.UUID `json:"split_id" binding:"required"`
	Name           string    `json:"name" binding:"required"`
	DurationType   string    `json:"duration_type" binding:"required,oneof=weeks sessions open"`
	TargetWeeks    *int      `json:"target_weeks"`
	TargetSessions *int      `json:"target_sessions"`
}

type UpdateSeriesRequest struct {
	Name    *string    `json:"name"`
	EndedAt *time.Time `json:"ended_at"`
}

// ─── Split Share ─────────────────────────────────────────────────────────────

type SplitShare struct {
	ID        uuid.UUID  `json:"id"`
	SplitID   uuid.UUID  `json:"split_id"`
	CreatedBy uuid.UUID  `json:"created_by"`
	CreatedAt time.Time  `json:"created_at"`
	ExpiresAt *time.Time `json:"expires_at"`
}

type CreateShareResponse struct {
	ShareID string `json:"share_id"`
	URL     string `json:"url"`
}

type ShareExercisePreview struct {
	Name        string  `json:"name"`
	MuscleGroup *string `json:"muscle_group"`
	TargetSets  int     `json:"target_sets"`
	TargetReps  int     `json:"target_reps"`
}

type ShareRoutinePreview struct {
	Name      string                 `json:"name"`
	DayOrder  int                    `json:"day_order"`
	Exercises []ShareExercisePreview `json:"exercises"`
}

type SharePreview struct {
	ShareID   string                `json:"share_id"`
	SplitName string                `json:"split_name"`
	Routines  []ShareRoutinePreview `json:"routines"`
}

type ImportShareResponse struct {
	SplitID string `json:"split_id"`
}

// ─── Session ─────────────────────────────────────────────────────────────────

type Session struct {
	ID          uuid.UUID  `json:"id"`
	UserID      uuid.UUID  `json:"user_id"`
	RoutineID   *uuid.UUID `json:"routine_id"`
	SeriesID    *uuid.UUID `json:"series_id"`
	SessionType string     `json:"session_type"`
	StartedAt   time.Time  `json:"started_at"`
	EndedAt     *time.Time `json:"ended_at"`
	Notes       *string    `json:"notes"`
}

type SessionSummary struct {
	Session
	RoutineName  *string  `json:"routine_name"`
	SetCount     int      `json:"set_count"`
	TotalVolume  float64  `json:"total_volume"`
	MuscleGroups []string `json:"muscle_groups"`
}

// StartSessionResponse includes the created session and routine targets (if routine_id given).
type StartSessionResponse struct {
	Session
	Targets []RoutineItemWithExercise `json:"targets"`
}

type SessionWithSets struct {
	Session
	RoutineName *string                  `json:"routine_name"`
	Sets        []SessionSetWithExercise `json:"sets"`
}

type CreateSessionRequest struct {
	RoutineID *uuid.UUID `json:"routine_id"`
	SeriesID  *uuid.UUID `json:"series_id"`
}

type UpdateSessionRequest struct {
	EndedAt     *time.Time `json:"ended_at"`
	Notes       *string    `json:"notes"`
	SessionType *string    `json:"session_type"`
}

// ─── SessionSet ──────────────────────────────────────────────────────────────

type SessionSet struct {
	ID            uuid.UUID `json:"id"`
	SessionID     uuid.UUID `json:"session_id"`
	ExerciseID    uuid.UUID `json:"exercise_id"`
	SetNumber     int       `json:"set_number"`
	Weight        float64   `json:"weight"`
	RepsPerformed int       `json:"reps_performed"`
	RPE           *int      `json:"rpe"`
	IsPR          bool      `json:"is_pr"`
	IsWarmup      bool      `json:"is_warmup"`
	ExerciseNote  *string   `json:"exercise_note"`
	CreatedAt     time.Time `json:"created_at"`
}

type SessionSetWithExercise struct {
	SessionSet
	ExerciseName string  `json:"exercise_name"`
	MuscleGroup  *string `json:"muscle_group"`
}

type CreateSetRequest struct {
	ExerciseID    uuid.UUID `json:"exercise_id" binding:"required"`
	SetNumber     int       `json:"set_number" binding:"required"`
	Weight        float64   `json:"weight" binding:"required"`
	RepsPerformed int       `json:"reps_performed" binding:"required"`
	RPE           *int      `json:"rpe" binding:"omitempty,min=1,max=10"`
	IsWarmup      *bool     `json:"is_warmup"`
	ExerciseNote  *string   `json:"exercise_note"`
}

type UpdateSetRequest struct {
	Weight        *float64 `json:"weight"`
	RepsPerformed *int     `json:"reps_performed"`
	RPE           *int     `json:"rpe"`
	IsWarmup      *bool    `json:"is_warmup"`
	ExerciseNote  *string  `json:"exercise_note"`
}
