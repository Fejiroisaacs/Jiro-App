CREATE TABLE shared_recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    share_token VARCHAR(32) UNIQUE NOT NULL,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    recipe_snapshot JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_shared_recipes_token ON shared_recipes(share_token);
CREATE INDEX idx_shared_recipes_recipe ON shared_recipes(recipe_id);
