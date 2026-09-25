package models

import (
	"time"

	"github.com/google/uuid"
)

// DayResponse is everything the user logged on one of their own calendar
// days, across all four modules. Every list is always present (empty, never
// null) so the client can render each section without guarding.
type DayResponse struct {
	// Date is the calendar day, YYYY-MM-DD, in Timezone.
	Date string `json:"date"`
	// Timezone is the IANA zone the day was cut in: the user's setting; when
	// that is missing or unknown, the request's tz hint; else "UTC".
	Timezone string      `json:"timezone"`
	IsToday  bool        `json:"is_today"`
	Jym      DayJym      `json:"jym"`
	Culinara DayCulinara `json:"culinara"`
	Journal  DayJournal  `json:"journal"`
	Ledger   DayLedger   `json:"ledger"`
}

type DayJym struct {
	// Sessions started in the day, oldest first. Same shape as GET /jym/sessions.
	Sessions []SessionSummary `json:"sessions"`
	// BodyWeight is that day's weigh-in, or null.
	BodyWeight *DayBodyWeight `json:"body_weight"`
	// WeightUnit is the user's display unit ("lbs" or "kg"); weights stay in kg.
	WeightUnit string `json:"weight_unit"`
}

type DayBodyWeight struct {
	ID       uuid.UUID `json:"id"`
	WeightKg float64   `json:"weight_kg"`
}

type DayCulinara struct {
	Cooked  []DayCooked  `json:"cooked"`
	Planned []DayPlanned `json:"planned"`
}

// DayCooked is one trial whose date_cooked falls in the day.
type DayCooked struct {
	TrialID     uuid.UUID `json:"trial_id"`
	RecipeID    uuid.UUID `json:"recipe_id"`
	RecipeTitle string    `json:"recipe_title"`
	Rating      *int      `json:"rating"`
	Notes       *string   `json:"notes"`
	DateCooked  time.Time `json:"date_cooked"`
}

// DayPlanned is one meal plan entry for the day's weekday in its week.
type DayPlanned struct {
	ID          uuid.UUID  `json:"id"`
	MealSlot    string     `json:"meal_slot"`
	RecipeID    *uuid.UUID `json:"recipe_id"`
	RecipeTitle *string    `json:"recipe_title"`
	CustomLabel *string    `json:"custom_label"`
}

type DayJournal struct {
	Entries []DayJournalEntry `json:"entries"`
}

type DayJournalEntry struct {
	ID        uuid.UUID `json:"id"`
	Title     *string   `json:"title"`
	Excerpt   string    `json:"excerpt"`
	Mood      *string   `json:"mood"`
	Tags      []string  `json:"tags"`
	CreatedAt time.Time `json:"created_at"`
}

type DayLedger struct {
	Transactions []DayTransaction `json:"transactions"`
	// Spent is the sum of expenses (positive); Income the sum of income.
	// Transfers count toward neither.
	Spent  float64 `json:"spent"`
	Income float64 `json:"income"`
}

// DayTransaction is one transaction dated that day. Amount carries its
// stored sign (expenses negative). A transfer is listed once, by its
// outgoing leg.
type DayTransaction struct {
	ID                    uuid.UUID  `json:"id"`
	Type                  string     `json:"type"`
	Amount                float64    `json:"amount"`
	Description           string     `json:"description"`
	AccountID             uuid.UUID  `json:"account_id"`
	AccountName           string     `json:"account_name"`
	Currency              string     `json:"currency"`
	TransferToAccountName *string    `json:"transfer_to_account_name"`
	CategoryID            *uuid.UUID `json:"category_id"`
	CategoryName          *string    `json:"category_name"`
	CategoryColor         *string    `json:"category_color"`
}
