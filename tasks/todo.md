# Jiro UI redesign

Plan: `~/.claude/plans/jaunty-rolling-dream.md`. Audit: `docs/UI-AUDIT-2026-09.md`.

## Phase 0 + Phase 1 (done, commits 71a2ae9..38fa179, pushed 2026-09-14)

- [x] 0.1-0.6 bugs: ledger dates and amounts, undefined CSS vars + `check:css`, copy, 404 page, dead files
- [x] 1.1-1.8 foundation: tokens and hardened palette, three themes with brand dark modes, focus + reduced motion, `jiro-icon` + `jiro-mark` + icon pipeline, `jiro-button` without `::ng-deep`, toast + confirm, page-header + empty-state, housekeeping

## Phase 2: the shell (done)

- [x] 2.1 Navigation model: `core/navigation.ts`, `jiro-module-nav` (desktop row + mobile overflow chips), generated mobile bar, `jiro-tab-strip` with `?tab=` URL sync, three quick-navs deleted, Culinara header links and back-links removed, Journaly pages on `jiro-page-header` with New entry
- [x] 2.2 Shell chrome: chrome-height tokens, no desktop topbar, `jiro-user-menu` (sidebar footer + mobile top bar), dismissible verify banner with toasts, `jiro-feedback-form` in a modal, shell icons via `jiro-icon`, `.main` overflow clip, session bar offset under the mobile top bar
- [x] 2.3 Dashboard v2: `dashboard.service.ts` (forkJoin, per-source catchError), Today row, This-month row, 14-day activity strip, shortcuts, `jiro-skeleton`
- [x] 2.4 Route titles + `JiroTitleStrategy` (shared instance via `useExisting`; `current` signal feeds the mobile bar)
- [x] 2.5 Housekeeping: main-layout shrunk, styles.scss tab-strip removed, todo review

## Verification (Phase 2)

- [x] `npm run check:css` 0 undefined (80 vars), `npm run icons` (50 icons), production build 408 kB initial
- [x] Desktop: no topbar; menu opens on Enter with focus on the first item, ArrowDown/End move, Escape closes and refocuses; Dark mode item toggles `html.dark`; feedback modal shows the form and the toast after Send
- [x] Desktop: active tab Jym / Exercises (on the exercise detail) / Net Worth; zero `.lnav .jnav .secondary-links`; `/jym/plan?tab=series` opens Series and switching writes `?tab=templates`; session player has no module row and sticks at top 0
- [x] Dashboard seeded (Resume card, "Written today", month net +$3,022.39, budget bar, activity strip with both journal days) and empty (four empty states, "Good evening, Ada"); light and dark
- [x] Verify banner dismiss persists across reload in the session
- [x] Document titles "Dashboard · Jiro", "Net worth · Jiro", "Transactions · Jiro"
- [x] Mobile: bars 3 / 5 / 5 / 4 / 5 (hub, Jym, Culinara, Journaly, Ledger); top bar shows module or route title ("Exercise" on the drill-down); menu opens downward; Ledger overflow chips (2); no FAB; session bar sits at 48px under the 48px top bar; dashboard stacks in one column

## Review (Phase 2)

**Delivered.** One navigation model in `core/navigation.ts` rendered by the shell (desktop tab row, mobile bar, overflow chips); three quick-nav components and four hand-written nav patterns gone. Desktop topbar removed; the account menu lives in the sidebar footer and the mobile top bar and is fully keyboard-operable. Feedback is a menu item in a modal; the FAB is gone. The verify banner is dismissible per session and its resend action now reports back. Dashboard shows today (workout, journal, kitchen), this month (ledger net, income, expenses, savings rate, top budgets), a 14-day activity strip and module shortcuts, with per-card degradation when a module fails. Every route has a title.

**Deviations from the plan.**
- Settings "Feedback" card dropped (review correction); the menu item is the single entry point.
- `jiro-skeleton` built now because the dashboard is its first consumer.
- The activity strip counts UTC days (like the API's streaks and calendars) rather than local days; late-evening users may see the last column labelled with tomorrow's weekday initial.
- Unused CSS left behind for Phase 3 cleanup: `.page-header` rules in the three Journaly section pages, `.back-link` rules in three Culinara pages.

**Found during verification, not fixed here.**
- Backend: `GET /culinara/cook-streak` returns 500 when a trial has no `date_cooked` (my seed created one that way; the UI's trial modal always sets it). The dashboard shows "Culinara is not available right now" in that case.
- Session player bar still paints the primary button on a primary background (Phase 3).

**Next: Phase 3 (pages).** Session player and exercise library, Ledger hub and transactions, Journaly home, Culinara list and detail; migrate control flow, hand-rolled confirms and toasts, `.state-message`/`.spinner-lg` copies, raw hex colours (196 left) as each page is touched. Then Phase 4, the landing page with real screenshots.

## Phase 3a: Jym pages (in progress, plan in `~/.claude/plans/jaunty-rolling-dream.md`)

- [x] 3a.0 Control-flow migration, whole app (736 directives, 58 files; `--format false`; build 395 kB) — commit eaf1387
- [ ] 3a.1 Session player, same layout: bar literals -> `currentColor`/tokens, `inverse` + `ghost` button variants, Finish/Exit visible on the bar, `--color-warning-rgb`, 40px set-row controls (36 mobile), warm-up `fire` icon with `aria-pressed`, aria-labels on icon buttons, picker in `jiro-modal`, `jym-pr-badge`, skeleton + empty state
- [ ] 3a.2 Exercise library as list rows: `forkJoin(listExercises, getPRs)`, best set + est. 1RM + PR date, `jiro-menu` row menu (Edit / Delete), ConfirmService + toasts, `jiro-page-header` when not embedded, empty + no-results states, skeleton
- [ ] 3a.3 Other Jym pages: `jiro-page-header`, `jiro-empty-state`, `.spinner`, ConfirmService for the five `.delete-confirm` modals, tokens for hex/rgba, theme-aware chart palette in exercise-detail, session-summary on-screen tokens (share card + `MUSCLE_COLORS` untouched), aria-labels
- [ ] Verification: `check:css`, production build, Playwright desktop + mobile, light + dark on the player, contrast on the bar buttons
- [ ] Commit per step, push at the end, review section below

## Phase 3b/3c/3d inputs (from explore traces, 2026-09-14; not yet acted on)

- Ledger (hub, transactions, accounts, budgets, networth, compare, transaction form): 43 raw hex, 29 rgba, 6 `.spinner-lg` copies, 3 hand-rolled delete confirms; none import page-header / empty-state / icon / input / skeleton / toast / confirm. `getAmountColor` and `getTypeColor` duplicate each other with a `#3B82F6` transfer literal; budgets format currency with a hard `$`; net-worth and compare charts hard-code light-theme axis colours; compare duplicates the whole table for mobile; transaction search only filters pages already fetched; `activeFilterCount()` reads plain fields.
- Journaly (home, week view, day modal): journal-home never binds the week view's `weekChange`, so paging weeks shows nothing; mood colours are an 8-entry hex map inside the week view only; filters fire per keystroke; one hand-rolled delete confirm; no toasts in the module; dead `.page-header` CSS and unused `moodIcon`.
- Culinara (list, detail, discover, meal planner, shopping list, forms): list and discover hand-roll header + `.spinner-lg`; detail has 11 title-only icon buttons, cook mode at `z-index: 9000` with no Escape and no wake lock, inline `setTimeout` confirmations instead of toasts; three dead `.back-link` CSS blocks; `#c49540` star gold repeated.
