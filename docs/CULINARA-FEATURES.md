# Culinara — Feature Reference

Culinara is the recipe lab notebook module of the Fejiro app. It lets you build a personal recipe library, run experiments through trials, and track what you changed each time you cook.

---

## Navigation

| Route | Page |
|---|---|
| `/culinara` | Recipe list — browse, search, filter, sort |
| `/culinara/:id` | Recipe detail — full recipe, trial log, cook mode |
| `/culinara/shopping` | Grocery list |

---

## Recipes

A **recipe** is the base record: title, description, tags, base ingredients, and instructions.

- Create a recipe with the **+ New Recipe** button on the list page.
- Edit the title, description, tags, ingredients, or instructions at any time from the detail page — edits do not affect existing trials.
- Delete a recipe from the detail page. This is permanent and removes all associated trials.

### Base Ingredients

A list of `item` + `amount` pairs (e.g. "flour / 500g"). These represent the canonical version of the recipe before any trial modifications.

### Instructions

Free-text cooking steps. In **Cook Mode** the instructions are parsed line-by-line into a numbered checklist.

### Tags

Tags can be selected from a preset list or typed in as custom tags. Both types are stored together on the recipe.

**Preset tags**: African, Mexican, Asian, Indian, American, Mediterranean, French, Japanese, Thai, Breakfast, Lunch, Dinner, Snack, Dessert, Drinks

---

## Recipe List (`/culinara`)

### Search & Filter

- **Search**: Full-text search by title/description, debounced 300ms.
- **Tag filter**: Click any tag chip to filter to that tag only. Click again or click "All" to clear.

### Sort

| Option | Behaviour |
|---|---|
| Newest | By `updated_at` descending (default) |
| Most Trials | By trial count descending |
| Highest Rated | By latest rating descending |
| A–Z | Alphabetical by title |

### Recipe Card

Each card shows: trial count, latest rating, title, description (2-line clamp), tags, first 3 ingredients (+N more if there are more), and last cooked timestamp (relative: "today", "yesterday", "X days ago").

---

## Trials

A **trial** records a single cooking run against a recipe. Trials are the core of Culinara's experiment tracking.

Each trial captures:
- **Date cooked**
- **Modifications** — list of `item` + `change` pairs (e.g. "flour → +50g, toasted"), tracking exactly what you changed from the base
- **Notes** — freeform observations, what worked, what to try next time
- **Rating** — 1–5 stars, optional

### Logging a Trial

Trials can be created in two ways:

1. **Log Trial button** on the detail page — opens a modal with all fields.
2. **Cook Mode** — after completing a cook, the footer lets you rate and add notes before saving a trial automatically.

Trials are listed on the detail page newest-first. Each trial can be edited or deleted individually.

### Average Rating

If a recipe has more than one rated trial, the detail page shows both the **latest rating** and the **average rating** alongside each other.

### Promote Trial to Base

Any trial with modifications can be **promoted** to the base recipe. Promoting merges the trial's modification list into the base ingredients. This is irreversible — a confirmation dialog explains the impact before proceeding.

---

## Cook Mode

Cook Mode is an interactive full-screen overlay for cooking through a recipe step-by-step.

**Activate**: Click the chef-hat icon on the recipe detail page.

### Ingredients checklist

All base ingredients are listed with checkboxes. Check each one off as you measure it out.

### Steps checklist

Instructions are split by line into numbered steps. Tap/click a step to mark it done (strikethrough).

### Finishing a cook

The sticky footer at the bottom of Cook Mode lets you:
- **Rate** the session (1–5 stars, tap to set, tap again to deselect)
- **Add notes** before saving
- **Log Trial** — saves a trial with the date, rating, and notes, then closes Cook Mode
- **Skip** — closes Cook Mode without saving any trial

---

## Shopping List (`/culinara/shopping`)

A lightweight grocery list built from recipe ingredients. Stored entirely client-side in localStorage — no backend.

### Adding items

From the recipe detail page, click **Add to grocery list** under the Base Ingredients section. All ingredients are added as a group labelled with the recipe name. A "✓ Added to grocery list" confirmation appears for 2.5 seconds.

### Managing the list

- Items are grouped by recipe.
- Check/uncheck individual items.
- **Check all** button on each group to mark the whole group done.
- Remove individual items with the × button.
- **Clear checked** removes all checked items across all groups.
- **Clear all** empties the entire list (with confirmation).

---

## Data Model

### Recipe

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | |
| `title` | string | Required |
| `description` | string \| null | |
| `tags` | string[] | Preset + custom |
| `base_ingredients` | Ingredient[] | |
| `instructions` | string \| null | |
| `trial_count` | number | Computed, list view only |
| `latest_rating` | number \| null | Computed, list view only |
| `last_cooked` | string \| null | ISO date, list view only |

### Ingredient / Modification

| Field | Type | Example |
|---|---|---|
| `item` | string | "bread flour" |
| `amount` / `change` | string | "500g" / "+50g" |

### RecipeTrial

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | |
| `recipe_id` | UUID | |
| `date_cooked` | string | ISO date |
| `modifications` | Modification[] | |
| `notes` | string \| null | |
| `rating` | number \| null | 1–5 |

---

## API Endpoints

**Base**: `/api/v1/culinara`

| Method | Path | Purpose |
|---|---|---|
| GET | `/recipes` | List recipes (`?q=` for search) |
| POST | `/recipes` | Create recipe |
| GET | `/recipes/:id` | Get recipe with all trials |
| PUT | `/recipes/:id` | Update recipe |
| DELETE | `/recipes/:id` | Delete recipe + trials |
| POST | `/recipes/:id/trials` | Log a trial |
| PUT | `/trials/:id` | Edit trial |
| DELETE | `/trials/:id` | Delete trial |
| POST | `/promote/:id` | Promote trial modifications to base |
