-- Users table (auth)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  provider VARCHAR(20) DEFAULT 'email',
  created_at TIMESTAMP DEFAULT NOW()
);

-- User profiles (health data)
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nickname VARCHAR(100) NOT NULL,
  gender VARCHAR(20) NOT NULL,
  date_of_birth DATE NOT NULL,
  height NUMERIC(5,2) NOT NULL,
  weight NUMERIC(5,2) NOT NULL,
  daily_calorie_goal NUMERIC(8,2),
  activity_level VARCHAR(20) NOT NULL,
  diet_goal VARCHAR(30),
  target_weight NUMERIC(5,2),
  target_date DATE,
  avatar_url TEXT,
  has_shared BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Dietary restrictions master list
CREATE TABLE dietary_restrictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- User dietary restrictions
CREATE TABLE user_dietary_restrictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  restriction_id UUID NOT NULL REFERENCES dietary_restrictions(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, restriction_id)
);

-- AI overviews + tips cache (type: 'overview' | 'tips')
CREATE TABLE ai_overviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  date DATE NOT NULL,
  type VARCHAR(20) DEFAULT 'overview',
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, date, type)
);

-- Meal logs
CREATE TABLE meal_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  image_url TEXT,
  description TEXT,
  food_name VARCHAR(255) NOT NULL,
  calories NUMERIC(8,2) DEFAULT 0,
  carbs NUMERIC(8,2) DEFAULT 0,
  protein NUMERIC(8,2) DEFAULT 0,
  fat NUMERIC(8,2) DEFAULT 0,
  sugar NUMERIC(8,2) DEFAULT 0,
  fiber NUMERIC(8,2) DEFAULT 0,
  vitamin_a NUMERIC(8,2) DEFAULT 0,
  vitamin_c NUMERIC(8,2) DEFAULT 0,
  vitamin_d NUMERIC(8,2) DEFAULT 0,
  calcium NUMERIC(8,2) DEFAULT 0,
  cholesterol NUMERIC(8,2) DEFAULT 0,
  location VARCHAR(255),
  logged_at TIMESTAMP DEFAULT NOW()
);

-- Weight logs (historical weight tracking)
CREATE TABLE weight_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  weight NUMERIC(5,2) NOT NULL,
  logged_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_weight_logs_user_logged
  ON weight_logs (user_id, logged_at DESC);