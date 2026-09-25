package services

import (
	"crypto/sha256"
	"encoding/hex"
	"testing"
	"time"
)

func TestNewInviteTokenIsRandomAndStoredHashed(t *testing.T) {
	raw1, hash1, err := newInviteToken()
	if err != nil {
		t.Fatal(err)
	}
	raw2, _, err := newInviteToken()
	if err != nil {
		t.Fatal(err)
	}
	if len(raw1) != 64 {
		t.Errorf("token length = %d, want 64 hex chars (256 bits)", len(raw1))
	}
	if _, err := hex.DecodeString(raw1); err != nil {
		t.Errorf("token %q is not hex: %v", raw1, err)
	}
	if raw1 == raw2 {
		t.Error("two tokens were equal")
	}
	if hash1 == raw1 {
		t.Error("stored hash is the raw token")
	}
	sum := sha256.Sum256([]byte(raw1))
	if want := hex.EncodeToString(sum[:]); hash1 != want {
		t.Errorf("hash = %q, want hex SHA-256 %q", hash1, want)
	}
	if hashInviteToken(raw1) != hash1 {
		t.Error("hashInviteToken does not reproduce the stored hash")
	}
	if hashInviteToken(raw2) == hash1 {
		t.Error("different tokens hashed the same")
	}
}

func TestInviteLinkUsable(t *testing.T) {
	now := time.Date(2026, 9, 25, 12, 0, 0, 0, time.UTC)
	revoked := now.Add(-time.Minute)
	for _, tc := range []struct {
		name      string
		expiresAt time.Time
		revokedAt *time.Time
		want      bool
	}{
		{"fresh", now.Add(InviteLinkTTL), nil, true},
		{"one second left", now.Add(time.Second), nil, true},
		{"expires exactly now", now, nil, false},
		{"expired", now.Add(-time.Hour), nil, false},
		{"revoked before expiry", now.Add(time.Hour), &revoked, false},
		{"revoked and expired", now.Add(-time.Hour), &revoked, false},
	} {
		if got := inviteLinkUsable(tc.expiresAt, tc.revokedAt, now); got != tc.want {
			t.Errorf("%s: usable = %v, want %v", tc.name, got, tc.want)
		}
	}
}

func TestInviteLinkTTLIsSevenDays(t *testing.T) {
	if InviteLinkTTL != 7*24*time.Hour {
		t.Errorf("InviteLinkTTL = %v; the UI says links last 7 days", InviteLinkTTL)
	}
}

func TestEmailsMatch(t *testing.T) {
	if !emailsMatch(" A@Example.com", "a@example.com ") {
		t.Error("case and surrounding space should not matter")
	}
	if emailsMatch("a@example.com", "b@example.com") {
		t.Error("different addresses matched")
	}
}
