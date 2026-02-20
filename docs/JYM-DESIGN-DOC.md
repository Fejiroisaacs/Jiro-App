# Technical Design Document: Jym (Gym Module)

## 1. Summary

Jym is a fitness tracking module that separates **Workout Definitions** (Templates) from **Workout Logs** (Sessions). It utilizes a normalized PostgreSQL schema to allow for complex analytics (e.g., "Show me my max squat volume over the last 6 months").

## 2. Architecture Diagram

Jym is a spoke module within the Jiro hub. All endpoints are served by the Go (Gin) API gateway under `/api/v1/jym/`. Data is stored in PostgreSQL. Exercise media (demo videos, form images) are stored in Cloudflare R2 via presigned URLs.

## 3. Data Schema (PostgreSQL)

### 3.1 The "Library" (Definitions)

These tables define what is *possible* to do in the gym.

```sql
-- 1. The Exercise Dictionary
CREATE TABLE exercises (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) NOT NULL,
    name VARCHAR(100) NOT NULL,           -- "Squat"
    muscle_group VARCHAR(50),             -- "Legs", "Chest"
    media_url VARCHAR(512),               -- R2 link to demo video
    notes TEXT,                           -- "Keep back straight"
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, name)                 -- unique per user, not globally
);

-- 2. The Strategy (Split)
CREATE TABLE splits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) NOT NULL,
    name VARCHAR(100) NOT NULL,           -- "Push/Pull/Legs"
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. The Template Day (Routine)
CREATE TABLE routines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) NOT NULL,
    split_id UUID REFERENCES splits(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,           -- "Pull Day B"
    day_order INT,                        -- 1 (Monday), 2 (Tuesday)...
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. The Template Exercises (What you PLAN to do)
CREATE TABLE routine_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    routine_id UUID REFERENCES routines(id) ON DELETE CASCADE,
    exercise_id UUID REFERENCES exercises(id),
    target_sets INT DEFAULT 3,
    target_reps INT DEFAULT 10,
    order_index INT                       -- 0 (First exercise), 1 (Second)...
);
```

### 3.2 The "Logger" (Sessions)

These tables record what was *actually* done.

```sql
-- 5. The Active Workout
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) NOT NULL,
    routine_id UUID REFERENCES routines(id), -- Link back to plan (optional for freestyle)
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    notes TEXT                            -- "Felt weak today, skipped cardio"
);

-- 6. The Actual Sets Performed
CREATE TABLE session_sets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    exercise_id UUID REFERENCES exercises(id),
    set_number INT,                       -- 1, 2, 3...
    weight DECIMAL,                       -- stored in user's preferred unit
    reps_performed INT,                   -- 5
    rpe INT CHECK (rpe BETWEEN 1 AND 10), -- Rate of Perceived Exertion
    is_pr BOOLEAN DEFAULT FALSE
);

-- Performance indexes for analytics queries
CREATE INDEX idx_session_sets_exercise ON session_sets(exercise_id, session_id);
CREATE INDEX idx_sessions_user_date ON sessions(user_id, started_at);
CREATE INDEX idx_sessions_started ON sessions(started_at);
```

### 3.3 Weight Unit Convention

Weight is stored as a raw decimal. The user's preferred unit (lbs or kg) is stored in `users.settings` (JSONB) and applied at the API/frontend layer. No unit is baked into the column name — conversion happens at display time.
