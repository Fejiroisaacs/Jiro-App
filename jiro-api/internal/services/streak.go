package services

import "time"

// dayStreaks takes distinct calendar days in the user's location, newest
// first ("2006-01-02", optionally with a time suffix), and returns the current
// streak (the run of consecutive days ending today or yesterday, else 0) and
// the longest run. now must already be in that location (now.In(loc)): its
// calendar date is "today", so a user east or west of UTC keeps their streak
// on their own day. Shared by the journal and cook streaks so they count days
// the same way.
func dayStreaks(days []string, now time.Time) (current, longest int) {
	if len(days) == 0 {
		return 0, 0
	}
	parse := func(s string) time.Time {
		t, _ := time.Parse("2006-01-02", s[:10])
		return t
	}
	ty, tm, td := now.Date()
	today := time.Date(ty, tm, td, 0, 0, 0, 0, time.UTC)

	// Current streak: count consecutive days starting from today or yesterday.
	for i, ds := range days {
		d := parse(ds)
		if d.Equal(today.AddDate(0, 0, -i)) {
			current++
		} else if i == 0 && d.Equal(today.AddDate(0, 0, -1)) {
			// Latest day was yesterday: the streak is still alive, count from there.
			current = 1
			today = today.AddDate(0, 0, -1)
		} else {
			break
		}
	}

	longest = 1
	run := 1
	for i := 1; i < len(days); i++ {
		if parse(days[i-1]).Sub(parse(days[i])) == 24*time.Hour {
			run++
			if run > longest {
				longest = run
			}
		} else {
			run = 1
		}
	}
	if current > longest {
		longest = current
	}
	return current, longest
}
