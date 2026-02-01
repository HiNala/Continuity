"""
Continuity - Database Models
SQLAlchemy models for all database tables.
"""

from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import (
    Column, String, Text, Boolean, Float, Integer,
    DateTime, ForeignKey, JSON
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()


# ============================================
# Project Status Enum
# ============================================
class ProjectStatus:
    """Project status values."""
    CREATED = "created"
    REQUIREMENTS_GATHERING = "requirements_gathering"
    ANALYZING = "analyzing"
    GENERATING = "generating"
    COMPLETED = "completed"
    FAILED = "failed"


# ============================================
# Orchestration State Enum (Mission 06)
# ============================================
class OrchestrationState:
    """Orchestration state machine states."""
    # Initial states
    CREATED = "created"
    
    # Requirements phase
    GATHERING_REQUIREMENTS = "gathering_requirements"
    AWAITING_CLARIFICATION = "awaiting_clarification"
    
    # Analysis phase
    ANALYZING_SPACE = "analyzing_space"
    
    # Cleanup phase
    GENERATING_CLEANUP = "generating_cleanup"
    EVALUATING_CLEANUP = "evaluating_cleanup"
    RETRYING_CLEANUP = "retrying_cleanup"
    
    # Structural phase
    GENERATING_STRUCTURAL = "generating_structural"
    EVALUATING_STRUCTURAL = "evaluating_structural"
    RETRYING_STRUCTURAL = "retrying_structural"
    
    # Fixture phase
    GENERATING_FIXTURE = "generating_fixture"
    EVALUATING_FIXTURE = "evaluating_fixture"
    RETRYING_FIXTURE = "retrying_fixture"
    
    # Style phase
    GENERATING_STYLE = "generating_style"
    EVALUATING_STYLE = "evaluating_style"
    RETRYING_STYLE = "retrying_style"
    
    # Terminal states
    COMPLETED = "completed"
    COMPLETED_WITH_WARNINGS = "completed_with_warnings"
    FAILED = "failed"


# ============================================
# Orchestration Trigger Enum
# ============================================
class OrchestrationTrigger:
    """What caused a state transition."""
    START = "start"
    SUCCESS = "success"
    FAILURE = "failure"
    TIMEOUT = "timeout"
    USER_ACTION = "user_action"
    MAX_RETRIES = "max_retries"
    SKIP = "skip"


# ============================================
# Projects Table
# ============================================
class Project(Base):
    """
    Projects table - Top-level record for each visualization project.
    """
    __tablename__ = "projects"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(String(255), nullable=True, index=True)  # Placeholder until auth
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    # Project data
    status = Column(String(50), default=ProjectStatus.CREATED, index=True)
    goal = Column(Text, nullable=True)  # Original user goal text
    images = Column(JSON, default=list)  # Array of image paths/URLs (legacy, use scenes for batch)
    
    # Batch processing mode
    is_batch = Column(Boolean, default=False)  # True = process each image independently
    total_scenes = Column(Integer, default=0)  # Number of images in batch
    completed_scenes = Column(Integer, default=0)  # Number of successfully processed scenes
    
    # Orchestration fields (Mission 06) - for single-image mode or batch coordination
    orchestration_state = Column(String(50), default=OrchestrationState.CREATED, index=True)
    current_phase = Column(String(50), nullable=True)  # Current generation phase
    current_scene_index = Column(Integer, default=0)  # Which scene is being processed in batch
    retry_count = Column(Integer, default=0)  # Retries for current phase
    started_at = Column(DateTime(timezone=True), nullable=True)  # Processing start time
    completed_at = Column(DateTime(timezone=True), nullable=True)  # Processing end time
    has_warnings = Column(Boolean, default=False)  # Any phases had issues
    warning_details = Column(JSON, default=list)  # Details of any warnings
    
    # Metadata
    metadata_ = Column("metadata", JSON, default=dict)
    
    # Relationships
    requirements = relationship("Requirements", back_populates="project", uselist=False, cascade="all, delete-orphan")
    analysis = relationship("ProjectAnalysis", back_populates="project", uselist=False, cascade="all, delete-orphan")
    scenes = relationship("Scene", back_populates="project", cascade="all, delete-orphan", order_by="Scene.scene_index")
    iterations = relationship("Iteration", back_populates="project", cascade="all, delete-orphan")
    constraints = relationship("Constraint", back_populates="project", cascade="all, delete-orphan")
    orchestration_logs = relationship("OrchestrationLog", back_populates="project", cascade="all, delete-orphan")
    reference_images = relationship("ReferenceImage", backref="project", cascade="all, delete-orphan")


# ============================================
# Orchestration Log Table (Mission 06)
# ============================================
class OrchestrationLog(Base):
    """
    OrchestrationLog table - Tracks all state transitions for a project.
    Provides complete visibility into how a project progressed through the pipeline.
    """
    __tablename__ = "orchestration_logs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    
    # State transition
    from_state = Column(String(50), nullable=False)
    to_state = Column(String(50), nullable=False)
    trigger = Column(String(50), nullable=False)  # success, failure, timeout, user_action
    
    # Additional context
    details = Column(JSON, default=dict)  # Extra information about the transition
    duration_ms = Column(Integer, nullable=True)  # Time spent in from_state
    
    # Relationship
    project = relationship("Project", back_populates="orchestration_logs")


# ============================================
# Scene Status Enum (Batch Processing)
# ============================================
class SceneStatus:
    """Status for individual scene/image processing."""
    PENDING = "pending"           # Waiting to be processed
    ANALYZING = "analyzing"       # Spatial analysis in progress
    GENERATING = "generating"     # Generation phases running
    COMPLETED = "completed"       # Successfully processed
    FAILED = "failed"             # Processing failed
    SKIPPED = "skipped"           # User chose to skip this image


# ============================================
# Scenes Table (Batch Processing)
# ============================================
class Scene(Base):
    """
    Scenes table - Individual image processing within a batch project.
    
    Each Scene represents ONE input image that will produce ONE output.
    This enables batch processing where a user uploads multiple images
    (e.g., an entire photoshoot) and each image gets processed independently
    while sharing requirements and style settings.
    
    For virtual staging: Upload 50 photos of a building, get 50 staged outputs.
    """
    __tablename__ = "scenes"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    # Scene identification
    scene_index = Column(Integer, nullable=False, default=0)  # Order in the batch
    name = Column(String(255), nullable=True)  # Optional name (e.g., "living_room_01.jpg")
    
    # Input/Output
    input_image_path = Column(Text, nullable=False)  # Original uploaded image
    output_image_path = Column(Text, nullable=True)  # Final generated image
    
    # Processing state (independent per-scene)
    status = Column(String(50), default=SceneStatus.PENDING, index=True)
    orchestration_state = Column(String(50), default=OrchestrationState.CREATED)
    current_phase = Column(String(50), nullable=True)
    retry_count = Column(Integer, default=0)
    
    # Timing
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    
    # Results
    has_warnings = Column(Boolean, default=False)
    warning_details = Column(JSON, default=list)
    error_message = Column(Text, nullable=True)
    
    # Scene-specific spatial analysis
    space_type_detected = Column(String(100), nullable=True)  # What type of space this image shows
    
    # Metadata
    metadata_ = Column("metadata", JSON, default=dict)
    
    # Relationships
    project = relationship("Project", back_populates="scenes")
    iterations = relationship("Iteration", back_populates="scene", cascade="all, delete-orphan")
    constraints = relationship("Constraint", back_populates="scene", cascade="all, delete-orphan")


# ============================================
# Requirements Table
# ============================================
class Requirements(Base):
    """
    Requirements table - Structured requirements from the Requirements Agent.
    """
    __tablename__ = "requirements"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, unique=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    # Original input
    original_goal = Column(Text, nullable=False)
    
    # Extracted requirements
    space_type = Column(String(100), nullable=True)  # bathroom, kitchen, office, etc.
    style_targets = Column(JSON, default=list)  # Array of style names
    accessibility_required = Column(Boolean, default=False)
    budget_tier = Column(String(50), nullable=True)  # luxury, mid-range, budget
    intended_use = Column(String(100), nullable=True)  # client presentation, planning, marketing
    
    # Additional data
    additional_constraints = Column(JSON, default=dict)
    clarification_responses = Column(JSON, default=dict)  # Questions asked and answers received
    
    # Analysis metadata
    analysis_complete = Column(Boolean, default=False)
    questions_asked = Column(Integer, default=0)
    
    # Relationship
    project = relationship("Project", back_populates="requirements")


# ============================================
# Generation Phase Enum
# ============================================
class GenerationPhase:
    """Generation phase values."""
    CLEANUP = "cleanup"
    STRUCTURAL = "structural"
    FIXTURE = "fixture"
    STYLE = "style"


# ============================================
# Iteration Status Enum
# ============================================
class IterationStatus:
    """Iteration status values."""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"


# ============================================
# Evaluation Status Enum
# ============================================
class EvaluationStatus:
    """Evaluation status values."""
    PENDING = "pending"
    PASSED = "passed"
    FAILED = "failed"


# ============================================
# Evaluation Criterion Enum
# ============================================
class EvaluationCriterion:
    """Evaluation criteria types."""
    CONSTRAINT_COMPLIANCE = "constraint_compliance"
    GEOMETRY_PRESERVATION = "geometry_preservation"
    HALLUCINATION_DETECTION = "hallucination_detection"
    STYLE_EXECUTION = "style_execution"
    PHASE_COMPLETION = "phase_completion"


# ============================================
# Iterations Table (for Mission 04+)
# ============================================
class Iteration(Base):
    """
    Iterations table - Tracks each generation attempt.
    Each row represents one call to the generation model.
    """
    __tablename__ = "iterations"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    scene_id = Column(UUID(as_uuid=True), ForeignKey("scenes.id", ondelete="CASCADE"), nullable=True)  # Links to scene in batch mode
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    
    # Phase and iteration tracking
    phase = Column(String(50), nullable=False)  # cleanup, structural, fixture, style
    iteration_number = Column(Integer, nullable=False, default=1)
    
    # Input/Output references
    input_image_path = Column(Text, nullable=True)  # Path to input image
    output_image_path = Column(Text, nullable=True)  # Path to generated output
    
    # Generation details
    prompt_used = Column(Text, nullable=True)  # Full prompt sent to model
    generation_latency_ms = Column(Integer, nullable=True)  # Time taken in milliseconds
    
    # Policy tracking
    policy_version = Column(Integer, nullable=True)
    
    # Status
    status = Column(String(20), default=IterationStatus.PENDING)  # pending, in_progress, completed, failed
    error_message = Column(Text, nullable=True)
    
    # Evaluation fields (Mission 05)
    evaluation_status = Column(String(20), default=EvaluationStatus.PENDING)  # pending, passed, failed
    evaluation_score = Column(Float, nullable=True)  # 0.0 to 1.0 overall score
    evaluation_result = Column(String(20), nullable=True)  # accepted, rejected
    evaluation_reasons = Column(JSON, default=list)  # Array of pass/fail reasons
    evaluated_at = Column(DateTime(timezone=True), nullable=True)
    evaluator_weave_trace_id = Column(String(255), nullable=True)
    failure_reasons = Column(JSON, default=list)
    
    # Weave tracking
    weave_run_id = Column(String(255), nullable=True)
    
    # Metadata
    metadata_ = Column("metadata", JSON, default=dict)
    
    # Relationships
    project = relationship("Project", back_populates="iterations")
    scene = relationship("Scene", back_populates="iterations")
    evaluation_details = relationship("EvaluationDetail", back_populates="iteration", cascade="all, delete-orphan")


# ============================================
# Evaluation Details Table (Mission 05)
# ============================================
class EvaluationDetail(Base):
    """
    EvaluationDetails table - Granular evaluation feedback per criterion.
    Each row represents evaluation of one criterion for one iteration.
    """
    __tablename__ = "evaluation_details"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    iteration_id = Column(UUID(as_uuid=True), ForeignKey("iterations.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    
    # Criterion info
    criterion = Column(String(50), nullable=False)  # constraint_compliance, geometry_preservation, etc.
    weight = Column(Float, default=1.0)  # Weight in overall score calculation
    
    # Evaluation result
    passed = Column(Boolean, nullable=False)
    score = Column(Float, nullable=False)  # 0.0 to 1.0
    
    # Detailed feedback
    details = Column(Text, nullable=True)  # Human-readable explanation
    evidence = Column(JSON, default=dict)  # Specific findings
    
    # Relationship
    iteration = relationship("Iteration", back_populates="evaluation_details")


# ============================================
# Constraint Classification Enum
# ============================================
class ConstraintClassification:
    """Constraint classification values."""
    LOCKED = "locked"       # Cannot change under any circumstances
    PREFERRED = "preferred"  # Should be preserved but could theoretically change
    FLEXIBLE = "flexible"    # Can be freely modified or removed


# ============================================
# Construction State Enum
# ============================================
class ConstructionState:
    """Construction state values."""
    UNFINISHED = "unfinished"           # Exposed studs, no finishes
    PARTIALLY_COMPLETE = "partially_complete"  # Some finishes, missing fixtures
    EXISTING_FINISH = "existing_finish"  # Currently usable space being redesigned


# ============================================
# Element Types - Spatial Analysis Taxonomy
# ============================================
class ElementType:
    """Element types for spatial analysis."""
    # Structural elements
    EXTERIOR_WALL = "exterior_wall"
    INTERIOR_WALL = "interior_wall"
    FLOOR = "floor"
    CEILING = "ceiling"
    DOOR = "door"
    WINDOW = "window"
    STRUCTURAL_COLUMN = "structural_column"
    BEAM = "beam"
    
    # Plumbing indicators
    FLOOR_DRAIN = "floor_drain"
    TOILET_FLANGE = "toilet_flange"
    SINK_PLUMBING_STUB = "sink_plumbing_stub"
    SHOWER_DRAIN = "shower_drain"
    WATER_HEATER_CONNECTION = "water_heater_connection"
    PIPE_CHASE = "pipe_chase"
    
    # Electrical indicators
    ELECTRICAL_PANEL = "electrical_panel"
    OUTLET_LOCATION = "outlet_location"
    LIGHT_FIXTURE_JUNCTION = "light_fixture_junction"
    SWITCH_LOCATION = "switch_location"
    
    # HVAC indicators
    VENT_LOCATION = "vent_location"
    HVAC_UNIT = "hvac_unit"
    DUCTWORK = "ductwork"
    
    # Movable items
    CONSTRUCTION_DEBRIS = "construction_debris"
    TEMPORARY_FIXTURE = "temporary_fixture"
    FURNITURE = "furniture"
    EQUIPMENT = "equipment"
    STAGING_ITEMS = "staging_items"


# ============================================
# Constraints Table (for Mission 03+)
# ============================================
class Constraint(Base):
    """
    Constraints table - Spatial constraints from analysis.
    Each row represents one identified element in the space.
    """
    __tablename__ = "constraints"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    scene_id = Column(UUID(as_uuid=True), ForeignKey("scenes.id", ondelete="CASCADE"), nullable=True)  # Links to scene in batch mode
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    
    # Element identification
    element_type = Column(String(100), nullable=False)  # floor_drain, plumbing_wall, column, etc.
    element_location = Column(Text, nullable=True)  # Description of where in the image
    
    # Classification
    classification = Column(String(20), nullable=False, default=ConstraintClassification.FLEXIBLE)
    confidence_score = Column(Float, default=1.0)  # 0.0 to 1.0
    
    # Source tracking
    source_image = Column(String(255), nullable=True)  # Which uploaded image
    notes = Column(Text, nullable=True)  # Additional notes about the element
    
    # Metadata
    metadata_ = Column("metadata", JSON, default=dict)
    
    # Relationships
    project = relationship("Project", back_populates="constraints")
    scene = relationship("Scene", back_populates="constraints")


# ============================================
# Project Analysis Table (for Mission 03+)
# ============================================
class ProjectAnalysis(Base):
    """
    ProjectAnalysis table - Overall spatial analysis results.
    One record per project containing high-level findings.
    """
    __tablename__ = "project_analysis"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, unique=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    # Construction state assessment
    construction_state = Column(String(50), nullable=True)  # unfinished, partially_complete, existing_finish
    
    # Analysis summary
    analysis_summary = Column(JSON, default=dict)  # High-level findings
    recommended_phase_sequence = Column(JSON, default=list)  # Recommended generation phases
    
    # Counts for quick reference
    locked_count = Column(Integer, default=0)
    preferred_count = Column(Integer, default=0)
    flexible_count = Column(Integer, default=0)
    
    # Quality indicators
    image_quality_assessment = Column(String(50), nullable=True)  # good, fair, poor
    confidence_overall = Column(Float, default=1.0)
    
    # Weave tracking
    weave_run_id = Column(String(255), nullable=True)
    
    # Relationship
    project = relationship("Project", back_populates="analysis")


# ============================================
# Policies Table (for Mission 05+)
# ============================================
# ============================================
# Policy Creator Enum
# ============================================
class PolicyCreator:
    """Who created the policy."""
    SYSTEM = "system"  # Default/initial policy
    QUALITY_CONTROL = "quality_control"  # Modified by QC agent
    USER = "user"  # User override


class Policy(Base):
    """
    Policies table - Versioned generation policies.
    Contains configuration for each generation phase.
    The Generation Agent reads policy, Quality Control Agent modifies it.
    """
    __tablename__ = "policies"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    
    # Project association (null for default global policies)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=True)
    
    # Version tracking
    version = Column(Integer, nullable=False, index=True, default=1)
    parent_version = Column(Integer, nullable=True)  # For evolution tracking
    
    # Phase configurations (JSON with prompt_template, creativity_level, constraint_emphasis, max_retries)
    cleanup_config = Column(JSON, default=dict)
    structural_config = Column(JSON, default=dict)
    fixture_config = Column(JSON, default=dict)
    style_config = Column(JSON, default=dict)
    
    # Legacy field for backwards compatibility
    configuration = Column(JSON, default=dict)
    
    # Tracking
    created_by = Column(String(50), default=PolicyCreator.SYSTEM)  # system, quality_control, user
    weave_run_id = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)
    
    # Whether this is the active policy
    is_active = Column(Boolean, default=True)


# ============================================
# Policy Changes Table (Mission 05)
# ============================================
class PolicyChange(Base):
    """
    PolicyChanges table - Tracks policy modifications made by QC agent.
    Provides audit trail of how policies evolved through self-improvement.
    """
    __tablename__ = "policy_changes"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    
    # Project and policy references
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    old_policy_id = Column(Integer, ForeignKey("policies.id"), nullable=False)
    new_policy_id = Column(Integer, ForeignKey("policies.id"), nullable=False)
    
    # Trigger information
    trigger_iteration_id = Column(UUID(as_uuid=True), ForeignKey("iterations.id"), nullable=True)
    trigger_reason = Column(String(100), nullable=True)  # constraint_violation, hallucination, style_mismatch
    
    # Change details
    changes_made = Column(JSON, nullable=False)  # Detailed description of what changed
    rationale = Column(Text, nullable=True)  # Explanation of why changes were made
    
    # Effectiveness tracking
    improvement_observed = Column(Boolean, nullable=True)  # Did it help?
    
    # Weave tracking
    weave_run_id = Column(String(255), nullable=True)


# ============================================
# Reference Images Table (Browserbase Integration)
# ============================================
class ReferenceImage(Base):
    """
    ReferenceImages table - Stores web-scraped inspiration images.
    
    These are images fetched via Browserbase from design websites
    that users can select as style references for the Generation Agent.
    """
    __tablename__ = "reference_images"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    
    # Image data
    url = Column(Text, nullable=False)  # URL of the image
    thumbnail_url = Column(Text, nullable=True)  # Smaller version for preview
    source_site = Column(String(100), nullable=True)  # pinterest, houzz, dezeen, etc.
    title = Column(Text, nullable=True)  # Title/description from source
    
    # Selection state
    is_selected = Column(Boolean, default=False)  # User selected this as reference
    selection_order = Column(Integer, nullable=True)  # Order of selection (1st, 2nd, etc.)
    
    # Search context
    search_query = Column(Text, nullable=True)  # Query used to find this image
    search_styles = Column(JSON, default=list)  # Style filters used
    search_space_type = Column(String(100), nullable=True)  # Space type filter used
    
    # Metadata
    metadata_ = Column("metadata", JSON, default=dict)


# ============================================
# System Status Table (from Mission 01)
# ============================================
class SystemStatus(Base):
    """
    Simple table for testing database connectivity.
    """
    __tablename__ = "system_status"
    
    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    message = Column(Text, nullable=False)
