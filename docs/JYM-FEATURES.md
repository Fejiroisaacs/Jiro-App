# Jym Feature Reference

Jym is the gym tracking module of Jiro. This document describes how each user-facing feature works today.

---

## Navigation

| Route | Page |
|---|---|
| `/jym` | Hub: in progress, up next, series, heatmap, muscle tracker, splits, templates |
| `/jym/exercises` | Exercise library; `?tab=prs` for the PR wall |
| `/jym/exercises/:id` | Exercise detail: charts by date, its workouts, form checks and notes |
| `/jym/plan` | Splits; `?tab=series` and `?tab=templates` |
| `/jym/splits/:id` | Split builder |
| `/jym/series/:id` | Series detail with progression charts |
| `/jym/track` | Session history (filters in `?exercise=&type=&day=`, `?calendar=1`); `?tab=bodyweight` for the body weight log |
| `/jym/session/:id` | Live session player |
| `/jym/sessions/:id/summary` | Workout summary |
| `/jym/sessions/:id/edit` | Fixing a finished workout |
| `/jym/discover`, `/jym/discover/:id` | Public splits |
| `/jym/share/:share_id` | A shared split |

---

## Workout Structure

### Exercises
A personal exercise dictionary. Each exercise has a **name**, an optional **main muscle group**, any **other muscles it works**, and optional **notes**. Exercise names are unique per user.

- Muscles come from one list: Chest, Back, Shoulders, Biceps, Triceps, Legs, Glutes, Core, Cardio and Other. Names stored before the list were mapped onto it ignoring case (quads, hamstrings and calves became Legs, abs became Core, anything else Other).
- **Also works** (the secondary muscles) organises an exercise: Bench Press is Chest, and also works Shoulders and Triceps. They show as muted tags in the library and on the exercise page, and the library's muscle filter finds them (Triceps lists Bench Press too, with its Triceps tag marked). Everything that counts uses the main muscle only (see How Jym Counts).
- Create, edit, and delete exercises from the library (`/jym/exercises`), and filter it by muscle group.
- Each row shows the best set and when the exercise was last trained.
- Renaming an exercise renames it across all history, since sets reference the exercise by ID.
- Deleting an exercise removes every set logged with it; the library asks first.

### Splits & Routines
A **split** is a named training plan (e.g. "PPL", "Upper/Lower"). It contains one or more **routines** (e.g. "Push Day", "Pull Day"). Each routine has an ordered list of exercises with target sets and reps.

- Build splits at `/jym/splits/:id`. Drag exercises to reorder them or move them to another day.
- **Add day** adds a day after the last one. Tap a day's name to rename it; the arrows move it earlier or later.
- Multiple splits can exist at once; a series makes one active.

### The Plan for Each Exercise
Tap an exercise's plan chip (such as "3×8") to open its plan:
- **Sets** and **Reps**, with an optional **Up to** for a rep range ("8-12"). A range can't end below where it starts.
- **RPE**: how hard the sets should feel, 6 to 10 in whole numbers, like logging.
- **Rest**: from 0:30 to 5:00, or **Your usual** (the account's rest length).
- **Note**: a cue of up to 140 characters, such as "Pause at the bottom".

The chip then reads the plan ("4×6-10 · RPE 8 · 2:00") with the note under it, and templates, Discover and share links show the same text. A workout keeps the plan it started with. Every save sends all of an exercise's plan, so a drag between days keeps it, and a save from an older copy of the app (which doesn't know these fields) leaves them as they were.

### Supersets and Circuits
- The link button between two exercises of a day makes them a **superset**, labelled A1 and A2; linking a third makes a **circuit**. Tap it again to unlink them there.
- Members have to sit next to each other: an exercise dragged out of its superset, moved to another day or removed leaves it, and a member left on its own is ungrouped. The same rule runs in the app and the API.
- Supersets travel with copies: share links, Discover, templates and the account export.

### Sharing and Discover
- **Share** gives the split a link that lasts 30 days. The split's page lists its live link with Copy and Revoke.
- **Public** lists the split in Discover, where anyone can search by name or tag.
- Importing a split, from a link or Discover, copies it into your splits and matches its exercises to your library by name, creating any you don't have. Importing the same split again opens the copy you already have.

### Split Series
A **series** ties a split to a time window (weeks, sessions count, or open-ended). Sessions logged within a series are linked to it for progression tracking.

- Start a series from the Jym hub or the split detail page.
- A series knows its next day: the day after the last one logged, wrapping round. The Jym home offers it as **Up next**.
- Starting a day from its split files the workout under the split's active series, whichever Start button was used.
- End a series manually or let it run open-ended.
- A length is 1 to 52 weeks or 1 to 200 sessions.
- Progress counts finished workouts with at least one working set. An ended series counts weeks to its end date ("8 / 8 weeks").
- Series detail page shows a volume chart per session (working sets; deloads left out) and per-exercise estimated 1RM curves (finished, non-deload workouts).

---

## Live Session Player

### Starting a Session
- **Routine session**: tap "Start" next to a routine on the hub. The player pre-populates exercise blocks and set rows from the routine's targets.
- **The workout keeps its own list** on the server: its exercises, in order, with the plan's sets and reps as they were when it started. Editing the routine mid-workout doesn't change it, and an exercise added or removed on one phone shows the same on another.
- **Freestyle session**: tap "Freestyle session" for an open canvas; add any exercises you want.
- **A workout is already open**: every start button asks whether to resume it, start a new one anyway, or cancel. A forgotten one gets a different choice (see Forgotten Workouts).

### The Screen
The workout is a focus screen, like cook mode: on a phone the bottom nav is hidden, and the sticky bar is one row with the timer, **Workout options** (⋯) and **Finish**. Every control in the player is at least 44 px.

### Workout Options
The ⋯ button opens a sheet (a bottom sheet on a phone) with:
- **Type**: Normal, Deload or Test. Deload sets are never PRs and don't count towards your best, and next time's suggestion skips deload and test workouts. Changing a workout's type re-rates its PRs.
- **Units**: lbs or kg, the account's unit (the same setting as in Settings). Changing it converts the whole workout: logged sets are shown from their stored kg, typed sets and suggestions are converted.
- **Rest timer**: 1m, 1:30, 2m, 3m or 5m (see Rest Timer).
- **Save as template**, **Leave for now** (the workout stays open; resume it from the Jym home) and **Discard workout** (asks first, naming the logged sets).

### Each Exercise
Each exercise's ⋯ menu has **Move up**, **Move down**, **Superset with next** (or **Unlink from next**) and **Remove exercise** (which asks first and deletes its logged sets). The order and supersets are saved with the workout, so another phone sees them, and Repeat keeps them.

The plan shows under the name ("Plan 3×8-12 · RPE 8 · 1:30"), with its note below, and the RPE field shows the target RPE until you type one.

### Supersets in the Workout
A superset's exercises are drawn together under **Superset A** (or **Circuit A** for three or more), labelled A1, A2.
- Logging a working set of A1 starts no rest: A2's next set scrolls into view and is marked for a moment.
- Logging the last member ends the round: the rest is the longest planned rest among the members (or your usual), and the first member's next set is marked.
- A finished member is skipped. Warm-ups rest as usual.
- Moving an exercise within its superset keeps it; moving it out, or removing a partner, unlinks it.

### Logging Sets
Each exercise block shows a set table with columns: **Set**, **Weight**, **Reps**, **RPE**, and the log button.

- Tap ✓ to log the row. Typed values win; an untouched row logs its ghost values (today's aim), so repeating a set is one tap.
- The fields bring up a number keypad: decimal for weight, whole numbers for reps and RPE. A comma counts as a decimal point ("102,5"), and a typed 0 logs (bodyweight lifts).
- **RPE** (Rating of Perceived Exertion, 1 to 10) is optional.
- Ghost values before the first set are today's aim (see below); after it, the last logged working set.
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
- **With a rep range** (8-12), the plate goes on once every set at the top weight reaches the top of the range, and today aims for the bottom again. Until then it stays, aiming one rep past last time's best, never past the top: *Last time 100 kg × 10, 9, 8. Stay at 100 kg until every set hits 12; aim for 11 today.* A set below the bottom of the range is marked short.
- **Freestyle**: one plate more, unless the top set was logged at RPE 9 or more; then stay and aim for one more rep.
- **Bodyweight** lifts aim for one more rep.
- One plate is **2.5 kg** or **5 lb**, counted from the plate grid (177.5 lb goes to 180). The rule lives in `weight-suggestion.ts` and is covered by `npm run test:unit`.
- The line is hidden once all sets are saved.

### Rest Timer
After every logged set, a rest timer opens under the sticky bar.
- It runs for the exercise's planned rest when it has one, otherwise the account's rest length (90 seconds unless changed in Workout options or Settings). In a superset it waits for the end of the round (see Supersets in the Workout).
- **+30s** lengthens this rest only; the next one starts at the usual length again.
- **Skip** ends it early. When rest is done it turns green, beeps and vibrates, then closes after 3 seconds.

### Unlogged work
Every unlogged row (typed or not, inserted warm-ups included) is kept on this device until the workout is finished or discarded, so a reload or leaving the page loses nothing. The exercises themselves are on the server.

### Body Weight
Log today's body weight directly from the session player without leaving the workout. The weight is saved with today's date and syncs to the body weight log.

### Session Notes
A session-level notes field sits at the top of the player. Saves on blur.

### Finishing or Leaving
- **Finish** ends the workout and opens its summary. If a set has weight and reps typed but isn't ticked, Finish first asks: log it and finish, skip it, or go back.
- **Leave for now** and **Discard workout** are in Workout options.

### Forgotten Workouts
A workout is **stale** when it's open and nothing has been logged for 3 hours (or since it started). It is offered a finish at its **last set**, so its duration is the training and not the days after (`stale-workout.ts`):
- **The player** shows a banner: "This workout started Mon 28 Sep, 7:30 PM and wasn't finished. Your last set was at 8:42 PM." with **Finish at 8:42 PM** or **Keep going**; with nothing logged, **Discard it**.
- **The Jym home** card says when its last set was and leads with **Finish**. Past a day, "Started" is a date, not hours ago.
- **Starting another workout** asks "Last workout not finished": **Finish it and start** (or **Discard it and start** when empty), **Resume it**, or Cancel.

### Workout Summary
At `/jym/sessions/:id/summary`, built by the server (`GET /jym/sessions/:id/summary`), so a reload keeps it and its numbers match history. Finish, history ("View summary"), the day view and search all open it, and **Done** returns where you came from.
- The routine name under "Workout complete", when it ran ("Mon 28 Sep, 7:30 PM to 8:42 PM"), then duration, volume and work sets (warm-ups left out) and the number of lifts that set a record.
- **Edit times** changes a finished workout's start or end. The end is after the start, not in the future and at most 24 hours later, and the times must include every logged set.
- **Repeat workout** starts a normal workout with the same exercises in the order they were done, of the same routine if there was one (exercises in the routine keep its sets and reps).
- **Save as template** saves its exercises, sets and reps.
- An open workout's summary says it isn't finished and offers **Resume workout**.
- **Muscle groups**: each group's share of the working sets, so bodyweight work counts.
- **Session highlights**: each lift's best set, which is its best record set if it set one, otherwise its highest estimated 1RM (bodyweight lifts: most reps).
- **Last time**: the lift's best set from its latest finished normal workout before this one, with the change in estimated 1RM. A record needs no change shown, and a deload isn't compared.
- The share card ranks its top lifts by estimated 1RM, bodyweight lifts after them by reps.

### Fixing a Workout
**Edit workout** (on the summary, and in history's detail) opens a finished workout in the player at `/jym/sessions/:id/edit`:
- The bar says "Editing" and the workout's date, with **Done**. There's no clock, rest timer or draft, and Workout options keeps only the type, units and Save as template.
- Sets can be added, changed and deleted. An added set is timed inside the workout (just after its last set), so records are rated as of that workout: a heavier set added to last week's workout is last week's record.
- **Done** returns to the summary, first asking about typed sets that weren't ticked, like Finish.
- Only this screen adds sets to a finished workout; the live player sends you to the summary.

### Logging a Past Workout
**Log past workout** (in history's header and empty state, and on the Jym home before your first workout) and **Log a workout** (on a past day's page) open a sheet:
- **Started** and **Finished** (default 6 to 7 PM on the day), and the workout: Freestyle, a day of one of your splits, or a template.
- The workout is created finished, then opens for fixing so you can add the sets.
- The end is after the start, at most 24 hours later, not in the future, and within the last year. A past workout never blocks starting a new one.
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

### Filters and Calendar
- **Exercise** keeps the workouts with a set of that exercise; **Type** keeps Regular, Deload or Test workouts. Both apply on the server (`GET /jym/sessions?exercise_id=&type=`), so "Show older sessions" keeps paging through the filtered list.
- **Calendar** opens a month, Monday first, with a dot on each day that has a workout, counted on your timezone's day (an 11:30 pm workout is on that day, not the next). It follows the Exercise and Type filters, and days after today can't be picked.
- Select a day to list only its workouts; select it again to list every day. **Clear filters** resets all three.
- The filters live in the URL (`?exercise=&type=&day=`, and `?calendar=1` while the calendar is open), so a reload keeps them and links can open history already filtered: an exercise's **See all workouts with ...**, and the Jym home's **Open calendar**.
- With nothing matching, the empty state names the filter ("No deload workouts with Bench Press").

---

## Exercise Detail & Charts

At `/jym/exercises/:id`:

- **Header**: exercise name, muscle group, best weight ever and the best estimated 1RM, from working sets outside deloads.
- **Charts**: **Est. 1RM** (the best set's, see How Jym counts), **Volume** and **Max weight**, one point per workout from `GET /jym/exercises/:id/stats`. Deloads and workouts with only warm-ups are left out.
  - Points sit at their real dates on a date axis with month ticks, so a break shows as a gap.
  - **3M**, **1Y** and **All** set the range; the page opens on 1Y when the history goes back more than a year, otherwise All. The Est. 1RM tooltip names the set behind each point.
- **Reps @ Weight**: the reps of each working set at one weight, per workout, outside deloads. Its data is fetched when it's picked (`GET /jym/exercises/:id/reps-at?weight=`).
- **Workouts**: every workout with this exercise, newest first, ten at a time (`GET /jym/exercises/:id/workouts`). Each shows its date, day, type, the exercise note and its sets (warm-ups marked W, RPE, estimated 1RM, PR badges), and links to its summary, or to the player while it's open. **See all workouts with ...** opens them in history.
- **Form progression** shows the form-check clips; **Notes** lists the exercise notes, one per workout, newest first.

### Plateau & Decline Detection
Computed from the stats rows of finished normal workouts with a working set (`plateau-rule.ts`, covered by `npm run test:unit`):
- Each workout is measured by its best set's estimated 1RM, or by reps when the sets compared are all bodyweight.
- The best of the last 3 workouts is set against the best of the up to 3 before them (so it needs 4 or more).
- **No banner** when the recent best is higher: 100×5 → 100×6 → 100×7 is progress.
- **Decline banner** when it is more than 5% lower.
- **Plateau banner** otherwise. Comparing bests over a window keeps heavy, medium and light days from reading as a decline.

---

## PR Wall

At `/jym/exercises?tab=prs`: your **all-time best set** for every exercise you have logged, in a table per muscle group (grouped ignoring case), with the best lift, estimated 1RM and date. Biggest lifts first; warm-ups never count.

---

## Jym Hub (`/jym`)

The home screen for the Jym module. Before your first workout it offers **Log past workout**.

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
- **Open calendar** below it opens history's month calendar. The cells themselves stay unlinked: at about 12 px they are too small to tap reliably.

### Muscle Group Frequency Tracker
Below the heatmap, a list of every muscle group you have trained, sorted by most recently trained.
- Each row shows a frequency bar for sessions in the **last 28 days**.
- A **fresh** (green) indicator shows muscle groups trained in the last 3 days.
- A **stale** (amber) indicator shows muscle groups not trained in the last 7+ days, as a gentle nudge.

---

## Body Weight Log

At `/jym/track?tab=bodyweight`: a chart and list of body weight entries.
- Log an entry by date and weight; logging the same day again replaces it.
- Delete individual entries.
- Stored in kg, shown in your unit.

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
- **Muscles** count by an exercise's main muscle group only: sets per muscle in a summary, "last trained" on the Jym home, the PR wall's groups, a workout's muscle tags and Discover's filter. The muscles it also works are for organising.

## How Personal Records Work

A working set is a PR when it beats every earlier working set of that exercise: heavier than the best weight, or the same weight with more reps. Weights within 0.05 kg count as the same, so switching units never makes a phantom PR. Warm-ups and deload sets are never PRs and never raise the bar.

PR flags are stored on the sets and recomputed for the whole exercise whenever a set is logged, edited, deleted or marked a warm-up, and whenever a session's type changes. `go run ./cmd/rerate-prs` (from `jiro-api/`, with `DATABASE_URL` set) recomputes every flag.
