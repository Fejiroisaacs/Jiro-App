# Jym: exercise types (J21)

Design agreed 2026-10-07. Weight × reps was the only way to log a set; this adds bodyweight ± load, duration and
distance + time, each with its own inputs, volume and records.

## Understanding summary

- Exercises get a **type**: weight × reps (the default; every existing exercise keeps it), **bodyweight ± load**,
  **duration** and **distance + time**.
- **Bodyweight**: reps plus an optional added load. Volume and estimated 1RM use body weight + load, from the latest
  body-weight entry on or before that day; with none yet, records compare added load, then reps.
- **Duration**: time held, optional load. A record is the longest hold.
- **Distance + time**: distance and time, pace follows. Two records: longest distance, and best pace (over at least
  400 m). The badge names which. The Cardio muscle group becomes loggable.
- **Distance unit** follows the weight unit (kg → km, lbs → mi); stored in metres.
- **Plans** hold sets × a target in the type's unit: 3 × 8, 3 × 0:45, 1 × 5 km.
- **Changing type**: weight × reps ↔ bodyweight any time (records re-rated); duration and distance only while the
  exercise has no logged sets.
- **"Last time"** for the new types shows what you did and ghosts it; no aim for today.

## Assumptions

- Added load is zero or more; negative load (assistance) waits for an Assisted type.
- A workout's volume counts weight and bodyweight sets only; totals of distance and time held show beside it.
- Plates, warm-up ramps, and the deload, plateau and series-progress rules stay weight × reps only.
- RPE, warm-ups, rest, supersets and notes work for every type. Muscle counts, streaks and the heatmap count every
  working set as before.

## Non-goals

Assisted, per side (3 × 5 already means each side), aims for the new types, per-exercise distance units, the record
types of J16.

## Decision log

| Decision | Alternatives | Why |
|---|---|---|
| Types: bodyweight, duration, distance + time | + assisted, + per side | Owner's scope; per side is implicit in sets × reps |
| Bodyweight volume uses logged body weight | added load only; reps only | Matches Strong/Hevy; a heavier lifter moves more |
| Duration: longest hold. Distance: longest and fastest | one record each | Both matter to runners and rowers |
| Distance unit follows weight unit | per exercise; separate setting | No new setting; metres stored |
| Type change only between matching inputs | any time; never | Keeps old sets meaningful |
| Plans: sets × a target in the type's unit | sets only | Plans stay useful for holds and runs |
| No aims for new types | per-type aims | YAGNI; last time is the guide |
| Approach A: typed columns, body weight copied onto the set | live join (B); generic columns (C) | Small query changes, readable data and export |

## Design

### Data (migration 000044)

- `exercises.kind TEXT NOT NULL DEFAULT 'weight_reps'` in (`weight_reps`, `bodyweight`, `duration`, `distance`).
- `session_sets`: `reps_performed` nullable; new `duration_s INT` (1–86 400), `distance_m NUMERIC(9,1)`,
  `body_weight_kg NUMERIC(5,2)`, `pr_kind TEXT` (`distance` | `pace`, null otherwise). `weight` stays NOT NULL
  (default 0) and is the load.
- `routine_items`, `session_exercises`: `target_distance_m NUMERIC(9,1)`; for duration, `target_reps` is seconds.

| kind | required | optional |
|---|---|---|
| weight_reps | reps ≥ 1 | weight ≥ 0 |
| bodyweight | reps ≥ 1 | weight (added load) ≥ 0 |
| duration | duration_s | weight (load) |
| distance | distance_m, duration_s | — |

The API validates by kind (400 otherwise).

### Body-weight copy

Logging or editing a bodyweight set writes the latest `body_weights` entry on or before the workout's day (user's
timezone) to `body_weight_kg`. Adding, editing or deleting a body-weight entry refreshes the copies on bodyweight
sets from that date to the next entry, then re-rates those exercises.

### Records (`rerateExercisePRs` by kind)

- weight × reps: unchanged.
- bodyweight: by estimated 1RM over body weight + load when known; otherwise added load, then reps.
- duration: longest hold at equal or more load.
- distance: longest distance (`pr_kind = distance`) or best pace over ≥ 400 m (`pace`); a set setting both stores
  `distance`.

### Numbers

- Volume `(weight + COALESCE(body_weight_kg, 0)) × reps` for weight and bodyweight sets only; e1RM likewise.
- Session rows, summary and history add `total_distance_m` and `total_duration_s` (working sets).
- Best set per exercise: e1RM / heaviest total then reps / longest hold / longest distance.
- Exercise stats per workout add `max_duration_s`, `max_distance_m`, `best_pace_s_per_km`; charts by kind (pace
  axis inverted). Reps @ Weight for weight types only.
- PR wall shows each kind's best; export adds `kind`, `duration_s`, `distance_m`, `body_weight_kg`, `pr_kind`.

### Player

| kind | col 1 | col 2 | col 3 |
|---|---|---|---|
| weight × reps | Weight | Reps | RPE |
| bodyweight | + kg | Reps | RPE |
| duration | + kg | Time | RPE |
| distance | Distance | Time | RPE |

- Time boxes use the number keypad and fill from the right: "45" → 0:45, "130" → 1:30, "2505" → 25:05.
- Ghosts and the "Last time" line per kind; logged distance rows show pace; plan tags "3 × 0:45", "1 × 5 km".
- kg/lbs toggles convert distance too. Plates and warm-up ramps for weight × reps only. Badges "PR", or
  "PR · distance" / "PR · pace". A hold or distance under the plan is a short set.

### Elsewhere

Type in the exercise forms and pickers (Cardio suggests Distance + time), a type tag and filter in the library, the
plan sheet's target relabels (Seconds, Distance) with "Up to" for rep types only, history and summary lines per kind,
templates from a workout average the time or distance, and demo data gains a Pull-up, a Plank and a 5 km Run.

### Build order

1. Migration, models, set validation, body-weight copy and refresh, records by kind, metrics SQL; DB tests.
2. Stats, summary, PR wall, export, demo.
3. UI: type in forms and tags, plan sheet.
4. Player: columns, time keypad, ghosts, pace, unit conversion.
5. Guide and docs. Then `verify_types` and the full suite.

### Risks

The metrics SQL touches every number shown (guarded by the suite and DB tests); the body-weight refresh on edit has
its own tests; the time box needs a phone check.
