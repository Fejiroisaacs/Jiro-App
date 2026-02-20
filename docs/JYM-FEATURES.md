# Jym — Feature Reference

Jym is the gym tracking module of the Fejiro app. This document describes every user-facing feature currently implemented.

---

## Navigation

| Route | Page |
|---|---|
| `/jym` | Hub — splits, active session, heatmap, muscle tracker |
| `/jym/splits/:id` | Split builder with drag-and-drop routines |
| `/jym/session/:id` | Live session player |
| `/jym/sessions` | Session history |
| `/jym/sessions/:id` | Read-only session detail |
| `/jym/exercises` | Exercise library |
| `/jym/exercises/:id` | Exercise detail with 1RM chart |
| `/jym/prs` | PR Wall |
| `/jym/series` | Split series list |
| `/jym/series/:id` | Series detail with progression charts |
| `/jym/bodyweight` | Body weight log |

---

## Workout Structure

### Exercises
A personal exercise dictionary. Each exercise has a **name**, optional **muscle group**, and optional **notes**. Exercise names are unique per user.

- Create, edit, and delete exercises from the library (`/jym/exercises`).
- Renaming an exercise automatically updates the name across all historical sessions — no data is lost because sets reference the exercise by ID, not by name.
- Deleting an exercise permanently removes all sets ever logged with it (cascading delete) — the library warns you before confirming.

### Splits & Routines
A **split** is a named training plan (e.g. "PPL", "Upper/Lower"). It contains one or more **routines** (e.g. "Push Day", "Pull Day"). Each routine has an ordered list of exercises with target sets and reps.

- Build splits at `/jym/splits/:id` using the drag-and-drop routine builder.
- Reorder exercises within a routine or move them between routines by dragging.
- Multiple splits can exist simultaneously; only one is active at a time via a series.

### Split Series
A **series** ties a split to a time window (weeks, sessions count, or open-ended). Sessions logged within a series are linked to it for progression tracking.

- Start a series from the Jym hub or the split detail page.
- End a series manually or let it run open-ended.
- Series detail page shows a volume chart per session and per-exercise 1RM progression curves.

---

## Live Session Player

### Starting a Session
- **Routine session**: tap "Start" next to a routine on the hub — the player pre-populates exercise blocks and set rows from the routine's targets.
- **Freestyle session**: tap "+ Freestyle Session" — open canvas, add any exercises you want.

### Session Type Toggle
Switch between **Normal**, **Deload**, and **Test** at any time during the session using the toggle in the sticky header.
- **Deload**: PR checks are skipped; the session is flagged so it doesn't count in plateau detection.
- **Test**: use this to find new 1RMs.

### Logging Sets
Each exercise block shows a set table with columns: **Set #**, **Weight**, **Reps**, **RPE**, **W (Warm-up)**, and a log/delete action.

- Enter weight and reps, then tap ✓ to save the set.
- **RPE** (Rating of Perceived Exertion, 1–10) is optional.
- Ghost text pre-fills from the previous session's values for that exercise.
- A saved set turns green. A **🏆** badge appears if the set is a personal record.
- Delete a saved set with the ✕ button.

### Warm-up Sets
Each set row has a **W** toggle button. Tap it to mark the set as a warm-up.
- Warm-up sets are highlighted in amber.
- Warm-up sets are **excluded from PR detection** — a warm-up set can never trigger a 🏆 badge, and warm-up weights are not counted when checking against your all-time max.
- The warm-up flag is persisted and restored if you leave and return to the session.

### Exercise Notes
Each exercise block has a subtle text area above the set table for a free-text note specific to that exercise in this session (e.g. "felt tight in left shoulder, went lighter").
- The note saves automatically when you click away from the text area.
- On save, the note is written to every already-logged set in that block.
- Notes are restored when returning to an in-progress session.

### Progressive Overload Suggestions
When you add an exercise to a freestyle session (or pick one from the exercise picker), the app fetches your history and shows a suggestion above the set table:

> *Last: 80 kg × 5 — try 82.5 kg*

- Increment is **2.5 kg** for lifts ≥ 50 kg, **1.25 kg** for lighter lifts.
- The suggestion is hidden once all sets are saved.
- Deload session history is excluded from the calculation.

### Rest Timer
After every logged set, a rest timer starts automatically in the sticky header bar.
- Default duration: **90 seconds**.
- Change duration on the fly with the preset chips: 1m, 1:30, 2m, 3m.
- The bar turns green and plays a double-beep when rest is done.
- Skip the timer early with the ✕ button.
- The timer collapses automatically 3 seconds after finishing.

### Body Weight
Log today's body weight directly from the session player without leaving the workout. The weight is saved with today's date and syncs to the body weight log.

### Session Notes
A session-level notes field sits at the top of the player. Saves on blur.

### Finishing or Exiting
- **Finish**: stamps `ended_at` and redirects to session history.
- **Save & Exit**: leaves the session open so you can return later. The in-progress session appears on the Jym hub.
- **Discard**: permanently deletes the session and all its sets.

---

## Session History

List of all sessions at `/jym/sessions`, showing:
- Date and time
- Routine name (or "Freestyle")
- Duration
- Set count
- Total volume (weight × reps, displayed in your preferred unit)
- Muscle groups trained

Click a session to see the full read-only detail — same layout as the player with inputs replaced by static values.

---

## Exercise Detail & 1RM Chart

At `/jym/exercises/:id`:

- **Header**: exercise name, muscle group, best weight ever, current estimated 1RM.
- **1RM Line Chart**: estimated 1RM (Epley formula: `weight × (1 + reps/30)`) plotted per session over time. Uses the best set from each session.
- **History Table**: every logged set — date, weight × reps, estimated 1RM, and a 🏆 if it was a PR at the time.

### Plateau & Decline Detection
Computed from the last 3 non-deload sessions for this exercise:
- **Plateau banner**: if your peak weight has been the same across 3 consecutive sessions, a yellow banner appears suggesting it may be time to progress.
- **Decline banner**: if your peak weight has dropped three sessions in a row, a red banner appears.

---

## PR Wall

At `/jym/prs`: a grid of cards showing your **all-time best set** for every exercise you have ever logged. Each card shows:
- Exercise name and muscle group
- Best weight and reps
- Estimated 1RM
- Date achieved

PR cards are sorted by estimated 1RM descending (your biggest lifts first). Warm-up sets are excluded from PR tracking.

---

## Jym Hub (`/jym`)

The home screen for the Jym module. Contains:

### Quick Navigation
Links to the exercise library, session history, PR wall, body weight log, and series list.

### In-Progress Session Banner
If a session was started but not finished, a banner appears with a "Resume" button that takes you back to the live player.

### Workout Frequency Heatmap
A GitHub-style contribution grid showing the last 16 weeks of workout activity.
- Each cell is one day. Colour intensity indicates how many sessions were logged that day.
- Darker = more sessions; empty = rest day.
- Hover a cell to see the date.

### Muscle Group Frequency Tracker
Below the heatmap, a list of every muscle group you have trained, sorted by most recently trained.
- Each row shows a frequency bar for sessions in the **last 28 days**.
- A **fresh** (green) indicator shows muscle groups trained in the last 3 days.
- A **stale** (amber) indicator shows muscle groups not trained in the last 7+ days, as a gentle nudge.

---

## Body Weight Log

At `/jym/bodyweight`: a chart and table of body weight entries over time.
- Log a new entry by date and weight.
- One entry per day (upserts if you log the same day twice).
- Delete individual entries.
- Weight is stored in kg internally; displayed in your preferred unit (kg or lbs) based on app settings.

---

## Settings

The app respects a global **unit preference** (kg / lbs). All weights entered and displayed throughout Jym respect this setting. Storage is always in kg.

---

## Personal Records — How They Work

A set is flagged as a PR at log time if its weight is strictly greater than the maximum weight ever logged for that exercise (across all sessions for the user), excluding warm-up sets and deload sessions.

The PR flag is stored permanently on the set. Renaming or reorganising exercises does not affect existing PR flags.
