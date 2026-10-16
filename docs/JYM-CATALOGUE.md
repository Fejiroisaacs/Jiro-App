# Jym: exercise catalogue (J20)

Design agreed 2026-10-15. A new account's library is empty, so a first workout starts with typing every exercise in.
The catalogue offers common exercises to pick from, without filling anyone's library with ones they don't do.

## Understanding summary

- A built-in, read-only catalogue of about 120 exercises. Each has a main muscle, the other muscles it works, a type
  (weight × reps, bodyweight, duration, distance) and its equipment. Equipment variants are separate exercises
  ("Barbell Bench Press", "Dumbbell Bench Press"), since their weights aren't comparable.
- **Nothing is added until it's picked.** A picked exercise is copied into the library as a normal exercise: rename,
  edit, delete as usual. The catalogue never changes it afterwards.
- **The catalogue picker:** grouped by main muscle, with search and equipment chips (Barbell, Dumbbell, Kettlebell,
  Machine, Cable, Bodyweight, Other). Tick several, add them at once. It opens from:
  - the Exercise library's **Add from catalogue**;
  - an **empty library**, where it shows straight away ("Pick the exercises you do", with a way to skip).
- **Split and workout pickers:** a search also lists catalogue matches not yet in the library, marked **New**. Choosing
  one adds just that one, then carries on as if it had been in the library.
- **Already in the library:** a catalogue entry whose name matches one of the user's exercises, ignoring case, shows
  "In your library" and can't be added again. No fuzzy matching.

## Assumptions

- The catalogue lives in the API's code (a Go slice with a stable key per exercise), served by an endpoint. No
  migration and no table.
- Muscles use the fixed list (`MuscleGroups`). Equipment is a catalogue-only label until J19 gives exercises one.
- Added exercises carry no link back to the catalogue.
- Kind rules are as for any exercise (J21): a hold's kind is locked once it has sets, and so on.

## Non-goals

- An equipment field on the user's own exercises (J19).
- How-to text, images or videos.
- Editing or extending the catalogue in the app.
- Changing the demo account.

## Decision log

| # | Decision | Alternatives | Why |
|---|---|---|---|
| 1 | Pick from the library, an empty library, and the split and workout pickers | Library only | Covers setting up once and the "I need this now" moment mid-plan |
| 2 | Variants as separate exercises, filtered by equipment chips | One entry per movement | A barbell and a dumbbell bench aren't one record; chips keep the list short |
| 3 | Same name (ignoring case) means already added | Fuzzy "you may have this" | No wrong guesses; renames stay possible |
| 4 | Copy on add, no link | Linked catalogue entries | The user owns their exercise; nothing changes under them |
| 5 | Catalogue in Go code | A seeded table | Versioned with the code, no migration, easy to review |

## Design

### API

- `services/jym_catalogue.go`: `catalogue []CatalogueExercise{Key, Name, Muscle, Secondary, Kind, Equipment}`.
- `GET /jym/catalogue` returns every entry with `in_library`: a case-insensitive name match against the user's
  exercises.
- `POST /jym/catalogue/add {keys: [...]}`, in one transaction:
  - creates the exercises whose names aren't in the library yet, through the same muscle checks as create;
  - returns `{added: Exercise[], skipped: string[]}`;
  - unknown keys are a 400.
- A unit test checks the catalogue itself: unique keys and names, muscles from `MuscleGroups`, secondaries never the
  main one, valid kinds and equipment.

### UI

- **`CataloguePicker`** (shared): a search box, equipment chips and one section per muscle in `MuscleGroups` order.
  - Each 44 px row has a checkbox, the name, a type tag when it isn't weight × reps, and the other muscles, muted.
  - "In your library" rows are ticked and disabled.
  - A sticky footer reads **Add N exercises**.
  - On a phone the muscle sections collapse, showing the first section and how many are ticked in each.
- **Library:**
  - **Add from catalogue** sits beside New exercise and opens the picker as a sheet.
  - An empty library shows the picker inline under "Pick the exercises you do", with **Skip, I'll add my own**.
- **Split and workout pickers:** after the user's own matches, a "From the catalogue" group lists up to 5 matches with
  a **New** tag. Choosing one calls add with that key, then picks the new exercise.

### Tests

- **Go:** the catalogue's validity; add skips names already there, case-insensitively, and only touches the caller's
  library; unknown keys are a 400.
- **UI unit tests:** the grouping and filter helper.
- **Playwright** (`verify_catalogue`):
  - an empty account sees the picker;
  - ticking three adds three;
  - an existing name shows "In your library";
  - a workout picker's "New" match adds and logs;
  - 44 px targets and no sideways scroll at 390 px.

## The catalogue (draft for review)

Kind: W = weight × reps, BW = bodyweight ± load, D = duration, Dist = distance + time.

### Chest (14)

| Exercise | Equipment | Kind | Also works |
|---|---|---|---|
| Barbell Bench Press | Barbell | W | Triceps, Shoulders |
| Incline Barbell Bench Press | Barbell | W | Shoulders, Triceps |
| Decline Barbell Bench Press | Barbell | W | Triceps |
| Dumbbell Bench Press | Dumbbell | W | Triceps, Shoulders |
| Incline Dumbbell Bench Press | Dumbbell | W | Shoulders, Triceps |
| Dumbbell Fly | Dumbbell | W | |
| Incline Dumbbell Fly | Dumbbell | W | Shoulders |
| Machine Chest Press | Machine | W | Triceps, Shoulders |
| Smith Machine Bench Press | Machine | W | Triceps, Shoulders |
| Pec Deck | Machine | W | |
| Cable Fly | Cable | W | |
| Low-to-High Cable Fly | Cable | W | Shoulders |
| Push-up | Bodyweight | BW | Triceps, Shoulders, Core |
| Chest Dip | Bodyweight | BW | Triceps, Shoulders |

### Back (18)

| Exercise | Equipment | Kind | Also works |
|---|---|---|---|
| Deadlift | Barbell | W | Legs, Glutes |
| Barbell Row | Barbell | W | Biceps |
| Pendlay Row | Barbell | W | Biceps |
| T-Bar Row | Barbell | W | Biceps |
| Rack Pull | Barbell | W | Glutes |
| Barbell Shrug | Barbell | W | |
| Dumbbell Row | Dumbbell | W | Biceps |
| Chest-Supported Dumbbell Row | Dumbbell | W | Biceps |
| Dumbbell Shrug | Dumbbell | W | |
| Pull-up | Bodyweight | BW | Biceps |
| Chin-up | Bodyweight | BW | Biceps |
| Inverted Row | Bodyweight | BW | Biceps |
| Back Extension | Bodyweight | BW | Glutes |
| Lat Pulldown | Cable | W | Biceps |
| Close-Grip Lat Pulldown | Cable | W | Biceps |
| Seated Cable Row | Cable | W | Biceps |
| Straight-Arm Pulldown | Cable | W | |
| Machine Row | Machine | W | Biceps |

### Shoulders (12)

| Exercise | Equipment | Kind | Also works |
|---|---|---|---|
| Overhead Press | Barbell | W | Triceps |
| Upright Row | Barbell | W | Back |
| Seated Dumbbell Shoulder Press | Dumbbell | W | Triceps |
| Arnold Press | Dumbbell | W | Triceps |
| Dumbbell Lateral Raise | Dumbbell | W | |
| Dumbbell Front Raise | Dumbbell | W | |
| Dumbbell Reverse Fly | Dumbbell | W | Back |
| Machine Shoulder Press | Machine | W | Triceps |
| Machine Lateral Raise | Machine | W | |
| Reverse Pec Deck | Machine | W | Back |
| Cable Lateral Raise | Cable | W | |
| Face Pull | Cable | W | Back |

### Biceps (9)

| Exercise | Equipment | Kind | Also works |
|---|---|---|---|
| Barbell Curl | Barbell | W | |
| EZ-Bar Curl | Barbell | W | |
| Preacher Curl | Barbell | W | |
| Dumbbell Curl | Dumbbell | W | |
| Hammer Curl | Dumbbell | W | |
| Incline Dumbbell Curl | Dumbbell | W | |
| Concentration Curl | Dumbbell | W | |
| Cable Curl | Cable | W | |
| Machine Preacher Curl | Machine | W | |

### Triceps (9)

| Exercise | Equipment | Kind | Also works |
|---|---|---|---|
| Close-Grip Bench Press | Barbell | W | Chest |
| Skull Crusher | Barbell | W | |
| Overhead Dumbbell Tricep Extension | Dumbbell | W | |
| Tricep Pushdown | Cable | W | |
| Rope Pushdown | Cable | W | |
| Overhead Cable Tricep Extension | Cable | W | |
| Machine Dip | Machine | W | Chest |
| Dip | Bodyweight | BW | Chest, Shoulders |
| Bench Dip | Bodyweight | BW | |

### Legs (21)

| Exercise | Equipment | Kind | Also works |
|---|---|---|---|
| Back Squat | Barbell | W | Glutes, Core |
| Front Squat | Barbell | W | Glutes, Core |
| Romanian Deadlift | Barbell | W | Glutes, Back |
| Goblet Squat | Dumbbell | W | Glutes |
| Bulgarian Split Squat | Dumbbell | W | Glutes |
| Dumbbell Lunge | Dumbbell | W | Glutes |
| Walking Lunge | Dumbbell | W | Glutes |
| Step-up | Dumbbell | W | Glutes |
| Dumbbell Romanian Deadlift | Dumbbell | W | Glutes |
| Leg Press | Machine | W | Glutes |
| Hack Squat | Machine | W | Glutes |
| Smith Machine Squat | Machine | W | Glutes |
| Leg Extension | Machine | W | |
| Lying Leg Curl | Machine | W | |
| Seated Leg Curl | Machine | W | |
| Standing Calf Raise | Machine | W | |
| Seated Calf Raise | Machine | W | |
| Hip Adduction | Machine | W | |
| Bodyweight Squat | Bodyweight | BW | Glutes |
| Nordic Curl | Bodyweight | BW | |
| Wall Sit | Bodyweight | D | Glutes |

### Glutes (8)

| Exercise | Equipment | Kind | Also works |
|---|---|---|---|
| Barbell Hip Thrust | Barbell | W | Legs |
| Sumo Deadlift | Barbell | W | Legs, Back |
| Good Morning | Barbell | W | Legs, Back |
| Kettlebell Swing | Kettlebell | W | Legs, Back |
| Machine Hip Thrust | Machine | W | Legs |
| Hip Abduction | Machine | W | |
| Cable Kickback | Cable | W | |
| Glute Bridge | Bodyweight | BW | Legs |

### Core (13)

| Exercise | Equipment | Kind | Also works |
|---|---|---|---|
| Plank | Bodyweight | D | |
| Side Plank | Bodyweight | D | |
| Hollow Hold | Bodyweight | D | |
| Hanging Leg Raise | Bodyweight | BW | |
| Hanging Knee Raise | Bodyweight | BW | |
| Crunch | Bodyweight | BW | |
| Sit-up | Bodyweight | BW | |
| Ab Wheel Rollout | Bodyweight | BW | Shoulders |
| Russian Twist | Bodyweight | BW | |
| Dead Bug | Bodyweight | BW | |
| Cable Crunch | Cable | W | |
| Pallof Press | Cable | W | |
| Machine Crunch | Machine | W | |

### Cardio (10)

| Exercise | Equipment | Kind | Also works |
|---|---|---|---|
| Run | Bodyweight | Dist | Legs |
| Walk | Bodyweight | Dist | Legs |
| Swim | Bodyweight | Dist | Back, Shoulders |
| Treadmill Run | Machine | Dist | Legs |
| Rowing Machine | Machine | Dist | Back, Legs |
| Stationary Bike | Machine | Dist | Legs |
| Elliptical | Machine | Dist | Legs |
| Stair Climber | Machine | D | Legs, Glutes |
| Cycling | Other | Dist | Legs |
| Jump Rope | Other | D | Legs |

### Other (1)

| Exercise | Equipment | Kind | Also works |
|---|---|---|---|
| Farmer's Carry | Dumbbell | D | Back, Core |
