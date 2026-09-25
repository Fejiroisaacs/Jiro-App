package services

import (
	"strings"
	"testing"

	"github.com/google/uuid"
)

func TestJournalEntryFilter(t *testing.T) {
	uid := uuid.New()

	t.Run("no filters", func(t *testing.T) {
		where, args, next := journalEntryFilter(uid, "", "", "", "", "")
		if where != `WHERE e.user_id = $1 AND e.group_id IS NULL` {
			t.Errorf("where = %q", where)
		}
		if len(args) != 1 || args[0] != uid {
			t.Errorf("args = %v", args)
		}
		if next != 2 {
			t.Errorf("next = %d, want 2", next)
		}
	})

	t.Run("all filters number placeholders in order", func(t *testing.T) {
		where, args, next := journalEntryFilter(uid, "good", "work", "plan", "2026-01-01", "2026-12-31")
		for _, frag := range []string{
			`e.mood = $2`,
			`EXISTS (SELECT 1 FROM unnest(e.tags) AS t(tag) WHERE t.tag ILIKE $3)`,
			`(e.title ILIKE $4 OR e.body ILIKE $4)`,
			`e.created_at >= $5`,
			`e.created_at <= $6`,
		} {
			if !strings.Contains(where, frag) {
				t.Errorf("where %q missing %q", where, frag)
			}
		}
		if len(args) != 6 || next != 7 {
			t.Errorf("len(args) = %d, next = %d; want 6, 7", len(args), next)
		}
	})

	t.Run("q is escaped so wildcards match literally", func(t *testing.T) {
		_, args, _ := journalEntryFilter(uid, "", "", `50%_off\`, "", "")
		if got, want := args[1], `%50\%\_off\\%`; got != want {
			t.Errorf("q arg = %q, want %q", got, want)
		}
	})

	t.Run("tag matches as a case-insensitive literal prefix", func(t *testing.T) {
		where, args, _ := journalEntryFilter(uid, "", "Train", "", "", "")
		if !strings.Contains(where, "ILIKE $2") {
			t.Errorf("where %q should match the tag with ILIKE", where)
		}
		if got, want := args[1], "Train%"; got != want {
			t.Errorf("tag arg = %q, want %q", got, want)
		}
	})
}

func TestTagPrefixPattern(t *testing.T) {
	for _, tc := range []struct{ in, want string }{
		{"train", "train%"},
		{"  Train ", "Train%"},
		{"#run", "run%"},
		{"50%_", `50\%\_%`},
	} {
		if got := tagPrefixPattern(tc.in); got != tc.want {
			t.Errorf("tagPrefixPattern(%q) = %q, want %q", tc.in, got, tc.want)
		}
	}
}
