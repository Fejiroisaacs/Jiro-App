# Technical Design Document: Culinara (Recipe Module)

## 1. Concept

A recipe management system that treats cooking as a scientific process. It distinguishes between the "Ideal Recipe" and "Experimental Trials," allowing users to track the evolution of a dish.

## 2. Key Features

* **Version Control for Food:** Track changes to ingredients across different attempts.
* **Visual History:** Side-by-side comparison of the "Target Image" vs. "Actual Result."
* **AI Chef:** Integration with Jiro AI to suggest modifications.

## 3. Data Schema (`schema_culinara.sql`)

### 3.1 Recipes (The Standard)

```sql
CREATE TABLE recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    target_image_url VARCHAR(512),   -- R2 presigned URL
    base_ingredients JSONB,          -- [{"item": "Flour", "qty": "500g"}]
    instructions TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 3.2 Trials (The History)

```sql
CREATE TABLE recipe_trials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id UUID REFERENCES recipes(id) ON DELETE CASCADE,
    date_cooked TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    result_image_url VARCHAR(512),   -- R2 presigned URL
    notes TEXT,                      -- "Too salty, reduce soy sauce"
    modifications JSONB,             -- [{"item": "Soy Sauce", "change": "Reduced from 2tbsp to 1tbsp"}]
    rating INT CHECK (rating BETWEEN 1 AND 5),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 3.3 Design Notes

* **`base_ingredients` as JSONB:** Chosen for flexibility and display simplicity. If ingredient-level search becomes a requirement (e.g., "show all recipes with chicken"), this should be normalized to a `recipe_ingredients` junction table.
* **`modifications` JSONB on trials:** Structured record of what changed from the standard. Enables the "promote trial to standard" workflow to be semi-automated rather than relying on free-text parsing.
* **`user_id` only on `recipes`:** Trials inherit ownership through their parent recipe via `recipe_id` FK. Queries filter by `recipes.user_id`.
