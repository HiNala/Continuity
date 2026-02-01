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
-- Projects Table
-- ============================================
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    status VARCHAR(50) DEFAULT 'created',
    goal TEXT,
    images JSONB DEFAULT '[]'::jsonb,
    -- Batch processing fields
    is_batch BOOLEAN DEFAULT FALSE,
    total_scenes INTEGER DEFAULT 0,
    completed_scenes INTEGER DEFAULT 0,
    -- Orchestration fields
    orchestration_state VARCHAR(50) DEFAULT 'created',
    current_phase VARCHAR(50),
    current_scene_index INTEGER DEFAULT 0,
    retry_count INTEGER DEFAULT 0,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    has_warnings BOOLEAN DEFAULT FALSE,
    warning_details JSONB DEFAULT '[]'::jsonb,
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_orchestration_state ON projects(orchestration_state);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_is_batch ON projects(is_batch);

-- ============================================
-- Scenes Table (Batch Processing)
-- ============================================
CREATE TABLE IF NOT EXISTS scenes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    -- Scene identification
    scene_index INTEGER NOT NULL DEFAULT 0,
    name VARCHAR(255),
    -- Input/Output
    input_image_path TEXT NOT NULL,
    output_image_path TEXT,
    -- Processing state
    status VARCHAR(50) DEFAULT 'pending',
    orchestration_state VARCHAR(50) DEFAULT 'created',
    current_phase VARCHAR(50),
    retry_count INTEGER DEFAULT 0,
    -- Timing
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    -- Results
    has_warnings BOOLEAN DEFAULT FALSE,
    warning_details JSONB DEFAULT '[]'::jsonb,
    error_message TEXT,
    -- Scene-specific analysis
    space_type_detected VARCHAR(100),
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_scenes_project_id ON scenes(project_id);
CREATE INDEX IF NOT EXISTS idx_scenes_status ON scenes(status);
CREATE INDEX IF NOT EXISTS idx_scenes_scene_index ON scenes(scene_index);

-- ============================================
-- Requirements Table
-- ============================================
CREATE TABLE IF NOT EXISTS requirements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    -- Original input
    original_goal TEXT NOT NULL,
    -- Extracted requirements
    space_type VARCHAR(100),
    style_targets JSONB DEFAULT '[]'::jsonb,
    accessibility_required BOOLEAN DEFAULT FALSE,
    budget_tier VARCHAR(50),
    intended_use VARCHAR(100),
    -- Additional data
    additional_constraints JSONB DEFAULT '{}'::jsonb,
    clarification_responses JSONB DEFAULT '{}'::jsonb,
    -- Analysis metadata
    analysis_complete BOOLEAN DEFAULT FALSE,
    questions_asked INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_requirements_project_id ON requirements(project_id);

-- ============================================
-- Orchestration Logs Table
-- ============================================
CREATE TABLE IF NOT EXISTS orchestration_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    -- State transition
    from_state VARCHAR(50) NOT NULL,
    to_state VARCHAR(50) NOT NULL,
    trigger VARCHAR(50) NOT NULL,
    -- Additional context
    details JSONB DEFAULT '{}'::jsonb,
    duration_ms INTEGER
);

CREATE INDEX IF NOT EXISTS idx_orchestration_logs_project_id ON orchestration_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_orchestration_logs_created_at ON orchestration_logs(created_at);

-- ============================================
-- Iterations Table
-- ============================================
CREATE TABLE IF NOT EXISTS iterations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    scene_id UUID REFERENCES scenes(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    -- Phase and iteration tracking
    phase VARCHAR(50) NOT NULL,
    iteration_number INTEGER NOT NULL DEFAULT 1,
    -- Input/Output references
    input_image_path TEXT,
    output_image_path TEXT,
    -- Generation details
    prompt_used TEXT,
    generation_latency_ms INTEGER,
    -- Policy tracking
    policy_version INTEGER,
    -- Status
    status VARCHAR(20) DEFAULT 'pending',
    error_message TEXT,
    -- Evaluation fields
    evaluation_status VARCHAR(20) DEFAULT 'pending',
    evaluation_score FLOAT,
    evaluation_result VARCHAR(20),
    evaluation_reasons JSONB DEFAULT '[]'::jsonb,
    evaluated_at TIMESTAMPTZ,
    evaluator_weave_trace_id VARCHAR(255),
    failure_reasons JSONB DEFAULT '[]'::jsonb,
    -- Weave tracking
    weave_run_id VARCHAR(255),
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_iterations_project_id ON iterations(project_id);
CREATE INDEX IF NOT EXISTS idx_iterations_scene_id ON iterations(scene_id);
CREATE INDEX IF NOT EXISTS idx_iterations_phase ON iterations(phase);
CREATE INDEX IF NOT EXISTS idx_iterations_status ON iterations(status);

-- ============================================
-- Evaluation Details Table
-- ============================================
CREATE TABLE IF NOT EXISTS evaluation_details (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    iteration_id UUID NOT NULL REFERENCES iterations(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    -- Criterion info
    criterion VARCHAR(50) NOT NULL,
    weight FLOAT DEFAULT 1.0,
    -- Evaluation result
    passed BOOLEAN NOT NULL,
    score FLOAT NOT NULL,
    -- Detailed feedback
    details TEXT,
    evidence JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_evaluation_details_iteration_id ON evaluation_details(iteration_id);
CREATE INDEX IF NOT EXISTS idx_evaluation_details_criterion ON evaluation_details(criterion);

-- ============================================
-- Constraints Table
-- ============================================
CREATE TABLE IF NOT EXISTS constraints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    scene_id UUID REFERENCES scenes(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    -- Element identification
    element_type VARCHAR(100) NOT NULL,
    element_location TEXT,
    -- Classification
    classification VARCHAR(20) NOT NULL DEFAULT 'flexible',
    confidence_score FLOAT DEFAULT 1.0,
    -- Source tracking
    source_image VARCHAR(255),
    notes TEXT,
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_constraints_project_id ON constraints(project_id);
CREATE INDEX IF NOT EXISTS idx_constraints_scene_id ON constraints(scene_id);
CREATE INDEX IF NOT EXISTS idx_constraints_classification ON constraints(classification);

-- ============================================
-- Project Analysis Table
-- ============================================
CREATE TABLE IF NOT EXISTS project_analysis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    -- Construction state assessment
    construction_state VARCHAR(50),
    -- Analysis summary
    analysis_summary JSONB DEFAULT '{}'::jsonb,
    recommended_phase_sequence JSONB DEFAULT '[]'::jsonb,
    -- Counts for quick reference
    locked_count INTEGER DEFAULT 0,
    preferred_count INTEGER DEFAULT 0,
    flexible_count INTEGER DEFAULT 0,
    -- Quality indicators
    image_quality_assessment VARCHAR(50),
    confidence_overall FLOAT DEFAULT 1.0,
    -- Weave tracking
    weave_run_id VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS idx_project_analysis_project_id ON project_analysis(project_id);

-- ============================================
-- Policies Table
-- ============================================
CREATE TABLE IF NOT EXISTS policies (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    -- Project association (null for default global policies)
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    -- Version tracking
    version INTEGER NOT NULL DEFAULT 1,
    parent_version INTEGER,
    -- Phase configurations
    cleanup_config JSONB DEFAULT '{}'::jsonb,
    structural_config JSONB DEFAULT '{}'::jsonb,
    fixture_config JSONB DEFAULT '{}'::jsonb,
    style_config JSONB DEFAULT '{}'::jsonb,
    -- Legacy field
    configuration JSONB DEFAULT '{}'::jsonb,
    -- Tracking
    created_by VARCHAR(50) DEFAULT 'system',
    weave_run_id VARCHAR(255),
    notes TEXT,
    -- Active status
    is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_policies_project_id ON policies(project_id);
CREATE INDEX IF NOT EXISTS idx_policies_version ON policies(version DESC);
CREATE INDEX IF NOT EXISTS idx_policies_is_active ON policies(is_active);

-- ============================================
-- Policy Changes Table
-- ============================================
CREATE TABLE IF NOT EXISTS policy_changes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    -- Project and policy references
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    old_policy_id INTEGER NOT NULL REFERENCES policies(id),
    new_policy_id INTEGER NOT NULL REFERENCES policies(id),
    -- Trigger information
    trigger_iteration_id UUID REFERENCES iterations(id),
    trigger_reason VARCHAR(100),
    -- Change details
    changes_made JSONB NOT NULL,
    rationale TEXT,
    -- Effectiveness tracking
    improvement_observed BOOLEAN,
    -- Weave tracking
    weave_run_id VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS idx_policy_changes_project_id ON policy_changes(project_id);

-- ============================================
-- Insert Default Policy
-- ============================================
INSERT INTO policies (version, cleanup_config, structural_config, fixture_config, style_config, created_by, is_active)
VALUES (
    1,
    '{"prompt_template": "Remove construction debris and temporary items", "creativity_level": 0.3, "constraint_emphasis": "high", "max_retries": 3}'::jsonb,
    '{"prompt_template": "Add structural elements respecting constraints", "creativity_level": 0.4, "constraint_emphasis": "high", "max_retries": 3}'::jsonb,
    '{"prompt_template": "Add fixtures based on requirements", "creativity_level": 0.5, "constraint_emphasis": "medium", "max_retries": 3}'::jsonb,
    '{"prompt_template": "Apply specified style aesthetics", "creativity_level": 0.7, "constraint_emphasis": "low", "max_retries": 3}'::jsonb,
    'system',
    TRUE
);

-- ============================================
-- Additional Constraints for Data Integrity
-- ============================================

-- Ensure completed_scenes never exceeds total_scenes
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_completed_scenes'
    ) THEN
        ALTER TABLE projects
            ADD CONSTRAINT chk_completed_scenes
            CHECK (completed_scenes <= total_scenes);
    END IF;
END $$;

-- Ensure evaluation scores are between 0 and 1
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_evaluation_score'
    ) THEN
        ALTER TABLE iterations
            ADD CONSTRAINT chk_evaluation_score
            CHECK (evaluation_score IS NULL OR (evaluation_score >= 0 AND evaluation_score <= 1));
    END IF;
END $$;

-- Ensure evaluation detail scores are between 0 and 1
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_eval_detail_score'
    ) THEN
        ALTER TABLE evaluation_details
            ADD CONSTRAINT chk_eval_detail_score
            CHECK (score >= 0 AND score <= 1);
    END IF;
END $$;

-- Ensure constraint confidence is between 0 and 1
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_confidence_score'
    ) THEN
        ALTER TABLE constraints
            ADD CONSTRAINT chk_confidence_score
            CHECK (confidence_score >= 0 AND confidence_score <= 1);
    END IF;
END $$;

-- Ensure scene indices are unique per project
CREATE UNIQUE INDEX IF NOT EXISTS idx_scenes_project_scene_unique 
    ON scenes(project_id, scene_index);

-- Composite index for common iteration queries
CREATE INDEX IF NOT EXISTS idx_iterations_project_phase_status 
    ON iterations(project_id, phase, status);

-- ============================================
-- Grant permissions
-- ============================================
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO continuity;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO continuity;
