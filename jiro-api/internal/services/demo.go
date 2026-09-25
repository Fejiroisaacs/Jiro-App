package services

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// DemoEmail is the shared demo account. The .invalid TLD can never receive
// mail, and registration refuses the whole domain (IsReservedDemoEmail).
const DemoEmail = "demo@jiro.invalid"

// demoLockKey serialises the seed and the date slide across API instances
// (pg_advisory_xact_lock). Arbitrary, just unique to this purpose: "jirodemo".
const demoLockKey int64 = 0x6a69726f64656d6f

// demoParkDays moves a unique date column out of the way during a slide.
// A plain UPDATE of UNIQUE(user_id, date) rows by a whole number of days or
// weeks collides with a neighbouring row mid-statement (weekly weigh-ins
// shifted by 7 days), so those columns are moved far out first and then
// back. No demo row lives 100 years out.
const demoParkDays = 36500

// IsReservedDemoEmail reports whether an address belongs to the demo's
// domain, so nobody can register it before the demo is first seeded.
func IsReservedDemoEmail(email string) bool {
	return strings.HasSuffix(strings.ToLower(strings.TrimSpace(email)), "@jiro.invalid")
}

// DemoService owns the shared, look-only demo account: it creates it with
// its sample data on first use, and keeps that data's dates recent.
type DemoService struct {
	db   *pgxpool.Pool
	auth *AuthService
}

func NewDemoService(db *pgxpool.Pool, auth *AuthService) *DemoService {
	return &DemoService{db: db, auth: auth}
}

// Login returns the demo user's id, first creating the user and its sample
// data if they do not exist yet, or else sliding the data's dates forward to
// today (KeepFresh). Everything runs in one transaction under an advisory
// lock, so concurrent first logins seed once and concurrent later logins
// slide once.
func (s *DemoService) Login(ctx context.Context) (uuid.UUID, error) {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return uuid.Nil, err
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock($1)`, demoLockKey); err != nil {
		return uuid.Nil, err
	}

	// The demo's today is a New York date (see demoDate), so its "yesterday"
	// is the yesterday the day view and streaks show a New York user. The seed
	// and the anchor take that date; keepFresh takes the instant and converts.
	now := time.Now()
	today := demoDate(now)
	var id uuid.UUID
	var anchor *time.Time
	err = tx.QueryRow(ctx, `SELECT id, demo_anchor_at FROM users WHERE is_demo`).Scan(&id, &anchor)
	switch {
	case errors.Is(err, pgx.ErrNoRows):
		if id, err = s.seed(ctx, tx, today); err != nil {
			return uuid.Nil, fmt.Errorf("seed demo: %w", err)
		}
	case err != nil:
		return uuid.Nil, err
	case anchor == nil:
		if _, err := tx.Exec(ctx, `UPDATE users SET demo_anchor_at = $2 WHERE id = $1`, id, today); err != nil {
			return uuid.Nil, err
		}
	default:
		if err := keepFresh(ctx, tx, id, *anchor, now); err != nil {
			return uuid.Nil, fmt.Errorf("refresh demo dates: %w", err)
		}
	}

	// Every visit mints a refresh token for the one shared account; drop the
	// expired ones so they do not pile up.
	if _, err := tx.Exec(ctx, `DELETE FROM refresh_tokens WHERE user_id = $1 AND expires_at < NOW()`, id); err != nil {
		return uuid.Nil, err
	}

	return id, tx.Commit(ctx)
}

func (s *DemoService) seed(ctx context.Context, tx pgx.Tx, now time.Time) (uuid.UUID, error) {
	// A real Argon2id hash of a random secret nobody ever sees: password
	// login can never succeed (and the Login handler refuses the demo anyway).
	secret := make([]byte, 32)
	if _, err := rand.Read(secret); err != nil {
		return uuid.Nil, err
	}
	hash, err := s.auth.HashPassword(hex.EncodeToString(secret))
	if err != nil {
		return uuid.Nil, err
	}

	ds := buildDemoDataset(now)
	id := uuid.New()
	// created_at predates the sample data; it is the one date never slid.
	if _, err := tx.Exec(ctx,
		`INSERT INTO users (id, email, password_hash, display_name, email_verified, is_admin, is_demo, demo_anchor_at, settings, created_at, updated_at)
		 VALUES ($1, $2, $3, 'Demo', true, false, true, $4, $5::jsonb, $6, $6)`,
		id, DemoEmail, hash, now, demoSettings, ds.SeedDay.AddDate(0, 0, -80),
	); err != nil {
		return uuid.Nil, err
	}

	b := &pgx.Batch{}
	ds.queue(b, id)
	if err := tx.SendBatch(ctx, b).Close(); err != nil {
		return uuid.Nil, err
	}
	return id, nil
}

// demoDayShift is how many whole calendar days (in the demo's timezone; the
// anchor is stored as UTC midnight of such a date) the data must move so
// that what was "yesterday" at anchor is yesterday again at now. Never
// negative, so a clock step backwards does nothing.
func demoDayShift(anchor, now time.Time) int {
	days := int(demoDate(now).Sub(utcDay(anchor)).Hours() / 24)
	if days < 0 {
		return 0
	}
	return days
}

// demoWeekShift is how many whole weeks the meal plan must move so its week
// stays the current one: the number of Monday boundaries between the old
// and the new anchor. Moving by whole weeks keeps week_start a Monday.
func demoWeekShift(oldAnchor, newAnchor time.Time) int {
	return int(mondayOf(newAnchor).Sub(mondayOf(oldAnchor)).Hours() / (24 * 7))
}

type shiftBy int

const (
	shiftDays  shiftBy = iota // $2 is whole days
	shiftWeeks                // $2 is whole weeks
	shiftNone                 // no $2: the second half of a park-and-return move
)

// demoShift is one UPDATE of KeepFresh; $1 is always the demo user id.
type demoShift struct {
	sql string
	by  shiftBy
}

// demoTS is a timestamp column's shift by $2 whole days.
const demoTS = "make_interval(days => $2)"

// demoShifts lists every date and timestamp the demo owns, directly by
// user_id or through its parent row. users.created_at is left alone on
// purpose. Keep in step with the schema: a new dated table the demo writes
// to belongs here, or its rows will age.
var demoShifts = []demoShift{
	// Jym
	{sql: `UPDATE exercises SET created_at = created_at + ` + demoTS + `, updated_at = updated_at + ` + demoTS + ` WHERE user_id = $1`},
	{sql: `UPDATE splits SET created_at = created_at + ` + demoTS + `, updated_at = updated_at + ` + demoTS + ` WHERE user_id = $1`},
	{sql: `UPDATE routines SET created_at = created_at + ` + demoTS + ` WHERE user_id = $1`},
	{sql: `UPDATE split_series SET started_at = started_at + ` + demoTS + `, ended_at = ended_at + ` + demoTS + `, created_at = created_at + ` + demoTS + ` WHERE user_id = $1`},
	{sql: `UPDATE sessions SET started_at = started_at + ` + demoTS + `, ended_at = ended_at + ` + demoTS + ` WHERE user_id = $1`},
	{sql: `UPDATE session_sets ss SET created_at = ss.created_at + ` + demoTS + ` FROM sessions s WHERE s.id = ss.session_id AND s.user_id = $1`},
	{sql: `UPDATE session_attachments SET created_at = created_at + ` + demoTS + ` WHERE user_id = $1`},
	{sql: `UPDATE body_weights SET recorded_at = recorded_at + $2::int + ` + fmt.Sprint(demoParkDays) + `, created_at = created_at + ` + demoTS + ` WHERE user_id = $1`},
	{sql: `UPDATE body_weights SET recorded_at = recorded_at - ` + fmt.Sprint(demoParkDays) + ` WHERE user_id = $1`, by: shiftNone},

	// Culinara
	{sql: `UPDATE recipes SET created_at = created_at + ` + demoTS + `, updated_at = updated_at + ` + demoTS + ` WHERE user_id = $1`},
	{sql: `UPDATE recipe_trials t SET date_cooked = t.date_cooked + ` + demoTS + `, created_at = t.created_at + ` + demoTS + ` FROM recipes r WHERE r.id = t.recipe_id AND r.user_id = $1`},
	{sql: `UPDATE recipe_collections SET created_at = created_at + ` + demoTS + `, updated_at = updated_at + ` + demoTS + ` WHERE user_id = $1`},
	{sql: `UPDATE recipe_collection_items i SET added_at = i.added_at + ` + demoTS + ` FROM recipe_collections c WHERE c.id = i.collection_id AND c.user_id = $1`},
	{sql: `UPDATE meal_plans SET created_at = created_at + ` + demoTS + `, updated_at = updated_at + ` + demoTS + ` WHERE user_id = $1`},
	{sql: `UPDATE meal_plan_entries e SET created_at = e.created_at + ` + demoTS + ` FROM meal_plans p WHERE p.id = e.meal_plan_id AND p.user_id = $1`},
	{sql: `UPDATE meal_plans SET week_start = week_start + $2::int * 7 + ` + fmt.Sprint(demoParkDays) + ` WHERE user_id = $1`, by: shiftWeeks},
	{sql: `UPDATE meal_plans SET week_start = week_start - ` + fmt.Sprint(demoParkDays) + ` WHERE user_id = $1`, by: shiftNone},
	{sql: `UPDATE grocery_items SET created_at = created_at + ` + demoTS + `, updated_at = updated_at + ` + demoTS + ` WHERE user_id = $1`},

	// Journaly
	{sql: `UPDATE journal_entries SET created_at = created_at + ` + demoTS + `, updated_at = updated_at + ` + demoTS + ` WHERE user_id = $1`},
	{sql: `UPDATE journal_images SET created_at = created_at + ` + demoTS + ` WHERE user_id = $1`},
	{sql: `UPDATE journal_collections SET created_at = created_at + ` + demoTS + `, updated_at = updated_at + ` + demoTS + ` WHERE user_id = $1`},
	{sql: `UPDATE journal_collection_entries e SET added_at = e.added_at + ` + demoTS + ` FROM journal_collections c WHERE c.id = e.collection_id AND c.user_id = $1`},

	// Ledger
	{sql: `UPDATE ledger_accounts SET created_at = created_at + ` + demoTS + `, updated_at = updated_at + ` + demoTS + ` WHERE user_id = $1`},
	{sql: `UPDATE ledger_categories SET created_at = created_at + ` + demoTS + ` WHERE user_id = $1`},
	{sql: `UPDATE ledger_transactions SET date = date + $2::int, created_at = created_at + ` + demoTS + `, updated_at = updated_at + ` + demoTS + ` WHERE user_id = $1`},
	{sql: `UPDATE ledger_budgets SET start_date = start_date + $2::int, created_at = created_at + ` + demoTS + `, updated_at = updated_at + ` + demoTS + ` WHERE user_id = $1`},
	{sql: `UPDATE ledger_networth_snapshots SET snapshot_date = snapshot_date + $2::int + ` + fmt.Sprint(demoParkDays) + ` WHERE user_id = $1`},
	{sql: `UPDATE ledger_networth_snapshots SET snapshot_date = snapshot_date - ` + fmt.Sprint(demoParkDays) + ` WHERE user_id = $1`, by: shiftNone},
}

// keepFresh slides every demo date forward by the whole days since anchor
// (the meal plan by whole weeks) and moves the anchor by the same amount.
// Rows, ids and content never change, so pages already open keep working.
// The caller holds the demo advisory lock.
func keepFresh(ctx context.Context, tx pgx.Tx, userID uuid.UUID, anchor, now time.Time) error {
	days := demoDayShift(anchor, now)
	if days == 0 {
		return nil
	}
	newAnchor := anchor.AddDate(0, 0, days)
	weeks := demoWeekShift(anchor, newAnchor)

	// GET /culinara/meal-plan creates an empty plan for any week a visitor
	// browses to. Those would collide with the seeded plan as it moves, and
	// hold nothing: drop them first.
	if _, err := tx.Exec(ctx,
		`DELETE FROM meal_plans p WHERE p.user_id = $1
		   AND NOT EXISTS (SELECT 1 FROM meal_plan_entries e WHERE e.meal_plan_id = p.id)`,
		userID,
	); err != nil {
		return err
	}

	for _, st := range demoShifts {
		args := []any{userID}
		switch st.by {
		case shiftDays:
			args = append(args, days)
		case shiftWeeks:
			args = append(args, weeks)
		}
		if _, err := tx.Exec(ctx, st.sql, args...); err != nil {
			return fmt.Errorf("%s: %w", strings.Fields(st.sql)[1], err)
		}
	}

	_, err := tx.Exec(ctx, `UPDATE users SET demo_anchor_at = $2 WHERE id = $1`, userID, newAnchor)
	return err
}
