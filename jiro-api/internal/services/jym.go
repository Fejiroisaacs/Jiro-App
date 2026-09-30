package services

import (
	"context"
	"encoding/csv"
	"errors"
	"fmt"
	"io"
	"math"
	"strconv"
	"time"

	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/models"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrExerciseNotFound   = errors.New("exercise not found")
	ErrExerciseNameTaken  = errors.New("exercise name already used")
	ErrSplitNotFound      = errors.New("split not found")
	ErrRoutineNotFound    = errors.New("routine not found")
	ErrSessionNotFound    = errors.New("session not found")
	ErrSetNotFound        = errors.New("set not found")
	ErrBodyWeightNotFound = errors.New("body weight not found")
	ErrSeriesNotFound     = errors.New("series not found")
	ErrShareNotFound      = errors.New("share not found")
	ErrShareExpired       = errors.New("share link has expired")
	ErrShareForbidden     = errors.New("not your share link")

	ErrInvalidSessionType  = errors.New("session type must be normal, deload or test")
	ErrSessionEnded        = errors.New("session has already ended")
	ErrDuplicateRoutine    = errors.New("routine listed more than once")
	ErrRoutineNotInSeries  = errors.New("routine is not a day of the series' split")
	ErrInvalidSeriesLength = errors.New("a series runs 1 to 52 weeks or 1 to 200 sessions")
	ErrSessionNotFinished  = errors.New("session has not finished")
)

// SessionTimesError is why an edit to a workout's times was refused; Reason is written for the user.
type SessionTimesError struct{ Reason string }

func (e *SessionTimesError) Error() string { return e.Reason }

// SessionInProgressError is StartSession's answer while another session is unfinished and Force is off.
type SessionInProgressError struct {
	SessionID   uuid.UUID
	RoutineName *string
	StartedAt   time.Time
	// SetCount and LastSetAt let the client offer to finish a forgotten workout, or discard an empty one.
	SetCount  int
	LastSetAt *time.Time
}

func (e *SessionInProgressError) Error() string { return "a session is already in progress" }

// validSessionTypes mirrors the sessions.session_type CHECK constraint
// (migration 000007); rejecting here gives a clear error instead of a
// constraint violation from the driver.
var validSessionTypes = map[string]bool{
	"normal": true,
	"deload": true,
	"test":   true,
}

type JymService struct {
	db *pgxpool.Pool
}

func NewJymService(db *pgxpool.Pool) *JymService {
	return &JymService{db: db}
}

// ─── Exercises ───────────────────────────────────────────────────────────────

// 23505 is unique_violation; exercises are UNIQUE (user_id, name).
func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}

func (s *JymService) CreateExercise(ctx context.Context, userID uuid.UUID, req *models.CreateExerciseRequest) (*models.Exercise, error) {
	ex := &models.Exercise{}
	err := s.db.QueryRow(ctx,
		`INSERT INTO exercises (user_id, name, muscle_group, notes)
		 VALUES ($1, $2, $3, $4)
		 RETURNING id, user_id, name, muscle_group, notes, created_at, updated_at`,
		userID, req.Name, req.MuscleGroup, req.Notes,
	).Scan(&ex.ID, &ex.UserID, &ex.Name, &ex.MuscleGroup, &ex.Notes, &ex.CreatedAt, &ex.UpdatedAt)
	if err != nil {
		if isUniqueViolation(err) {
			return nil, ErrExerciseNameTaken
		}
		return nil, err
	}
	return ex, nil
}

func (s *JymService) ListExercises(ctx context.Context, userID uuid.UUID, search, muscleGroup string) ([]models.Exercise, error) {
	query := `
		SELECT e.id, e.user_id, e.name, e.muscle_group, e.notes, e.created_at, e.updated_at,
		       (SELECT MAX(s.started_at) FROM session_sets ss
		        JOIN sessions s ON s.id = ss.session_id
		        WHERE ss.exercise_id = e.id AND s.user_id = e.user_id) AS last_performed_at
		FROM exercises e WHERE e.user_id = $1`
	args := []interface{}{userID}

	if search != "" {
		args = append(args, "%"+search+"%")
		query += ` AND e.name ILIKE $` + intStr(len(args))
	}
	if muscleGroup != "" {
		args = append(args, muscleGroup)
		query += ` AND LOWER(TRIM(e.muscle_group)) = LOWER(TRIM($` + intStr(len(args)) + `))`
	}
	query += ` ORDER BY e.name ASC`

	rows, err := s.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var exercises []models.Exercise
	for rows.Next() {
		var ex models.Exercise
		if err := rows.Scan(&ex.ID, &ex.UserID, &ex.Name, &ex.MuscleGroup, &ex.Notes, &ex.CreatedAt, &ex.UpdatedAt, &ex.LastPerformedAt); err != nil {
			return nil, err
		}
		exercises = append(exercises, ex)
	}
	if exercises == nil {
		exercises = []models.Exercise{}
	}
	return exercises, nil
}

// GetExerciseWithHistory returns the exercise, its best working set over all history, and its sets newest first
// (every set, or the latest `limit` when set).
func (s *JymService) GetExerciseWithHistory(ctx context.Context, userID, exerciseID uuid.UUID, limit *int) (*models.ExerciseWithHistory, error) {
	ex := &models.ExerciseWithHistory{}
	err := s.db.QueryRow(ctx,
		`SELECT id, user_id, name, muscle_group, notes, created_at, updated_at
		 FROM exercises WHERE id = $1 AND user_id = $2`,
		exerciseID, userID,
	).Scan(&ex.ID, &ex.UserID, &ex.Name, &ex.MuscleGroup, &ex.Notes, &ex.CreatedAt, &ex.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrExerciseNotFound
		}
		return nil, err
	}

	// Header stats cover every working set outside deloads, however many sets the list returns.
	var best1RM float64
	if err := s.db.QueryRow(ctx,
		`SELECT COALESCE(MAX(ss.weight), 0),
		        COALESCE(MAX(`+e1rmSQL("ss.weight", "ss.reps_performed")+`), 0)
		 FROM session_sets ss
		 JOIN sessions s ON ss.session_id = s.id
		 WHERE ss.exercise_id = $1 AND s.user_id = $2 AND NOT ss.is_warmup AND s.session_type <> 'deload'`,
		exerciseID, userID,
	).Scan(&ex.BestWeight, &best1RM); err != nil {
		return nil, err
	}
	ex.Est1RM = roundTenth(best1RM)

	rows, err := s.db.Query(ctx,
		`SELECT ss.session_id, s.started_at, s.ended_at, ss.set_number, ss.weight, ss.reps_performed, ss.rpe, ss.is_warmup,
		        ss.is_pr, s.session_type, ss.exercise_note
		 FROM session_sets ss
		 JOIN sessions s ON ss.session_id = s.id
		 WHERE ss.exercise_id = $1 AND s.user_id = $2
		 ORDER BY s.started_at DESC, ss.set_number ASC, ss.created_at ASC
		 LIMIT $3`,
		exerciseID, userID, limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	ex.History = []models.SetHistory{}
	for rows.Next() {
		var h models.SetHistory
		if err := rows.Scan(&h.SessionID, &h.Date, &h.EndedAt, &h.SetNumber, &h.Weight, &h.Reps, &h.RPE, &h.IsWarmup,
			&h.IsPR, &h.SessionType, &h.ExerciseNote); err != nil {
			return nil, err
		}
		h.Est1RM = epley1RM(h.Weight, h.Reps)
		ex.History = append(ex.History, h)
	}
	return ex, rows.Err()
}

func (s *JymService) UpdateExercise(ctx context.Context, userID, exerciseID uuid.UUID, req *models.UpdateExerciseRequest) (*models.Exercise, error) {
	ex := &models.Exercise{}
	err := s.db.QueryRow(ctx,
		`UPDATE exercises SET
		   name         = COALESCE($3, name),
		   muscle_group = CASE WHEN $4::TEXT IS NULL THEN muscle_group ELSE NULLIF(TRIM($4), '') END,
		   notes        = CASE WHEN $5::TEXT IS NULL THEN notes ELSE NULLIF(TRIM($5), '') END,
		   updated_at   = NOW()
		 WHERE id = $1 AND user_id = $2
		 RETURNING id, user_id, name, muscle_group, notes, created_at, updated_at`,
		exerciseID, userID, req.Name, req.MuscleGroup, req.Notes,
	).Scan(&ex.ID, &ex.UserID, &ex.Name, &ex.MuscleGroup, &ex.Notes, &ex.CreatedAt, &ex.UpdatedAt)
	if err != nil {
		if isUniqueViolation(err) {
			return nil, ErrExerciseNameTaken
		}
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrExerciseNotFound
		}
		return nil, err
	}
	return ex, nil
}

// DeleteExercise removes the exercise and all associated session_attachment rows,
// returning the R2 object keys so the caller can clean up object storage.
func (s *JymService) DeleteExercise(ctx context.Context, userID, exerciseID uuid.UUID) ([]string, error) {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	// Collect object keys for this exercise's form-check attachments
	rows, err := tx.Query(ctx,
		`SELECT object_key FROM session_attachments WHERE exercise_id = $1 AND user_id = $2`,
		exerciseID, userID,
	)
	if err != nil {
		return nil, err
	}
	var keys []string
	for rows.Next() {
		var k string
		if err := rows.Scan(&k); err != nil {
			rows.Close()
			return nil, err
		}
		keys = append(keys, k)
	}
	rows.Close()

	// Delete the attachment rows
	if _, err := tx.Exec(ctx,
		`DELETE FROM session_attachments WHERE exercise_id = $1 AND user_id = $2`,
		exerciseID, userID,
	); err != nil {
		return nil, err
	}

	// Delete the exercise itself
	res, err := tx.Exec(ctx, `DELETE FROM exercises WHERE id = $1 AND user_id = $2`, exerciseID, userID)
	if err != nil {
		return nil, err
	}
	if res.RowsAffected() == 0 {
		return nil, ErrExerciseNotFound
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return keys, nil
}

// ─── Splits ──────────────────────────────────────────────────────────────────

func (s *JymService) CreateSplit(ctx context.Context, userID uuid.UUID, req *models.CreateSplitRequest) (*models.Split, error) {
	tags := req.Tags
	if tags == nil {
		tags = []string{}
	}
	sp := &models.Split{}
	err := s.db.QueryRow(ctx,
		`INSERT INTO splits (user_id, name, description, tags)
		 VALUES ($1, $2, $3, $4)
		 RETURNING id, user_id, name, description, visibility, tags, created_at, updated_at`,
		userID, req.Name, req.Description, tags,
	).Scan(&sp.ID, &sp.UserID, &sp.Name, &sp.Description, &sp.Visibility, &sp.Tags, &sp.CreatedAt, &sp.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return sp, nil
}

func (s *JymService) ListSplits(ctx context.Context, userID uuid.UUID) ([]models.Split, error) {
	rows, err := s.db.Query(ctx,
		`SELECT s.id, s.user_id, s.name, s.description, s.visibility, s.tags,
		        s.created_at, s.updated_at, COUNT(r.id) as routine_count
		 FROM splits s
		 LEFT JOIN routines r ON r.split_id = s.id
		 WHERE s.user_id = $1
		 GROUP BY s.id
		 ORDER BY s.updated_at DESC`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var splits []models.Split
	for rows.Next() {
		var sp models.Split
		if err := rows.Scan(&sp.ID, &sp.UserID, &sp.Name, &sp.Description, &sp.Visibility, &sp.Tags, &sp.CreatedAt, &sp.UpdatedAt, &sp.RoutineCount); err != nil {
			return nil, err
		}
		splits = append(splits, sp)
	}
	if splits == nil {
		splits = []models.Split{}
	}
	return splits, nil
}

func (s *JymService) GetSplitWithRoutines(ctx context.Context, userID, splitID uuid.UUID) (*models.SplitWithRoutines, error) {
	sp := &models.SplitWithRoutines{}
	err := s.db.QueryRow(ctx,
		`SELECT id, user_id, name, description, visibility, tags, created_at, updated_at
		 FROM splits WHERE id = $1 AND user_id = $2`,
		splitID, userID,
	).Scan(&sp.ID, &sp.UserID, &sp.Name, &sp.Description, &sp.Visibility, &sp.Tags, &sp.CreatedAt, &sp.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrSplitNotFound
		}
		return nil, err
	}

	rows, err := s.db.Query(ctx,
		`SELECT r.id, r.user_id, r.split_id, r.name, r.day_order, r.created_at
		 FROM routines r WHERE r.split_id = $1 ORDER BY r.day_order ASC`,
		splitID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	sp.Routines = []models.RoutineWithItems{}
	for rows.Next() {
		var rt models.RoutineWithItems
		if err := rows.Scan(&rt.ID, &rt.UserID, &rt.SplitID, &rt.Name, &rt.DayOrder, &rt.CreatedAt); err != nil {
			return nil, err
		}
		rt.Items = []models.RoutineItemWithExercise{}
		sp.Routines = append(sp.Routines, rt)
	}
	rows.Close()

	// Fetch all items for all routines in one query
	if len(sp.Routines) > 0 {
		itemRows, err := s.db.Query(ctx,
			`SELECT ri.id, ri.routine_id, ri.exercise_id, ri.target_sets, ri.target_reps, ri.order_index,
			        e.name, e.muscle_group
			 FROM routine_items ri
			 JOIN exercises e ON ri.exercise_id = e.id
			 WHERE ri.routine_id IN (
			   SELECT id FROM routines WHERE split_id = $1
			 )
			 ORDER BY ri.routine_id, ri.order_index ASC`,
			splitID,
		)
		if err != nil {
			return nil, err
		}
		defer itemRows.Close()

		// Index routines by ID for fast lookup
		routineIdx := make(map[uuid.UUID]int)
		for i, rt := range sp.Routines {
			routineIdx[rt.ID] = i
		}

		for itemRows.Next() {
			var item models.RoutineItemWithExercise
			if err := itemRows.Scan(
				&item.ID, &item.RoutineID, &item.ExerciseID,
				&item.TargetSets, &item.TargetReps, &item.OrderIndex,
				&item.ExerciseName, &item.MuscleGroup,
			); err != nil {
				return nil, err
			}
			if idx, ok := routineIdx[item.RoutineID]; ok {
				sp.Routines[idx].Items = append(sp.Routines[idx].Items, item)
			}
		}
	}

	return sp, nil
}

func (s *JymService) UpdateSplit(ctx context.Context, userID, splitID uuid.UUID, req *models.UpdateSplitRequest) (*models.Split, error) {
	var tagsArg interface{}
	if req.Tags != nil {
		tagsArg = *req.Tags
	}
	sp := &models.Split{}
	err := s.db.QueryRow(ctx,
		`UPDATE splits SET
		   name        = COALESCE($3, name),
		   description = COALESCE($4, description),
		   visibility  = COALESCE($5, visibility),
		   tags        = CASE WHEN $6::TEXT[] IS NULL THEN tags ELSE $6::TEXT[] END,
		   updated_at  = NOW()
		 WHERE id = $1 AND user_id = $2
		 RETURNING id, user_id, name, description, visibility, tags, created_at, updated_at`,
		splitID, userID, req.Name, req.Description, req.Visibility, tagsArg,
	).Scan(&sp.ID, &sp.UserID, &sp.Name, &sp.Description, &sp.Visibility, &sp.Tags, &sp.CreatedAt, &sp.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrSplitNotFound
		}
		return nil, err
	}
	return sp, nil
}

func (s *JymService) DeleteSplit(ctx context.Context, userID, splitID uuid.UUID) error {
	res, err := s.db.Exec(ctx, `DELETE FROM splits WHERE id = $1 AND user_id = $2`, splitID, userID)
	if err != nil {
		return err
	}
	if res.RowsAffected() == 0 {
		return ErrSplitNotFound
	}
	return nil
}

// ─── Public Split Discovery ───────────────────────────────────────────────────

func (s *JymService) ListPublicSplits(ctx context.Context, search, tag, muscleGroup string, limit, offset int) ([]models.PublicSplitSummary, error) {
	rows, err := s.db.Query(ctx, `
		SELECT s.id, s.name, s.description, s.tags, s.created_at, COUNT(r.id) as routine_count
		FROM splits s
		LEFT JOIN routines r ON r.split_id = s.id
		WHERE s.visibility = 'public'
		  AND ($1 = '' OR s.name ILIKE '%' || $1 || '%')
		  AND ($2 = '' OR EXISTS (SELECT 1 FROM unnest(s.tags) t WHERE LOWER(TRIM(t)) = LOWER(TRIM($2))))
		  AND ($3 = '' OR EXISTS (
		        SELECT 1 FROM routines r2
		        JOIN routine_items ri ON ri.routine_id = r2.id
		        JOIN exercises e ON e.id = ri.exercise_id
		        WHERE r2.split_id = s.id AND LOWER(e.muscle_group) = LOWER($3)
		      ))
		GROUP BY s.id
		ORDER BY s.created_at DESC
		LIMIT $4 OFFSET $5
	`, search, tag, muscleGroup, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []models.PublicSplitSummary
	for rows.Next() {
		var p models.PublicSplitSummary
		if err := rows.Scan(&p.ID, &p.Name, &p.Description, &p.Tags, &p.CreatedAt, &p.RoutineCount); err != nil {
			return nil, err
		}
		results = append(results, p)
	}
	if results == nil {
		results = []models.PublicSplitSummary{}
	}
	return results, nil
}

func (s *JymService) GetPublicSplit(ctx context.Context, splitID uuid.UUID) (*models.PublicSplitDetail, error) {
	var name string
	var tags []string
	var visibility string
	err := s.db.QueryRow(ctx,
		`SELECT name, tags, visibility FROM splits WHERE id = $1`,
		splitID,
	).Scan(&name, &tags, &visibility)
	if err == pgx.ErrNoRows {
		return nil, ErrSplitNotFound
	}
	if err != nil {
		return nil, err
	}
	if visibility != "public" {
		return nil, ErrSplitNotFound
	}

	rows, err := s.db.Query(ctx, `
		SELECT r.id, r.name, r.day_order,
		       e.name, e.muscle_group,
		       COALESCE(ri.target_sets, 0), COALESCE(ri.target_reps, 0)
		FROM routines r
		LEFT JOIN routine_items ri ON ri.routine_id = r.id
		LEFT JOIN exercises e ON e.id = ri.exercise_id
		WHERE r.split_id = $1
		ORDER BY r.day_order, ri.order_index
	`, splitID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	routineMap := map[uuid.UUID]*models.ShareRoutinePreview{}
	var routineOrder []uuid.UUID

	for rows.Next() {
		var rID uuid.UUID
		var rName string
		var dayOrder int
		var exName *string
		var mg *string
		var tSets, tReps int

		if err := rows.Scan(&rID, &rName, &dayOrder, &exName, &mg, &tSets, &tReps); err != nil {
			return nil, err
		}
		if _, ok := routineMap[rID]; !ok {
			routineMap[rID] = &models.ShareRoutinePreview{
				Name:      rName,
				DayOrder:  dayOrder,
				Exercises: []models.ShareExercisePreview{},
			}
			routineOrder = append(routineOrder, rID)
		}
		if exName != nil {
			routineMap[rID].Exercises = append(routineMap[rID].Exercises, models.ShareExercisePreview{
				Name:        *exName,
				MuscleGroup: mg,
				TargetSets:  tSets,
				TargetReps:  tReps,
			})
		}
	}

	routines := make([]models.ShareRoutinePreview, 0, len(routineOrder))
	for _, id := range routineOrder {
		routines = append(routines, *routineMap[id])
	}

	return &models.PublicSplitDetail{
		SplitID:   splitID.String(),
		SplitName: name,
		Tags:      tags,
		Routines:  routines,
	}, nil
}

func (s *JymService) ImportPublicSplit(ctx context.Context, importerID, splitID uuid.UUID) (uuid.UUID, error) {
	// Verify the split is public
	var visibility string
	err := s.db.QueryRow(ctx, `SELECT visibility FROM splits WHERE id = $1`, splitID).Scan(&visibility)
	if err == pgx.ErrNoRows {
		return uuid.Nil, ErrSplitNotFound
	}
	if err != nil {
		return uuid.Nil, err
	}
	if visibility != "public" {
		return uuid.Nil, ErrSplitNotFound
	}
	return s.copySplit(ctx, importerID, splitID)
}

// ─── Routines ─────────────────────────────────────────────────────────────────

func (s *JymService) CreateRoutine(ctx context.Context, userID, splitID uuid.UUID, req *models.CreateRoutineRequest) (*models.Routine, error) {
	// Verify split ownership
	var ownerID uuid.UUID
	if err := s.db.QueryRow(ctx, `SELECT user_id FROM splits WHERE id = $1`, splitID).Scan(&ownerID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrSplitNotFound
		}
		return nil, err
	}
	if ownerID != userID {
		return nil, ErrNotOwner
	}

	dayOrder := req.DayOrder
	if dayOrder == 0 {
		dayOrder = 1
	}

	rt := &models.Routine{}
	err := s.db.QueryRow(ctx,
		`INSERT INTO routines (user_id, split_id, name, day_order)
		 VALUES ($1, $2, $3, $4)
		 RETURNING id, user_id, split_id, name, day_order, created_at`,
		userID, splitID, req.Name, dayOrder,
	).Scan(&rt.ID, &rt.UserID, &rt.SplitID, &rt.Name, &rt.DayOrder, &rt.CreatedAt)
	if err != nil {
		return nil, err
	}
	return rt, nil
}

func (s *JymService) UpdateRoutine(ctx context.Context, userID, routineID uuid.UUID, req *models.UpdateRoutineRequest) (*models.Routine, error) {
	rt := &models.Routine{}
	err := s.db.QueryRow(ctx,
		`UPDATE routines SET
		   name      = COALESCE($3, name),
		   day_order = COALESCE($4, day_order)
		 WHERE id = $1
		   AND split_id IN (SELECT id FROM splits WHERE user_id = $2)
		 RETURNING id, user_id, split_id, name, day_order, created_at`,
		routineID, userID, req.Name, req.DayOrder,
	).Scan(&rt.ID, &rt.UserID, &rt.SplitID, &rt.Name, &rt.DayOrder, &rt.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrRoutineNotFound
		}
		return nil, err
	}
	return rt, nil
}

func (s *JymService) DeleteRoutine(ctx context.Context, userID, routineID uuid.UUID) error {
	res, err := s.db.Exec(ctx,
		`DELETE FROM routines WHERE id = $1
		 AND (
		   split_id IN (SELECT id FROM splits WHERE user_id = $2)
		   OR (split_id IS NULL AND user_id = $2)
		 )`,
		routineID, userID,
	)
	if err != nil {
		return err
	}
	if res.RowsAffected() == 0 {
		return ErrRoutineNotFound
	}
	return nil
}

// ReplaceRoutineItems does a full replace of all items in a routine (for drag-drop saves).
func (s *JymService) ReplaceRoutineItems(ctx context.Context, userID, routineID uuid.UUID, items []models.ReplaceItemEntry) ([]models.RoutineItemWithExercise, error) {
	// Verify ownership (split-owned or standalone template)
	var exists bool
	err := s.db.QueryRow(ctx,
		`SELECT EXISTS(
		   SELECT 1 FROM routines r
		   WHERE r.id = $1
		   AND (
		     r.split_id IN (SELECT id FROM splits WHERE user_id = $2)
		     OR (r.split_id IS NULL AND r.user_id = $2)
		   )
		 )`, routineID, userID,
	).Scan(&exists)
	if err != nil || !exists {
		return nil, ErrRoutineNotFound
	}
	if err := s.checkItemExercises(ctx, userID, items); err != nil {
		return nil, err
	}

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	if err := replaceItemsTx(ctx, tx, routineID, items); err != nil {
		return nil, err
	}
	if err = tx.Commit(ctx); err != nil {
		return nil, err
	}
	return s.listRoutineItems(ctx, routineID)
}

// ReplaceSplitItems replaces several days' items of one split in a single transaction, so a move is atomic.
func (s *JymService) ReplaceSplitItems(ctx context.Context, userID, splitID uuid.UUID, entries []models.RoutineItemsEntry) ([]models.RoutineItemsResult, error) {
	var owns bool
	if err := s.db.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM splits WHERE id = $1 AND user_id = $2)`,
		splitID, userID,
	).Scan(&owns); err != nil {
		return nil, err
	}
	if !owns {
		return nil, ErrSplitNotFound
	}

	seen := make(map[uuid.UUID]bool, len(entries))
	for _, e := range entries {
		if seen[e.RoutineID] {
			return nil, ErrDuplicateRoutine
		}
		seen[e.RoutineID] = true
		var inSplit bool
		if err := s.db.QueryRow(ctx,
			`SELECT EXISTS(SELECT 1 FROM routines WHERE id = $1 AND split_id = $2)`,
			e.RoutineID, splitID,
		).Scan(&inSplit); err != nil {
			return nil, err
		}
		if !inSplit {
			return nil, ErrRoutineNotFound
		}
		if err := s.checkItemExercises(ctx, userID, e.Items); err != nil {
			return nil, err
		}
	}

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	for _, e := range entries {
		if err := replaceItemsTx(ctx, tx, e.RoutineID, e.Items); err != nil {
			return nil, err
		}
	}
	if err = tx.Commit(ctx); err != nil {
		return nil, err
	}

	result := make([]models.RoutineItemsResult, 0, len(entries))
	for _, e := range entries {
		items, err := s.listRoutineItems(ctx, e.RoutineID)
		if err != nil {
			return nil, err
		}
		result = append(result, models.RoutineItemsResult{RoutineID: e.RoutineID, Items: items})
	}
	return result, nil
}

func (s *JymService) checkItemExercises(ctx context.Context, userID uuid.UUID, items []models.ReplaceItemEntry) error {
	for _, item := range items {
		if owned, err := s.ownsExercise(ctx, item.ExerciseID, userID); err != nil {
			return err
		} else if !owned {
			return ErrExerciseNotFound
		}
	}
	return nil
}

// replaceItemsTx swaps a routine's items for the list, in order; zero targets default to 3 sets of 8.
func replaceItemsTx(ctx context.Context, tx pgx.Tx, routineID uuid.UUID, items []models.ReplaceItemEntry) error {
	if _, err := tx.Exec(ctx, `DELETE FROM routine_items WHERE routine_id = $1`, routineID); err != nil {
		return err
	}
	for i, item := range items {
		sets := item.TargetSets
		if sets == 0 {
			sets = 3
		}
		reps := item.TargetReps
		if reps == 0 {
			reps = 8
		}
		if _, err := tx.Exec(ctx,
			`INSERT INTO routine_items (routine_id, exercise_id, target_sets, target_reps, order_index)
			 VALUES ($1, $2, $3, $4, $5)`,
			routineID, item.ExerciseID, sets, reps, i,
		); err != nil {
			return err
		}
	}
	return nil
}

func (s *JymService) listRoutineItems(ctx context.Context, routineID uuid.UUID) ([]models.RoutineItemWithExercise, error) {
	rows, err := s.db.Query(ctx,
		`SELECT ri.id, ri.routine_id, ri.exercise_id, ri.target_sets, ri.target_reps, ri.order_index,
		        e.name, e.muscle_group
		 FROM routine_items ri
		 JOIN exercises e ON ri.exercise_id = e.id
		 WHERE ri.routine_id = $1
		 ORDER BY ri.order_index ASC`,
		routineID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := []models.RoutineItemWithExercise{}
	for rows.Next() {
		var item models.RoutineItemWithExercise
		if err := rows.Scan(
			&item.ID, &item.RoutineID, &item.ExerciseID,
			&item.TargetSets, &item.TargetReps, &item.OrderIndex,
			&item.ExerciseName, &item.MuscleGroup,
		); err != nil {
			return nil, err
		}
		result = append(result, item)
	}
	return result, rows.Err()
}

// ─── A workout's own exercise list ────────────────────────────────────────────

// listSessionExercises is a workout's list in order.
func listSessionExercises(ctx context.Context, q querier, sessionID uuid.UUID) ([]models.SessionExercise, error) {
	rows, err := q.Query(ctx,
		`SELECT se.exercise_id, e.name, e.muscle_group, se.position, se.target_sets, se.target_reps
		 FROM session_exercises se JOIN exercises e ON e.id = se.exercise_id
		 WHERE se.session_id = $1
		 ORDER BY se.position, se.exercise_id`,
		sessionID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	list := []models.SessionExercise{}
	for rows.Next() {
		var x models.SessionExercise
		if err := rows.Scan(&x.ExerciseID, &x.ExerciseName, &x.MuscleGroup, &x.Position, &x.TargetSets, &x.TargetReps); err != nil {
			return nil, err
		}
		list = append(list, x)
	}
	return list, rows.Err()
}

// seedSessionExercises gives a new workout its list: the given exercises in order (Repeat), else the routine's items.
// Targets come from the routine wherever an exercise is in it; an exercise that isn't the user's is ErrExerciseNotFound.
func seedSessionExercises(ctx context.Context, tx pgx.Tx, userID, sessionID uuid.UUID, routineID *uuid.UUID, exerciseIDs []uuid.UUID) error {
	if len(exerciseIDs) > 0 {
		distinct := map[uuid.UUID]bool{}
		for _, id := range exerciseIDs {
			distinct[id] = true
		}
		tag, err := tx.Exec(ctx,
			`INSERT INTO session_exercises (session_id, exercise_id, position, target_sets, target_reps)
			 SELECT $1, d.id, ROW_NUMBER() OVER (ORDER BY d.ord), ri.target_sets, ri.target_reps
			 FROM (SELECT DISTINCT ON (u.id) u.id, u.ord
			       FROM unnest($2::uuid[]) WITH ORDINALITY AS u(id, ord) ORDER BY u.id, u.ord) d
			 JOIN exercises e ON e.id = d.id AND e.user_id = $3
			 LEFT JOIN LATERAL (SELECT target_sets, target_reps FROM routine_items
			                    WHERE routine_id = $4 AND exercise_id = d.id
			                    ORDER BY order_index, id LIMIT 1) ri ON TRUE`,
			sessionID, exerciseIDs, userID, routineID,
		)
		if err != nil {
			return err
		}
		if int(tag.RowsAffected()) != len(distinct) {
			return ErrExerciseNotFound
		}
		return nil
	}
	if routineID == nil {
		return nil
	}
	_, err := tx.Exec(ctx,
		`INSERT INTO session_exercises (session_id, exercise_id, position, target_sets, target_reps)
		 SELECT $1, fi.exercise_id, ROW_NUMBER() OVER (ORDER BY fi.order_index, fi.id), fi.target_sets, fi.target_reps
		 FROM (SELECT DISTINCT ON (exercise_id) exercise_id, target_sets, target_reps, order_index, id
		       FROM routine_items WHERE routine_id = $2 ORDER BY exercise_id, order_index, id) fi`,
		sessionID, *routineID,
	)
	return err
}

// ensureSessionExercise puts an exercise on a workout's list, last, with its routine's targets if it has them.
func ensureSessionExercise(ctx context.Context, tx pgx.Tx, sessionID, exerciseID uuid.UUID) error {
	_, err := tx.Exec(ctx,
		`INSERT INTO session_exercises (session_id, exercise_id, position, target_sets, target_reps)
		 SELECT s.id, $2,
		        COALESCE((SELECT MAX(x.position) FROM session_exercises x WHERE x.session_id = s.id), 0) + 1,
		        ri.target_sets, ri.target_reps
		 FROM sessions s
		 LEFT JOIN LATERAL (SELECT target_sets, target_reps FROM routine_items
		                    WHERE routine_id = s.routine_id AND exercise_id = $2
		                    ORDER BY order_index, id LIMIT 1) ri ON TRUE
		 WHERE s.id = $1
		 ON CONFLICT (session_id, exercise_id) DO NOTHING`,
		sessionID, exerciseID,
	)
	return err
}

// AddSessionExercise puts an exercise on a workout's list, last; one already there stays where it is.
func (s *JymService) AddSessionExercise(ctx context.Context, userID, sessionID, exerciseID uuid.UUID) (*models.SessionExercise, error) {
	var owner uuid.UUID
	if err := s.db.QueryRow(ctx, `SELECT user_id FROM sessions WHERE id = $1`, sessionID).Scan(&owner); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrSessionNotFound
		}
		return nil, err
	}
	if owner != userID {
		return nil, ErrSessionNotFound
	}
	if owned, err := s.ownsExercise(ctx, exerciseID, userID); err != nil {
		return nil, err
	} else if !owned {
		return nil, ErrExerciseNotFound
	}
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	if err := ensureSessionExercise(ctx, tx, sessionID, exerciseID); err != nil {
		return nil, err
	}
	list, err := listSessionExercises(ctx, tx, sessionID)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	for i := range list {
		if list[i].ExerciseID == exerciseID {
			return &list[i], nil
		}
	}
	return nil, ErrExerciseNotFound
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

// Exercise, routine and series ids arrive in request bodies and the reads that
// follow join without an owner predicate, so an unchecked id leaks another
// user's name back. Check before use.
func (s *JymService) ownsExercise(ctx context.Context, exerciseID, userID uuid.UUID) (bool, error) {
	var ok bool
	err := s.db.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM exercises WHERE id = $1 AND user_id = $2)`,
		exerciseID, userID,
	).Scan(&ok)
	return ok, err
}

// routines.user_id is NOT NULL, so this covers standalone templates too.
func (s *JymService) ownsRoutine(ctx context.Context, routineID, userID uuid.UUID) (bool, error) {
	var ok bool
	err := s.db.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM routines WHERE id = $1 AND user_id = $2)`,
		routineID, userID,
	).Scan(&ok)
	return ok, err
}

func (s *JymService) ownsSeries(ctx context.Context, seriesID, userID uuid.UUID) (bool, error) {
	var ok bool
	err := s.db.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM split_series WHERE id = $1 AND user_id = $2)`,
		seriesID, userID,
	).Scan(&ok)
	return ok, err
}

func (s *JymService) StartSession(ctx context.Context, userID uuid.UUID, req *models.CreateSessionRequest) (*models.StartSessionResponse, error) {
	// A caller that sends no session_type gets "normal", the column default,
	// exactly as before.
	sessionType := "normal"
	if req.SessionType != nil {
		sessionType = *req.SessionType
	}
	if !validSessionTypes[sessionType] {
		return nil, ErrInvalidSessionType
	}
	past := req.StartedAt != nil || req.EndedAt != nil
	if past {
		if err := checkPastWorkout(req.StartedAt, req.EndedAt); err != nil {
			return nil, err
		}
	}

	if req.RoutineID != nil {
		if owned, err := s.ownsRoutine(ctx, *req.RoutineID, userID); err != nil {
			return nil, err
		} else if !owned {
			return nil, ErrRoutineNotFound
		}
	}
	seriesID := req.SeriesID
	// A day of a split with an active series belongs to that series, whichever Start button was used;
	// a past workout only if it falls inside the series.
	if req.RoutineID != nil && seriesID == nil {
		var active uuid.UUID
		err := s.db.QueryRow(ctx,
			`SELECT sr.id FROM split_series sr JOIN routines r ON r.split_id = sr.split_id
			 WHERE r.id = $1 AND sr.user_id = $2 AND sr.ended_at IS NULL
			   AND ($3::timestamptz IS NULL OR sr.started_at <= $3)
			 ORDER BY sr.started_at DESC LIMIT 1`,
			*req.RoutineID, userID, req.StartedAt,
		).Scan(&active)
		if err == nil {
			seriesID = &active
		} else if !errors.Is(err, pgx.ErrNoRows) {
			return nil, err
		}
	}
	if req.SeriesID != nil {
		if owned, err := s.ownsSeries(ctx, *req.SeriesID, userID); err != nil {
			return nil, err
		} else if !owned {
			return nil, ErrSeriesNotFound
		}
	}
	if req.RoutineID != nil && req.SeriesID != nil {
		var inSplit bool
		if err := s.db.QueryRow(ctx,
			`SELECT EXISTS(SELECT 1 FROM routines r JOIN split_series sr ON sr.split_id = r.split_id
			  WHERE r.id = $1 AND sr.id = $2)`,
			*req.RoutineID, *req.SeriesID,
		).Scan(&inSplit); err != nil {
			return nil, err
		}
		if !inSplit {
			return nil, ErrRoutineNotInSeries
		}
	}
	// A past workout is created finished, so it never competes with the open one.
	if !req.Force && !past {
		open := &SessionInProgressError{}
		err := s.db.QueryRow(ctx,
			`SELECT s.id, r.name, s.started_at,
			        (SELECT COUNT(*) FROM session_sets ss WHERE ss.session_id = s.id),
			        (SELECT MAX(ss.created_at) FROM session_sets ss WHERE ss.session_id = s.id)
			 FROM sessions s LEFT JOIN routines r ON r.id = s.routine_id
			 WHERE s.user_id = $1 AND s.ended_at IS NULL
			 ORDER BY s.started_at DESC LIMIT 1`,
			userID,
		).Scan(&open.SessionID, &open.RoutineName, &open.StartedAt, &open.SetCount, &open.LastSetAt)
		if err == nil {
			return nil, open
		}
		if !errors.Is(err, pgx.ErrNoRows) {
			return nil, err
		}
	}

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	sess := &models.StartSessionResponse{}
	err = tx.QueryRow(ctx,
		`INSERT INTO sessions (user_id, routine_id, series_id, session_type, started_at, ended_at)
		 VALUES ($1, $2, $3, $4, COALESCE($5, NOW()), $6)
		 RETURNING id, user_id, routine_id, series_id, session_type, started_at, ended_at, notes`,
		userID, req.RoutineID, seriesID, sessionType, req.StartedAt, req.EndedAt,
	).Scan(&sess.ID, &sess.UserID, &sess.RoutineID, &sess.SeriesID, &sess.SessionType, &sess.StartedAt, &sess.EndedAt, &sess.Notes)
	if err != nil {
		return nil, err
	}
	// The workout keeps its own list, so a later edit to the routine doesn't change it.
	if err := seedSessionExercises(ctx, tx, userID, sess.ID, req.RoutineID, req.ExerciseIDs); err != nil {
		return nil, err
	}
	if sess.Exercises, err = listSessionExercises(ctx, tx, sess.ID); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	sess.Targets = []models.RoutineItemWithExercise{}
	if req.RoutineID != nil {
		rows, err := s.db.Query(ctx,
			`SELECT ri.id, ri.routine_id, ri.exercise_id, ri.target_sets, ri.target_reps, ri.order_index,
			        e.name, e.muscle_group
			 FROM routine_items ri
			 JOIN exercises e ON ri.exercise_id = e.id
			 WHERE ri.routine_id = $1
			 ORDER BY ri.order_index ASC`,
			req.RoutineID,
		)
		if err != nil {
			return nil, err
		}
		defer rows.Close()

		for rows.Next() {
			var item models.RoutineItemWithExercise
			if err := rows.Scan(
				&item.ID, &item.RoutineID, &item.ExerciseID,
				&item.TargetSets, &item.TargetReps, &item.OrderIndex,
				&item.ExerciseName, &item.MuscleGroup,
			); err != nil {
				return nil, err
			}
			sess.Targets = append(sess.Targets, item)
		}
	}

	return sess, nil
}

// oldestPastWorkout is how far back a past workout can be logged.
const oldestPastWorkout = 366 * 24 * time.Hour

// checkPastWorkout holds a logged-afterwards workout to the same times rules as an edit, and to the last year.
func checkPastWorkout(start, end *time.Time) error {
	switch {
	case start == nil || end == nil:
		return &SessionTimesError{"Give both a start and a finish time."}
	case !end.After(*start):
		return &SessionTimesError{"The end must be after the start."}
	case end.After(time.Now().Add(5 * time.Minute)):
		return &SessionTimesError{"The end can't be in the future."}
	case end.Sub(*start) > maxSessionLength:
		return &SessionTimesError{"A workout can't be longer than 24 hours."}
	case start.Before(time.Now().Add(-oldestPastWorkout)):
		return &SessionTimesError{"A past workout can go back a year at most."}
	}
	return nil
}

// sessionPageSelect aggregates only the sessions its page CTE picks, newest first.
const sessionPageSelect = `WITH page AS (%s)
		 SELECT s.id, s.user_id, s.routine_id, s.series_id, s.session_type, s.started_at, s.ended_at, s.notes,
		        r.name as routine_name, ` + sessionAggregatesSQL + `
		 FROM page
		 JOIN sessions s ON s.id = page.id
		 LEFT JOIN routines r ON s.routine_id = r.id
		 LEFT JOIN session_sets ss ON ss.session_id = s.id
		 LEFT JOIN exercises e ON ss.exercise_id = e.id
		 GROUP BY s.id, r.name
		 ORDER BY s.started_at DESC, s.id DESC`

// ListSessions returns one page of sessions, newest first; before and beforeID continue after a page's last row.
func (s *JymService) ListSessions(ctx context.Context, userID uuid.UUID, before *time.Time, beforeID uuid.UUID, limit int) ([]models.SessionSummary, error) {
	rows, err := s.db.Query(ctx, fmt.Sprintf(sessionPageSelect,
		`SELECT id FROM sessions
		 WHERE user_id = $1 AND ($2::timestamptz IS NULL OR (started_at, id) < ($2::timestamptz, $3::uuid))
		 ORDER BY started_at DESC, id DESC
		 LIMIT $4`),
		userID, before, beforeID, limit,
	)
	if err != nil {
		return nil, err
	}
	return scanSessionSummaries(rows)
}

// ListSessionsSince returns every session from the start of the user's calendar day, plus any still in progress.
func (s *JymService) ListSessionsSince(ctx context.Context, userID uuid.UUID, day time.Time, tzHint string) ([]models.SessionSummary, error) {
	loc, err := userLocation(ctx, s.db, userID, tzHint)
	if err != nil {
		return nil, err
	}
	start := time.Date(day.Year(), day.Month(), day.Day(), 0, 0, 0, 0, loc)
	rows, err := s.db.Query(ctx, fmt.Sprintf(sessionPageSelect,
		`SELECT id FROM sessions
		 WHERE user_id = $1 AND (started_at >= $2 OR ended_at IS NULL)
		 ORDER BY started_at DESC, id DESC
		 LIMIT 1000`),
		userID, start,
	)
	if err != nil {
		return nil, err
	}
	return scanSessionSummaries(rows)
}

// ListAllSessions returns every session the user has, for the account export.
// An export that silently stopped at 50 would quietly lose history.
func (s *JymService) ListAllSessions(ctx context.Context, userID uuid.UUID) ([]models.SessionSummary, error) {
	return s.listSessions(ctx, userID, nil)
}

// sessionSummarySelect is a session list row; callers append a WHERE on s.* then sessionSummaryGroup.
const sessionSummarySelect = `SELECT s.id, s.user_id, s.routine_id, s.series_id, s.session_type, s.started_at, s.ended_at, s.notes,
		        r.name as routine_name, ` + sessionAggregatesSQL + `
		 FROM sessions s
		 LEFT JOIN routines r ON s.routine_id = r.id
		 LEFT JOIN session_sets ss ON ss.session_id = s.id
		 LEFT JOIN exercises e ON ss.exercise_id = e.id
		 `

const sessionSummaryGroup = ` GROUP BY s.id, r.name `

// listSessions backs the export; a nil limit binds LIMIT NULL, which Postgres treats as no limit.
func (s *JymService) listSessions(ctx context.Context, userID uuid.UUID, limit *int) ([]models.SessionSummary, error) {
	rows, err := s.db.Query(ctx,
		sessionSummarySelect+`WHERE s.user_id = $1`+sessionSummaryGroup+`ORDER BY s.started_at DESC LIMIT $2`,
		userID, limit,
	)
	if err != nil {
		return nil, err
	}
	return scanSessionSummaries(rows)
}

// ListSessionsBetween returns sessions started in [from, to), oldest first.
func (s *JymService) ListSessionsBetween(ctx context.Context, userID uuid.UUID, from, to time.Time) ([]models.SessionSummary, error) {
	rows, err := s.db.Query(ctx,
		sessionSummarySelect+`WHERE s.user_id = $1 AND s.started_at >= $2 AND s.started_at < $3`+sessionSummaryGroup+`ORDER BY s.started_at ASC`,
		userID, from, to,
	)
	if err != nil {
		return nil, err
	}
	return scanSessionSummaries(rows)
}

func scanSessionSummaries(rows pgx.Rows) ([]models.SessionSummary, error) {
	defer rows.Close()
	sessions := []models.SessionSummary{}
	for rows.Next() {
		var sess models.SessionSummary
		if err := rows.Scan(
			&sess.ID, &sess.UserID, &sess.RoutineID, &sess.SeriesID, &sess.SessionType,
			&sess.StartedAt, &sess.EndedAt, &sess.Notes,
			&sess.RoutineName, &sess.SetCount, &sess.PRCount, &sess.TotalVolume, &sess.MuscleGroups,
			&sess.FirstSetAt, &sess.LastSetAt,
		); err != nil {
			return nil, err
		}
		if sess.MuscleGroups == nil {
			sess.MuscleGroups = []string{}
		}
		sessions = append(sessions, sess)
	}
	return sessions, rows.Err()
}

func (s *JymService) GetSession(ctx context.Context, userID, sessionID uuid.UUID) (*models.SessionWithSets, error) {
	sess := &models.SessionWithSets{}
	err := s.db.QueryRow(ctx,
		`SELECT s.id, s.user_id, s.routine_id, s.series_id, s.session_type, s.started_at, s.ended_at, s.notes, r.name
		 FROM sessions s
		 LEFT JOIN routines r ON s.routine_id = r.id
		 WHERE s.id = $1 AND s.user_id = $2`,
		sessionID, userID,
	).Scan(&sess.ID, &sess.UserID, &sess.RoutineID, &sess.SeriesID, &sess.SessionType, &sess.StartedAt, &sess.EndedAt, &sess.Notes, &sess.RoutineName)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrSessionNotFound
		}
		return nil, err
	}

	// Exercises in the order they were first done, not by id.
	rows, err := s.db.Query(ctx,
		`SELECT ss.id, ss.session_id, ss.exercise_id, ss.set_number, ss.weight,
		        ss.reps_performed, ss.rpe, ss.is_pr, ss.is_warmup, ss.exercise_note, ss.created_at,
		        e.name, e.muscle_group
		 FROM session_sets ss
		 JOIN exercises e ON ss.exercise_id = e.id
		 WHERE ss.session_id = $1
		 ORDER BY MIN(ss.created_at) OVER (PARTITION BY ss.exercise_id), ss.exercise_id, ss.set_number, ss.created_at`,
		sessionID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	sess.Sets = []models.SessionSetWithExercise{}
	for rows.Next() {
		var set models.SessionSetWithExercise
		if err := rows.Scan(
			&set.ID, &set.SessionID, &set.ExerciseID, &set.SetNumber, &set.Weight,
			&set.RepsPerformed, &set.RPE, &set.IsPR, &set.IsWarmup, &set.ExerciseNote, &set.CreatedAt,
			&set.ExerciseName, &set.MuscleGroup,
		); err != nil {
			return nil, err
		}
		sess.Sets = append(sess.Sets, set)
	}

	// Load attachments
	aRows, err := s.db.Query(ctx,
		`SELECT id, session_id, user_id, exercise_id, object_key, file_url, file_type, label, created_at
		 FROM session_attachments
		 WHERE session_id = $1
		 ORDER BY created_at ASC`,
		sessionID,
	)
	if err != nil {
		return nil, err
	}
	defer aRows.Close()

	sess.Attachments = []models.SessionAttachment{}
	for aRows.Next() {
		var a models.SessionAttachment
		if err := aRows.Scan(&a.ID, &a.SessionID, &a.UserID, &a.ExerciseID, &a.ObjectKey, &a.FileURL, &a.FileType, &a.Label, &a.CreatedAt); err != nil {
			return nil, err
		}
		sess.Attachments = append(sess.Attachments, a)
	}

	sess.Targets = []models.RoutineItemWithExercise{}
	if sess.RoutineID != nil {
		items, err := s.listRoutineItems(ctx, *sess.RoutineID)
		if err != nil {
			return nil, err
		}
		if items != nil {
			sess.Targets = items
		}
	}
	if sess.Exercises, err = listSessionExercises(ctx, s.db, sessionID); err != nil {
		return nil, err
	}
	return sess, nil
}

func (s *JymService) CreateAttachment(ctx context.Context, userID, sessionID uuid.UUID, exerciseID *uuid.UUID, objectKey, fileURL, fileType string, label *string) (*models.SessionAttachment, error) {
	a := &models.SessionAttachment{}
	err := s.db.QueryRow(ctx,
		`INSERT INTO session_attachments (session_id, user_id, exercise_id, object_key, file_url, file_type, label)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)
		 RETURNING id, session_id, user_id, exercise_id, object_key, file_url, file_type, label, created_at`,
		sessionID, userID, exerciseID, objectKey, fileURL, fileType, label,
	).Scan(&a.ID, &a.SessionID, &a.UserID, &a.ExerciseID, &a.ObjectKey, &a.FileURL, &a.FileType, &a.Label, &a.CreatedAt)
	if err != nil {
		return nil, err
	}
	return a, nil
}

func (s *JymService) GetAttachment(ctx context.Context, userID, attachmentID uuid.UUID) (*models.SessionAttachment, error) {
	a := &models.SessionAttachment{}
	err := s.db.QueryRow(ctx,
		`SELECT id, session_id, user_id, exercise_id, object_key, file_url, file_type, label, created_at
		 FROM session_attachments WHERE id = $1 AND user_id = $2`,
		attachmentID, userID,
	).Scan(&a.ID, &a.SessionID, &a.UserID, &a.ExerciseID, &a.ObjectKey, &a.FileURL, &a.FileType, &a.Label, &a.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrSessionNotFound
		}
		return nil, err
	}
	return a, nil
}

func (s *JymService) DeleteAttachment(ctx context.Context, userID, attachmentID uuid.UUID) (*models.SessionAttachment, error) {
	a := &models.SessionAttachment{}
	err := s.db.QueryRow(ctx,
		`DELETE FROM session_attachments WHERE id = $1 AND user_id = $2
		 RETURNING id, session_id, user_id, exercise_id, object_key, file_url, file_type, label, created_at`,
		attachmentID, userID,
	).Scan(&a.ID, &a.SessionID, &a.UserID, &a.ExerciseID, &a.ObjectKey, &a.FileURL, &a.FileType, &a.Label, &a.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrSessionNotFound
		}
		return nil, err
	}
	return a, nil
}

func (s *JymService) ListFormChecks(ctx context.Context, userID, exerciseID uuid.UUID) ([]models.ExerciseFormCheck, error) {
	rows, err := s.db.Query(ctx,
		`SELECT sa.id, sa.session_id, sa.user_id, sa.exercise_id,
		        sa.object_key, sa.file_url, sa.file_type, sa.label, sa.created_at,
		        s.started_at AS session_date
		 FROM session_attachments sa
		 JOIN sessions s ON sa.session_id = s.id
		 WHERE sa.exercise_id = $1 AND sa.user_id = $2
		 ORDER BY s.started_at DESC, sa.created_at ASC`,
		exerciseID, userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := []models.ExerciseFormCheck{}
	for rows.Next() {
		var fc models.ExerciseFormCheck
		if err := rows.Scan(
			&fc.ID, &fc.SessionID, &fc.UserID, &fc.ExerciseID,
			&fc.ObjectKey, &fc.FileURL, &fc.FileType, &fc.Label, &fc.CreatedAt,
			&fc.SessionDate,
		); err != nil {
			return nil, err
		}
		result = append(result, fc)
	}
	return result, nil
}

// UpdateSession edits notes or type and finishes the session once; finishing again is ErrSessionEnded.
func (s *JymService) UpdateSession(ctx context.Context, userID, sessionID uuid.UUID, req *models.UpdateSessionRequest) (*models.Session, error) {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	sess := &models.Session{}
	err = tx.QueryRow(ctx,
		`UPDATE sessions SET
		   ended_at     = COALESCE($3, ended_at),
		   notes        = COALESCE($4, notes),
		   session_type = COALESCE($5, session_type)
		 WHERE id = $1 AND user_id = $2
		   AND ($3::timestamptz IS NULL OR ended_at IS NULL)
		 RETURNING id, user_id, routine_id, series_id, session_type, started_at, ended_at, notes`,
		sessionID, userID, req.EndedAt, req.Notes, req.SessionType,
	).Scan(&sess.ID, &sess.UserID, &sess.RoutineID, &sess.SeriesID, &sess.SessionType, &sess.StartedAt, &sess.EndedAt, &sess.Notes)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			// Tell "no such session" apart from "already finished".
			var ended bool
			if qerr := s.db.QueryRow(ctx,
				`SELECT ended_at IS NOT NULL FROM sessions WHERE id = $1 AND user_id = $2`,
				sessionID, userID,
			).Scan(&ended); qerr == nil && ended {
				return nil, ErrSessionEnded
			}
			return nil, ErrSessionNotFound
		}
		return nil, err
	}

	// Deload sets never count, so a type change moves PRs in every exercise of the session.
	if req.SessionType != nil {
		if err := rerateSessionExercises(ctx, tx, userID, sessionID); err != nil {
			return nil, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return sess, nil
}

const (
	// sessionTimeSlack covers times typed in whole minutes and a device clock slightly off the server's.
	sessionTimeSlack = time.Minute
	maxSessionLength = 24 * time.Hour
)

// UpdateSessionTimes moves a finished workout's start or end. The times must still hold every logged
// set; PR flags follow the order sets were logged, so nothing is re-rated.
func (s *JymService) UpdateSessionTimes(ctx context.Context, userID, sessionID uuid.UUID, req *models.UpdateSessionTimesRequest) (*models.Session, error) {
	if req.StartedAt == nil && req.EndedAt == nil {
		return nil, &SessionTimesError{"Change the start or the end."}
	}
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var start time.Time
	var end, firstSet, lastSet *time.Time
	err = tx.QueryRow(ctx,
		`SELECT s.started_at, s.ended_at,
		        (SELECT MIN(ss.created_at) FROM session_sets ss WHERE ss.session_id = s.id),
		        (SELECT MAX(ss.created_at) FROM session_sets ss WHERE ss.session_id = s.id)
		 FROM sessions s WHERE s.id = $1 AND s.user_id = $2
		 FOR UPDATE OF s`,
		sessionID, userID,
	).Scan(&start, &end, &firstSet, &lastSet)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrSessionNotFound
	}
	if err != nil {
		return nil, err
	}
	if end == nil {
		return nil, ErrSessionNotFinished
	}

	newStart, newEnd := start, *end
	if req.StartedAt != nil {
		newStart = *req.StartedAt
	}
	if req.EndedAt != nil {
		newEnd = *req.EndedAt
	}
	switch {
	case !newEnd.After(newStart):
		return nil, &SessionTimesError{"The end must be after the start."}
	case newEnd.After(time.Now().Add(5 * time.Minute)):
		return nil, &SessionTimesError{"The end can't be in the future."}
	case newEnd.Sub(newStart) > maxSessionLength:
		return nil, &SessionTimesError{"A workout can't be longer than 24 hours."}
	// Only a field being changed is held to the sets, so an untouched end the device clocked early still saves.
	case req.StartedAt != nil && firstSet != nil && newStart.After(firstSet.Add(sessionTimeSlack)):
		return nil, &SessionTimesError{"The start can't be after your first set."}
	case req.EndedAt != nil && lastSet != nil && newEnd.Before(lastSet.Add(-sessionTimeSlack)):
		return nil, &SessionTimesError{"The end can't be before your last set."}
	}

	sess := &models.Session{}
	err = tx.QueryRow(ctx,
		`UPDATE sessions SET started_at = $3, ended_at = $4 WHERE id = $1 AND user_id = $2
		 RETURNING id, user_id, routine_id, series_id, session_type, started_at, ended_at, notes`,
		sessionID, userID, newStart, newEnd,
	).Scan(&sess.ID, &sess.UserID, &sess.RoutineID, &sess.SeriesID, &sess.SessionType, &sess.StartedAt, &sess.EndedAt, &sess.Notes)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return sess, nil
}

func (s *JymService) DeleteSession(ctx context.Context, userID, sessionID uuid.UUID) error {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	exerciseIDs, err := sessionExerciseIDs(ctx, tx, sessionID)
	if err != nil {
		return err
	}
	res, err := tx.Exec(ctx, `DELETE FROM sessions WHERE id = $1 AND user_id = $2`, sessionID, userID)
	if err != nil {
		return err
	}
	if res.RowsAffected() == 0 {
		return ErrSessionNotFound
	}
	for _, exerciseID := range exerciseIDs {
		if _, err := rerateExercisePRs(ctx, tx, userID, exerciseID); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

// DeleteSessionExercise removes every logged set for one exercise within a
// session - "remove this exercise from today's workout" rather than deleting
// sets one at a time. Zero sets logged yet is the normal, successful case
// for a block nobody has touched, not an error; only an unowned or missing
// session is, so ownership is checked separately from the delete itself.
func (s *JymService) DeleteSessionExercise(ctx context.Context, userID, sessionID, exerciseID uuid.UUID) error {
	var exists bool
	err := s.db.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM sessions WHERE id = $1 AND user_id = $2)`,
		sessionID, userID,
	).Scan(&exists)
	if err != nil {
		return err
	}
	if !exists {
		return ErrSessionNotFound
	}

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	res, err := tx.Exec(ctx,
		`DELETE FROM session_sets WHERE session_id = $1 AND exercise_id = $2`,
		sessionID, exerciseID,
	)
	if err != nil {
		return err
	}
	if res.RowsAffected() > 0 {
		if _, err := rerateExercisePRs(ctx, tx, userID, exerciseID); err != nil {
			return err
		}
	}
	if _, err := tx.Exec(ctx,
		`DELETE FROM session_exercises WHERE session_id = $1 AND exercise_id = $2`,
		sessionID, exerciseID,
	); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// GetSessionAttachmentKeys returns the R2 object_key for every attachment
// belonging to the given session and user. Used by DeleteSession to clean up
// storage before the DB row is removed.
func (s *JymService) GetSessionAttachmentKeys(ctx context.Context, userID, sessionID uuid.UUID) ([]string, error) {
	rows, err := s.db.Query(ctx,
		`SELECT object_key FROM session_attachments WHERE session_id = $1 AND user_id = $2`,
		sessionID, userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var keys []string
	for rows.Next() {
		var key string
		if err := rows.Scan(&key); err != nil {
			return nil, err
		}
		keys = append(keys, key)
	}
	return keys, nil
}

// ─── Sets ─────────────────────────────────────────────────────────────────────

// prTolerance treats weights this close as one lift: a kg best shown in lb and typed back lands within ~0.03 kg.
const prTolerance = 0.05

// isNewPR reports whether a working set beats the best weight, or ties it (within prTolerance) with more reps.
func isNewPR(weight float64, reps int, isWarmup bool, bestWeight float64, bestReps int) bool {
	if isWarmup {
		return false
	}
	if weight > bestWeight+prTolerance {
		return true
	}
	return math.Abs(weight-bestWeight) <= prTolerance && reps > bestReps
}

// roundWeight rounds kg to the 2 decimals session_sets.weight keeps.
func roundWeight(kg float64) float64 {
	return math.Round(kg*100) / 100
}

// rerateExercisePRs recomputes is_pr for every set of one exercise in logging order, so no edit or delete leaves
// a stale flag. Warm-ups and deload sets are never PRs and don't raise the bar. Returns how many flags changed.
func rerateExercisePRs(ctx context.Context, tx pgx.Tx, userID, exerciseID uuid.UUID) (int, error) {
	// The row lock makes concurrent writes to one exercise re-rate in turn.
	var locked int
	if err := tx.QueryRow(ctx,
		`SELECT 1 FROM exercises WHERE id = $1 AND user_id = $2 FOR UPDATE`, exerciseID, userID,
	).Scan(&locked); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return 0, ErrExerciseNotFound
		}
		return 0, err
	}

	rows, err := tx.Query(ctx,
		`SELECT ss.id, ss.weight, ss.reps_performed, ss.is_warmup, s.session_type = 'deload', ss.is_pr
		 FROM session_sets ss
		 JOIN sessions s ON s.id = ss.session_id
		 WHERE ss.exercise_id = $1 AND s.user_id = $2
		 ORDER BY ss.created_at, ss.id`,
		exerciseID, userID,
	)
	if err != nil {
		return 0, err
	}
	var ids []string
	var flags []bool
	var bestWeight float64
	var bestReps int
	for rows.Next() {
		var id uuid.UUID
		var weight float64
		var reps int
		var warmup, deload, current bool
		if err := rows.Scan(&id, &weight, &reps, &warmup, &deload, &current); err != nil {
			rows.Close()
			return 0, err
		}
		pr := false
		if !warmup && !deload {
			pr = isNewPR(weight, reps, false, bestWeight, bestReps)
			switch {
			case weight > bestWeight+prTolerance:
				bestWeight, bestReps = weight, reps
			case math.Abs(weight-bestWeight) <= prTolerance:
				bestWeight = math.Max(bestWeight, weight)
				if reps > bestReps {
					bestReps = reps
				}
			}
		}
		if pr != current {
			ids = append(ids, id.String())
			flags = append(flags, pr)
		}
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return 0, err
	}
	if len(ids) == 0 {
		return 0, nil
	}
	if _, err := tx.Exec(ctx,
		`UPDATE session_sets SET is_pr = u.pr
		 FROM unnest($1::text[], $2::bool[]) AS u(id, pr)
		 WHERE session_sets.id = u.id::uuid`,
		ids, flags,
	); err != nil {
		return 0, err
	}
	return len(ids), nil
}

// sessionExerciseIDs lists the exercises a session has sets for.
func sessionExerciseIDs(ctx context.Context, tx pgx.Tx, sessionID uuid.UUID) ([]uuid.UUID, error) {
	rows, err := tx.Query(ctx, `SELECT DISTINCT exercise_id FROM session_sets WHERE session_id = $1`, sessionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var ids []uuid.UUID
	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

func rerateSessionExercises(ctx context.Context, tx pgx.Tx, userID, sessionID uuid.UUID) error {
	exerciseIDs, err := sessionExerciseIDs(ctx, tx, sessionID)
	if err != nil {
		return err
	}
	for _, exerciseID := range exerciseIDs {
		if _, err := rerateExercisePRs(ctx, tx, userID, exerciseID); err != nil {
			return err
		}
	}
	return nil
}

// RerateAllPRs re-rates every exercise that has sets: a one-off backfill for flags written under older rules.
func (s *JymService) RerateAllPRs(ctx context.Context) (exercises, changed int, err error) {
	rows, err := s.db.Query(ctx,
		`SELECT DISTINCT s.user_id, ss.exercise_id
		 FROM session_sets ss JOIN sessions s ON s.id = ss.session_id`)
	if err != nil {
		return 0, 0, err
	}
	type pair struct{ userID, exerciseID uuid.UUID }
	var pairs []pair
	for rows.Next() {
		var p pair
		if err := rows.Scan(&p.userID, &p.exerciseID); err != nil {
			rows.Close()
			return 0, 0, err
		}
		pairs = append(pairs, p)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return 0, 0, err
	}

	for _, p := range pairs {
		tx, err := s.db.Begin(ctx)
		if err != nil {
			return exercises, changed, err
		}
		n, err := rerateExercisePRs(ctx, tx, p.userID, p.exerciseID)
		if errors.Is(err, ErrExerciseNotFound) {
			tx.Rollback(ctx)
			continue
		}
		if err != nil {
			tx.Rollback(ctx)
			return exercises, changed, err
		}
		if err := tx.Commit(ctx); err != nil {
			return exercises, changed, err
		}
		exercises++
		changed += n
	}
	return exercises, changed, nil
}

func (s *JymService) LogSet(ctx context.Context, userID, sessionID uuid.UUID, req *models.CreateSetRequest) (*models.SessionSet, error) {
	// Verify session ownership, and that it is still live unless the set is fixed into a finished one
	var ownerID uuid.UUID
	var endedAt *time.Time
	if err := s.db.QueryRow(ctx, `SELECT user_id, ended_at FROM sessions WHERE id = $1`, sessionID).Scan(&ownerID, &endedAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrSessionNotFound
		}
		return nil, err
	}
	if ownerID != userID {
		return nil, ErrNotOwner
	}
	if endedAt != nil && !req.Fix {
		return nil, ErrSessionEnded
	}

	if owned, err := s.ownsExercise(ctx, req.ExerciseID, userID); err != nil {
		return nil, err
	} else if !owned {
		return nil, ErrExerciseNotFound
	}

	isWarmup := req.IsWarmup != nil && *req.IsWarmup
	// Compare at the column's precision, or 175 lbs never ties the 79.38 kg saved.
	weight := roundWeight(req.Weight)

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	// A set fixed into a finished workout is timed just after its last set (never past its end), so PR order,
	// set order and the workout's times stay in the workout's own time; a live set is timed now.
	set := &models.SessionSet{}
	err = tx.QueryRow(ctx,
		`INSERT INTO session_sets (session_id, exercise_id, set_number, weight, reps_performed, rpe, is_warmup, exercise_note, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE((
		   SELECT LEAST(s.ended_at, GREATEST(s.started_at, COALESCE(MAX(x.created_at), s.started_at)) + interval '1 second')
		   FROM sessions s LEFT JOIN session_sets x ON x.session_id = s.id
		   WHERE s.id = $1 AND s.ended_at IS NOT NULL
		   GROUP BY s.id), NOW()))
		 RETURNING id, session_id, exercise_id, set_number, weight, reps_performed, rpe, is_pr, is_warmup, exercise_note, created_at`,
		sessionID, req.ExerciseID, req.SetNumber, weight, req.RepsPerformed, req.RPE, isWarmup, req.ExerciseNote,
	).Scan(&set.ID, &set.SessionID, &set.ExerciseID, &set.SetNumber, &set.Weight,
		&set.RepsPerformed, &set.RPE, &set.IsPR, &set.IsWarmup, &set.ExerciseNote, &set.CreatedAt)
	if err != nil {
		return nil, err
	}
	if err := ensureSessionExercise(ctx, tx, sessionID, req.ExerciseID); err != nil {
		return nil, err
	}
	if _, err := rerateExercisePRs(ctx, tx, userID, req.ExerciseID); err != nil {
		return nil, err
	}
	if err := tx.QueryRow(ctx, `SELECT is_pr FROM session_sets WHERE id = $1`, set.ID).Scan(&set.IsPR); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return set, nil
}

// UpdateSet edits a logged set; a change to weight, reps or warm-up re-rates the whole exercise.
func (s *JymService) UpdateSet(ctx context.Context, userID, setID uuid.UUID, req *models.UpdateSetRequest) (*models.SessionSet, error) {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	set := &models.SessionSet{}
	err = tx.QueryRow(ctx,
		`UPDATE session_sets SET
		   weight         = COALESCE($3, weight),
		   reps_performed = COALESCE($4, reps_performed),
		   rpe            = COALESCE($5, rpe),
		   is_warmup      = COALESCE($6, is_warmup),
		   exercise_note  = CASE WHEN $7::TEXT IS NULL THEN exercise_note ELSE NULLIF(TRIM($7), '') END
		 WHERE id = $1
		   AND session_id IN (SELECT id FROM sessions WHERE user_id = $2)
		 RETURNING id, session_id, exercise_id, set_number, weight, reps_performed, rpe, is_pr, is_warmup, exercise_note, created_at`,
		setID, userID, req.Weight, req.RepsPerformed, req.RPE, req.IsWarmup, req.ExerciseNote,
	).Scan(&set.ID, &set.SessionID, &set.ExerciseID, &set.SetNumber, &set.Weight,
		&set.RepsPerformed, &set.RPE, &set.IsPR, &set.IsWarmup, &set.ExerciseNote, &set.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrSetNotFound
		}
		return nil, err
	}

	if req.Weight != nil || req.RepsPerformed != nil || req.IsWarmup != nil {
		if _, err := rerateExercisePRs(ctx, tx, userID, set.ExerciseID); err != nil {
			return nil, err
		}
		if err := tx.QueryRow(ctx, `SELECT is_pr FROM session_sets WHERE id = $1`, set.ID).Scan(&set.IsPR); err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return set, nil
}

// DeleteSet removes a set, renumbers the rest of that exercise in the session, and re-rates its PRs.
func (s *JymService) DeleteSet(ctx context.Context, userID, setID uuid.UUID) error {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var sessionID, exerciseID uuid.UUID
	err = tx.QueryRow(ctx,
		`DELETE FROM session_sets WHERE id = $1
		 AND session_id IN (SELECT id FROM sessions WHERE user_id = $2)
		 RETURNING session_id, exercise_id`,
		setID, userID,
	).Scan(&sessionID, &exerciseID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrSetNotFound
		}
		return err
	}
	if _, err := tx.Exec(ctx,
		`UPDATE session_sets ss SET set_number = n.rn
		 FROM (SELECT id, ROW_NUMBER() OVER (ORDER BY set_number, created_at, id) AS rn
		       FROM session_sets WHERE session_id = $1 AND exercise_id = $2) n
		 WHERE ss.id = n.id AND ss.set_number <> n.rn`,
		sessionID, exerciseID,
	); err != nil {
		return err
	}
	if _, err := rerateExercisePRs(ctx, tx, userID, exerciseID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// GetPRs returns the best personal record set (by weight) for each exercise the user has logged.
func (s *JymService) GetPRs(ctx context.Context, userID uuid.UUID) ([]models.ExercisePR, error) {
	rows, err := s.db.Query(ctx,
		`SELECT DISTINCT ON (ss.exercise_id)
		        e.id, e.name, e.muscle_group,
		        ss.weight, ss.reps_performed, s.started_at
		 FROM session_sets ss
		 JOIN sessions s  ON ss.session_id  = s.id
		 JOIN exercises e ON ss.exercise_id = e.id
		 WHERE s.user_id = $1
		   AND ss.is_pr  = true
		   AND (s.session_type IS NULL OR s.session_type != 'deload')
		 ORDER BY ss.exercise_id, ROUND(ss.weight, 1) DESC, ss.reps_performed DESC, ss.weight DESC`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	prs := []models.ExercisePR{}
	for rows.Next() {
		var pr models.ExercisePR
		if err := rows.Scan(&pr.ExerciseID, &pr.Name, &pr.MuscleGroup, &pr.Weight, &pr.Reps, &pr.Date); err != nil {
			return nil, err
		}
		pr.Est1RM = epley1RM(pr.Weight, pr.Reps)
		prs = append(prs, pr)
	}
	return prs, nil
}

// ─── Body Weights ─────────────────────────────────────────────────────────────

func (s *JymService) LogBodyWeight(ctx context.Context, userID uuid.UUID, req *models.LogBodyWeightRequest) (*models.BodyWeight, error) {
	bw := &models.BodyWeight{}
	err := s.db.QueryRow(ctx,
		`INSERT INTO body_weights (user_id, recorded_at, weight_kg)
		 VALUES ($1, $2::date, $3)
		 ON CONFLICT (user_id, recorded_at) DO UPDATE SET weight_kg = EXCLUDED.weight_kg
		 RETURNING id, user_id, recorded_at, weight_kg, created_at`,
		userID, req.RecordedAt, req.WeightKg,
	).Scan(&bw.ID, &bw.UserID, &bw.RecordedAt, &bw.WeightKg, &bw.CreatedAt)
	if err != nil {
		return nil, err
	}
	return bw, nil
}

// ListBodyWeights returns the last year of entries, which is what the chart
// plots.
func (s *JymService) ListBodyWeights(ctx context.Context, userID uuid.UUID) ([]models.BodyWeight, error) {
	limit := 365
	return s.listBodyWeights(ctx, userID, &limit)
}

// ListAllBodyWeights returns every entry, for the account export.
func (s *JymService) ListAllBodyWeights(ctx context.Context, userID uuid.UUID) ([]models.BodyWeight, error) {
	return s.listBodyWeights(ctx, userID, nil)
}

func (s *JymService) listBodyWeights(ctx context.Context, userID uuid.UUID, limit *int) ([]models.BodyWeight, error) {
	rows, err := s.db.Query(ctx,
		`SELECT id, user_id, recorded_at, weight_kg, created_at
		 FROM body_weights WHERE user_id = $1
		 ORDER BY recorded_at DESC
		 LIMIT $2`,
		userID, limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []models.BodyWeight
	for rows.Next() {
		var bw models.BodyWeight
		if err := rows.Scan(&bw.ID, &bw.UserID, &bw.RecordedAt, &bw.WeightKg, &bw.CreatedAt); err != nil {
			return nil, err
		}
		result = append(result, bw)
	}
	if result == nil {
		result = []models.BodyWeight{}
	}
	return result, nil
}

func (s *JymService) DeleteBodyWeight(ctx context.Context, userID, id uuid.UUID) error {
	res, err := s.db.Exec(ctx, `DELETE FROM body_weights WHERE id = $1 AND user_id = $2`, id, userID)
	if err != nil {
		return err
	}
	if res.RowsAffected() == 0 {
		return ErrBodyWeightNotFound
	}
	return nil
}

// ─── Split Series ─────────────────────────────────────────────────────────────

func (s *JymService) CreateSeries(ctx context.Context, userID uuid.UUID, req *models.CreateSeriesRequest) (*models.SplitSeriesSummary, error) {
	// A length in weeks or sessions needs its number; open-ended keeps none.
	switch req.DurationType {
	case "weeks":
		if req.TargetWeeks == nil || *req.TargetWeeks < 1 || *req.TargetWeeks > 52 {
			return nil, ErrInvalidSeriesLength
		}
		req.TargetSessions = nil
	case "sessions":
		if req.TargetSessions == nil || *req.TargetSessions < 1 || *req.TargetSessions > 200 {
			return nil, ErrInvalidSeriesLength
		}
		req.TargetWeeks = nil
	default:
		req.TargetWeeks, req.TargetSessions = nil, nil
	}

	// Verify split ownership
	var ownerID uuid.UUID
	if err := s.db.QueryRow(ctx, `SELECT user_id FROM splits WHERE id = $1`, req.SplitID).Scan(&ownerID); err != nil {
		return nil, ErrSplitNotFound
	}
	if ownerID != userID {
		return nil, ErrNotOwner
	}

	sr := &models.SplitSeriesSummary{}
	err := s.db.QueryRow(ctx,
		`INSERT INTO split_series (user_id, split_id, name, duration_type, target_weeks, target_sessions)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 RETURNING id, user_id, split_id, name, duration_type, target_weeks, target_sessions, started_at, ended_at, created_at`,
		userID, req.SplitID, req.Name, req.DurationType, req.TargetWeeks, req.TargetSessions,
	).Scan(&sr.ID, &sr.UserID, &sr.SplitID, &sr.Name, &sr.DurationType,
		&sr.TargetWeeks, &sr.TargetSessions, &sr.StartedAt, &sr.EndedAt, &sr.CreatedAt)
	if err != nil {
		return nil, err
	}

	// Fetch split name
	s.db.QueryRow(ctx, `SELECT name FROM splits WHERE id = $1`, req.SplitID).Scan(&sr.SplitName)
	return sr, nil
}

func (s *JymService) ListSeries(ctx context.Context, userID uuid.UUID) ([]models.SplitSeriesSummary, error) {
	rows, err := s.db.Query(ctx,
		`SELECT sr.id, sr.user_id, sr.split_id, sr.name, sr.duration_type,
		        sr.target_weeks, sr.target_sessions, sr.started_at, sr.ended_at, sr.created_at,
		        sp.name as split_name,
		        `+seriesSessionCountSQL("sr.id")+` as session_count
		 FROM split_series sr
		 JOIN splits sp ON sr.split_id = sp.id
		 WHERE sr.user_id = $1
		 ORDER BY sr.started_at DESC`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []models.SplitSeriesSummary
	for rows.Next() {
		var sr models.SplitSeriesSummary
		if err := rows.Scan(
			&sr.ID, &sr.UserID, &sr.SplitID, &sr.Name, &sr.DurationType,
			&sr.TargetWeeks, &sr.TargetSessions, &sr.StartedAt, &sr.EndedAt, &sr.CreatedAt,
			&sr.SplitName, &sr.SessionCount,
		); err != nil {
			return nil, err
		}
		result = append(result, sr)
	}
	rows.Close()
	for i := range result {
		if result[i].EndedAt != nil {
			continue
		}
		if result[i].NextRoutine, err = s.NextRoutine(ctx, result[i].ID, result[i].SplitID); err != nil {
			return nil, err
		}
	}
	if result == nil {
		result = []models.SplitSeriesSummary{}
	}
	return result, nil
}

// NextRoutine is the day after the series' latest logged day, wrapping round, or the first day before any.
// Nil when the split has no days.
func (s *JymService) NextRoutine(ctx context.Context, seriesID, splitID uuid.UUID) (*models.RoutineRef, error) {
	rows, err := s.db.Query(ctx,
		`SELECT id, name, day_order FROM routines WHERE split_id = $1 ORDER BY day_order, created_at, id`,
		splitID,
	)
	if err != nil {
		return nil, err
	}
	var days []models.RoutineRef
	for rows.Next() {
		var d models.RoutineRef
		if err := rows.Scan(&d.ID, &d.Name, &d.DayOrder); err != nil {
			rows.Close()
			return nil, err
		}
		days = append(days, d)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(days) == 0 {
		return nil, nil
	}

	var last uuid.UUID
	err = s.db.QueryRow(ctx,
		`SELECT routine_id FROM sessions
		 WHERE series_id = $1 AND routine_id IS NOT NULL
		 ORDER BY started_at DESC LIMIT 1`,
		seriesID,
	).Scan(&last)
	if errors.Is(err, pgx.ErrNoRows) {
		return &days[0], nil
	}
	if err != nil {
		return nil, err
	}
	for i, d := range days {
		if d.ID == last {
			next := days[(i+1)%len(days)]
			return &next, nil
		}
	}
	// The last day logged has since been removed from the split.
	return &days[0], nil
}

func (s *JymService) GetSeriesDetail(ctx context.Context, userID, seriesID uuid.UUID) (*models.SplitSeriesDetail, error) {
	detail := &models.SplitSeriesDetail{}
	err := s.db.QueryRow(ctx,
		`SELECT sr.id, sr.user_id, sr.split_id, sr.name, sr.duration_type,
		        sr.target_weeks, sr.target_sessions, sr.started_at, sr.ended_at, sr.created_at,
		        sp.name,
		        `+seriesSessionCountSQL("sr.id")+`
		 FROM split_series sr
		 JOIN splits sp ON sr.split_id = sp.id
		 WHERE sr.id = $1 AND sr.user_id = $2`,
		seriesID, userID,
	).Scan(
		&detail.ID, &detail.UserID, &detail.SplitID, &detail.Name, &detail.DurationType,
		&detail.TargetWeeks, &detail.TargetSessions, &detail.StartedAt, &detail.EndedAt, &detail.CreatedAt,
		&detail.SplitName, &detail.SessionCount,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrSeriesNotFound
		}
		return nil, err
	}

	if detail.EndedAt == nil {
		if detail.NextRoutine, err = s.NextRoutine(ctx, detail.ID, detail.SplitID); err != nil {
			return nil, err
		}
	}

	// Session points (for volume chart)
	sessRows, err := s.db.Query(ctx,
		`SELECT s.id, s.started_at, s.session_type,
		        `+workingVolumeSQL+` as total_volume,
		        `+workingSetCountSQL+` as set_count
		 FROM sessions s
		 LEFT JOIN session_sets ss ON ss.session_id = s.id
		 WHERE s.series_id = $1 AND `+countedSessionSQL("s")+`
		 GROUP BY s.id
		 ORDER BY s.started_at ASC`,
		seriesID,
	)
	if err != nil {
		return nil, err
	}
	defer sessRows.Close()

	detail.Sessions = []models.SeriesSessionPoint{}
	for sessRows.Next() {
		var pt models.SeriesSessionPoint
		if err := sessRows.Scan(&pt.SessionID, &pt.Date, &pt.SessionType, &pt.TotalVolume, &pt.SetCount); err != nil {
			return nil, err
		}
		detail.Sessions = append(detail.Sessions, pt)
	}
	sessRows.Close()

	// Best working-set e1RM per exercise per finished, non-deload session, oldest session first.
	exRows, err := s.db.Query(ctx,
		`SELECT ss.session_id, s.started_at, ss.exercise_id, e.name, e.muscle_group,
		        MAX(`+e1rmSQL("ss.weight", "ss.reps_performed")+`) AS best_est_1rm
		 FROM session_sets ss
		 JOIN sessions s ON s.id = ss.session_id
		 JOIN exercises e ON ss.exercise_id = e.id
		 WHERE s.series_id = $1 AND NOT ss.is_warmup AND s.ended_at IS NOT NULL AND s.session_type <> 'deload'
		 GROUP BY ss.session_id, s.started_at, ss.exercise_id, e.name, e.muscle_group
		 ORDER BY ss.exercise_id, s.started_at`,
		seriesID,
	)
	if err != nil {
		return nil, err
	}
	defer exRows.Close()

	exMap := make(map[uuid.UUID]*models.ExerciseProgression)
	exOrder := []uuid.UUID{}
	for exRows.Next() {
		var sessID, exID uuid.UUID
		var date time.Time
		var exName string
		var mg *string
		var best1RM float64
		if err := exRows.Scan(&sessID, &date, &exID, &exName, &mg, &best1RM); err != nil {
			return nil, err
		}
		if _, ok := exMap[exID]; !ok {
			exMap[exID] = &models.ExerciseProgression{
				ExerciseID:   exID,
				ExerciseName: exName,
				MuscleGroup:  mg,
				Points:       []models.ProgressionPoint{},
			}
			exOrder = append(exOrder, exID)
		}
		exMap[exID].Points = append(exMap[exID].Points, models.ProgressionPoint{
			SessionID:  sessID,
			Date:       date,
			BestEst1RM: roundTenth(best1RM),
		})
	}
	if err := exRows.Err(); err != nil {
		return nil, err
	}

	detail.ExerciseProgressions = []models.ExerciseProgression{}
	for _, exID := range exOrder {
		detail.ExerciseProgressions = append(detail.ExerciseProgressions, *exMap[exID])
	}

	return detail, nil
}

func (s *JymService) UpdateSeries(ctx context.Context, userID, seriesID uuid.UUID, req *models.UpdateSeriesRequest) (*models.SplitSeriesSummary, error) {
	sr := &models.SplitSeriesSummary{}
	err := s.db.QueryRow(ctx,
		`UPDATE split_series SET
		   name     = COALESCE($3, name),
		   ended_at = COALESCE($4, ended_at)
		 WHERE id = $1 AND user_id = $2
		 RETURNING id, user_id, split_id, name, duration_type, target_weeks, target_sessions, started_at, ended_at, created_at`,
		seriesID, userID, req.Name, req.EndedAt,
	).Scan(&sr.ID, &sr.UserID, &sr.SplitID, &sr.Name, &sr.DurationType,
		&sr.TargetWeeks, &sr.TargetSessions, &sr.StartedAt, &sr.EndedAt, &sr.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrSeriesNotFound
		}
		return nil, err
	}
	s.db.QueryRow(ctx, `SELECT name FROM splits WHERE id = $1`, sr.SplitID).Scan(&sr.SplitName)
	s.db.QueryRow(ctx, `SELECT `+seriesSessionCountSQL("$1"), seriesID).Scan(&sr.SessionCount)
	return sr, nil
}

func (s *JymService) DeleteSeries(ctx context.Context, userID, seriesID uuid.UUID) error {
	res, err := s.db.Exec(ctx, `DELETE FROM split_series WHERE id = $1 AND user_id = $2`, seriesID, userID)
	if err != nil {
		return err
	}
	if res.RowsAffected() == 0 {
		return ErrSeriesNotFound
	}
	return nil
}

// ─── CSV Export ───────────────────────────────────────────────────────────────

// StreamSessionsCSV writes a CSV of all session sets for the user directly to w.
// Optional from/to filter by session start date (inclusive). Optional exerciseID narrows to one exercise.
// csvSafe blocks spreadsheet formula injection: a cell starting with = + - @ tab
// or CR executes on open, and encoding/csv does not quote those. Reachable across
// accounts, since importing a public split copies its names into your rows.
func csvSafe(v string) string {
	if v == "" {
		return v
	}
	switch v[0] {
	case '=', '+', '-', '@', 0x09, 0x0D:
		return "'" + v
	}
	return v
}

// StreamSessionsCSV writes the user's sets as CSV; from, to and dates are the user's calendar days.
func (s *JymService) StreamSessionsCSV(ctx context.Context, userID uuid.UUID, from, to *time.Time, exerciseID *uuid.UUID, tzHint string, w io.Writer) error {
	loc, err := userLocation(ctx, s.db, userID, tzHint)
	if err != nil {
		return err
	}
	args := []interface{}{userID, loc.String()}
	where := "WHERE s.user_id = $1"
	p := 3

	if from != nil {
		start, _ := DayWindow(from.Year(), from.Month(), from.Day(), loc)
		where += fmt.Sprintf(" AND s.started_at >= $%d", p)
		args = append(args, start)
		p++
	}
	if to != nil {
		// include the full end day
		_, end := DayWindow(to.Year(), to.Month(), to.Day(), loc)
		where += fmt.Sprintf(" AND s.started_at < $%d", p)
		args = append(args, end)
		p++
	}
	if exerciseID != nil {
		where += fmt.Sprintf(" AND ss.exercise_id = $%d", p)
		args = append(args, *exerciseID)
	}

	query := `
		SELECT
			(s.started_at AT TIME ZONE $2)::date,
			s.id,
			COALESCE(r.name, ''),
			e.name,
			COALESCE(e.muscle_group, ''),
			ss.set_number,
			ss.weight,
			ss.reps_performed,
			COALESCE(ss.rpe::text, ''),
			ss.is_warmup,
			ss.is_pr
		FROM sessions s
		LEFT JOIN routines r ON s.routine_id = r.id
		JOIN session_sets ss ON ss.session_id = s.id
		JOIN exercises e ON ss.exercise_id = e.id
		` + where + `
		ORDER BY s.started_at DESC, e.name, ss.set_number`

	rows, err := s.db.Query(ctx, query, args...)
	if err != nil {
		return err
	}
	defer rows.Close()

	cw := csv.NewWriter(w)
	_ = cw.Write([]string{
		"date", "session_id", "routine", "exercise", "muscle_group",
		"set", "weight_kg", "reps", "rpe", "is_warmup", "is_pr", "estimated_1rm",
	})

	for rows.Next() {
		var date time.Time
		var sessionID uuid.UUID
		var routine, exercise, muscleGroup, rpe string
		var setNum, reps int
		var weight float64
		var isWarmup, isPR bool

		if err := rows.Scan(
			&date, &sessionID, &routine, &exercise, &muscleGroup,
			&setNum, &weight, &reps, &rpe, &isWarmup, &isPR,
		); err != nil {
			return err
		}
		est1rm := epley1RM(weight, reps)

		_ = cw.Write([]string{
			date.Format("2006-01-02"),
			sessionID.String(),
			csvSafe(routine),
			csvSafe(exercise),
			csvSafe(muscleGroup),
			strconv.Itoa(setNum),
			fmt.Sprintf("%.2f", weight),
			strconv.Itoa(reps),
			rpe,
			strconv.FormatBool(isWarmup),
			strconv.FormatBool(isPR),
			fmt.Sprintf("%.1f", est1rm),
		})
	}

	cw.Flush()
	return cw.Error()
}

// ─── Split Shares ─────────────────────────────────────────────────────────────

// SplitShareTTL is how long a new split share link stays usable.
const SplitShareTTL = 30 * 24 * time.Hour

// splitShareUsable reports whether a share with this expiry is live; NULL (pre-TTL rows) never expires.
func splitShareUsable(expiresAt *time.Time, now time.Time) bool {
	return expiresAt == nil || now.Before(*expiresAt)
}

// CreateShare generates a share record for a split the user owns and returns a
// shareable URL.
func (s *JymService) CreateShare(ctx context.Context, userID, splitID uuid.UUID, appBaseURL string) (*models.CreateShareResponse, error) {
	// Verify ownership
	var ownerID uuid.UUID
	err := s.db.QueryRow(ctx, `SELECT user_id FROM splits WHERE id = $1`, splitID).Scan(&ownerID)
	if err == pgx.ErrNoRows {
		return nil, ErrSplitNotFound
	}
	if err != nil {
		return nil, err
	}
	if ownerID != userID {
		return nil, ErrSplitNotFound
	}

	// Share again hands back the live link (with a day or more left) instead of minting one per click.
	var shareID uuid.UUID
	var expiresAt time.Time
	err = s.db.QueryRow(ctx,
		`SELECT id, expires_at FROM split_shares
		 WHERE split_id = $1 AND created_by = $2 AND expires_at > NOW() + interval '1 day'
		 ORDER BY created_at DESC LIMIT 1`,
		splitID, userID,
	).Scan(&shareID, &expiresAt)
	if errors.Is(err, pgx.ErrNoRows) {
		err = s.db.QueryRow(ctx,
			`INSERT INTO split_shares (split_id, created_by, expires_at) VALUES ($1, $2, $3) RETURNING id, expires_at`,
			splitID, userID, time.Now().Add(SplitShareTTL),
		).Scan(&shareID, &expiresAt)
	}
	if err != nil {
		return nil, err
	}

	return &models.CreateShareResponse{
		ShareID:   shareID.String(),
		URL:       appBaseURL + "/jym/share/" + shareID.String(),
		ExpiresAt: expiresAt,
	}, nil
}

// ListShares returns the live links to one of the user's splits, newest first.
func (s *JymService) ListShares(ctx context.Context, userID, splitID uuid.UUID, appBaseURL string) ([]models.ShareLink, error) {
	var ownerID uuid.UUID
	err := s.db.QueryRow(ctx, `SELECT user_id FROM splits WHERE id = $1`, splitID).Scan(&ownerID)
	if errors.Is(err, pgx.ErrNoRows) || (err == nil && ownerID != userID) {
		return nil, ErrSplitNotFound
	}
	if err != nil {
		return nil, err
	}
	rows, err := s.db.Query(ctx,
		`SELECT id, expires_at FROM split_shares
		 WHERE split_id = $1 AND created_by = $2 AND (expires_at IS NULL OR expires_at > NOW())
		 ORDER BY created_at DESC`,
		splitID, userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	links := []models.ShareLink{}
	for rows.Next() {
		var link models.ShareLink
		var id uuid.UUID
		if err := rows.Scan(&id, &link.ExpiresAt); err != nil {
			return nil, err
		}
		link.ShareID = id.String()
		link.URL = appBaseURL + "/jym/share/" + link.ShareID
		links = append(links, link)
	}
	return links, rows.Err()
}

// RevokeShare deletes a share the user owns.
func (s *JymService) RevokeShare(ctx context.Context, userID, shareID uuid.UUID) error {
	tag, err := s.db.Exec(ctx,
		`DELETE FROM split_shares WHERE id = $1 AND created_by = $2`,
		shareID, userID,
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrShareNotFound
	}
	return nil
}

// GetSharePreview returns a public, sanitised preview of the shared split.
func (s *JymService) GetSharePreview(ctx context.Context, shareID uuid.UUID) (*models.SharePreview, error) {
	var splitID uuid.UUID
	var expiresAt *time.Time
	err := s.db.QueryRow(ctx,
		`SELECT split_id, expires_at FROM split_shares WHERE id = $1`,
		shareID,
	).Scan(&splitID, &expiresAt)
	if err == pgx.ErrNoRows {
		return nil, ErrShareNotFound
	}
	if err != nil {
		return nil, err
	}
	if !splitShareUsable(expiresAt, time.Now()) {
		return nil, ErrShareExpired
	}

	var splitName string
	err = s.db.QueryRow(ctx, `SELECT name FROM splits WHERE id = $1`, splitID).Scan(&splitName)
	if err != nil {
		return nil, err
	}

	rows, err := s.db.Query(ctx, `
		SELECT r.id, r.name, r.day_order,
		       e.name, e.muscle_group,
		       COALESCE(ri.target_sets, 0), COALESCE(ri.target_reps, 0)
		FROM routines r
		LEFT JOIN routine_items ri ON ri.routine_id = r.id
		LEFT JOIN exercises e ON e.id = ri.exercise_id
		WHERE r.split_id = $1
		ORDER BY r.day_order, ri.order_index
	`, splitID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	routineMap := map[uuid.UUID]*models.ShareRoutinePreview{}
	var routineOrder []uuid.UUID

	for rows.Next() {
		var rID uuid.UUID
		var rName string
		var dayOrder int
		var exName *string
		var mg *string
		var tSets, tReps int

		if err := rows.Scan(&rID, &rName, &dayOrder, &exName, &mg, &tSets, &tReps); err != nil {
			return nil, err
		}
		if _, ok := routineMap[rID]; !ok {
			routineMap[rID] = &models.ShareRoutinePreview{
				Name:      rName,
				DayOrder:  dayOrder,
				Exercises: []models.ShareExercisePreview{},
			}
			routineOrder = append(routineOrder, rID)
		}
		if exName != nil {
			routineMap[rID].Exercises = append(routineMap[rID].Exercises, models.ShareExercisePreview{
				Name:        *exName,
				MuscleGroup: mg,
				TargetSets:  tSets,
				TargetReps:  tReps,
			})
		}
	}

	routines := make([]models.ShareRoutinePreview, 0, len(routineOrder))
	for _, id := range routineOrder {
		routines = append(routines, *routineMap[id])
	}

	return &models.SharePreview{
		ShareID:   shareID.String(),
		SplitName: splitName,
		Routines:  routines,
	}, nil
}

// ImportShare deep-copies a shared split into the importing user's account.
func (s *JymService) ImportShare(ctx context.Context, importerID, shareID uuid.UUID) (uuid.UUID, error) {
	var splitID uuid.UUID
	var expiresAt *time.Time
	err := s.db.QueryRow(ctx,
		`SELECT split_id, expires_at FROM split_shares WHERE id = $1`,
		shareID,
	).Scan(&splitID, &expiresAt)
	if err == pgx.ErrNoRows {
		return uuid.Nil, ErrShareNotFound
	}
	if err != nil {
		return uuid.Nil, err
	}
	if !splitShareUsable(expiresAt, time.Now()) {
		return uuid.Nil, ErrShareExpired
	}
	return s.copySplit(ctx, importerID, splitID)
}

// copySplit deep-copies split splitID into importerID's account and returns the new split ID.
// Importing the same split again returns the copy made the first time.
func (s *JymService) copySplit(ctx context.Context, importerID, splitID uuid.UUID) (uuid.UUID, error) {
	var existing uuid.UUID
	err := s.db.QueryRow(ctx,
		`SELECT id FROM splits WHERE user_id = $1 AND source_split_id = $2`, importerID, splitID,
	).Scan(&existing)
	if err == nil {
		return existing, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return uuid.Nil, err
	}

	// Load original split
	var origName string
	var origDesc *string
	err = s.db.QueryRow(ctx,
		`SELECT name, description FROM splits WHERE id = $1`, splitID,
	).Scan(&origName, &origDesc)
	if err != nil {
		return uuid.Nil, err
	}

	// Load routines + items
	rows, err := s.db.Query(ctx, `
		SELECT r.id, r.name, r.day_order,
		       e.name, e.muscle_group,
		       COALESCE(ri.target_sets, 0), COALESCE(ri.target_reps, 0),
		       COALESCE(ri.order_index, 0)
		FROM routines r
		LEFT JOIN routine_items ri ON ri.routine_id = r.id
		LEFT JOIN exercises e ON e.id = ri.exercise_id
		WHERE r.split_id = $1
		ORDER BY r.day_order, ri.order_index
	`, splitID)
	if err != nil {
		return uuid.Nil, err
	}

	type itemRow struct {
		exName     string
		mg         *string
		targetSets int
		targetReps int
		orderIdx   int
	}
	type routineData struct {
		name     string
		dayOrder int
		items    []itemRow
	}

	rMap := map[uuid.UUID]*routineData{}
	var rOrder []uuid.UUID

	for rows.Next() {
		var rID uuid.UUID
		var rName string
		var dayOrder int
		var exName *string
		var mg *string
		var tSets, tReps, orderIdx int

		if err := rows.Scan(&rID, &rName, &dayOrder, &exName, &mg, &tSets, &tReps, &orderIdx); err != nil {
			rows.Close()
			return uuid.Nil, err
		}
		if _, ok := rMap[rID]; !ok {
			rMap[rID] = &routineData{name: rName, dayOrder: dayOrder}
			rOrder = append(rOrder, rID)
		}
		if exName != nil {
			rMap[rID].items = append(rMap[rID].items, itemRow{
				exName: *exName, mg: mg, targetSets: tSets, targetReps: tReps, orderIdx: orderIdx,
			})
		}
	}
	rows.Close()

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return uuid.Nil, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	exCache := map[string]uuid.UUID{}

	resolveExercise := func(name string, mg *string) (uuid.UUID, error) {
		if id, ok := exCache[name]; ok {
			return id, nil
		}
		var id uuid.UUID
		err := tx.QueryRow(ctx,
			`SELECT id FROM exercises WHERE user_id = $1 AND LOWER(name) = LOWER($2) LIMIT 1`,
			importerID, name,
		).Scan(&id)
		if err == nil {
			exCache[name] = id
			return id, nil
		}
		if err != pgx.ErrNoRows {
			return uuid.Nil, err
		}
		err = tx.QueryRow(ctx,
			`INSERT INTO exercises (user_id, name, muscle_group) VALUES ($1, $2, $3) RETURNING id`,
			importerID, name, mg,
		).Scan(&id)
		if err != nil {
			return uuid.Nil, err
		}
		exCache[name] = id
		return id, nil
	}

	var newSplitID uuid.UUID
	err = tx.QueryRow(ctx,
		`INSERT INTO splits (user_id, name, description, source_split_id) VALUES ($1, $2, $3, $4) RETURNING id`,
		importerID, origName, origDesc, splitID,
	).Scan(&newSplitID)
	if err != nil {
		return uuid.Nil, err
	}

	for _, rID := range rOrder {
		rd := rMap[rID]
		var newRoutineID uuid.UUID
		err = tx.QueryRow(ctx,
			`INSERT INTO routines (user_id, split_id, name, day_order) VALUES ($1, $2, $3, $4) RETURNING id`,
			importerID, newSplitID, rd.name, rd.dayOrder,
		).Scan(&newRoutineID)
		if err != nil {
			return uuid.Nil, err
		}
		for _, item := range rd.items {
			exID, err := resolveExercise(item.exName, item.mg)
			if err != nil {
				return uuid.Nil, err
			}
			_, err = tx.Exec(ctx,
				`INSERT INTO routine_items (routine_id, exercise_id, target_sets, target_reps, order_index)
				 VALUES ($1, $2, $3, $4, $5)`,
				newRoutineID, exID, item.targetSets, item.targetReps, item.orderIdx,
			)
			if err != nil {
				return uuid.Nil, err
			}
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return uuid.Nil, err
	}
	return newSplitID, nil
}

func intStr(n int) string {
	return strconv.Itoa(n)
}

// ─── Routine Templates ────────────────────────────────────────────────────────

// ListTemplates returns all standalone routines (split_id IS NULL) owned by the user,
// with their exercise items included.
func (s *JymService) ListTemplates(ctx context.Context, userID uuid.UUID) ([]models.RoutineWithItems, error) {
	rows, err := s.db.Query(ctx,
		`SELECT r.id, r.user_id, r.split_id, r.name, r.day_order, r.created_at,
		        ri.id, ri.routine_id, ri.exercise_id, ri.target_sets, ri.target_reps, ri.order_index,
		        e.name, e.muscle_group
		 FROM routines r
		 LEFT JOIN routine_items ri ON ri.routine_id = r.id
		 LEFT JOIN exercises e ON e.id = ri.exercise_id
		 WHERE r.user_id = $1 AND r.split_id IS NULL
		 ORDER BY r.created_at DESC, ri.order_index ASC`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	templateMap := map[uuid.UUID]int{}
	var templates []models.RoutineWithItems

	for rows.Next() {
		var rt models.Routine
		var itemID, routineID, exerciseID *uuid.UUID
		var targetSets, targetReps, orderIndex *int
		var exName *string
		var mg *string

		if err := rows.Scan(
			&rt.ID, &rt.UserID, &rt.SplitID, &rt.Name, &rt.DayOrder, &rt.CreatedAt,
			&itemID, &routineID, &exerciseID, &targetSets, &targetReps, &orderIndex,
			&exName, &mg,
		); err != nil {
			return nil, err
		}

		idx, exists := templateMap[rt.ID]
		if !exists {
			templates = append(templates, models.RoutineWithItems{
				Routine: rt,
				Items:   []models.RoutineItemWithExercise{},
			})
			idx = len(templates) - 1
			templateMap[rt.ID] = idx
		}

		if itemID != nil {
			templates[idx].Items = append(templates[idx].Items, models.RoutineItemWithExercise{
				RoutineItem: models.RoutineItem{
					ID:         *itemID,
					RoutineID:  *routineID,
					ExerciseID: *exerciseID,
					TargetSets: *targetSets,
					TargetReps: *targetReps,
					OrderIndex: *orderIndex,
				},
				ExerciseName: *exName,
				MuscleGroup:  mg,
			})
		}
	}

	if templates == nil {
		templates = []models.RoutineWithItems{}
	}
	return templates, nil
}

// CreateTemplateFromSession creates a standalone routine template from a finished session.
// It groups the session's sets by exercise (preserving first-appearance order) and derives
// target_sets (number of non-warmup sets logged) and target_reps (rounded average).
func (s *JymService) CreateTemplateFromSession(ctx context.Context, userID, sessionID uuid.UUID, name string) (*models.RoutineWithItems, error) {
	// Verify session ownership
	var ownerID uuid.UUID
	if err := s.db.QueryRow(ctx,
		`SELECT user_id FROM sessions WHERE id = $1`, sessionID,
	).Scan(&ownerID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrSessionNotFound
		}
		return nil, err
	}
	if ownerID != userID {
		return nil, ErrNotOwner
	}

	// Aggregate sets per exercise: count non-warmup sets, average reps, preserve order
	type exAgg struct {
		exerciseID uuid.UUID
		targetSets int
		targetReps int
		orderIdx   int
	}
	rows, err := s.db.Query(ctx,
		`SELECT exercise_id,
		        COUNT(*) FILTER (WHERE NOT is_warmup)::int AS target_sets,
		        COALESCE(ROUND(AVG(reps_performed) FILTER (WHERE NOT is_warmup)), ROUND(AVG(reps_performed)))::int AS target_reps
		 FROM session_sets
		 WHERE session_id = $1
		 GROUP BY exercise_id
		 ORDER BY MIN(created_at) ASC`,
		sessionID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var exercises []exAgg
	for i := 0; rows.Next(); i++ {
		var agg exAgg
		agg.orderIdx = i
		if err := rows.Scan(&agg.exerciseID, &agg.targetSets, &agg.targetReps); err != nil {
			return nil, err
		}
		if agg.targetSets == 0 {
			agg.targetSets = 1 // at least 1 if all were warmups
		}
		if agg.targetReps == 0 {
			agg.targetReps = 8
		}
		exercises = append(exercises, agg)
	}
	rows.Close()

	if len(exercises) == 0 {
		return nil, ErrSessionNotFound // session has no sets to template from
	}

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	// Create the standalone routine
	rt := &models.Routine{}
	if err := tx.QueryRow(ctx,
		`INSERT INTO routines (user_id, name, day_order)
		 VALUES ($1, $2, 1)
		 RETURNING id, user_id, split_id, name, day_order, created_at`,
		userID, name,
	).Scan(&rt.ID, &rt.UserID, &rt.SplitID, &rt.Name, &rt.DayOrder, &rt.CreatedAt); err != nil {
		return nil, err
	}

	// Insert items
	result := &models.RoutineWithItems{Routine: *rt, Items: []models.RoutineItemWithExercise{}}
	for _, ex := range exercises {
		var item models.RoutineItemWithExercise
		var mg *string
		if err := tx.QueryRow(ctx,
			`INSERT INTO routine_items (routine_id, exercise_id, target_sets, target_reps, order_index)
			 VALUES ($1, $2, $3, $4, $5)
			 RETURNING id, routine_id, exercise_id, target_sets, target_reps, order_index`,
			rt.ID, ex.exerciseID, ex.targetSets, ex.targetReps, ex.orderIdx,
		).Scan(
			&item.ID, &item.RoutineID, &item.ExerciseID,
			&item.TargetSets, &item.TargetReps, &item.OrderIndex,
		); err != nil {
			return nil, err
		}
		// Fetch exercise name
		if err := tx.QueryRow(ctx,
			`SELECT name, muscle_group FROM exercises WHERE id = $1`, ex.exerciseID,
		).Scan(&item.ExerciseName, &mg); err != nil {
			return nil, err
		}
		item.MuscleGroup = mg
		result.Items = append(result.Items, item)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return result, nil
}
