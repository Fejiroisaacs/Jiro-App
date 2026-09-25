package services

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// A recurring series is its head row; due copies are written lazily when the user opens Ledger.

// ErrInvalidRecurrence: an unknown interval, or a copy asked to repeat itself.
var ErrInvalidRecurrence = errors.New("invalid recurrence")

// maxCatchUpPerSeries bounds one catch-up pass; the rest is written on the next visit.
const maxCatchUpPerSeries = 400

var recurrenceIntervals = map[string]bool{"weekly": true, "biweekly": true, "monthly": true, "yearly": true}

// ValidRecurrenceInterval reports whether s is one of the "Repeat every" choices.
func ValidRecurrenceInterval(s string) bool { return recurrenceIntervals[s] }

// daysIn is the number of days in year-month.
func daysIn(year int, month time.Month) int {
	return time.Date(year, month+1, 0, 0, 0, 0, 0, time.UTC).Day()
}

// clampAnchor keeps an anchor day inside 1..31.
func clampAnchor(anchor int) int {
	if anchor < 1 {
		return 1
	}
	if anchor > 31 {
		return 31
	}
	return anchor
}

// advanceRecurrence is the scheduled date after d; monthly and yearly clamp to the anchor day.
func advanceRecurrence(d time.Time, interval string, anchor int) time.Time {
	switch interval {
	case "weekly":
		return d.AddDate(0, 0, 7)
	case "biweekly":
		return d.AddDate(0, 0, 14)
	}
	months := 1
	if interval == "yearly" {
		months = 12
	}
	first := time.Date(d.Year(), d.Month()+time.Month(months), 1, 0, 0, 0, 0, time.UTC)
	day := clampAnchor(anchor)
	if dim := daysIn(first.Year(), first.Month()); day > dim {
		day = dim
	}
	return time.Date(first.Year(), first.Month(), day, 0, 0, 0, 0, time.UTC)
}

// nextOccurrenceAfter is the first scheduled date strictly after `after`.
func nextOccurrenceAfter(start time.Time, interval string, anchor int, after time.Time) time.Time {
	d := advanceRecurrence(start, interval, anchor)
	for !d.After(after) {
		d = advanceRecurrence(d, interval, anchor)
	}
	return d
}

// dueOccurrences lists due dates from next through today (at most limit) and the next date after.
func dueOccurrences(next, today time.Time, interval string, anchor, limit int) ([]time.Time, time.Time) {
	var due []time.Time
	for !next.After(today) && len(due) < limit {
		due = append(due, next)
		next = advanceRecurrence(next, interval, anchor)
	}
	return due, next
}

// dateOnly drops the clock and zone from a DATE column value.
func dateOnly(t time.Time) time.Time {
	y, m, d := t.Date()
	return time.Date(y, m, d, 0, 0, 0, 0, time.UTC)
}

type recurringHead struct {
	id          uuid.UUID
	accountID   uuid.UUID
	categoryID  *uuid.UUID
	txType      string
	amount      float64
	description string
	notes       *string
	date        time.Time
	interval    string
	day         *int
	transferTo  *uuid.UUID
	next        time.Time
}

// CatchUpRecurring writes every occurrence due by the user's today and returns the count; never for the demo.
// Safe concurrently: due heads are locked FOR UPDATE, backed by the unique (recurrence_source_id, date) index.
func (s *LedgerService) CatchUpRecurring(ctx context.Context, userID uuid.UUID, tzHint string, now time.Time) (int, error) {
	var isDemo bool
	var tzName *string
	if err := s.db.QueryRow(ctx,
		`SELECT is_demo, settings->>'timezone' FROM users WHERE id = $1`, userID,
	).Scan(&isDemo, &tzName); err != nil {
		return 0, fmt.Errorf("load user: %w", err)
	}
	if isDemo {
		return 0, nil
	}
	loc, _ := PickLocation(deref(tzName), tzHint)
	today := calendarToday(now, loc)

	// Cheap check first, so an ordinary page load opens no transaction.
	var anyDue bool
	if err := s.db.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM ledger_transactions
		  WHERE user_id = $1 AND is_recurring AND recurrence_next_date <= $2)`,
		userID, today,
	).Scan(&anyDue); err != nil || !anyDue {
		return 0, err
	}

	tx, err := s.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return 0, err
	}
	defer tx.Rollback(ctx)

	rows, err := tx.Query(ctx,
		`SELECT id, account_id, category_id, type, amount::float8, description, notes, date,
		        recurrence_interval, recurrence_day, transfer_to_account_id, recurrence_next_date
		 FROM ledger_transactions
		 WHERE user_id = $1 AND is_recurring
		   AND recurrence_next_date IS NOT NULL AND recurrence_next_date <= $2
		   AND NOT (type = 'transfer' AND amount > 0)
		 ORDER BY recurrence_next_date, id
		 FOR UPDATE`,
		userID, today)
	if err != nil {
		return 0, err
	}
	var heads []recurringHead
	for rows.Next() {
		var h recurringHead
		var interval *string
		if err := rows.Scan(&h.id, &h.accountID, &h.categoryID, &h.txType, &h.amount, &h.description,
			&h.notes, &h.date, &interval, &h.day, &h.transferTo, &h.next); err != nil {
			rows.Close()
			return 0, err
		}
		h.interval = deref(interval)
		h.date, h.next = dateOnly(h.date), dateOnly(h.next)
		heads = append(heads, h)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return 0, err
	}

	written := 0
	for _, h := range heads {
		// A series that can no longer be written (unknown interval, deleted transfer target) stops.
		if !ValidRecurrenceInterval(h.interval) || (h.txType == "transfer" && h.transferTo == nil) {
			if _, err := tx.Exec(ctx,
				`UPDATE ledger_transactions SET is_recurring = FALSE, recurrence_next_date = NULL, updated_at = NOW() WHERE id = $1`,
				h.id); err != nil {
				return 0, err
			}
			continue
		}
		anchor := h.date.Day()
		if h.day != nil {
			anchor = *h.day
		}
		dates, next := dueOccurrences(h.next, today, h.interval, anchor, maxCatchUpPerSeries)
		for _, d := range dates {
			n, err := writeOccurrence(ctx, tx, userID, h, d)
			if err != nil {
				return 0, fmt.Errorf("series %s on %s: %w", h.id, d.Format(dayLayout), err)
			}
			written += n
		}
		if _, err := tx.Exec(ctx,
			`UPDATE ledger_transactions SET recurrence_next_date = $2 WHERE id = $1`, h.id, next,
		); err != nil {
			return 0, err
		}
	}
	return written, tx.Commit(ctx)
}

// writeOccurrence writes one copy of the head on d and moves balances unless it exists; returns 1 if written.
func writeOccurrence(ctx context.Context, tx pgx.Tx, userID uuid.UUID, h recurringHead, d time.Time) (int, error) {
	var id uuid.UUID
	err := tx.QueryRow(ctx,
		`INSERT INTO ledger_transactions
		   (user_id, account_id, category_id, type, amount, description, notes, date,
		    is_recurring, transfer_to_account_id, recurrence_source_id)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,FALSE,$9,$10)
		 ON CONFLICT (recurrence_source_id, date)
		   WHERE recurrence_source_id IS NOT NULL AND NOT (type = 'transfer' AND amount > 0)
		   DO NOTHING
		 RETURNING id`,
		userID, h.accountID, h.categoryID, h.txType, h.amount, h.description, h.notes, d,
		h.transferTo, h.id,
	).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, nil // already written
	}
	if err != nil {
		return 0, err
	}
	if _, err := tx.Exec(ctx,
		`UPDATE ledger_accounts SET balance = balance + $1, updated_at = NOW() WHERE id = $2 AND user_id = $3`,
		h.amount, h.accountID, userID); err != nil {
		return 0, err
	}
	if h.txType == "transfer" {
		if _, err := tx.Exec(ctx,
			`INSERT INTO ledger_transactions
			   (user_id, account_id, type, amount, description, notes, date,
			    is_recurring, transfer_to_account_id, recurrence_source_id)
			 VALUES ($1,$2,'transfer',$3,$4,$5,$6,FALSE,$7,$8)`,
			userID, *h.transferTo, -h.amount, h.description, h.notes, d, h.accountID, h.id); err != nil {
			return 0, err
		}
		if _, err := tx.Exec(ctx,
			`UPDATE ledger_accounts SET balance = balance + $1, updated_at = NOW() WHERE id = $2 AND user_id = $3`,
			-h.amount, *h.transferTo, userID); err != nil {
			return 0, err
		}
	}
	return 1, nil
}
