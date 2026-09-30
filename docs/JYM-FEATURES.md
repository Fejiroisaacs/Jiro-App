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

- Create, edit, and delete exercises from the library (`/jym/exercises`). Setting the muscle group to None or emptying the notes clears them.
- The muscle-group filter ignores case and spacing, so "Chest" also finds "chest ".
- An exercise with no record yet (warm-ups only) shows when it was last trained, counted in calendar days in your timezone.
- Renaming an exercise automatically updates the name across all historical sessions — no data is lost because sets reference the exercise by ID, not by name.
- Deleting an exercise permanently removes all sets ever logged with it (cascading delete) — the library warns you before confirming.

### Splits & Routines
A **split** is a named training plan (e.g. "PPL", "Upper/Lower"). It contains one or more **routines** (e.g. "Push Day", "Pull Day"). Each routine has an ordered list of exercises with target sets and reps.

- Build splits at `/jym/splits/:id` using the drag-and-drop routine builder.
- Reorder exercises within a routine or move them between routines by dragging. On a phone the board scrolls sideways as you drag toward its edge.
- Saves run one after another, so quick edits in a row all stick.
- **Add day** suggests the number after the last day. Tap a day's name to rename it; the arrows move it earlier or later (swapping day numbers with its neighbour).
- **Share** makes a link that lasts 30 days, or shows the live one if there is one; each live link is listed with Copy and Revoke (`GET /jym/splits/:id/shares`).
- Importing a split, from a share link or Discover, then **Open it**, takes you to your copy. Importing the same split again opens that copy instead of making another (`splits.source_split_id`, migration 000038). Delete the copy to import it fresh.
- Discover's tag filter ignores case. Its pager stays on later pages, and a page past the end steps back and turns Next off.
- Multiple splits can exist simultaneously; only one is active at a time via a series.

### Split Series
A **series** ties a split to a time window (weeks, sessions count, or open-ended). Sessions logged within a series are linked to it for progression tracking.

- Start a series from the Jym hub or the split detail page.
- A series knows its next day: the day after the last one logged, wrapping round. The Jym home offers it as **Up next**.
- Starting a day from its split files the workout under the split's active series, whichever Start button was used.
- End a series manually or let it run open-ended.
- A length is 1–52 weeks or 1–200 sessions; the start form won't take anything else.
- Progress counts finished workouts with at least one working set. Weeks are counted to the end date once a series has ended, so an old block reads "8 / 8 weeks", not the weeks since.
- Series detail page shows a volume chart per session (working sets; deloads left out) and per-exercise estimated 1RM curves (finished, non-deload workouts).

---

## Live Session Player

### Starting a Session
- **Routine session**: tap "Start" next to a routine on the hub. The player pre-populates exercise blocks and set rows from the routine's targets. The plan comes from the server, so the workout can be resumed on any device.
- **Freestyle session**: tap "Freestyle session" for an open canvas; add any exercises you want.
- **A workout is already open**: every start button asks whether to resume it, start a new one anyway, or cancel. A double tap starts one workout. A forgotten one gets a different choice (see Forgotten workouts).

### The Screen
The workout is a focus screen, like cook mode: on a phone the bottom nav is hidden, and the sticky bar is one row with the timer, **Workout options** (⋯) and **Finish**. Every control in the player is at least 44 px.

### Workout Options
The ⋯ button opens a sheet (a bottom sheet on a phone) with:
- **Type**: Normal, Deload or Test. Deload sets are never PRs and don't count towards your best, and next time's suggestion skips deload and test workouts. Changing a workout's type re-rates its PRs.
- **Units**: lbs or kg, the account's unit (the same setting as in Settings). Changing it converts the whole workout: logged sets are shown from their stored kg, typed sets and suggestions are converted.
- **Rest timer**: 1m, 1:30, 2m, 3m or 5m (see Rest Timer).
- **Save as template**, **Leave for now** (the workout stays open; resume it from the Jym home) and **Discard workout** (asks first, naming the logged sets).

### Logging Sets
Each exercise block shows a set table with columns: **Set**, **Weight**, **Reps**, **RPE**, and the log button.

- Tap ✓ to log the row. Typed values win; an untouched row logs its ghost values (today's aim), so repeating a set is one tap.
- The fields bring up a number keypad: decimal for weight, whole numbers for reps and RPE. A comma counts as a decimal point ("102,5"), and a typed 0 logs (bodyweight lifts).
- **RPE** (Rating of Perceived Exertion, 1 to 10) is optional.
- Ghost values before the first set of the day are today's aim (see below). A new row's ghosts are the last logged working set, never a warm-up.
- A saved set is tinted. A **PR** badge appears if the set is a personal record.
- Tap a logged value to correct it: the row shows **Cancel** and **Save** under it (Enter on reps or RPE also saves; Escape cancels on desktop).
- In a routine, the block shows its plan ("Plan 3 × 8"), and a logged working set below the planned reps is marked.

### The Set Number
Tap a set's number for its sheet: **Mark as warm-up** (or **Make it a working set**) and **Remove set**. Removing a logged set deletes it; removing an unlogged row just drops it. The rows renumber either way.

### Warm-up Sets
- Warm-up rows show a flame by the set number and an amber tint.
- Warm-up sets are **excluded from PR detection**, from volume and from set counts.
- **Add warm-up sets**: before an exercise has anything logged, a working weight above the bar (typed or suggested) gets an offer that previews the ramp: the bar for 10, then about 50%, 70% and 85% for 5, 3 and 1, each rounded down to a weight your plates can load (225 lb: 45 × 10, 110 × 5, 155 × 3, 190 × 1). It inserts them as typed warm-up rows above the working sets, one tap each to log.

### Plates
Each exercise's **Plates** button shows the plates for each side of the bar for any weight (it starts at the next working set's weight), drawn as a small stack and written out. When your plates can't make the weight exactly, it offers the nearest two you can load. It uses the bar and plate sizes in Settings > Workouts. The maths is in `plates.ts` (fewest plates, covered by `npm run test:unit`).

### Exercise Notes
Each exercise block has a subtle text area above the set table for a free-text note specific to that exercise in this session (e.g. "felt tight in left shoulder, went lighter").
- The note saves automatically when you click away from the text area.
- On save, the note is written to every already-logged set in that block.
- Notes are restored when returning to an in-progress session.

### Last Time and Today's Aim
Every exercise with history shows one line above its sets: what you did last time, and what to aim for today.

> *Last time 100 lbs × 8, 8, 6. Stay at 100 lbs until every set hits 8.*

- **Last time** is the latest finished normal workout that started before this one. Deload and test days and unfinished workouts are skipped, and warm-ups are not counted.
- **With a plan** (a routine's sets × reps), it is double progression: once enough sets at the top weight hit the planned reps, try one plate more; until then, stay at the same weight.
- **Freestyle**: one plate more, unless the top set was logged at RPE 9 or more; then stay and aim for one more rep.
- **Bodyweight** lifts aim for one more rep.
- One plate is **2.5 kg** or **5 lb**, counted from the plate grid (177.5 lb goes to 180). The rule lives in `weight-suggestion.ts` and is covered by `npm run test:unit`.
- The line is hidden once all sets are saved.

### Rest Timer
After every logged set, a rest timer opens under the sticky bar.
- It runs for the account's rest length (90 seconds unless changed in Workout options or Settings).
- **+30s** lengthens this rest only; the next one starts at the usual length again.
- **Skip** ends it early. When rest is done it turns green, beeps and vibrates, then closes after 3 seconds.

### Unlogged work
Every unlogged row (typed or not, inserted warm-ups included), exercises you added and plan exercises you removed are kept on this device until the workout is finished or discarded, so a reload or leaving the page loses nothing.

### Body Weight
Log today's body weight directly from the session player without leaving the workout. The weight is saved with today's date and syncs to the body weight log.

### Session Notes
A session-level notes field sits at the top of the player. Saves on blur.

### Finishing or Leaving
- **Finish**: stamps `ended_at` and opens the workout summary. If a set has weight and reps typed but isn't ticked, Finish first asks: log it and finish, skip it, or go back.
- **Leave for now** and **Discard workout** are in Workout options.

### Forgotten Workouts
A workout is **stale** when it's open and nothing has been logged for 3 hours (or since it started). It is offered a finish at its **last set**, by the server's log time, so its duration is the training and not the days after (`stale-workout.ts`):
- **The player** shows a banner: "This workout started Mon 28 Sep, 7:30 PM and wasn't finished. Your last set was at 8:42 PM." with **Finish at 8:42 PM** or **Keep going**; with nothing logged, **Discard it**.
- **The Jym home** card says when its last set was and leads with **Finish**. Past a day, "Started" is a date, not hours ago.
- **Starting another workout** asks "Last workout not finished": **Finish it and start** (or **Discard it and start** when empty), **Resume it**, or Cancel.

### Workout Summary
At `/jym/sessions/:id/summary`, built by the server (`GET /jym/sessions/:id/summary`), so a reload keeps it and its numbers match history. Finish, history ("View summary"), the day view and search all open it, and **Done** returns where you came from.
- The routine name under "Workout complete", when it ran ("Mon 28 Sep, 7:30 PM to 8:42 PM"), then duration, volume and work sets (warm-ups left out) and the number of lifts that set a record.
- **Edit times** changes a finished workout's start or end (`PATCH /jym/sessions/:id/times`). The end is after the start, not in the future and at most 24 hours later, and the times include every logged set (a minute of slack, since the fields have no seconds). PR flags don't move: they follow the order sets were logged.
- **Repeat workout** starts a normal workout of the same routine with the same extra exercises, leaving out routine exercises this one skipped; a freestyle repeat has the same exercises in the same order.
- **Save as template** saves its exercises, sets and reps.
- An open workout's summary says it isn't finished and offers **Resume workout**.
- **Muscle groups**: each group's share of the working sets, so bodyweight work counts.
- **Session highlights**: each lift's best set, which is its best record set if it set one, otherwise its highest estimated 1RM (bodyweight lifts: most reps).
- **Last time**: the lift's best set from its latest finished normal workout before this one, with the change in estimated 1RM. A record needs no change shown, and a deload isn't compared.
- The share card ranks its top lifts by estimated 1RM, bodyweight lifts after them by reps.

### Fixing a Workout
**Edit workout** (on the summary, and in history's detail) opens a finished workout in the player at `/jym/sessions/:id/edit`:
- The bar says "Editing" and the workout's date, with **Done**. There's no clock, rest timer or draft, and Workout options keeps only the type, units and Save as template.
- Sets can be added, changed and deleted. An added set is sent with `fix: true` and the server times it inside the workout: a second after its last set, never past its end. So records are rated in the workout's own time: a heavier set added to last week's workout becomes the record then, and a later equal set isn't one.
- **Done** returns to the summary, first asking about typed sets that weren't ticked, like Finish.
- Without `fix`, logging into a finished workout is still refused (`SESSION_ENDED`), so a phone that missed the finish is sent to the summary.

### Logging a Past Workout
**Log past workout** (in history's header and empty state, and on the Jym home before your first workout) and **Log a workout** (on a past day's page) open a sheet:
- **Started** and **Finished** (default 6 to 7 PM on the day), and the workout: Freestyle, a day of one of your splits, or a template.
- The workout is created finished (`started_at` and `ended_at` on `POST /jym/sessions`), then opens for fixing so you can add the sets.
- The end is after the start, at most 24 hours later, not in the future, and within the last year. A logged past workout isn't an open one, so it never blocks starting.
- A split day joins the split's active series only if the workout falls on or after the series' start.

---

## Session History

Sessions at `/jym/track?tab=sessions`, 50 at a time with "Show older sessions", showing:
- Date and time
- Routine name (or "Freestyle")
- Duration
- Working sets (warm-ups left out)
- Total volume (weight × reps over working sets, displayed in your preferred unit)
- Muscle groups trained

Click a session to see its sets by exercise (with RPE and the exercise note), its notes and form-check clips, and links to **View summary** (or **Resume workout** for an open one) and **See this day**. An open workout is marked "In progress".

---

## Exercise Detail & 1RM Chart

At `/jym/exercises/:id`:

- **Header**: exercise name, muscle group, best weight ever and the best estimated 1RM, from working sets outside deloads.
- **1RM Line Chart**: estimated 1RM (see How Jym counts) plotted per session over time. Uses the best set from each session.
- **History Table**: every logged set — date, weight × reps, estimated 1RM, and a 🏆 if it was a PR at the time.

### Plateau & Decline Detection
Computed from finished normal workouts, never warm-ups (`plateau-rule.ts`, covered by `npm run test:unit`):
- Each workout is measured by its best set's estimated 1RM, or by reps when the sets compared are all bodyweight.
- The best of the last 3 workouts is set against the best of the up to 3 before them (so it needs 4 or more).
- **No banner** when the recent best is higher: 100×5 → 100×6 → 100×7 is progress.
- **Decline banner** when it is more than 5% lower.
- **Plateau banner** otherwise. Comparing bests over a window keeps heavy, medium and light days from reading as a decline.

---

## PR Wall

At `/jym/prs`: a grid of cards showing your **all-time best set** for every exercise you have ever logged. Each card shows:
- Exercise name and muscle group
- Best weight and reps
- Estimated 1RM
- Date achieved

PR cards are sorted by estimated 1RM descending (your biggest lifts first). Warm-up sets are excluded from PR tracking. Muscle groups are grouped ignoring case and spacing, and shown title-cased.

---

## Jym Hub (`/jym`)

The home screen for the Jym module. Contains:

### Quick Navigation
Links to the exercise library, session history, PR wall, body weight log, and series list.

### In Progress and Up Next
- A workout that was started but not finished is the first thing on the page, with **Resume** and discard; a forgotten one leads with **Finish** (see Forgotten workouts).
- Otherwise **Up next** names the next day of the most recently started active series: **Start** opens that day in the series, **Other day** picks another.
- Active series cards show **Next: (day)**, and their Start opens that day directly.
- **Home-screen shortcuts**: a long press on the installed app's icon offers **Start workout** (`/jym?go=start`: Up next, else freestyle) and **Resume workout** (`/jym?go=resume`). Android and desktop only; iPhone doesn't support web app shortcuts.

### Time for a Lighter Week?
A card that suggests a deload (`deload-rule.ts`, covered by `npm run test:unit`):
- It compares each of your newest 3 finished normal workouts with working sets against the last time you trained that same split day. It suggests a deload when they average at least 5% less volume and none of them set a record.
- A freestyle workout has no like-for-like, so it gives no answer.
- Only workouts after your latest deload count, so the card stays quiet during a deload and until new evidence builds up after it. It also hides while a workout is open.
- **Start next session as a deload** opens Up next's day, in its series, as a deload (freestyle when no series is active). **Not now** hides it for a week.

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

**Settings > Workouts** holds the rest timer length (`rest_seconds`) and, per unit, the bar weight and the plate sizes you have (`plates`), used by the Plates sheet and warm-up sets. Defaults: a 45 lb bar with 45, 35, 25, 10, 5 and 2.5 lb plates; a 20 kg bar with 25, 20, 15, 10, 5, 2.5 and 1.25 kg plates.

---

## How Jym Counts

One set of rules, in `jiro-api/internal/services/jym_metrics.go`, behind every list, summary and chart:
- A **working set** is any set that isn't a warm-up. Sets, volume and best sets count working sets.
- **Estimated 1RM** is Epley, `weight × (1 + reps/30)`, with a single meaning the weight itself and reps capped at 10, since Epley overshoots beyond that (340 × 12 counts as 340 × 10). It is rounded to 0.1 kg.
- **PRs** in a session count lifts with a new record, not record sets: three sets that each beat the last on one lift are one record.
- **Templates** saved from a workout take their sets and reps from its working sets.

## Personal Records — How They Work

A working set is a PR when it beats every earlier working set of that exercise: heavier than the best weight, or the same weight with more reps. Weights within 0.05 kg count as the same weight, so a kg best shown in lbs and typed back is neither a phantom PR nor a missed one. Warm-ups and deload sets are never PRs and never raise the bar.

PR flags are stored on the sets and recomputed for the whole exercise whenever a set is logged, edited, deleted or marked a warm-up, and whenever a session's type changes. `go run ./cmd/rerate-prs` (from `jiro-api/`, with `DATABASE_URL` set) recomputes every stored flag once, for data written under older rules.
