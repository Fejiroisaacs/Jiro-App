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
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrExerciseNotFound   = errors.New("exercise not found")
	ErrSplitNotFound      = errors.New("split not found")
	ErrRoutineNotFound    = errors.New("routine not found")
	ErrSessionNotFound    = errors.New("session not found")
	ErrSetNotFound        = errors.New("set not found")
	ErrBodyWeightNotFound = errors.New("body weight not found")
	ErrSeriesNotFound     = errors.New("series not found")
	ErrShareNotFound      = errors.New("share not found")
	ErrShareExpired       = errors.New("share link has expired")
	ErrShareForbidden     = errors.New("not your share link")
)

type JymService struct {
	db *pgxpool.Pool
}

func NewJymService(db *pgxpool.Pool) *JymService {
	return &JymService{db: db}
}

func epley1RM(weight float64, reps int) float64 {
	if reps == 1 {
		return weight
	}
	return math.Round((weight*(1+float64(reps)/30.0))*10) / 10
}

// ─── Exercises ───────────────────────────────────────────────────────────────

func (s *JymService) CreateExercise(ctx context.Context, userID uuid.UUID, req *models.CreateExerciseRequest) (*models.Exercise, error) {
	ex := &models.Exercise{}
	err := s.db.QueryRow(ctx,
		`INSERT INTO exercises (user_id, name, muscle_group, notes)
		 VALUES ($1, $2, $3, $4)
		 RETURNING id, user_id, name, muscle_group, notes, created_at, updated_at`,
		userID, req.Name, req.MuscleGroup, req.Notes,
	).Scan(&ex.ID, &ex.UserID, &ex.Name, &ex.MuscleGroup, &ex.Notes, &ex.CreatedAt, &ex.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return ex, nil
}

func (s *JymService) ListExercises(ctx context.Context, userID uuid.UUID, search, muscleGroup string) ([]models.Exercise, error) {
	query := `SELECT id, user_id, name, muscle_group, notes, created_at, updated_at
	          FROM exercises WHERE user_id = $1`
	args := []interface{}{userID}

	if search != "" {
		args = append(args, "%"+search+"%")
		query += ` AND name ILIKE $` + intStr(len(args))
	}
	if muscleGroup != "" {
		args = append(args, muscleGroup)
		query += ` AND muscle_group = $` + intStr(len(args))
	}
	query += ` ORDER BY name ASC`

	rows, err := s.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var exercises []models.Exercise
	for rows.Next() {
		var ex models.Exercise
		if err := rows.Scan(&ex.ID, &ex.UserID, &ex.Name, &ex.MuscleGroup, &ex.Notes, &ex.CreatedAt, &ex.UpdatedAt); err != nil {
			return nil, err
		}
		exercises = append(exercises, ex)
	}
	if exercises == nil {
		exercises = []models.Exercise{}
	}
	return exercises, nil
}

func (s *JymService) GetExerciseWithHistory(ctx context.Context, userID, exerciseID uuid.UUID) (*models.ExerciseWithHistory, error) {
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

	// Fetch last 100 sets for this exercise with session_type
	rows, err := s.db.Query(ctx,
		`SELECT ss.session_id, s.started_at, ss.weight, ss.reps_performed, ss.is_pr, s.session_type, ss.exercise_note
		 FROM session_sets ss
		 JOIN sessions s ON ss.session_id = s.id
		 WHERE ss.exercise_id = $1 AND s.user_id = $2
		 ORDER BY s.started_at DESC
		 LIMIT 100`,
		exerciseID, userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	ex.History = []models.SetHistory{}
	var bestWeight float64
	for rows.Next() {
		var h models.SetHistory
		if err := rows.Scan(&h.SessionID, &h.Date, &h.Weight, &h.Reps, &h.IsPR, &h.SessionType, &h.ExerciseNote); err != nil {
			return nil, err
		}
		h.Est1RM = epley1RM(h.Weight, h.Reps)
		ex.History = append(ex.History, h)
		if h.Weight > bestWeight {
			bestWeight = h.Weight
		}
	}
	ex.BestWeight = bestWeight
	var maxEst1RM float64
	for _, h := range ex.History {
		if h.Est1RM > maxEst1RM {
			maxEst1RM = h.Est1RM
		}
	}
	ex.Est1RM = maxEst1RM
	return ex, nil
}

func (s *JymService) UpdateExercise(ctx context.Context, userID, exerciseID uuid.UUID, req *models.UpdateExerciseRequest) (*models.Exercise, error) {
	ex := &models.Exercise{}
	err := s.db.QueryRow(ctx,
		`UPDATE exercises SET
		   name         = COALESCE($3, name),
		   muscle_group = COALESCE($4, muscle_group),
		   notes        = COALESCE($5, notes),
		   updated_at   = NOW()
		 WHERE id = $1 AND user_id = $2
		 RETURNING id, user_id, name, muscle_group, notes, created_at, updated_at`,
		exerciseID, userID, req.Name, req.MuscleGroup, req.Notes,
	).Scan(&ex.ID, &ex.UserID, &ex.Name, &ex.MuscleGroup, &ex.Notes, &ex.CreatedAt, &ex.UpdatedAt)
	if err != nil {
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
		  AND ($2 = '' OR s.tags && ARRAY[$2]::TEXT[])
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

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	if _, err = tx.Exec(ctx, `DELETE FROM routine_items WHERE routine_id = $1`, routineID); err != nil {
		return nil, err
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
		if _, err = tx.Exec(ctx,
			`INSERT INTO routine_items (routine_id, exercise_id, target_sets, target_reps, order_index)
			 VALUES ($1, $2, $3, $4, $5)`,
			routineID, item.ExerciseID, sets, reps, i,
		); err != nil {
			return nil, err
		}
	}

	if err = tx.Commit(ctx); err != nil {
		return nil, err
	}

	// Return updated items with exercise names
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

	var result []models.RoutineItemWithExercise
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
	if result == nil {
		result = []models.RoutineItemWithExercise{}
	}
	return result, nil
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

func (s *JymService) StartSession(ctx context.Context, userID uuid.UUID, req *models.CreateSessionRequest) (*models.StartSessionResponse, error) {
	sess := &models.StartSessionResponse{}
	err := s.db.QueryRow(ctx,
		`INSERT INTO sessions (user_id, routine_id, series_id)
		 VALUES ($1, $2, $3)
		 RETURNING id, user_id, routine_id, series_id, session_type, started_at, ended_at, notes`,
		userID, req.RoutineID, req.SeriesID,
	).Scan(&sess.ID, &sess.UserID, &sess.RoutineID, &sess.SeriesID, &sess.SessionType, &sess.StartedAt, &sess.EndedAt, &sess.Notes)
	if err != nil {
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

func (s *JymService) ListSessions(ctx context.Context, userID uuid.UUID) ([]models.SessionSummary, error) {
	rows, err := s.db.Query(ctx,
		`SELECT s.id, s.user_id, s.routine_id, s.series_id, s.session_type, s.started_at, s.ended_at, s.notes,
		        r.name as routine_name,
		        COUNT(ss.id) as set_count,
		        COALESCE(SUM(ss.weight * ss.reps_performed), 0) as total_volume,
		        COALESCE(array_agg(DISTINCT e.muscle_group) FILTER (WHERE e.muscle_group IS NOT NULL), '{}'::text[]) as muscle_groups
		 FROM sessions s
		 LEFT JOIN routines r ON s.routine_id = r.id
		 LEFT JOIN session_sets ss ON ss.session_id = s.id
		 LEFT JOIN exercises e ON ss.exercise_id = e.id
		 WHERE s.user_id = $1
		 GROUP BY s.id, r.name
		 ORDER BY s.started_at DESC
		 LIMIT 50`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var sessions []models.SessionSummary
	for rows.Next() {
		var sess models.SessionSummary
		if err := rows.Scan(
			&sess.ID, &sess.UserID, &sess.RoutineID, &sess.SeriesID, &sess.SessionType,
			&sess.StartedAt, &sess.EndedAt, &sess.Notes,
			&sess.RoutineName, &sess.SetCount, &sess.TotalVolume, &sess.MuscleGroups,
		); err != nil {
			return nil, err
		}
		if sess.MuscleGroups == nil {
			sess.MuscleGroups = []string{}
		}
		sessions = append(sessions, sess)
	}
	if sessions == nil {
		sessions = []models.SessionSummary{}
	}
	return sessions, nil
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

	rows, err := s.db.Query(ctx,
		`SELECT ss.id, ss.session_id, ss.exercise_id, ss.set_number, ss.weight,
		        ss.reps_performed, ss.rpe, ss.is_pr, ss.is_warmup, ss.exercise_note, ss.created_at,
		        e.name, e.muscle_group
		 FROM session_sets ss
		 JOIN exercises e ON ss.exercise_id = e.id
		 WHERE ss.session_id = $1
		 ORDER BY ss.exercise_id, ss.set_number ASC`,
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

func (s *JymService) UpdateSession(ctx context.Context, userID, sessionID uuid.UUID, req *models.UpdateSessionRequest) (*models.Session, error) {
	sess := &models.Session{}
	err := s.db.QueryRow(ctx,
		`UPDATE sessions SET
		   ended_at     = COALESCE($3, ended_at),
		   notes        = COALESCE($4, notes),
		   session_type = COALESCE($5, session_type)
		 WHERE id = $1 AND user_id = $2
		 RETURNING id, user_id, routine_id, series_id, session_type, started_at, ended_at, notes`,
		sessionID, userID, req.EndedAt, req.Notes, req.SessionType,
	).Scan(&sess.ID, &sess.UserID, &sess.RoutineID, &sess.SeriesID, &sess.SessionType, &sess.StartedAt, &sess.EndedAt, &sess.Notes)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrSessionNotFound
		}
		return nil, err
	}
	return sess, nil
}

func (s *JymService) DeleteSession(ctx context.Context, userID, sessionID uuid.UUID) error {
	res, err := s.db.Exec(ctx, `DELETE FROM sessions WHERE id = $1 AND user_id = $2`, sessionID, userID)
	if err != nil {
		return err
	}
	if res.RowsAffected() == 0 {
		return ErrSessionNotFound
	}
	return nil
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

func (s *JymService) LogSet(ctx context.Context, userID, sessionID uuid.UUID, req *models.CreateSetRequest) (*models.SessionSet, error) {
	// Verify session ownership and get session type
	var ownerID uuid.UUID
	var sessionType string
	if err := s.db.QueryRow(ctx, `SELECT user_id, session_type FROM sessions WHERE id = $1`, sessionID).Scan(&ownerID, &sessionType); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrSessionNotFound
		}
		return nil, err
	}
	if ownerID != userID {
		return nil, ErrNotOwner
	}

	isWarmup := req.IsWarmup != nil && *req.IsWarmup

	// A PR is: strictly higher weight than ever before, OR same weight with more reps.
	var isPR bool
	var bestWeight float64
	var bestReps int
	// Fetch historical best: highest weight ever, and max reps achieved at that weight.
	// COALESCE on aggregates guarantees exactly one row even when there is no history.
	s.db.QueryRow(ctx,
		`SELECT
				COALESCE(MAX(ss.weight), 0),
				COALESCE(MAX(ss.reps_performed) FILTER (
					WHERE ss.weight = (
						SELECT MAX(ss2.weight)
						FROM session_sets ss2
						JOIN sessions s2 ON ss2.session_id = s2.id
						WHERE ss2.exercise_id = $1 AND s2.user_id = $2
						AND ss2.is_warmup = false
					)
				), 0)
			FROM session_sets ss
			JOIN sessions s ON ss.session_id = s.id
			WHERE ss.exercise_id = $1 AND s.user_id = $2 AND ss.is_warmup = false`,
		req.ExerciseID, userID,
	).Scan(&bestWeight, &bestReps)
	isPR = req.Weight > bestWeight ||
		(req.Weight == bestWeight && req.RepsPerformed > bestReps)

	set := &models.SessionSet{}
	err := s.db.QueryRow(ctx,
		`INSERT INTO session_sets (session_id, exercise_id, set_number, weight, reps_performed, rpe, is_pr, is_warmup, exercise_note)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		 RETURNING id, session_id, exercise_id, set_number, weight, reps_performed, rpe, is_pr, is_warmup, exercise_note, created_at`,
		sessionID, req.ExerciseID, req.SetNumber, req.Weight, req.RepsPerformed, req.RPE, isPR, isWarmup, req.ExerciseNote,
	).Scan(&set.ID, &set.SessionID, &set.ExerciseID, &set.SetNumber, &set.Weight,
		&set.RepsPerformed, &set.RPE, &set.IsPR, &set.IsWarmup, &set.ExerciseNote, &set.CreatedAt)
	if err != nil {
		return nil, err
	}
	return set, nil
}

func (s *JymService) UpdateSet(ctx context.Context, userID, setID uuid.UUID, req *models.UpdateSetRequest) (*models.SessionSet, error) {
	set := &models.SessionSet{}
	err := s.db.QueryRow(ctx,
		`UPDATE session_sets SET
		   weight         = COALESCE($3, weight),
		   reps_performed = COALESCE($4, reps_performed),
		   rpe            = COALESCE($5, rpe),
		   is_warmup      = COALESCE($6, is_warmup),
		   exercise_note  = COALESCE($7, exercise_note)
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
	return set, nil
}

func (s *JymService) DeleteSet(ctx context.Context, userID, setID uuid.UUID) error {
	res, err := s.db.Exec(ctx,
		`DELETE FROM session_sets WHERE id = $1
		 AND session_id IN (SELECT id FROM sessions WHERE user_id = $2)`,
		setID, userID,
	)
	if err != nil {
		return err
	}
	if res.RowsAffected() == 0 {
		return ErrSetNotFound
	}
	return nil
}

// GetLastSessionSets returns the last logged sets for each exercise (for ghost text).
func (s *JymService) GetLastSessionSets(ctx context.Context, userID uuid.UUID, exerciseIDs []uuid.UUID) (map[uuid.UUID][]models.SessionSet, error) {
	if len(exerciseIDs) == 0 {
		return map[uuid.UUID][]models.SessionSet{}, nil
	}

	// Build $2,$3,... placeholders
	args := []interface{}{userID}
	placeholders := ""
	for i, id := range exerciseIDs {
		args = append(args, id)
		if i > 0 {
			placeholders += ","
		}
		placeholders += "$" + intStr(i+2)
	}

	rows, err := s.db.Query(ctx,
		`SELECT DISTINCT ON (ss.exercise_id) ss.id, ss.session_id, ss.exercise_id,
		        ss.set_number, ss.weight, ss.reps_performed, ss.rpe, ss.is_pr, ss.is_warmup, ss.exercise_note, ss.created_at
		 FROM session_sets ss
		 JOIN sessions s ON ss.session_id = s.id
		 WHERE s.user_id = $1 AND ss.exercise_id IN (`+placeholders+`)
		 ORDER BY ss.exercise_id, s.started_at DESC`,
		args...,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make(map[uuid.UUID][]models.SessionSet)
	for rows.Next() {
		var set models.SessionSet
		if err := rows.Scan(&set.ID, &set.SessionID, &set.ExerciseID, &set.SetNumber,
			&set.Weight, &set.RepsPerformed, &set.RPE, &set.IsPR, &set.IsWarmup, &set.ExerciseNote, &set.CreatedAt); err != nil {
			return nil, err
		}
		result[set.ExerciseID] = append(result[set.ExerciseID], set)
	}
	return result, nil
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
		 ORDER BY ss.exercise_id, ss.weight DESC`,
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

func (s *JymService) ListBodyWeights(ctx context.Context, userID uuid.UUID) ([]models.BodyWeight, error) {
	rows, err := s.db.Query(ctx,
		`SELECT id, user_id, recorded_at, weight_kg, created_at
		 FROM body_weights WHERE user_id = $1
		 ORDER BY recorded_at DESC
		 LIMIT 365`,
		userID,
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
		        COUNT(sess.id) as session_count
		 FROM split_series sr
		 JOIN splits sp ON sr.split_id = sp.id
		 LEFT JOIN sessions sess ON sess.series_id = sr.id
		 WHERE sr.user_id = $1
		 GROUP BY sr.id, sp.name
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
	if result == nil {
		result = []models.SplitSeriesSummary{}
	}
	return result, nil
}

func (s *JymService) GetSeriesDetail(ctx context.Context, userID, seriesID uuid.UUID) (*models.SplitSeriesDetail, error) {
	detail := &models.SplitSeriesDetail{}
	err := s.db.QueryRow(ctx,
		`SELECT sr.id, sr.user_id, sr.split_id, sr.name, sr.duration_type,
		        sr.target_weeks, sr.target_sessions, sr.started_at, sr.ended_at, sr.created_at,
		        sp.name,
		        COUNT(sess.id)
		 FROM split_series sr
		 JOIN splits sp ON sr.split_id = sp.id
		 LEFT JOIN sessions sess ON sess.series_id = sr.id
		 WHERE sr.id = $1 AND sr.user_id = $2
		 GROUP BY sr.id, sp.name`,
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

	// Session points (for volume chart)
	sessRows, err := s.db.Query(ctx,
		`SELECT s.id, s.started_at, s.session_type,
		        COALESCE(SUM(ss.weight * ss.reps_performed), 0) as total_volume,
		        COUNT(ss.id) as set_count
		 FROM sessions s
		 LEFT JOIN session_sets ss ON ss.session_id = s.id
		 WHERE s.series_id = $1
		 GROUP BY s.id
		 ORDER BY s.started_at ASC`,
		seriesID,
	)
	if err != nil {
		return nil, err
	}
	defer sessRows.Close()

	detail.Sessions = []models.SeriesSessionPoint{}
	var sessionIDs []uuid.UUID
	for sessRows.Next() {
		var pt models.SeriesSessionPoint
		if err := sessRows.Scan(&pt.SessionID, &pt.Date, &pt.SessionType, &pt.TotalVolume, &pt.SetCount); err != nil {
			return nil, err
		}
		detail.Sessions = append(detail.Sessions, pt)
		sessionIDs = append(sessionIDs, pt.SessionID)
	}
	sessRows.Close()

	// Build session date lookup
	sessDateMap := make(map[uuid.UUID]time.Time)
	for _, sp := range detail.Sessions {
		sessDateMap[sp.SessionID] = sp.Date
	}

	// Exercise progressions (best est 1RM per exercise per session)
	if len(sessionIDs) > 0 {
		placeholders := ""
		args := []interface{}{}
		for i, id := range sessionIDs {
			args = append(args, id)
			if i > 0 {
				placeholders += ","
			}
			placeholders += "$" + intStr(i+1)
		}

		exRows, err := s.db.Query(ctx,
			`SELECT ss.session_id, ss.exercise_id, e.name, e.muscle_group,
			        MAX(ss.weight * (1 + ss.reps_performed::float / 30.0)) as best_est_1rm
			 FROM session_sets ss
			 JOIN exercises e ON ss.exercise_id = e.id
			 WHERE ss.session_id IN (`+placeholders+`)
			 GROUP BY ss.session_id, ss.exercise_id, e.name, e.muscle_group
			 ORDER BY ss.exercise_id, ss.session_id ASC`,
			args...,
		)
		if err != nil {
			return nil, err
		}
		defer exRows.Close()

		exMap := make(map[uuid.UUID]*models.ExerciseProgression)
		exOrder := []uuid.UUID{}
		for exRows.Next() {
			var sessID, exID uuid.UUID
			var exName string
			var mg *string
			var best1RM float64
			if err := exRows.Scan(&sessID, &exID, &exName, &mg, &best1RM); err != nil {
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
				Date:       sessDateMap[sessID],
				BestEst1RM: math.Round(best1RM*10) / 10,
			})
		}

		for _, exID := range exOrder {
			detail.ExerciseProgressions = append(detail.ExerciseProgressions, *exMap[exID])
		}
		if detail.ExerciseProgressions == nil {
			detail.ExerciseProgressions = []models.ExerciseProgression{}
		}
	} else {
		detail.ExerciseProgressions = []models.ExerciseProgression{}
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
	s.db.QueryRow(ctx, `SELECT COUNT(*) FROM sessions WHERE series_id = $1`, seriesID).Scan(&sr.SessionCount)
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
func (s *JymService) StreamSessionsCSV(ctx context.Context, userID uuid.UUID, from, to *time.Time, exerciseID *uuid.UUID, w io.Writer) error {
	args := []interface{}{userID}
	where := "WHERE s.user_id = $1"
	p := 2

	if from != nil {
		where += fmt.Sprintf(" AND s.started_at >= $%d", p)
		args = append(args, *from)
		p++
	}
	if to != nil {
		// include the full end day
		end := to.AddDate(0, 0, 1)
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
			s.started_at::date,
			s.id,
			COALESCE(r.name, ''),
			e.name,
			COALESCE(e.muscle_group, ''),
			ss.set_number,
			ss.weight,
			ss.reps_performed,
			COALESCE(ss.rpe::text, ''),
			ss.is_warmup,
			ss.is_pr,
			ROUND((ss.weight * (1 + ss.reps_performed::float / 30.0))::numeric, 1)
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
		var weight, est1rm float64
		var isWarmup, isPR bool

		if err := rows.Scan(
			&date, &sessionID, &routine, &exercise, &muscleGroup,
			&setNum, &weight, &reps, &rpe, &isWarmup, &isPR, &est1rm,
		); err != nil {
			return err
		}

		_ = cw.Write([]string{
			date.Format("2006-01-02"),
			sessionID.String(),
			routine,
			exercise,
			muscleGroup,
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

	var shareID uuid.UUID
	err = s.db.QueryRow(ctx,
		`INSERT INTO split_shares (split_id, created_by) VALUES ($1, $2) RETURNING id`,
		splitID, userID,
	).Scan(&shareID)
	if err != nil {
		return nil, err
	}

	return &models.CreateShareResponse{
		ShareID: shareID.String(),
		URL:     appBaseURL + "/jym/share/" + shareID.String(),
	}, nil
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
	if expiresAt != nil && time.Now().After(*expiresAt) {
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
	if expiresAt != nil && time.Now().After(*expiresAt) {
		return uuid.Nil, ErrShareExpired
	}
	return s.copySplit(ctx, importerID, splitID)
}

// copySplit deep-copies split splitID into importerID's account and returns the new split ID.
func (s *JymService) copySplit(ctx context.Context, importerID, splitID uuid.UUID) (uuid.UUID, error) {
	// Load original split
	var origName string
	var origDesc *string
	err := s.db.QueryRow(ctx,
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
		`INSERT INTO splits (user_id, name, description) VALUES ($1, $2, $3) RETURNING id`,
		importerID, origName, origDesc,
	).Scan(&newSplitID)
	if err != nil {
		return uuid.Nil, err
	}

	for _, rID := range rOrder {
		rd := rMap[rID]
		var newRoutineID uuid.UUID
		err = tx.QueryRow(ctx,
			`INSERT INTO routines (split_id, name, day_order) VALUES ($1, $2, $3) RETURNING id`,
			newSplitID, rd.name, rd.dayOrder,
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
		        ROUND(AVG(reps_performed))::int            AS target_reps
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
