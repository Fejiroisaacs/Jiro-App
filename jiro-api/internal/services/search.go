package services

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/models"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ErrSearchQueryTooLong is returned when the trimmed query exceeds
// searchMaxRunes. The handler maps it to 400 INVALID_QUERY.
var ErrSearchQueryTooLong = errors.New("search query too long")

const (
	searchMinRunes = 2
	searchMaxRunes = 100
	// Each group shows searchGroupSize items; one extra row is fetched to
	// know whether more exist.
	searchGroupSize = 5
	searchFetchSize = searchGroupSize + 1
)

type SearchService struct {
	db *pgxpool.Pool
}

func NewSearchService(db *pgxpool.Pool) *SearchService {
	return &SearchService{db: db}
}

// Search runs a case-insensitive substring search over the caller's own
// recipes, exercises, sessions and journal entries. Every query is scoped by
// user_id. Queries shorter than searchMinRunes return empty groups without
// touching the database.
func (s *SearchService) Search(ctx context.Context, userID uuid.UUID, rawQuery string) (*models.SearchResponse, error) {
	q := strings.TrimSpace(rawQuery)
	n := utf8.RuneCountInString(q)
	if n > searchMaxRunes {
		return nil, ErrSearchQueryTooLong
	}

	resp := &models.SearchResponse{
		Query:     q,
		Recipes:   emptySearchGroup(),
		Exercises: emptySearchGroup(),
		Sessions:  emptySearchGroup(),
		Journal:   emptySearchGroup(),
	}
	if n < searchMinRunes {
		return resp, nil
	}

	esc := escapeLike(q)
	contains := "%" + esc + "%"
	prefix := esc + "%"

	var err error
	if resp.Recipes, err = s.searchRecipes(ctx, userID, contains, prefix); err != nil {
		return nil, fmt.Errorf("search recipes: %w", err)
	}
	if resp.Exercises, err = s.searchExercises(ctx, userID, contains, prefix); err != nil {
		return nil, fmt.Errorf("search exercises: %w", err)
	}
	if resp.Sessions, err = s.searchSessions(ctx, userID, contains); err != nil {
		return nil, fmt.Errorf("search sessions: %w", err)
	}
	if resp.Journal, err = s.searchJournal(ctx, userID, contains, strings.ToLower(q)); err != nil {
		return nil, fmt.Errorf("search journal: %w", err)
	}
	return resp, nil
}

func (s *SearchService) searchRecipes(ctx context.Context, userID uuid.UUID, contains, prefix string) (models.SearchGroup, error) {
	rows, err := s.db.Query(ctx, `
		SELECT r.id, r.title, r.updated_at
		FROM recipes r
		WHERE r.user_id = $1
		  AND (r.title ILIKE $2 OR COALESCE(r.description, '') ILIKE $2)
		ORDER BY (r.title ILIKE $3) DESC, r.updated_at DESC
		LIMIT 6`, userID, contains, prefix)
	if err != nil {
		return models.SearchGroup{}, err
	}
	return collectSearchRows(rows, func(row pgx.Rows) (models.SearchItem, error) {
		var it models.SearchItem
		var title string
		var updated *time.Time
		if err := row.Scan(&it.ID, &title, &updated); err != nil {
			return it, err
		}
		it.Title = &title
		it.Date = updated
		return it, nil
	})
}

func (s *SearchService) searchExercises(ctx context.Context, userID uuid.UUID, contains, prefix string) (models.SearchGroup, error) {
	rows, err := s.db.Query(ctx, `
		SELECT e.id, e.name, e.muscle_group
		FROM exercises e
		WHERE e.user_id = $1 AND e.name ILIKE $2
		ORDER BY (e.name ILIKE $3) DESC, e.name ASC
		LIMIT 6`, userID, contains, prefix)
	if err != nil {
		return models.SearchGroup{}, err
	}
	return collectSearchRows(rows, func(row pgx.Rows) (models.SearchItem, error) {
		var it models.SearchItem
		var name string
		var muscle *string
		if err := row.Scan(&it.ID, &name, &muscle); err != nil {
			return it, err
		}
		it.Title = &name
		it.Subtitle = muscle
		return it, nil
	})
}

func (s *SearchService) searchSessions(ctx context.Context, userID uuid.UUID, contains string) (models.SearchGroup, error) {
	rows, err := s.db.Query(ctx, `
		SELECT s.id, COALESCE(r.name, 'Freestyle'), s.session_type, s.started_at, (s.ended_at IS NULL)
		FROM sessions s
		LEFT JOIN routines r ON r.id = s.routine_id
		WHERE s.user_id = $1
		  AND (COALESCE(r.name, 'Freestyle') ILIKE $2 OR COALESCE(s.notes, '') ILIKE $2)
		ORDER BY s.started_at DESC
		LIMIT 6`, userID, contains)
	if err != nil {
		return models.SearchGroup{}, err
	}
	return collectSearchRows(rows, func(row pgx.Rows) (models.SearchItem, error) {
		var it models.SearchItem
		var name, sessionType string
		var started *time.Time
		var inProgress bool
		if err := row.Scan(&it.ID, &name, &sessionType, &started, &inProgress); err != nil {
			return it, err
		}
		it.Title = &name
		it.Subtitle = &sessionType
		it.Date = started
		it.InProgress = &inProgress
		return it, nil
	})
}

// searchJournal covers only the caller's own entries — private ones and their
// own posts in shared groups. Other group members' posts are never searched.
func (s *SearchService) searchJournal(ctx context.Context, userID uuid.UUID, contains, lowered string) (models.SearchGroup, error) {
	rows, err := s.db.Query(ctx, `
		SELECT e.id, e.group_id, e.title,
		       substring(e.body from greatest(strpos(lower(e.body), $3::text) - 40, 1) for 160),
		       e.created_at
		FROM journal_entries e
		WHERE e.user_id = $1
		  AND (COALESCE(e.title, '') ILIKE $2 OR e.body ILIKE $2)
		ORDER BY e.created_at DESC
		LIMIT 6`, userID, contains, lowered)
	if err != nil {
		return models.SearchGroup{}, err
	}
	return collectSearchRows(rows, func(row pgx.Rows) (models.SearchItem, error) {
		var it models.SearchItem
		var snippet string
		var created *time.Time
		if err := row.Scan(&it.ID, &it.GroupID, &it.Title, &snippet, &created); err != nil {
			return it, err
		}
		it.Snippet = &snippet
		it.Date = created
		return it, nil
	})
}

// collectSearchRows scans up to searchFetchSize rows, trims to
// searchGroupSize and sets HasMore when the extra row came back.
func collectSearchRows(rows pgx.Rows, scan func(pgx.Rows) (models.SearchItem, error)) (models.SearchGroup, error) {
	defer rows.Close()
	g := emptySearchGroup()
	for rows.Next() {
		it, err := scan(rows)
		if err != nil {
			return models.SearchGroup{}, err
		}
		g.Items = append(g.Items, it)
	}
	if err := rows.Err(); err != nil {
		return models.SearchGroup{}, err
	}
	if len(g.Items) >= searchFetchSize {
		g.HasMore = true
		g.Items = g.Items[:searchGroupSize]
	}
	return g, nil
}

func emptySearchGroup() models.SearchGroup {
	return models.SearchGroup{Items: []models.SearchItem{}}
}

// escapeLike escapes LIKE/ILIKE metacharacters so user input matches
// literally. Postgres's default LIKE escape character is backslash, so the
// backslash itself is escaped first.
func escapeLike(s string) string {
	s = strings.ReplaceAll(s, `\`, `\\`)
	s = strings.ReplaceAll(s, `%`, `\%`)
	s = strings.ReplaceAll(s, `_`, `\_`)
	return s
}
