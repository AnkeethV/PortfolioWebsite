-- =============================================================================
-- Schema for Portfolio Website + AI Chatbot (Ankeeth V)
-- Compatible with Postgres, Neon, Vercel Postgres, and PGlite
-- =============================================================================

CREATE TABLE IF NOT EXISTS personal_info (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  title VARCHAR(255) NOT NULL,
  location VARCHAR(255),
  email VARCHAR(255) NOT NULL,
  linkedin_url TEXT,
  github_url TEXT,
  bio TEXT NOT NULL,
  resume_url TEXT DEFAULT '/resume.pdf',
  photo_url TEXT DEFAULT '/assets/placeholder-avatar.svg',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS experience (
  id SERIAL PRIMARY KEY,
  company VARCHAR(255) NOT NULL,
  title VARCHAR(255) NOT NULL,
  start_date VARCHAR(100) NOT NULL,
  end_date VARCHAR(100) NOT NULL,
  bullets JSONB NOT NULL DEFAULT '[]'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  tech_tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  thumbnail_url TEXT,
  video_url TEXT,
  external_link TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS skills (
  id SERIAL PRIMARY KEY,
  category VARCHAR(50) NOT NULL, -- 'technical', 'tools', 'soft'
  value VARCHAR(255) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS faq (
  id SERIAL PRIMARY KEY,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for ordering performance
CREATE INDEX IF NOT EXISTS idx_experience_sort ON experience(sort_order, id);
CREATE INDEX IF NOT EXISTS idx_projects_sort ON projects(sort_order, id);
CREATE INDEX IF NOT EXISTS idx_skills_category_sort ON skills(category, sort_order, id);
CREATE INDEX IF NOT EXISTS idx_faq_sort ON faq(sort_order, id);
