package services

import "testing"

func TestEscapeLike(t *testing.T) {
	cases := map[string]string{
		`bench`:    `bench`,
		`50%`:      `50\%`,
		`snake_ca`: `snake\_ca`,
		`\`:        `\\`,
		`\%`:       `\\\%`,
		`a\_b%`:    `a\\\_b\%`,
	}
	for in, want := range cases {
		if got := escapeLike(in); got != want {
			t.Errorf("escapeLike(%q) = %q, want %q", in, got, want)
		}
	}
}
