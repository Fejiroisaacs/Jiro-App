# Jiro UI redesign: Phase 0 + Phase 1

Plan: `~/.claude/plans/jaunty-rolling-dream.md`. Audit: `docs/UI-AUDIT-2026-09.md`.

## Phase 0: bugs

- [x] 0.1 Ledger dates: `parseDateOnly` in ledger-utils; transaction-log, networth-page use it
- [x] 0.2 Ledger amounts: `formatSignedCurrency`; hub, accounts, transaction-log use it
- [x] 0.3 Ten undefined CSS variables defined; `scripts/check-css-vars.mjs` + `npm run check:css`
- [x] 0.4 Copy: "foucus", "Light weight baby", login subtitle
- [x] 0.5 404 page (`features/not-found`) wired to `**`
- [x] 0.6 Delete `app.html`, `desktop.ini` x2

## Phase 1: design system foundation

- [x] 1.1 Tokens + hardened palette (radius, type, z-index, semantic, rgb triplets, mark tokens; styles.scss literals)
- [x] 1.2 Three themes with brand-derived dark; THEMES narrowing; effect moved to App; pre-boot dark script; theme-color meta; white-on-primary literals
- [x] 1.3 Global focus-visible (+ sidebar and field exceptions); removed 51 `outline: none`; reduced-motion block; landing gates
- [x] 1.4 `@phosphor-icons/core`, `scripts/build-icons.mjs`, `jiro-icon`, `jiro-mark`; tiles in main-layout/dashboard/guide; modal close + star-rating
- [x] 1.5 `jiro-button`: `--jiro-btn-width`, `block`, `size`; removed all 65 `::ng-deep` rules; `block` on auth, journal-join, journal-group, split-list
- [x] 1.6 Toast service + `jiro-toaster`; confirm service + `jiro-confirm`; migrated 3 toasts + 4 native confirms
- [x] 1.7 `jiro-page-header`, `jiro-empty-state`, global `.spinner`; guide + settings use the header
- [x] 1.8 check-css-vars hex report; deleted 3 unreferenced icon SVGs

## Verification

- [x] `npm run check:css`: 76 referenced variables, 0 undefined
- [x] `npx ng build --configuration production`: 406.6 kB initial, under the 500 kB budget
- [x] Playwright desktop: ledger hub "Sep 12 / -$86.42 / +$3,150.00"; transactions 0 x "Invalid Date"; 404 renders; focus ring visible (cream on sidebar); dark toggle sets html.dark and theme-color #1A1310; forest and slate light+dark; toast "Settings saved"; confirm dialog focuses Cancel and closes on Escape; /admin themed; /login dark with dark on; reduced-motion disables tilt and normal motion keeps it
- [x] Playwright mobile: dashboard, jym, ledger, culinara light; dashboard, session player, transactions dark
- [x] Contrast script: every body-text pair >= 4.5:1 in all six palettes after the three fixes
- [x] `git diff --stat`: routes unchanged except `**`, no nav label or field-name changes

## Review

**Delivered.** 5 Phase 0 commits + 1 Phase 1 commit on `New-Features`, not pushed.

**Numbers moved.** `::ng-deep` 65 -> 0. `outline: none` 51 -> 0. Undefined CSS variables 10 -> 0. Themes 11 -> 3. Raw hex in components 204 -> 196 (Phase 3 target: 0). `window.confirm` 4 -> 0. Hand-rolled toasts 3 -> 0.

**Deviations from the plan.**
- Phase 1 landed as one commit, not one per sub-area: the outline sweep and the button sweep touched the same 30 files as the token and toast work, so per-area staging would have needed hunk-level splitting.
- `jiro-skeleton` deferred to Phase 3 with its first consumer (plan review correction).
- NotFound keeps its own centred layout rather than `jiro-page-header`; `guide.ts` took the header instead.
- The three mobile-only "shrink the button" overrides were deleted rather than converted; buttons keep their 40px minimum on mobile, which matches the audit's touch-target finding.
- Contrast pass moved three light tokens after measurement: muted #7C6F67 -> #756861, danger #C1582A -> #BD5629, warning #A97A45 -> #956B3D.

**Known, left for Phase 2/3.**
- Shell stroke icons (hamburger, sun/moon, gear, feedback) are still inline SVGs; only module marks moved.
- Session player bar paints the primary button on a primary background (pre-existing; Phase 3 session bar).
- Ledger summary strip, category chips and page-level `.state-message`/`.spinner-lg` copies still use their own colours and CSS.
- 14 hand-rolled confirm modals still exist alongside the new service.
- Feedback FAB, verify banner, dashboard launcher, four secondary-nav patterns: Phase 2.

**Next.** Phase 2 (shell): unified module sub-nav on desktop and in the mobile bar, topbar rework, dashboard v2 from `MASTER-DASHBOARD-REDESIGN.md` in house style, feedback into the user menu, dismissible verify banner, `jiro-icon` for the shell's stroke icons.
