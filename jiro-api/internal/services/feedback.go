package services

import (
	"context"
	"errors"

	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/models"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrFeedbackNotFound  = errors.New("feedback not found")
	ErrInvalidFeedbackType = errors.New("invalid feedback type")
)

var validFeedbackTypes = map[string]bool{
	"bug":     true,
	"feature": true,
	"other":   true,
}

type FeedbackService struct {
	db *pgxpool.Pool
}

func NewFeedbackService(db *pgxpool.Pool) *FeedbackService {
	return &FeedbackService{db: db}
}

func (s *FeedbackService) SubmitFeedback(ctx context.Context, userID uuid.UUID, req *models.SubmitFeedbackRequest) (*models.Feedback, error) {
	if !validFeedbackTypes[req.Type] {
		return nil, ErrInvalidFeedbackType
	}

	f := &models.Feedback{}
	err := s.db.QueryRow(ctx,
		`INSERT INTO feedback (user_id, type, message)
		 VALUES ($1, $2, $3)
		 RETURNING id, user_id, type, message, created_at`,
		userID, req.Type, req.Message,
	).Scan(&f.ID, &f.UserID, &f.Type, &f.Message, &f.CreatedAt)
	if err != nil {
		return nil, err
	}
	return f, nil
}

func (s *FeedbackService) ListFeedback(ctx context.Context, limit, offset int) ([]models.FeedbackWithUser, error) {
	if limit <= 0 {
		limit = 20
	}

	rows, err := s.db.Query(ctx,
		`SELECT f.id, f.user_id, f.type, f.message, f.created_at,
		        COALESCE(u.username, '') AS username, u.email
		 FROM feedback f
		 JOIN users u ON f.user_id = u.id
		 ORDER BY f.created_at DESC
		 LIMIT $1 OFFSET $2`,
		limit, offset,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.FeedbackWithUser
	for rows.Next() {
		var fw models.FeedbackWithUser
		if err := rows.Scan(
			&fw.ID, &fw.UserID, &fw.Type, &fw.Message, &fw.CreatedAt,
			&fw.Username, &fw.Email,
		); err != nil {
			return nil, err
		}
		list = append(list, fw)
	}
	if list == nil {
		list = []models.FeedbackWithUser{}
	}
	return list, nil
}

func (s *FeedbackService) DeleteFeedback(ctx context.Context, id uuid.UUID) error {
	result, err := s.db.Exec(ctx, "DELETE FROM feedback WHERE id = $1", id)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrFeedbackNotFound
	}
	return nil
}
