package services

import (
	"context"
	"errors"
	"fmt"
	"math"
	"time"
	// The alpine runtime image has no zoneinfo; without this every zone falls back to UTC.
	_ "time/tzdata"

	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/models"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	// ErrInvalidDay: the date is not YYYY-MM-DD. Maps to 400.
	ErrInvalidDay = errors.New("invalid day")
	// ErrFutureDay: the date is after today in the user's timezone. Maps to 400.
	ErrFutureDay = errors.New("future day")
)

const dayLayout = "2006-01-02"

// dayExcerptRunes caps the journal excerpt sent with each entry.
const dayExcerptRunes = 240

// DayService assembles one calendar day across modules; read-only (never creates a meal plan).
type DayService struct {
	db  *pgxpool.Pool
	jym *JymService
}

func NewDayService(db *pgxpool.Pool, jym *JymService) *DayService {
	return &DayService{db: db, jym: jym}
}

// UserLocation resolves an IANA zone name, falling back to UTC for empty, "Local" or unknown.
func UserLocation(name string) (*time.Location, string) {
	if name == "" || name == "Local" {
		return time.UTC, "UTC"
	}
	loc, err := time.LoadLocation(name)
	if err != nil {
		return time.UTC, "UTC"
	}
	return loc, loc.String()
}

// PickLocation picks the zone a user's day is cut in: settings zone, else client hint, else UTC.
func PickLocation(setting, hint string) (*time.Location, string) {
	if loc, name := UserLocation(setting); name != "UTC" || setting == "UTC" {
		return loc, name
	}
	return UserLocation(hint)
}

// userLocation returns the user's day zone (as PickLocation); its name also works for AT TIME ZONE.
func userLocation(ctx context.Context, db *pgxpool.Pool, userID uuid.UUID, hint string) (*time.Location, error) {
	var tzName *string
	if err := db.QueryRow(ctx,
		`SELECT settings->>'timezone' FROM users WHERE id = $1`, userID,
	).Scan(&tzName); err != nil {
		return nil, fmt.Errorf("load timezone: %w", err)
	}
	loc, _ := PickLocation(deref(tzName), hint)
	return loc, nil
}

// calendarToday is today's date in loc, at UTC midnight.
func calendarToday(now time.Time, loc *time.Location) time.Time {
	y, m, d := now.In(loc).Date()
	return time.Date(y, m, d, 0, 0, 0, 0, time.UTC)
}

// DayWindow is [local midnight, next local midnight) of that date in loc; 23 or 25 hours across DST.
func DayWindow(year int, month time.Month, day int, loc *time.Location) (time.Time, time.Time) {
	start := time.Date(year, month, day, 0, 0, 0, 0, loc)
	return start, start.AddDate(0, 0, 1)
}

// ResolveDay parses a date (empty means today in loc) or returns ErrInvalidDay / ErrFutureDay.
func ResolveDay(raw string, loc *time.Location, now time.Time) (time.Time, error) {
	ty, tm, td := now.In(loc).Date()
	today := time.Date(ty, tm, td, 0, 0, 0, 0, time.UTC)
	if raw == "" {
		return today, nil
	}
	d, err := time.Parse(dayLayout, raw)
	if err != nil {
		return time.Time{}, ErrInvalidDay
	}
	if d.After(today) {
		return time.Time{}, ErrFutureDay
	}
	return d, nil
}

// weekdayIndex is d's day in a meal plan week: 0=Monday .. 6=Sunday.
func weekdayIndex(d time.Time) int {
	return (int(d.Weekday()) + 6) % 7
}

// GetDay returns the user's day; rawDate is YYYY-MM-DD or empty for today.
func (s *DayService) GetDay(ctx context.Context, userID uuid.UUID, rawDate, tzHint string, now time.Time) (*models.DayResponse, error) {
	var tzName, unit *string
	if err := s.db.QueryRow(ctx,
		`SELECT settings->>'timezone', settings->>'weight_unit' FROM users WHERE id = $1`, userID,
	).Scan(&tzName, &unit); err != nil {
		return nil, fmt.Errorf("load settings: %w", err)
	}
	loc, zone := PickLocation(deref(tzName), tzHint)

	day, err := ResolveDay(rawDate, loc, now)
	if err != nil {
		return nil, err
	}
	start, end := DayWindow(day.Year(), day.Month(), day.Day(), loc)
	dateStr := day.Format(dayLayout)
	ty, tm, td := now.In(loc).Date()

	weightUnit := "lbs" // the default a new account is created with
	if deref(unit) == "kg" {
		weightUnit = "kg"
	}

	resp := &models.DayResponse{
		Date:     dateStr,
		Timezone: zone,
		IsToday:  day.Year() == ty && day.Month() == tm && day.Day() == td,
		Jym:      models.DayJym{WeightUnit: weightUnit},
	}

	if resp.Jym.Sessions, err = s.jym.ListSessionsBetween(ctx, userID, start, end); err != nil {
		return nil, fmt.Errorf("day sessions: %w", err)
	}
	if resp.Jym.BodyWeight, err = s.bodyWeight(ctx, userID, dateStr); err != nil {
		return nil, fmt.Errorf("day body weight: %w", err)
	}
	if resp.Culinara.Cooked, err = s.cooked(ctx, userID, start, end); err != nil {
		return nil, fmt.Errorf("day cooked: %w", err)
	}
	// day is a calendar date at UTC midnight, which is what mondayOf expects.
	if resp.Culinara.Planned, err = s.planned(ctx, userID, mondayOf(day).Format(dayLayout), weekdayIndex(day)); err != nil {
		return nil, fmt.Errorf("day planned: %w", err)
	}
	if resp.Journal.Entries, err = s.journal(ctx, userID, start, end); err != nil {
		return nil, fmt.Errorf("day journal: %w", err)
	}
	if err = s.ledger(ctx, userID, dateStr, &resp.Ledger); err != nil {
		return nil, fmt.Errorf("day ledger: %w", err)
	}
	return resp, nil
}

func deref(p *string) string {
	if p == nil {
		return ""
	}
	return *p
}

func (s *DayService) bodyWeight(ctx context.Context, userID uuid.UUID, date string) (*models.DayBodyWeight, error) {
	rows, err := s.db.Query(ctx,
		`SELECT id, weight_kg::float8 FROM body_weights WHERE user_id = $1 AND recorded_at = $2::date`,
		userID, date)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	if !rows.Next() {
		return nil, rows.Err()
	}
	var bw models.DayBodyWeight
	if err := rows.Scan(&bw.ID, &bw.WeightKg); err != nil {
		return nil, err
	}
	return &bw, nil
}

// cooked: trials own no user_id; ownership is the recipe's.
func (s *DayService) cooked(ctx context.Context, userID uuid.UUID, start, end time.Time) ([]models.DayCooked, error) {
	rows, err := s.db.Query(ctx, `
		SELECT t.id, t.recipe_id, r.title, t.rating, t.notes, t.date_cooked
		FROM recipe_trials t
		JOIN recipes r ON r.id = t.recipe_id
		WHERE r.user_id = $1 AND t.date_cooked >= $2 AND t.date_cooked < $3
		ORDER BY t.date_cooked`, userID, start, end)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.DayCooked{}
	for rows.Next() {
		var c models.DayCooked
		if err := rows.Scan(&c.TrialID, &c.RecipeID, &c.RecipeTitle, &c.Rating, &c.Notes, &c.DateCooked); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

// planned reads the week's existing plan only, scoped to its owner.
func (s *DayService) planned(ctx context.Context, userID uuid.UUID, weekStart string, weekday int) ([]models.DayPlanned, error) {
	rows, err := s.db.Query(ctx, `
		SELECT e.id, e.meal_slot, r.id, r.title, e.custom_label
		FROM meal_plans p
		JOIN meal_plan_entries e ON e.meal_plan_id = p.id
		LEFT JOIN recipes r ON r.id = e.recipe_id AND r.user_id = p.user_id
		WHERE p.user_id = $1 AND p.week_start = $2::date AND e.day_of_week = $3
		ORDER BY CASE e.meal_slot WHEN 'breakfast' THEN 0 WHEN 'lunch' THEN 1 WHEN 'dinner' THEN 2 ELSE 3 END,
		         e.position, e.created_at`, userID, weekStart, weekday)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.DayPlanned{}
	for rows.Next() {
		var p models.DayPlanned
		if err := rows.Scan(&p.ID, &p.MealSlot, &p.RecipeID, &p.RecipeTitle, &p.CustomLabel); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

// journal: the user's own private entries (group posts belong to the group).
func (s *DayService) journal(ctx context.Context, userID uuid.UUID, start, end time.Time) ([]models.DayJournalEntry, error) {
	rows, err := s.db.Query(ctx, `
		SELECT id, title, left(body, $4), mood, COALESCE(tags, '{}'::text[]), created_at
		FROM journal_entries
		WHERE user_id = $1 AND group_id IS NULL AND created_at >= $2 AND created_at < $3
		ORDER BY created_at`, userID, start, end, dayExcerptRunes)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.DayJournalEntry{}
	for rows.Next() {
		var e models.DayJournalEntry
		if err := rows.Scan(&e.ID, &e.Title, &e.Excerpt, &e.Mood, &e.Tags, &e.CreatedAt); err != nil {
			return nil, err
		}
		if e.Tags == nil {
			e.Tags = []string{}
		}
		out = append(out, e)
	}
	return out, rows.Err()
}

// ledger lists that day's transactions; a transfer is listed once, by its source leg.
func (s *DayService) ledger(ctx context.Context, userID uuid.UUID, date string, dst *models.DayLedger) error {
	rows, err := s.db.Query(ctx, `
		SELECT t.id, t.type, t.amount::float8, t.description, t.account_id, a.name, a.currency,
		       ta.name, t.category_id, c.name, c.color
		FROM ledger_transactions t
		JOIN ledger_accounts a ON a.id = t.account_id
		LEFT JOIN ledger_accounts ta ON ta.id = t.transfer_to_account_id AND ta.user_id = t.user_id
		LEFT JOIN ledger_categories c ON c.id = t.category_id
		WHERE t.user_id = $1 AND t.date = $2::date
		  AND NOT (t.type = 'transfer' AND t.amount > 0)
		ORDER BY t.created_at, t.id`, userID, date)
	if err != nil {
		return err
	}
	defer rows.Close()
	dst.Transactions = []models.DayTransaction{}
	for rows.Next() {
		var t models.DayTransaction
		if err := rows.Scan(&t.ID, &t.Type, &t.Amount, &t.Description, &t.AccountID, &t.AccountName, &t.Currency,
			&t.TransferToAccountName, &t.CategoryID, &t.CategoryName, &t.CategoryColor); err != nil {
			return err
		}
		switch t.Type {
		case "expense":
			dst.Spent += math.Abs(t.Amount)
		case "income":
			dst.Income += math.Abs(t.Amount)
		}
		dst.Transactions = append(dst.Transactions, t)
	}
	// Summing float64 cents drifts (0.1+0.2); amounts are NUMERIC(15,2).
	dst.Spent = math.Round(dst.Spent*100) / 100
	dst.Income = math.Round(dst.Income*100) / 100
	return rows.Err()
}
