package services

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/models"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrJournalEntryNotFound    = errors.New("journal entry not found")
	ErrJournalGroupNotFound    = errors.New("journal group not found")
	ErrJournalCollectionNotFound = errors.New("journal collection not found")
	ErrJournalImageNotFound    = errors.New("journal image not found")
	ErrNotGroupMember          = errors.New("not a member of this group")
	ErrAlreadyGroupMember      = errors.New("already a member of this group")
	ErrInvalidMood             = errors.New("invalid mood value")
	ErrImageLimitReached       = errors.New("entry already has 3 images")
)

var validMoods = map[string]bool{
	"happy": true, "calm": true, "energised": true, "grateful": true,
	"anxious": true, "sad": true, "tired": true, "stressed": true,
}

type JournalService struct {
	db *pgxpool.Pool
}

func NewJournalService(db *pgxpool.Pool) *JournalService {
	return &JournalService{db: db}
}

func (s *JournalService) ValidateMood(mood string) bool {
	return validMoods[mood]
}

// ─── Entries ───────────────────────────────────────────────────────────────

func (s *JournalService) CreateEntry(ctx context.Context, userID uuid.UUID, groupID *uuid.UUID, req *models.CreateJournalEntryRequest) (*models.JournalEntry, error) {
	tags := req.Tags
	if tags == nil {
		tags = []string{}
	}
	entry := &models.JournalEntry{}
	err := s.db.QueryRow(ctx,
		`INSERT INTO journal_entries (user_id, group_id, title, body, mood, tags)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 RETURNING id, user_id, group_id, title, body, mood, tags, created_at, updated_at`,
		userID, groupID, req.Title, req.Body, req.Mood, tags,
	).Scan(&entry.ID, &entry.UserID, &entry.GroupID, &entry.Title, &entry.Body, &entry.Mood, &entry.Tags, &entry.CreatedAt, &entry.UpdatedAt)
	if err != nil {
		return nil, err
	}
	entry.Images = []models.JournalImage{}
	return entry, nil
}

func (s *JournalService) GetEntry(ctx context.Context, userID, entryID uuid.UUID) (*models.JournalEntry, error) {
	entry := &models.JournalEntry{}
	err := s.db.QueryRow(ctx,
		`SELECT id, user_id, group_id, title, body, mood, tags, created_at, updated_at
		 FROM journal_entries WHERE id = $1`,
		entryID,
	).Scan(&entry.ID, &entry.UserID, &entry.GroupID, &entry.Title, &entry.Body, &entry.Mood, &entry.Tags, &entry.CreatedAt, &entry.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrJournalEntryNotFound
		}
		return nil, err
	}

	// Check access: owner or active group member
	if entry.UserID != userID {
		if entry.GroupID == nil {
			return nil, ErrJournalEntryNotFound
		}
		if !s.isActiveMember(ctx, *entry.GroupID, userID) {
			return nil, ErrJournalEntryNotFound
		}
	}

	images, _ := s.listImages(ctx, entryID)
	entry.Images = images
	return entry, nil
}

func (s *JournalService) ListEntries(ctx context.Context, userID uuid.UUID, mood, tag, q, from, to string, limit, offset int) ([]models.JournalEntry, error) {
	args := []any{userID}
	where := `WHERE e.user_id = $1 AND e.group_id IS NULL`
	i := 2

	if mood != "" {
		where += fmt.Sprintf(` AND e.mood = $%d`, i)
		args = append(args, mood)
		i++
	}
	if tag != "" {
		where += fmt.Sprintf(` AND $%d = ANY(e.tags)`, i)
		args = append(args, tag)
		i++
	}
	if q != "" {
		where += fmt.Sprintf(` AND (e.title ILIKE $%d OR e.body ILIKE $%d)`, i, i)
		args = append(args, "%"+q+"%")
		i++
	}
	if from != "" {
		where += fmt.Sprintf(` AND e.created_at >= $%d`, i)
		args = append(args, from)
		i++
	}
	if to != "" {
		where += fmt.Sprintf(` AND e.created_at <= $%d`, i)
		args = append(args, to)
		i++
	}

	if limit <= 0 || limit > 50 {
		limit = 20
	}
	args = append(args, limit, offset)

	query := fmt.Sprintf(`
		SELECT e.id, e.user_id, e.group_id, e.title, e.body, e.mood, e.tags, e.created_at, e.updated_at
		FROM journal_entries e
		%s
		ORDER BY e.created_at DESC
		LIMIT $%d OFFSET $%d`, where, i, i+1)

	rows, err := s.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var entries []models.JournalEntry
	for rows.Next() {
		var e models.JournalEntry
		if err := rows.Scan(&e.ID, &e.UserID, &e.GroupID, &e.Title, &e.Body, &e.Mood, &e.Tags, &e.CreatedAt, &e.UpdatedAt); err != nil {
			return nil, err
		}
		e.Images = []models.JournalImage{}
		entries = append(entries, e)
	}
	if entries == nil {
		entries = []models.JournalEntry{}
	}
	return entries, nil
}

func (s *JournalService) UpdateEntry(ctx context.Context, userID, entryID uuid.UUID, req *models.UpdateJournalEntryRequest) (*models.JournalEntry, error) {
	entry := &models.JournalEntry{}
	err := s.db.QueryRow(ctx,
		`SELECT id, user_id FROM journal_entries WHERE id = $1`, entryID,
	).Scan(&entry.ID, &entry.UserID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrJournalEntryNotFound
		}
		return nil, err
	}
	if entry.UserID != userID {
		return nil, ErrJournalEntryNotFound
	}

	// Build dynamic SET
	setClauses := []string{"updated_at = NOW()"}
	args := []any{}
	i := 1

	if req.Title != nil {
		setClauses = append(setClauses, fmt.Sprintf("title = $%d", i))
		args = append(args, req.Title)
		i++
	}
	if req.Body != nil {
		setClauses = append(setClauses, fmt.Sprintf("body = $%d", i))
		args = append(args, *req.Body)
		i++
	}
	if req.Mood != nil {
		setClauses = append(setClauses, fmt.Sprintf("mood = $%d", i))
		args = append(args, req.Mood)
		i++
	}
	if req.Tags != nil {
		setClauses = append(setClauses, fmt.Sprintf("tags = $%d", i))
		args = append(args, req.Tags)
		i++
	}

	set := ""
	for j, c := range setClauses {
		if j > 0 {
			set += ", "
		}
		set += c
	}
	args = append(args, entryID)

	err = s.db.QueryRow(ctx,
		fmt.Sprintf(`UPDATE journal_entries SET %s WHERE id = $%d
		 RETURNING id, user_id, group_id, title, body, mood, tags, created_at, updated_at`, set, i),
		args...,
	).Scan(&entry.ID, &entry.UserID, &entry.GroupID, &entry.Title, &entry.Body, &entry.Mood, &entry.Tags, &entry.CreatedAt, &entry.UpdatedAt)
	if err != nil {
		return nil, err
	}

	images, _ := s.listImages(ctx, entryID)
	entry.Images = images
	return entry, nil
}

func (s *JournalService) DeleteEntry(ctx context.Context, userID, entryID uuid.UUID) ([]string, error) {
	var ownerID uuid.UUID
	err := s.db.QueryRow(ctx, `SELECT user_id FROM journal_entries WHERE id = $1`, entryID).Scan(&ownerID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrJournalEntryNotFound
		}
		return nil, err
	}
	if ownerID != userID {
		return nil, ErrJournalEntryNotFound
	}

	// Collect object keys for R2 cleanup
	rows, err := s.db.Query(ctx, `SELECT object_key FROM journal_images WHERE entry_id = $1`, entryID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var keys []string
	for rows.Next() {
		var k string
		if err := rows.Scan(&k); err == nil {
			keys = append(keys, k)
		}
	}

	_, err = s.db.Exec(ctx, `DELETE FROM journal_entries WHERE id = $1`, entryID)
	return keys, err
}

// ─── Streak & Calendar ─────────────────────────────────────────────────────

func (s *JournalService) GetStreak(ctx context.Context, userID uuid.UUID) (*models.JournalStreakResponse, error) {
	resp := &models.JournalStreakResponse{}

	// Total entries
	s.db.QueryRow(ctx,
		`SELECT COUNT(*) FROM journal_entries WHERE user_id = $1 AND group_id IS NULL`, userID,
	).Scan(&resp.TotalEntries)

	// Last entry
	var lastAt time.Time
	err := s.db.QueryRow(ctx,
		`SELECT created_at FROM journal_entries WHERE user_id = $1 AND group_id IS NULL ORDER BY created_at DESC LIMIT 1`, userID,
	).Scan(&lastAt)
	if err == nil {
		resp.LastEntryAt = &lastAt
	}

	// Current streak
	row := s.db.QueryRow(ctx, `
		WITH daily AS (
			SELECT DISTINCT DATE(created_at AT TIME ZONE 'UTC') AS day
			FROM journal_entries
			WHERE user_id = $1 AND group_id IS NULL
		),
		numbered AS (
			SELECT day, ROW_NUMBER() OVER (ORDER BY day DESC) AS rn FROM daily
		),
		streaks AS (
			SELECT day, rn, (day - (rn || ' days')::INTERVAL)::DATE AS grp FROM numbered
		)
		SELECT COUNT(*) FROM streaks
		WHERE grp = (SELECT grp FROM streaks ORDER BY day DESC LIMIT 1)
	`, userID)
	row.Scan(&resp.CurrentStreak)

	// Longest streak
	row = s.db.QueryRow(ctx, `
		WITH daily AS (
			SELECT DISTINCT DATE(created_at AT TIME ZONE 'UTC') AS day
			FROM journal_entries
			WHERE user_id = $1 AND group_id IS NULL
		),
		numbered AS (
			SELECT day, ROW_NUMBER() OVER (ORDER BY day DESC) AS rn FROM daily
		),
		streaks AS (
			SELECT grp, COUNT(*) AS len
			FROM (SELECT day, (day - (ROW_NUMBER() OVER (ORDER BY day DESC) || ' days')::INTERVAL)::DATE AS grp FROM daily) t
			GROUP BY grp
		)
		SELECT COALESCE(MAX(len), 0) FROM streaks
	`, userID)
	row.Scan(&resp.LongestStreak)

	return resp, nil
}

func (s *JournalService) GetCalendar(ctx context.Context, userID uuid.UUID, year, month int, groupID *uuid.UUID) (*models.JournalCalendarResponse, error) {
	var rows interface {
		Next() bool
		Scan(...any) error
		Close()
	}
	var err error

	if groupID != nil {
		// Group calendar: entries from all active members
		r, e := s.db.Query(ctx, `
			SELECT DISTINCT EXTRACT(DAY FROM e.created_at AT TIME ZONE 'UTC')::INT
			FROM journal_entries e
			JOIN journal_group_members m ON m.group_id = e.group_id AND m.user_id = $1 AND m.status = 'active'
			WHERE e.group_id = $2
			  AND EXTRACT(YEAR FROM e.created_at AT TIME ZONE 'UTC') = $3
			  AND EXTRACT(MONTH FROM e.created_at AT TIME ZONE 'UTC') = $4
		`, userID, *groupID, year, month)
		rows, err = r, e
	} else {
		r, e := s.db.Query(ctx, `
			SELECT DISTINCT EXTRACT(DAY FROM created_at AT TIME ZONE 'UTC')::INT
			FROM journal_entries
			WHERE user_id = $1 AND group_id IS NULL
			  AND EXTRACT(YEAR FROM created_at AT TIME ZONE 'UTC') = $2
			  AND EXTRACT(MONTH FROM created_at AT TIME ZONE 'UTC') = $3
		`, userID, year, month)
		rows, err = r, e
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var days []int
	for rows.Next() {
		var d int
		if err := rows.Scan(&d); err == nil {
			days = append(days, d)
		}
	}
	if days == nil {
		days = []int{}
	}
	return &models.JournalCalendarResponse{Year: year, Month: month, Days: days}, nil
}

// ─── Images ────────────────────────────────────────────────────────────────

func (s *JournalService) CountImages(ctx context.Context, entryID uuid.UUID) (int, error) {
	var count int
	err := s.db.QueryRow(ctx, `SELECT COUNT(*) FROM journal_images WHERE entry_id = $1`, entryID).Scan(&count)
	return count, err
}

func (s *JournalService) CreateImage(ctx context.Context, entryID, userID uuid.UUID, objectKey, fileURL string) (*models.JournalImage, error) {
	img := &models.JournalImage{}
	err := s.db.QueryRow(ctx,
		`INSERT INTO journal_images (entry_id, user_id, object_key, file_url)
		 VALUES ($1, $2, $3, $4)
		 RETURNING id, entry_id, user_id, object_key, file_url, created_at`,
		entryID, userID, objectKey, fileURL,
	).Scan(&img.ID, &img.EntryID, &img.UserID, &img.ObjectKey, &img.FileURL, &img.CreatedAt)
	return img, err
}

func (s *JournalService) GetImage(ctx context.Context, imageID uuid.UUID) (*models.JournalImage, error) {
	img := &models.JournalImage{}
	err := s.db.QueryRow(ctx,
		`SELECT id, entry_id, user_id, object_key, file_url, created_at FROM journal_images WHERE id = $1`, imageID,
	).Scan(&img.ID, &img.EntryID, &img.UserID, &img.ObjectKey, &img.FileURL, &img.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrJournalImageNotFound
		}
		return nil, err
	}
	return img, nil
}

func (s *JournalService) DeleteImage(ctx context.Context, imageID uuid.UUID) error {
	_, err := s.db.Exec(ctx, `DELETE FROM journal_images WHERE id = $1`, imageID)
	return err
}

func (s *JournalService) listImages(ctx context.Context, entryID uuid.UUID) ([]models.JournalImage, error) {
	rows, err := s.db.Query(ctx,
		`SELECT id, entry_id, user_id, object_key, file_url, created_at FROM journal_images WHERE entry_id = $1 ORDER BY created_at`, entryID)
	if err != nil {
		return []models.JournalImage{}, err
	}
	defer rows.Close()
	var imgs []models.JournalImage
	for rows.Next() {
		var img models.JournalImage
		if err := rows.Scan(&img.ID, &img.EntryID, &img.UserID, &img.ObjectKey, &img.FileURL, &img.CreatedAt); err != nil {
			return nil, err
		}
		imgs = append(imgs, img)
	}
	if imgs == nil {
		imgs = []models.JournalImage{}
	}
	return imgs, nil
}

// ─── Groups ────────────────────────────────────────────────────────────────

func (s *JournalService) CreateGroup(ctx context.Context, ownerID uuid.UUID, name string) (*models.JournalGroup, error) {
	group := &models.JournalGroup{}
	err := s.db.QueryRow(ctx,
		`INSERT INTO journal_groups (owner_id, name) VALUES ($1, $2)
		 RETURNING id, owner_id, name, created_at, updated_at`,
		ownerID, name,
	).Scan(&group.ID, &group.OwnerID, &group.Name, &group.CreatedAt, &group.UpdatedAt)
	if err != nil {
		return nil, err
	}

	// Owner is automatically an active member
	s.db.Exec(ctx,
		`INSERT INTO journal_group_members (group_id, user_id, invited_by, status, joined_at)
		 VALUES ($1, $2, $2, 'active', NOW())`,
		group.ID, ownerID)

	group.Members = []models.JournalGroupMember{}
	return group, nil
}

func (s *JournalService) GetGroup(ctx context.Context, userID, groupID uuid.UUID) (*models.JournalGroup, error) {
	group := &models.JournalGroup{}
	err := s.db.QueryRow(ctx,
		`SELECT id, owner_id, name, created_at, updated_at FROM journal_groups WHERE id = $1`, groupID,
	).Scan(&group.ID, &group.OwnerID, &group.Name, &group.CreatedAt, &group.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrJournalGroupNotFound
		}
		return nil, err
	}

	if !s.isActiveMember(ctx, groupID, userID) && group.OwnerID != userID {
		return nil, ErrJournalGroupNotFound
	}

	members, _ := s.listGroupMembers(ctx, groupID)
	group.Members = members
	return group, nil
}

func (s *JournalService) ListGroups(ctx context.Context, userID uuid.UUID) ([]models.JournalGroup, error) {
	rows, err := s.db.Query(ctx, `
		SELECT g.id, g.owner_id, g.name, g.created_at, g.updated_at
		FROM journal_groups g
		JOIN journal_group_members m ON m.group_id = g.id AND m.user_id = $1 AND m.status = 'active'
		ORDER BY g.updated_at DESC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var groups []models.JournalGroup
	for rows.Next() {
		var g models.JournalGroup
		if err := rows.Scan(&g.ID, &g.OwnerID, &g.Name, &g.CreatedAt, &g.UpdatedAt); err != nil {
			return nil, err
		}
		g.Members = []models.JournalGroupMember{}
		groups = append(groups, g)
	}
	if groups == nil {
		groups = []models.JournalGroup{}
	}
	return groups, nil
}

func (s *JournalService) UpdateGroup(ctx context.Context, userID, groupID uuid.UUID, name string) (*models.JournalGroup, error) {
	var ownerID uuid.UUID
	err := s.db.QueryRow(ctx, `SELECT owner_id FROM journal_groups WHERE id = $1`, groupID).Scan(&ownerID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrJournalGroupNotFound
		}
		return nil, err
	}
	if ownerID != userID {
		return nil, ErrNotOwner
	}

	group := &models.JournalGroup{}
	err = s.db.QueryRow(ctx,
		`UPDATE journal_groups SET name = $1, updated_at = NOW() WHERE id = $2
		 RETURNING id, owner_id, name, created_at, updated_at`,
		name, groupID,
	).Scan(&group.ID, &group.OwnerID, &group.Name, &group.CreatedAt, &group.UpdatedAt)
	if err != nil {
		return nil, err
	}
	members, _ := s.listGroupMembers(ctx, groupID)
	group.Members = members
	return group, nil
}

func (s *JournalService) DeleteGroup(ctx context.Context, userID, groupID uuid.UUID) error {
	var ownerID uuid.UUID
	err := s.db.QueryRow(ctx, `SELECT owner_id FROM journal_groups WHERE id = $1`, groupID).Scan(&ownerID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrJournalGroupNotFound
		}
		return err
	}
	if ownerID != userID {
		return ErrNotOwner
	}
	_, err = s.db.Exec(ctx, `DELETE FROM journal_groups WHERE id = $1`, groupID)
	return err
}

func (s *JournalService) RemoveMember(ctx context.Context, requesterID, groupID, targetUserID uuid.UUID) error {
	var ownerID uuid.UUID
	s.db.QueryRow(ctx, `SELECT owner_id FROM journal_groups WHERE id = $1`, groupID).Scan(&ownerID)

	// Only owner can remove others; anyone can remove themselves
	if requesterID != targetUserID && ownerID != requesterID {
		return ErrNotOwner
	}
	// Owner cannot leave their own group
	if ownerID == targetUserID {
		return errors.New("owner cannot leave the group; delete it instead")
	}

	_, err := s.db.Exec(ctx, `DELETE FROM journal_group_members WHERE group_id = $1 AND user_id = $2`, groupID, targetUserID)
	return err
}

func (s *JournalService) isActiveMember(ctx context.Context, groupID, userID uuid.UUID) bool {
	var exists bool
	s.db.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM journal_group_members WHERE group_id = $1 AND user_id = $2 AND status = 'active')`,
		groupID, userID,
	).Scan(&exists)
	return exists
}

func (s *JournalService) listGroupMembers(ctx context.Context, groupID uuid.UUID) ([]models.JournalGroupMember, error) {
	rows, err := s.db.Query(ctx, `
		SELECT m.id, m.group_id, m.user_id, m.invited_by, m.status, m.joined_at, m.created_at,
		       u.email, u.username
		FROM journal_group_members m
		JOIN users u ON u.id = m.user_id
		WHERE m.group_id = $1
		ORDER BY m.created_at
	`, groupID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var members []models.JournalGroupMember
	for rows.Next() {
		var m models.JournalGroupMember
		if err := rows.Scan(&m.ID, &m.GroupID, &m.UserID, &m.InvitedBy, &m.Status, &m.JoinedAt, &m.CreatedAt, &m.UserEmail, &m.UserUsername); err != nil {
			return nil, err
		}
		members = append(members, m)
	}
	if members == nil {
		members = []models.JournalGroupMember{}
	}
	return members, nil
}

// ─── Group Invites ─────────────────────────────────────────────────────────

func (s *JournalService) LookupUserByEmail(ctx context.Context, email string) (uuid.UUID, string, error) {
	var id uuid.UUID
	var username string
	err := s.db.QueryRow(ctx, `SELECT id, username FROM users WHERE email = $1`, email).Scan(&id, &username)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return uuid.Nil, "", ErrUserNotFound
		}
		return uuid.Nil, "", err
	}
	return id, username, nil
}

func (s *JournalService) CreateGroupInvite(ctx context.Context, groupID uuid.UUID, email string) (rawToken string, err error) {
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}
	rawToken = hex.EncodeToString(raw)
	hash := sha256.Sum256([]byte(rawToken))
	tokenHash := hex.EncodeToString(hash[:])
	expiresAt := time.Now().Add(7 * 24 * time.Hour)

	_, err = s.db.Exec(ctx,
		`INSERT INTO journal_group_invites (group_id, email, token_hash, expires_at) VALUES ($1, $2, $3, $4)
		 ON CONFLICT DO NOTHING`,
		groupID, email, tokenHash, expiresAt)
	return rawToken, err
}

func (s *JournalService) EnsurePendingMember(ctx context.Context, groupID, inviteeID, inviterID uuid.UUID) error {
	_, err := s.db.Exec(ctx,
		`INSERT INTO journal_group_members (group_id, user_id, invited_by, status)
		 VALUES ($1, $2, $3, 'pending')
		 ON CONFLICT (group_id, user_id) DO NOTHING`,
		groupID, inviteeID, inviterID)
	return err
}

func (s *JournalService) IsMember(ctx context.Context, groupID, userID uuid.UUID) (bool, error) {
	var exists bool
	err := s.db.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM journal_group_members WHERE group_id = $1 AND user_id = $2)`,
		groupID, userID,
	).Scan(&exists)
	return exists, err
}

func (s *JournalService) AcceptInvite(ctx context.Context, rawToken string) (*models.JoinGroupResponse, error) {
	hash := sha256.Sum256([]byte(rawToken))
	tokenHash := hex.EncodeToString(hash[:])

	var inviteID, groupID uuid.UUID
	var expiresAt time.Time
	err := s.db.QueryRow(ctx,
		`SELECT id, group_id, expires_at FROM journal_group_invites WHERE token_hash = $1`, tokenHash,
	).Scan(&inviteID, &groupID, &expiresAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrInvalidToken
		}
		return nil, err
	}
	if time.Now().After(expiresAt) {
		return nil, ErrInvalidToken
	}

	// Activate membership
	_, err = s.db.Exec(ctx,
		`UPDATE journal_group_members SET status = 'active', joined_at = NOW()
		 WHERE group_id = $1 AND status = 'pending'`, groupID)
	if err != nil {
		return nil, err
	}

	// Delete invite
	s.db.Exec(ctx, `DELETE FROM journal_group_invites WHERE id = $1`, inviteID)

	var groupName string
	s.db.QueryRow(ctx, `SELECT name FROM journal_groups WHERE id = $1`, groupID).Scan(&groupName)

	return &models.JoinGroupResponse{GroupID: groupID, GroupName: groupName}, nil
}

// ─── Group entries ─────────────────────────────────────────────────────────

func (s *JournalService) ListGroupEntries(ctx context.Context, userID, groupID uuid.UUID) ([]models.JournalEntry, error) {
	if !s.isActiveMember(ctx, groupID, userID) {
		return nil, ErrNotGroupMember
	}

	rows, err := s.db.Query(ctx, `
		SELECT id, user_id, group_id, title, body, mood, tags, created_at, updated_at
		FROM journal_entries
		WHERE group_id = $1
		ORDER BY created_at DESC
	`, groupID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var entries []models.JournalEntry
	for rows.Next() {
		var e models.JournalEntry
		if err := rows.Scan(&e.ID, &e.UserID, &e.GroupID, &e.Title, &e.Body, &e.Mood, &e.Tags, &e.CreatedAt, &e.UpdatedAt); err != nil {
			return nil, err
		}
		e.Images = []models.JournalImage{}
		entries = append(entries, e)
	}
	if entries == nil {
		entries = []models.JournalEntry{}
	}
	return entries, nil
}

// ─── Collections ───────────────────────────────────────────────────────────

func (s *JournalService) CreateCollection(ctx context.Context, userID uuid.UUID, req *models.CreateJournalCollectionRequest) (*models.JournalCollection, error) {
	col := &models.JournalCollection{}
	err := s.db.QueryRow(ctx,
		`INSERT INTO journal_collections (user_id, name, description)
		 VALUES ($1, $2, $3)
		 RETURNING id, user_id, name, description, cover_image_url, created_at, updated_at`,
		userID, req.Name, req.Description,
	).Scan(&col.ID, &col.UserID, &col.Name, &col.Description, &col.CoverImageURL, &col.CreatedAt, &col.UpdatedAt)
	return col, err
}

func (s *JournalService) ListCollections(ctx context.Context, userID uuid.UUID) ([]models.JournalCollection, error) {
	rows, err := s.db.Query(ctx, `
		SELECT c.id, c.user_id, c.name, c.description, c.cover_image_url, c.created_at, c.updated_at,
		       (SELECT COUNT(*) FROM journal_collection_entries ce WHERE ce.collection_id = c.id) AS entry_count
		FROM journal_collections c
		WHERE c.user_id = $1
		ORDER BY c.updated_at DESC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var cols []models.JournalCollection
	for rows.Next() {
		var c models.JournalCollection
		if err := rows.Scan(&c.ID, &c.UserID, &c.Name, &c.Description, &c.CoverImageURL, &c.CreatedAt, &c.UpdatedAt, &c.EntryCount); err != nil {
			return nil, err
		}
		cols = append(cols, c)
	}
	if cols == nil {
		cols = []models.JournalCollection{}
	}
	return cols, nil
}

func (s *JournalService) GetCollection(ctx context.Context, userID, collectionID uuid.UUID) (*models.JournalCollection, []models.JournalEntry, error) {
	col := &models.JournalCollection{}
	err := s.db.QueryRow(ctx,
		`SELECT id, user_id, name, description, cover_image_url, created_at, updated_at FROM journal_collections WHERE id = $1 AND user_id = $2`,
		collectionID, userID,
	).Scan(&col.ID, &col.UserID, &col.Name, &col.Description, &col.CoverImageURL, &col.CreatedAt, &col.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil, ErrJournalCollectionNotFound
		}
		return nil, nil, err
	}

	rows, err := s.db.Query(ctx, `
		SELECT e.id, e.user_id, e.group_id, e.title, e.body, e.mood, e.tags, e.created_at, e.updated_at
		FROM journal_entries e
		JOIN journal_collection_entries ce ON ce.entry_id = e.id
		WHERE ce.collection_id = $1
		ORDER BY ce.added_at DESC
	`, collectionID)
	if err != nil {
		return col, nil, err
	}
	defer rows.Close()

	var entries []models.JournalEntry
	for rows.Next() {
		var e models.JournalEntry
		if err := rows.Scan(&e.ID, &e.UserID, &e.GroupID, &e.Title, &e.Body, &e.Mood, &e.Tags, &e.CreatedAt, &e.UpdatedAt); err != nil {
			return col, nil, err
		}
		e.Images = []models.JournalImage{}
		entries = append(entries, e)
	}
	if entries == nil {
		entries = []models.JournalEntry{}
	}
	col.EntryCount = len(entries)
	return col, entries, nil
}

func (s *JournalService) UpdateCollection(ctx context.Context, userID, collectionID uuid.UUID, req *models.UpdateJournalCollectionRequest) (*models.JournalCollection, error) {
	var ownerID uuid.UUID
	err := s.db.QueryRow(ctx, `SELECT user_id FROM journal_collections WHERE id = $1`, collectionID).Scan(&ownerID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrJournalCollectionNotFound
		}
		return nil, err
	}
	if ownerID != userID {
		return nil, ErrJournalCollectionNotFound
	}

	setClauses := []string{"updated_at = NOW()"}
	args := []any{}
	i := 1
	if req.Name != nil {
		setClauses = append(setClauses, fmt.Sprintf("name = $%d", i))
		args = append(args, *req.Name)
		i++
	}
	if req.Description != nil {
		setClauses = append(setClauses, fmt.Sprintf("description = $%d", i))
		args = append(args, req.Description)
		i++
	}
	set := ""
	for j, c := range setClauses {
		if j > 0 {
			set += ", "
		}
		set += c
	}
	args = append(args, collectionID)

	col := &models.JournalCollection{}
	err = s.db.QueryRow(ctx,
		fmt.Sprintf(`UPDATE journal_collections SET %s WHERE id = $%d
		 RETURNING id, user_id, name, description, cover_image_url, created_at, updated_at`, set, i),
		args...,
	).Scan(&col.ID, &col.UserID, &col.Name, &col.Description, &col.CoverImageURL, &col.CreatedAt, &col.UpdatedAt)
	return col, err
}

func (s *JournalService) DeleteCollection(ctx context.Context, userID, collectionID uuid.UUID) error {
	var ownerID uuid.UUID
	err := s.db.QueryRow(ctx, `SELECT user_id FROM journal_collections WHERE id = $1`, collectionID).Scan(&ownerID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrJournalCollectionNotFound
		}
		return err
	}
	if ownerID != userID {
		return ErrJournalCollectionNotFound
	}
	_, err = s.db.Exec(ctx, `DELETE FROM journal_collections WHERE id = $1`, collectionID)
	return err
}

func (s *JournalService) AddEntryToCollection(ctx context.Context, userID, collectionID, entryID uuid.UUID) error {
	var ownerID uuid.UUID
	if err := s.db.QueryRow(ctx, `SELECT user_id FROM journal_collections WHERE id = $1`, collectionID).Scan(&ownerID); err != nil {
		return ErrJournalCollectionNotFound
	}
	if ownerID != userID {
		return ErrJournalCollectionNotFound
	}
	_, err := s.db.Exec(ctx,
		`INSERT INTO journal_collection_entries (collection_id, entry_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
		collectionID, entryID)
	return err
}

func (s *JournalService) RemoveEntryFromCollection(ctx context.Context, userID, collectionID, entryID uuid.UUID) error {
	var ownerID uuid.UUID
	if err := s.db.QueryRow(ctx, `SELECT user_id FROM journal_collections WHERE id = $1`, collectionID).Scan(&ownerID); err != nil {
		return ErrJournalCollectionNotFound
	}
	if ownerID != userID {
		return ErrJournalCollectionNotFound
	}
	_, err := s.db.Exec(ctx,
		`DELETE FROM journal_collection_entries WHERE collection_id = $1 AND entry_id = $2`,
		collectionID, entryID)
	return err
}

// ─── Presign helpers ───────────────────────────────────────────────────────

func JournalImageObjectKey(userID, entryID uuid.UUID, ext string) string {
	raw := make([]byte, 8)
	rand.Read(raw)
	return fmt.Sprintf("journal/%s/%s/%s%s", userID, entryID, hex.EncodeToString(raw), ext)
}
