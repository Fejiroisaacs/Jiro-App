-- The Culinara grocery list, saved to the account. It used to live in the
-- browser's localStorage (key culinara_shopping_list), so it vanished on a
-- new device and never reached the data export.
--
-- De-duplication: an item is unique per (user, source_key, name_key).
--   name_key   the item name lowercased with its whitespace trimmed and
--              collapsed ("  Feta " and "feta" are the same item).
--   source_key where it came from: 'recipe:<uuid>' for a recipe's
--              ingredient, 'title:<normalised title>' for an item imported
--              from an old browser list that named a recipe no longer found,
--              'manual' for one typed in by hand.
-- Both keys are computed by the API (services.groceryNameKey /
-- groceryRecipeSource), so the rule lives in one place and is unit tested.
-- Adding the same recipe twice therefore adds nothing the second time
-- (INSERT ... ON CONFLICT DO NOTHING), even from two tabs at once. The same
-- ingredient from two different recipes stays two rows: the list groups by
-- recipe and amounts like "200 g" and "1 cup" cannot be summed.
--
-- recipe_title is a snapshot of the recipe's title when the item was added,
-- so the group heading survives the recipe being renamed or deleted
-- (recipe_id then becomes NULL; source_key keeps de-duplicating).
CREATE TABLE grocery_items (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item         TEXT NOT NULL CHECK (char_length(item) BETWEEN 1 AND 200),
    amount       TEXT NOT NULL DEFAULT '' CHECK (char_length(amount) <= 100),
    recipe_id    UUID REFERENCES recipes(id) ON DELETE SET NULL,
    recipe_title TEXT CHECK (char_length(recipe_title) <= 255),
    source_key   TEXT NOT NULL,
    name_key     TEXT NOT NULL,
    checked      BOOLEAN NOT NULL DEFAULT false,
    position     INTEGER NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, source_key, name_key)
);

CREATE INDEX idx_grocery_items_user_position ON grocery_items(user_id, position);

-- 000032's default privileges already cover a table created by the same
-- admin role; granted explicitly as well in case another role runs this.
GRANT SELECT, INSERT, UPDATE, DELETE ON grocery_items TO jiro_app;
