-- ============================================
-- Continuity - Database Initialization
-- ============================================
-- This script runs when the PostgreSQL container starts
-- for the first time. It sets up the initial schema.
-- ============================================

-- Enable useful extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================
-- System Status Table (for health checks)
-- ============================================
CREATE TABLE IF NOT EXISTS system_status (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    message TEXT NOT NULL
);

-- Insert initial status record
INSERT INTO system_status (message) 
VALUES ('Database initialized successfully');

-- ============================================
-- Projects Table (Mission 02+)
-- ============================================
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    user_id VARCHAR(255),
    goal TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at DESC);

-- ============================================
-- Iterations Table (Mission 04+)
-- ============================================
CREATE TABLE IF NOT EXISTS iterations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    phase VARCHAR(50) NOT NULL,
    iteration_number INTEGER NOT NULL,
    input_reference TEXT,
    output_reference TEXT,
    policy_version INTEGER,
    evaluation_result VARCHAR(20),
    failure_reasons JSONB DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_iterations_project_id ON iterations(project_id);
CREATE INDEX IF NOT EXISTS idx_iterations_phase ON iterations(phase);

-- ============================================
-- Policies Table (Mission 05+)
-- ============================================
CREATE TABLE IF NOT EXISTS policies (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    version INTEGER NOT NULL,
    parent_version INTEGER,
    configuration JSONB NOT NULL,
    weave_run_id VARCHAR(255),
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_policies_version ON policies(version DESC);

-- ============================================
-- Constraints Table (Mission 03+)
-- ============================================
CREATE TABLE IF NOT EXISTS constraints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    element_type VARCHAR(100) NOT NULL,
    location JSONB,
    classification VARCHAR(20) NOT NULL, -- locked, preferred, flexible
    confidence FLOAT DEFAULT 1.0,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_constraints_project_id ON constraints(project_id);
CREATE INDEX IF NOT EXISTS idx_constraints_classification ON constraints(classification);

-- ============================================
-- Artifacts Table (all missions)
-- ============================================
CREATE TABLE IF NOT EXISTS artifacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    iteration_id UUID REFERENCES iterations(id) ON DELETE SET NULL,
    artifact_type VARCHAR(50) NOT NULL,
    file_path TEXT,
    content_type VARCHAR(100),
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_artifacts_project_id ON artifacts(project_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_type ON artifacts(artifact_type);

-- ============================================
-- Grant permissions
-- ============================================
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO continuity;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO continuity;
