package services

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"time"

	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/models"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// InviteLinkTTL is how long a copyable group invite link works.
const InviteLinkTTL = 7 * 24 * time.Hour

// newInviteToken returns a fresh unguessable token (256 random bits, hex) and
// the hash that is stored in its place.
func newInviteToken() (raw, hash string, err error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", "", err
	}
	raw = hex.EncodeToString(b)
	return raw, hashInviteToken(raw), nil
}

// hashInviteToken is the stored form of an invite token: hex SHA-256, the
// same as email invites, refresh and reset tokens. A 256-bit random token
// needs no slow hash; a leaked table still gives no working link.
func hashInviteToken(raw string) string {
	h := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(h[:])
}

// inviteLinkUsable reports whether a link admits anyone at now: it has not
// been revoked and has not reached its expiry.
func inviteLinkUsable(expiresAt time.Time, revokedAt *time.Time, now time.Time) bool {
	return revokedAt == nil && now.Before(expiresAt)
}

// requireGroupOwner returns ErrJournalGroupNotFound for a missing group and
// ErrNotOwner for anyone but its owner.
func (s *JournalService) requireGroupOwner(ctx context.Context, userID, groupID uuid.UUID) error {
	var ownerID uuid.UUID
	if err := s.db.QueryRow(ctx, `SELECT owner_id FROM journal_groups WHERE id = $1`, groupID).Scan(&ownerID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrJournalGroupNotFound
		}
		return err
	}
	if ownerID != userID {
		return ErrNotOwner
	}
	return nil
}

// CreateInviteLink makes a new link for the owner's group, revoking any link
// still active, so a group has at most one working link. The raw token is
// only ever in this return value.
func (s *JournalService) CreateInviteLink(ctx context.Context, ownerID, groupID uuid.UUID) (*models.JournalInviteLink, error) {
	if err := s.requireGroupOwner(ctx, ownerID, groupID); err != nil {
		return nil, err
	}
	raw, hash, err := newInviteToken()
	if err != nil {
		return nil, err
	}

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx,
		`UPDATE journal_group_invite_links SET revoked_at = NOW()
		 WHERE group_id = $1 AND revoked_at IS NULL`, groupID); err != nil {
		return nil, err
	}
	link := &models.JournalInviteLink{Token: raw}
	if err := tx.QueryRow(ctx,
		`INSERT INTO journal_group_invite_links (group_id, created_by, token_hash, expires_at)
		 VALUES ($1, $2, $3, $4)
		 RETURNING expires_at, created_at`,
		groupID, ownerID, hash, time.Now().Add(InviteLinkTTL),
	).Scan(&link.ExpiresAt, &link.CreatedAt); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return link, nil
}

// GetInviteLink returns the owner's group's working link, without its token,
// or nil when there is none.
func (s *JournalService) GetInviteLink(ctx context.Context, ownerID, groupID uuid.UUID) (*models.JournalInviteLink, error) {
	if err := s.requireGroupOwner(ctx, ownerID, groupID); err != nil {
		return nil, err
	}
	link := &models.JournalInviteLink{}
	err := s.db.QueryRow(ctx,
		`SELECT expires_at, created_at FROM journal_group_invite_links
		 WHERE group_id = $1 AND revoked_at IS NULL AND expires_at > NOW()
		 ORDER BY created_at DESC LIMIT 1`, groupID,
	).Scan(&link.ExpiresAt, &link.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return link, nil
}

// RevokeInviteLink stops the owner's group's link from working. Revoking
// when there is no link is not an error.
func (s *JournalService) RevokeInviteLink(ctx context.Context, ownerID, groupID uuid.UUID) error {
	if err := s.requireGroupOwner(ctx, ownerID, groupID); err != nil {
		return err
	}
	_, err := s.db.Exec(ctx,
		`UPDATE journal_group_invite_links SET revoked_at = NOW()
		 WHERE group_id = $1 AND revoked_at IS NULL`, groupID)
	return err
}

type inviteLinkRow struct {
	groupID   uuid.UUID
	createdBy uuid.UUID
	expiresAt time.Time
	revokedAt *time.Time
}

// usableInviteLink finds the link a raw token opens, or ErrInvalidToken when
// it is unknown, expired or revoked (the three are not told apart).
func (s *JournalService) usableInviteLink(ctx context.Context, rawToken string) (*inviteLinkRow, error) {
	var l inviteLinkRow
	err := s.db.QueryRow(ctx,
		`SELECT group_id, created_by, expires_at, revoked_at
		 FROM journal_group_invite_links WHERE token_hash = $1`, hashInviteToken(rawToken),
	).Scan(&l.groupID, &l.createdBy, &l.expiresAt, &l.revokedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrInvalidToken
	}
	if err != nil {
		return nil, err
	}
	if !inviteLinkUsable(l.expiresAt, l.revokedAt, time.Now()) {
		return nil, ErrInvalidToken
	}
	return &l, nil
}

// acceptInviteLink adds userID to the link's group as an active member. A
// link is not used up: it admits everyone who holds it until it expires or
// is revoked. Joining a group one is already in is a no-op.
func (s *JournalService) acceptInviteLink(ctx context.Context, rawToken string, userID uuid.UUID) (*models.JoinGroupResponse, error) {
	l, err := s.usableInviteLink(ctx, rawToken)
	if err != nil {
		return nil, err
	}
	resp := &models.JoinGroupResponse{GroupID: l.groupID}
	if err := s.db.QueryRow(ctx, `SELECT name FROM journal_groups WHERE id = $1`, l.groupID).Scan(&resp.GroupName); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrInvalidToken
		}
		return nil, err
	}
	if s.isActiveMember(ctx, l.groupID, userID) {
		resp.AlreadyMember = true
		return resp, nil
	}
	// A pending row (from an emailed invite) becomes active; otherwise a new
	// membership, attributed to whoever made the link.
	if _, err := s.db.Exec(ctx,
		`INSERT INTO journal_group_members (group_id, user_id, invited_by, status, joined_at)
		 VALUES ($1, $2, $3, 'active', NOW())
		 ON CONFLICT (group_id, user_id)
		 DO UPDATE SET status = 'active', joined_at = NOW()`,
		l.groupID, userID, l.createdBy); err != nil {
		return nil, err
	}
	return resp, nil
}

// PreviewInvite says which group a token opens, for the join page to show
// before the user commits. It is a read, so the look-only demo can see it.
// An emailed invite for a different address reports ErrInviteEmailMismatch
// up front rather than on the join.
func (s *JournalService) PreviewInvite(ctx context.Context, rawToken string, userID uuid.UUID) (*models.JoinPreview, error) {
	p := &models.JoinPreview{}
	var groupID uuid.UUID

	var inviteEmail string
	err := s.db.QueryRow(ctx,
		`SELECT group_id, email, expires_at FROM journal_group_invites WHERE token_hash = $1`, hashInviteToken(rawToken),
	).Scan(&groupID, &inviteEmail, &p.ExpiresAt)
	switch {
	case err == nil:
		if time.Now().After(p.ExpiresAt) {
			return nil, ErrInvalidToken
		}
		var userEmail string
		if err := s.db.QueryRow(ctx, `SELECT email FROM users WHERE id = $1`, userID).Scan(&userEmail); err != nil {
			return nil, err
		}
		if !emailsMatch(userEmail, inviteEmail) {
			return nil, ErrInviteEmailMismatch
		}
		p.Kind = "email"
	case errors.Is(err, pgx.ErrNoRows):
		l, err := s.usableInviteLink(ctx, rawToken)
		if err != nil {
			return nil, err
		}
		groupID, p.ExpiresAt, p.Kind = l.groupID, l.expiresAt, "link"
	default:
		return nil, err
	}

	err = s.db.QueryRow(ctx, `
		SELECT g.name,
		       (SELECT COUNT(*) FROM journal_group_members m WHERE m.group_id = g.id AND m.status = 'active')
		FROM journal_groups g WHERE g.id = $1`, groupID,
	).Scan(&p.GroupName, &p.MemberCount)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrInvalidToken
	}
	if err != nil {
		return nil, err
	}
	if s.isActiveMember(ctx, groupID, userID) {
		p.AlreadyMember = true
		p.GroupID = &groupID
	}
	return p, nil
}
