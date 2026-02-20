CREATE TABLE recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    target_image_url VARCHAR(512),
    base_ingredients JSONB DEFAULT '[]',
    instructions TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_recipes_user ON recipes(user_id);

CREATE TABLE recipe_trials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    date_cooked TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    result_image_url VARCHAR(512),
    notes TEXT,
    modifications JSONB DEFAULT '[]',
    rating INT CHECK (rating BETWEEN 1 AND 5),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_trials_recipe ON recipe_trials(recipe_id);
