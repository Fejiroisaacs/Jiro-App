-- The Culinara grocery list; items are unique per (user, source_key, name_key), keys computed by the API.
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

-- Granted explicitly in case a role other than 000032's runs this.
GRANT SELECT, INSERT, UPDATE, DELETE ON grocery_items TO jiro_app;
