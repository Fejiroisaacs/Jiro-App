# Jiro UI audit, September 2026

Scope: the Angular app in `jiro-ui/` as it runs today. Every page was screenshotted at 1440x900 and on a Pixel-class phone, in light and dark mode, with an empty account and with seeded data. The code was scanned for token usage, states, accessibility, and consistency. Screenshots live in the published report page; the numbers behind each claim are in the last section.

## Verdict

Keep the brand. Rebuild the shell and the system underneath it. Migrate pages onto that, module by module.

- **Keep:** Newsreader + DM Sans, the hard offset shadows, the warm palette (hardened, see B4), the copy voice, the URL structure.
- **Rebuild:** the navigation model (desktop sub-nav and mobile bottom bar), the hub dashboard, the theme system (drop ten colour themes for one light and one brand-derived dark), and the component/token layer (ten tokens are referenced but never defined).
- **Do not adopt** the neon glass mockup in `jiro_app_mockup_*.png`. It is a different product. `MASTER-DASHBOARD-REDESIGN.md` already says to keep the house style; that is the right call.

This is a structural redesign, not a visual restart. About 70% of the lift comes from tokens plus shared components, because every page already styles itself from CSS variables.

## What works today

- The type pairing is distinctive and readable. Most apps in this space ship Inter; this one does not.
- The 2/4/8px offset shadow is a real signature with a consistent light source.
- The landing hero typography ("Your Life, Unified.") is strong.
- Session player: sticky bar, tabular-number timer, ghost-set placeholders, PR badges.
- Accounts page: the "Assets minus Liabilities equals Net worth" strip is a genuinely good idea.
- Every list has an empty state with a call to action.
- PWA hygiene: safe-area insets, iOS input zoom prevention, manifest, theme-color, legacy route redirects.

## Findings, ranked

Severity: Critical (bugs, blocking), High (structural), Medium, Low.

### A. Bugs found during the audit (Critical)

1. **Ledger dates are off by one and show "Invalid Date".** The API returns `date` as `2026-09-12T00:00:00Z`. `ledger-utils.ts` `formatDate()` does `new Date(iso)` and prints in local time, so a Sep 12 transaction shows "Sep 11" on the hub. `transaction-log.ts` `formatDateShort()` appends `T00:00:00` to that already-full timestamp and prints "Invalid Date" on every row. Fix: normalise to `date.slice(0, 10)` once in `ledger.service.ts`, or have the API return a date-only string.
2. **Ledger hub prints "--$86.42".** The API returns expense amounts as negative numbers; the hub template prepends a second minus. The transaction log uses a different formatter and prints `+$3150.00` with no thousands separator. Fix: one money formatter that owns the sign.
3. **Ten CSS custom properties are used but never defined.** `--border-radius-sm` (37 references in 15 files), `--border-radius-md`, `--font-size-base`, `--bg-main`, `--surface-secondary`, `--color-success`, `--color-warning`, `--color-accent-rgb`, `--color-danger-rgb`, `--space-3xl`. Each declaration is invalid at computed-value time and falls back to the initial value, so those corners render square and those colours render transparent. Fix: define them in `styles.scss` or replace the references.
4. **Copy.** "foucus" typo and "Light weight baby!!!" in `session-player.ts`; "Jiro, just like Fejiro. Get it? :)" on the public login page.
5. **No 404 page.** The wildcard route redirects to `/login`, which redirects signed-in users to `/dashboard` with no message.

### B. Brand and theme (High)

1. **Dark mode discards the identity.** Page `#111113` and sidebar `#0d0d0f` are generic zinc. Primary becomes `#b07060`; white button text on it is 3.9:1 and fails AA. The module tile icons keep their baked-in cream `#E6DCC3` background and read as light-mode stickers. Fix: derive dark from the brand (espresso ground around `#1A1310`, surface `#241B17`, cream text at 90%, maroon lifted only where contrast needs it) and rebuild the module icons as `currentColor` SVGs.
2. **Ten colour themes times dark mode is 22 palettes** that only swap primary, sidebar, and page. Royal-blue, plum, crimson and slate contradict the "Earth & Clay" premise, and every new component has to be checked against all of them. Recommend one light and one dark. If choice matters, keep three (earth, forest, slate) derived from two seed colours each.
3. **Palette drift.** 204 hard-coded hex colours in components (50 in `session-summary.ts`). Landing mood chips use Tailwind hexes (`#d97706`, `#0891b2`, `#7c3aed`, `#059669`). Ledger category chips use raw database colours. Money green and red are not tokens. Fix: add `--color-positive`, `--color-negative`, `--color-warning`, `--color-info` tinted to the palette, and lint against raw hex in components.
4. **Contrast.** `--text-muted #9B8F88` on cream is 2.77:1 (fails AA), 3.14:1 on white. Clay star `#C4956A` on white is 2.67:1. Mobile nav labels at 55% opacity are 3.75:1. Dark-mode muted is 3.34:1. Fix: `--text-muted` to about `#7C6F67` (4.6:1 on cream).
5. **A note on the palette itself.** Cream + maroon + brown + clay is the most common AI-generated "warm craft" palette. It is your brand and it is executed better than most, so I do not recommend changing hue. I recommend hardening it: shift cream slightly away from yellow (`#F2ECE1`), push maroon toward oxblood (`#6E3128`) for more authority, keep green as the only secondary accent, and lean harder on the two things that are actually yours: the serif display face and the hard shadow. If you ever want out of the family entirely, the one alternative that keeps the grounded feel is olive + brick + paper.

### C. App shell and navigation (High)

1. **Four secondary-nav patterns for one job.** Jym: sidebar sub-items plus a segmented tab strip. Culinara: header buttons. Journaly: tab bar with the action on the right. Ledger: tab bar. Fix: one module sub-nav component (the Ledger and Journal tab bar is the best of the four) driven by route config, used by every module, and mirrored into the mobile bottom bar.
2. **Mobile bottom bar is uneven.** Jym gets five tabs; Culinara, Journaly and Ledger get two ("Jiro" and the module name), which wastes the bar. `nav_redesign.md` already specifies the fix; it was only built for Jym.
3. **The dashboard is a launcher, not a dashboard.** Five identical cards in a three-column grid (one orphan in row two) duplicating the sidebar. `MASTER-DASHBOARD-REDESIGN.md` has the right data plan. Build it in house style: today's state (in-progress session, streaks, month net, last entry) plus one "start something" row.
4. **Persistent chrome eats the screen.** The verify-email banner appears on every page and wraps to two lines on mobile. The feedback FAB overlaps content bottom-right on every mobile screen and is the most prominent brand-coloured element in the app. The sticky topbar holds only a dark toggle and an avatar. Fix: banner dismissible per session; feedback into the user menu and Settings; topbar shows page title and primary action, or is removed on desktop.
5. **Three icon languages in one sidebar.** Dashboard, Guide and Settings are white glyphs; modules are coloured cream tiles; Jym sub-items are smaller tiles. Fix: one family. Phosphor Duotone suits the palette; or keep your tiles for modules only and use one stroke set at 1.75px for everything else.
6. **The user menu is a `div` with a click handler.** It is not focusable and cannot be opened from a keyboard. Guide is three quarters "Soon".

### D. Landing page (Medium)

1. **Div-built fake screenshots** (hero dashboard and all four module cards) are the strongest templated tell on the page. Replace with real screenshots of the redesigned app, or one hero image.
2. Eyebrow labels on three of four sections; "Why Jiro" is three equal columns; the final call-to-action section switches to a white-blue ground that breaks the page theme. Four labels for one intent: Sign up, Get started, Create your account, Register.
3. Mouse-tracking 3D tilt, glare and pulse with no `prefers-reduced-motion`, driven by a document-level `mousemove` listener.

### E. Module pages (Medium)

1. **Session player on mobile**, the most used screen: about 150px of sticky chrome (timer, three toggles, Exit and Finish), then notes and body-weight panels, so the first exercise starts below the fold. The "W" column header is cryptic. Fix: collapse type and unit toggles into an overflow, move notes and body weight to the finish step, 48px tap targets on set inputs.
2. **Exercise library** cards show only a name, a chip, and Edit/Delete. Delete is a first-class visible action; there is no data. Fix: a list with last performed and best set; edit and delete in a row menu.
3. **Journaly** shows each entry twice (week view and list) and a three-field filter row above two entries. Fix: the week view is the navigation; the list becomes "recent"; filters behind a search icon.
4. **Ledger hub** uses four semantic colours in the summary strip and brand maroon as a data colour for savings rate. The budgets column holds one card and dead space. Fix: numbers in ink, sign via a small plus or minus, colour only on deltas; budgets as a horizontal strip.
5. **Culinara header** stacks six rows of controls on mobile before any content (primary button, three secondary buttons, search, two rows of sort pills, tag chips). Fix: sort into a menu; tags and collections as one scrollable chip row.

### F. Components, tokens, code (Medium)

1. **Shared components are under-used.** 223 raw `<button>` against 155 `jiro-button`; 100 raw `<input>` against 12 `jiro-input`; 21 `jiro-card`. 65 `::ng-deep` blocks, mostly fighting the button's `width: 100%` default. Fix: button defaults to auto width with a `block` input; add `jiro-select`, `jiro-textarea`, `jiro-tabs`, `jiro-chip`, `jiro-list-row`, `jiro-toast`, `jiro-skeleton`, `jiro-empty`, `jiro-page-header`.
2. **Scales.** 25 distinct border-radius values; 25+ raw font sizes alongside the tokens; 59 `transition: all`; 14 `100vh` and no `100dvh`; 32 `setTimeout`-driven toasts; 4 `window.confirm`; `z-index: 9999` on the texture overlay and `9000` elsewhere. Fix: radius scale (4/8/12/999), a seven-step type scale, a documented z-index scale, one toast service, one confirm modal.
3. **Control flow.** 618 `*ngIf` and 143 `*ngFor` against 14 `@if` and 3 `@for` on Angular 21. Run `ng generate @angular/core:control-flow`; it is mechanical.
4. **Dead code.** `app.html` is the untouched Angular starter (Angular logo, Inter, purple gradients) and is not referenced by `app.ts`. Two `desktop.ini` files are committed under `shared/components`.
5. **File size.** Inline template plus styles in single files of 1000 to 1900 lines (`recipe-detail.ts` 1901, `session-player.ts` 1800). Split the five largest into `.html` and `.scss`.

### G. Accessibility (High)

1. **Focus.** 51 `outline: none` and one `:focus-visible`. The only visible focus is the browser default rectangle on cards. Add a global `:focus-visible` ring in the brand colour and remove the `outline: none` rules.
2. **Names and landmarks.** 31 icon-only buttons rely on `title` alone; 19 `aria-label` attributes across 30K lines; no skip link; the user menu is not keyboard reachable; zero `prefers-reduced-motion` rules.
3. **Touch targets.** Several 28 to 34px icon buttons (dark toggle, set-row warm-up, PR and delete buttons).

## Recommended order

- **Phase 0, one day.** Fix section A: dates, amounts, undefined tokens, copy, 404 page.
- **Phase 1, about a week. Design system.** Tokens (radius, type, z-index, semantic colours, hardened palette, brand-derived dark mode), one icon family, focus states, reduced motion, the shared component list in F1. Reduce themes to one plus one, or three.
- **Phase 2, about a week. Shell.** Unified module sub-nav on desktop and in the mobile bar; topbar rework; dashboard v2 from the existing data plan in house style; feedback into the menu; banner dismissible.
- **Phase 3, module by module. Pages.** Jym session player and library, Ledger hub and transactions, Journaly home, Culinara list and detail. Migrate control flow and split files as each is touched.
- **Phase 4. Landing page** with real screenshots of the finished app.

## Method and numbers

Static scan of `jiro-ui/src` plus 43 Playwright screenshots (desktop 1440x900, Pixel-class mobile, light and dark, empty and seeded). A local throwaway account `audit-tester@example.com` was created in the local Postgres database and seeded with exercises, a split, a session, recipes, journal entries, accounts and transactions. Seeded set weights were sent in pounds while the API stores kilograms, so the seeded numbers look inflated; that is the seed, not the app.

| Measure | Count |
|---|---|
| Components (inline template files) | 84 |
| Lines in `features/`, `layouts/`, `shared/` | 30,298 |
| Largest files | recipe-detail 1901, session-player 1800, comparison-page 1279, transaction-log 1217 |
| Hard-coded hex colours in components | 204 |
| CSS variables referenced but never defined | 10 |
| Distinct `border-radius` values | 25 |
| `outline: none` / `:focus-visible` | 51 / 1 |
| `prefers-reduced-motion` rules | 0 |
| `aria-label` / icon buttons with `title` only | 19 / 31 |
| `*ngIf` + `*ngFor` / `@if` + `@for` | 761 / 17 |
| Raw `<button>` / `jiro-button` | 223 / 155 |
| Raw `<input>` / `jiro-input` | 100 / 12 |
| `::ng-deep` | 65 |
| `transition: all` | 59 |
| `100vh` / `100dvh` | 14 / 0 |
| `window.confirm` | 4 |
| `setTimeout` (mostly toast dismissal) | 32 |
| Emoji or text-symbol glyphs in templates | 23 |
| Colour themes x dark mode | 11 x 2 |
| Initial JS bundle (dev) | 31.7 kB, everything else lazy |

Contrast (WCAG, computed): text-muted on cream 2.77, on white 3.14; text-secondary on cream 5.50; sidebar labels 5.00; mobile nav labels 3.75; primary button 8.43; clay star on white 2.67; dark muted 3.34; dark primary button 3.94; expense orange on white 4.47.
