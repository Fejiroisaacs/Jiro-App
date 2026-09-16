# Master Dashboard Redesign Plan

Based on the newly generated AI mockup, the base dashboard needs a highly aesthetic dark-mode redesign utilizing glassmorphism, clean typography, vibrant neon blue/purple accent colors, and modular widgets that represent the core pillars of the Jiro App Suite (Jym, Journal, Culinara, and Ledger).

Importantly, the dashboard will only display data that is actually tracked within the existing Go backends for each sub-app.

## Synthesized Data Metrics for the Dashboard

### 1. Jym (Fitness & Body)
*Source Models: `SplitSeries`, `Session`, `BodyWeight`*
- **Active Program Progress**: Show the current `SplitSeries` name, duration type, and progress (Sessions completed out of `TargetSessions` or Weeks).
- **Recent Workout Activity**: Summary of the last `Session` (Routine name, total volume, sets).
- **Body Weight Trend**: The latest recorded `BodyWeight` (weight in kg).

### 2. Ledger (Finance)
*Source Models: `NetWorthSnapshot`, `LedgerSummary`, `BudgetWithSpend`*
- **Net Worth Overview**: The latest `NetWorthSnapshot` showing total Net Worth, Assets, and Liabilities.
- **Monthly Cash Flow**: Current `LedgerSummary` showing Month Income, Expenses, and Savings Rate.
- **Budget Alerts**: Top 2-3 `BudgetWithSpend` categories highlighting `Spent` vs `Remaining` (percentage used).

### 3. Journal (Mindfulness & Mood)
*Source Models: `JournalStreakResponse`, `JournalCalendarResponse`, `JournalEntry`*
- **Activity & Streaks**: `CurrentStreak` and `TotalEntries` from the `JournalStreakResponse`.
- **Mood Tracker**: A quick display of the latest `Mood` from the most recent `JournalEntry`.
- **Heatmap/Calendar mini-view**: A small representation using `Days` from `JournalCalendarResponse` to visually show consistency over the month.

### 4. Culinara (Nutrition & Cooking)
*Source Models: `CookStreakResponse`, `Recipe`*
- **Cooking Consistency**: `CurrentStreak` and `TotalCookDays` from the `CookStreakResponse`.
- **Recent Meals**: The `Title` and `TargetImageURL` of recently cooked `Recipe` entries or recipes with the highest `LatestRating`.

## Proposed Design & Layout

To ensure the new dashboard integrates perfectly with the existing app, we will abandon the hardcoded neon/dark theme from the mockup and instead exclusively use the application's global CSS variables defined in `styles.scss`.

1. **Theme Compatibility**: 
   - Use `var(--bg-page)` for the main background.
   - Use `var(--bg-surface)` and `var(--bg-canvas)` for widget cards and containers.
   - Surfaces will utilize the existing artisanal hard shadows (`var(--shadow-sm)`, `var(--shadow-md)`).
   - The design will automatically adapt to the user's selected theme (e.g., `theme-midnight`, `theme-forest`, `theme-royal-blue`) and adhere to the global `html.dark` toggle.

2. **Typography**: 
   - Headers will use `var(--font-family-display)` (Newsreader).
   - Body text will use `var(--font-family)` (DM Sans).
   - Colors will be mapped to `var(--text-primary)`, `var(--text-secondary)`, and `var(--text-muted)`.

3. **Accents & Highlights**: 
   - Instead of neon blue/purple, all progress bars, streaks, and interactive elements will use `var(--color-primary)` and `var(--color-accent)`.
   - Danger or alert states (like over-budget warnings) will use `var(--color-danger)`.

4. **Grid Structure**:
   - **Header**: Greeting string, quick "Add New..." floating action button.
   - **Top Row (Financials & Highlights)**: Large widget for Net Worth, accompanied by smaller widgets for Active Jym Split progress and Journal Streak.
   - **Middle Row (Activity & Trends)**: Activity heatmap combining Journal/Cook/Jym days, side-by-side with budget progress bars.
   - **Side/Bottom Panel**: Recent specific items (last cooked meal, latest journal mood, last recorded body weight).
