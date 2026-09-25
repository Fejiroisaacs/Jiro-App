package services

import (
	"errors"
	"testing"
	"time"

	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/models"
	"github.com/google/uuid"
)

func day(s string) time.Time {
	d, err := time.Parse(dayLayout, s)
	if err != nil {
		panic(err)
	}
	return d
}

func fmtDays(ds []time.Time) []string {
	out := make([]string, len(ds))
	for i, d := range ds {
		out[i] = d.Format(dayLayout)
	}
	return out
}

func equalStrings(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

// ── Recurring date generation ────────────────────────────────────────────────

func TestAdvanceRecurrence(t *testing.T) {
	cases := []struct {
		name     string
		from     string
		interval string
		anchor   int
		want     string
	}{
		{"weekly", "2026-09-25", "weekly", 25, "2026-10-02"},
		{"biweekly across a month", "2026-09-25", "biweekly", 25, "2026-10-09"},
		{"monthly plain", "2026-09-15", "monthly", 15, "2026-10-15"},
		{"monthly 31st into 30-day month", "2026-08-31", "monthly", 31, "2026-09-30"},
		{"monthly 31st into February", "2026-01-31", "monthly", 31, "2026-02-28"},
		{"monthly 31st into leap February", "2028-01-31", "monthly", 31, "2028-02-29"},
		{"monthly back to the anchor after a short month", "2026-02-28", "monthly", 31, "2026-03-31"},
		{"monthly 30th after February", "2026-02-28", "monthly", 30, "2026-03-30"},
		{"monthly across the year", "2026-12-31", "monthly", 31, "2027-01-31"},
		{"yearly", "2026-03-10", "yearly", 10, "2027-03-10"},
		{"yearly leap day to a common year", "2028-02-29", "yearly", 29, "2029-02-28"},
		{"yearly back to a leap day", "2031-02-28", "yearly", 29, "2032-02-29"},
		{"anchor out of range is clamped", "2026-01-10", "monthly", 45, "2026-02-28"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got := advanceRecurrence(day(c.from), c.interval, c.anchor).Format(dayLayout)
			if got != c.want {
				t.Errorf("advanceRecurrence(%s, %s, %d) = %s, want %s", c.from, c.interval, c.anchor, got, c.want)
			}
		})
	}
}

func TestMonthlyNeverDrifts(t *testing.T) {
	// Anchored on the 31st: the short months take their last day, and the
	// long months get the 31st back.
	want := []string{"2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30", "2026-05-31", "2026-06-30", "2026-07-31"}
	d := day(want[0])
	got := []string{d.Format(dayLayout)}
	for len(got) < len(want) {
		d = advanceRecurrence(d, "monthly", 31)
		got = append(got, d.Format(dayLayout))
	}
	if !equalStrings(got, want) {
		t.Errorf("monthly on the 31st = %v, want %v", got, want)
	}
}

func TestDueOccurrencesCatchUp(t *testing.T) {
	cases := []struct {
		name     string
		next     string
		today    string
		interval string
		anchor   int
		limit    int
		wantDue  []string
		wantNext string
	}{
		{"nothing due yet", "2026-10-01", "2026-09-25", "monthly", 1, 100, nil, "2026-10-01"},
		{"due today", "2026-09-25", "2026-09-25", "monthly", 25, 100, []string{"2026-09-25"}, "2026-10-25"},
		{"three missed months", "2026-06-30", "2026-09-29", "monthly", 30,
			100, []string{"2026-06-30", "2026-07-30", "2026-08-30"}, "2026-09-30"},
		{"month ends while catching up", "2026-01-31", "2026-04-30", "monthly", 31, 100,
			[]string{"2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"}, "2026-05-31"},
		{"weekly up to today inclusive", "2026-09-04", "2026-09-25", "weekly", 4, 100,
			[]string{"2026-09-04", "2026-09-11", "2026-09-18", "2026-09-25"}, "2026-10-02"},
		{"capped, rest on the next visit", "2026-01-01", "2026-12-31", "weekly", 1, 3,
			[]string{"2026-01-01", "2026-01-08", "2026-01-15"}, "2026-01-22"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			due, next := dueOccurrences(day(c.next), day(c.today), c.interval, c.anchor, c.limit)
			if !equalStrings(fmtDays(due), c.wantDue) && !(len(due) == 0 && len(c.wantDue) == 0) {
				t.Errorf("due = %v, want %v", fmtDays(due), c.wantDue)
			}
			if got := next.Format(dayLayout); got != c.wantNext {
				t.Errorf("next = %s, want %s", got, c.wantNext)
			}
		})
	}
}

// Running the catch-up again with the next date it returned finds nothing:
// the sequence is idempotent at the date level (the database adds the row
// lock and the unique index on top).
func TestDueOccurrencesIdempotent(t *testing.T) {
	today := day("2026-09-25")
	first, next := dueOccurrences(day("2026-05-31"), today, "monthly", 31, maxCatchUpPerSeries)
	if len(first) != 4 {
		t.Fatalf("first pass wrote %v, want four dates", fmtDays(first))
	}
	again, next2 := dueOccurrences(next, today, "monthly", 31, maxCatchUpPerSeries)
	if len(again) != 0 {
		t.Errorf("second pass wrote %v, want nothing", fmtDays(again))
	}
	if !next2.Equal(next) {
		t.Errorf("second pass moved next from %s to %s", next.Format(dayLayout), next2.Format(dayLayout))
	}
	// A capped pass followed by another covers the same dates exactly once.
	a, n := dueOccurrences(day("2026-05-31"), today, "monthly", 31, 2)
	b, _ := dueOccurrences(n, today, "monthly", 31, maxCatchUpPerSeries)
	if got := fmtDays(append(a, b...)); !equalStrings(got, fmtDays(first)) {
		t.Errorf("two capped passes = %v, want %v", got, fmtDays(first))
	}
}

func TestNewRecurrence(t *testing.T) {
	cases := []struct {
		name     string
		start    string
		interval string
		lastCopy string
		want     string
	}{
		{"first copy after the start", "2026-09-10", "monthly", "", "2026-10-10"},
		{"start in the past still begins right after it", "2026-06-15", "monthly", "", "2026-07-15"},
		{"re-armed after copies already written", "2026-06-15", "monthly", "2026-08-15", "2026-09-15"},
		{"end of month start", "2026-01-31", "monthly", "", "2026-02-28"},
		{"biweekly", "2026-09-11", "biweekly", "", "2026-09-25"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			var last time.Time
			if c.lastCopy != "" {
				last = day(c.lastCopy)
			}
			r := newRecurrence(day(c.start), c.interval, last)
			if !r.on || r.next == nil || r.interval == nil || *r.interval != c.interval {
				t.Fatalf("newRecurrence = %+v, want an armed %s series", r, c.interval)
			}
			if got := r.next.Format(dayLayout); got != c.want {
				t.Errorf("next = %s, want %s", got, c.want)
			}
			if *r.day != day(c.start).Day() {
				t.Errorf("anchor = %d, want the start's day %d", *r.day, day(c.start).Day())
			}
		})
	}
}

func TestValidRecurrenceInterval(t *testing.T) {
	for _, ok := range []string{"weekly", "biweekly", "monthly", "yearly"} {
		if !ValidRecurrenceInterval(ok) {
			t.Errorf("%q should be valid", ok)
		}
	}
	for _, bad := range []string{"", "daily", "Monthly"} {
		if ValidRecurrenceInterval(bad) {
			t.Errorf("%q should be invalid", bad)
		}
	}
}

// ── Compare maths ────────────────────────────────────────────────────────────

func pct(v float64) *float64 { return &v }

func TestCompareValues(t *testing.T) {
	cases := []struct {
		name      string
		a, b      float64
		wantDelta float64
		wantPct   *float64
	}{
		{"higher now", 100, 150, 50, pct(50)},
		{"lower now", 200, 150, -50, pct(-25)},
		{"no change", 80, 80, 0, pct(0)},
		{"new: nothing before", 0, 120, 120, nil},
		{"both zero", 0, 0, 0, nil},
		{"negative base uses its size", -200, -100, 100, pct(50)},
		{"float noise is rounded to cents", 0.1 + 0.2, 0.6, 0.3, pct(100)},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			v := compareValues(c.a, c.b)
			if v.Delta != c.wantDelta {
				t.Errorf("delta = %v, want %v", v.Delta, c.wantDelta)
			}
			switch {
			case c.wantPct == nil && v.DeltaPct != nil:
				t.Errorf("delta_pct = %v, want nil (no base)", *v.DeltaPct)
			case c.wantPct != nil && v.DeltaPct == nil:
				t.Errorf("delta_pct = nil, want %v", *c.wantPct)
			case c.wantPct != nil && *v.DeltaPct != *c.wantPct:
				t.Errorf("delta_pct = %v, want %v", *v.DeltaPct, *c.wantPct)
			}
		})
	}
}

func TestBuildComparison(t *testing.T) {
	food := uuid.New()
	rent := uuid.New()
	salary := uuid.New()
	rows := []comparisonRow{
		{categoryID: &food, name: "Food", txType: "expense", a: 300, b: 420},
		{categoryID: &rent, name: "Rent", txType: "expense", a: 1650, b: 1650},
		{categoryID: &salary, name: "Salary", txType: "income", a: 4000, b: 4369.24},
		{categoryID: nil, name: "Uncategorised", txType: "expense", a: 0, b: 25},
	}
	summary, cats := buildComparison(rows)

	if summary.Income.A != 4000 || summary.Income.B != 4369.24 || summary.Income.Delta != 369.24 {
		t.Errorf("income = %+v", summary.Income)
	}
	if summary.Expenses.A != 1950 || summary.Expenses.B != 2095 || summary.Expenses.Delta != 145 {
		t.Errorf("expenses = %+v", summary.Expenses)
	}
	// Net: 2050 before, 2274.24 now: up 224.24.
	if summary.Net.A != 2050 || summary.Net.B != 2274.24 || summary.Net.Delta != 224.24 {
		t.Errorf("net = %+v", summary.Net)
	}

	gotOrder := []string{}
	for _, c := range cats {
		gotOrder = append(gotOrder, c.Name)
	}
	wantOrder := []string{"Salary", "Food", "Uncategorised", "Rent"}
	if !equalStrings(gotOrder, wantOrder) {
		t.Errorf("order = %v, want %v (largest change first)", gotOrder, wantOrder)
	}
	for _, c := range cats {
		if c.Name == "Uncategorised" {
			if c.DeltaPct != nil {
				t.Errorf("uncategorised from zero: delta_pct = %v, want nil (new)", *c.DeltaPct)
			}
			if c.CategoryID != nil {
				t.Errorf("uncategorised has a category id")
			}
		}
	}
}

// ── Category delete rule ─────────────────────────────────────────────────────

func TestCheckCategoryMove(t *testing.T) {
	groceries := models.LedgerCategory{ID: uuid.New(), Name: "Groceries", Type: "expense"}
	dining := models.LedgerCategory{ID: uuid.New(), Name: "Dining", Type: "expense"}
	salary := models.LedgerCategory{ID: uuid.New(), Name: "Salary", Type: "income"}

	if err := checkCategoryMove(groceries, nil); err != nil {
		t.Errorf("uncategorise: %v, want allowed", err)
	}
	if err := checkCategoryMove(groceries, &dining); err != nil {
		t.Errorf("move to same type: %v, want allowed", err)
	}
	if err := checkCategoryMove(groceries, &groceries); !errors.Is(err, ErrLedgerInvalid) {
		t.Errorf("move to itself: %v, want ErrLedgerInvalid", err)
	}
	if err := checkCategoryMove(groceries, &salary); !errors.Is(err, ErrLedgerInvalid) {
		t.Errorf("expense to income: %v, want ErrLedgerInvalid", err)
	}
}

func TestPickCategoryColor(t *testing.T) {
	if got := pickCategoryColor(nil); got != categoryPalette[0] {
		t.Errorf("first colour = %s, want %s", got, categoryPalette[0])
	}
	// The defaults use the whole palette but for one: the free one is picked,
	// matched case-insensitively.
	used := []string{}
	for _, c := range categoryPalette {
		if c != "#4DB6AC" {
			used = append(used, c)
		}
	}
	used[0] = "#8d6e63"
	if got := pickCategoryColor(used); got != "#4DB6AC" {
		t.Errorf("free colour = %s, want #4DB6AC", got)
	}
	// All taken: the palette in turn, still a palette colour.
	all := append([]string{}, categoryPalette...)
	got := pickCategoryColor(all)
	found := false
	for _, c := range categoryPalette {
		found = found || c == got
	}
	if !found {
		t.Errorf("all taken gave %s, not a palette colour", got)
	}
}

func TestNormaliseColor(t *testing.T) {
	if got, err := normaliseColor(" #64b5f6 "); err != nil || got != "#64B5F6" {
		t.Errorf("normaliseColor = %q, %v", got, err)
	}
	for _, bad := range []string{"", "red", "#fff", "64B5F6", "#64B5F6AA"} {
		if _, err := normaliseColor(bad); !errors.Is(err, ErrLedgerInvalid) {
			t.Errorf("normaliseColor(%q) = %v, want ErrLedgerInvalid", bad, err)
		}
	}
}

func TestBuildCategoryTreeKeepsOrder(t *testing.T) {
	a := models.LedgerCategory{ID: uuid.New(), Name: "Food", Type: "expense"}
	b := models.LedgerCategory{ID: uuid.New(), Name: "Housing", Type: "expense"}
	child := models.LedgerCategory{ID: uuid.New(), Name: "Groceries", Type: "expense", ParentID: &a.ID}
	orphanParent := uuid.New()
	orphan := models.LedgerCategory{ID: uuid.New(), Name: "Lost", Type: "expense", ParentID: &orphanParent}
	c := models.LedgerCategory{ID: uuid.New(), Name: "Salary", Type: "income"}

	for i := 0; i < 20; i++ { // map iteration order must not leak into the result
		tree := buildCategoryTree([]models.LedgerCategory{a, child, b, orphan, c})
		names := []string{}
		for _, n := range tree {
			names = append(names, n.Name)
		}
		if !equalStrings(names, []string{"Food", "Housing", "Salary", "Lost"}) {
			t.Fatalf("roots = %v", names)
		}
		if len(tree[0].Children) != 1 || tree[0].Children[0].Name != "Groceries" {
			t.Fatalf("children of Food = %+v", tree[0].Children)
		}
	}
}
