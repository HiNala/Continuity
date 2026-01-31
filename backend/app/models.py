"""
Continuity - Database Models
SQLAlchemy models for all database tables.
"""

from datetime import datetime, timezone
from typing import Optional, List
from uuid import uuid4

from sqlalchemy import (
    Column, String, Text, Boolean, Float, Integer,
    DateTime, ForeignKey, JSON, Enum as SQLEnum
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
    images = Column(JSON, default=list)  # Array of image paths/URLs
    
    # Metadata
    metadata_ = Column("metadata", JSON, default=dict)
    
    # Relationships
    requirements = relationship("Requirements", back_populates="project", uselist=False, cascade="all, delete-orphan")
    iterations = relationship("Iteration", back_populates="project", cascade="all, delete-orphan")
    constraints = relationship("Constraint", back_populates="project", cascade="all, delete-orphan")


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
# Iterations Table (for Mission 04+)
# ============================================
class Iteration(Base):
    """
    Iterations table - Tracks each generation attempt.
    """
    __tablename__ = "iterations"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    
    # Iteration data
    phase = Column(String(50), nullable=False)  # cleanup, structural, fixture, style
    iteration_number = Column(Integer, nullable=False)
    input_reference = Column(Text, nullable=True)
    output_reference = Column(Text, nullable=True)
    
    # Policy and evaluation
    policy_version = Column(Integer, nullable=True)
    evaluation_result = Column(String(20), nullable=True)  # accepted, rejected
    failure_reasons = Column(JSON, default=list)
    
    # Metadata
    metadata_ = Column("metadata", JSON, default=dict)
    weave_run_id = Column(String(255), nullable=True)
    
    # Relationship
    project = relationship("Project", back_populates="iterations")


# ============================================
# Constraints Table (for Mission 03+)
# ============================================
class Constraint(Base):
    """
    Constraints table - Spatial constraints from analysis.
    """
    __tablename__ = "constraints"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    
    # Constraint data
    element_type = Column(String(100), nullable=False)  # floor_drain, plumbing_wall, column, etc.
    location = Column(JSON, nullable=True)  # Position data
    classification = Column(String(20), nullable=False)  # locked, preferred, flexible
    confidence = Column(Float, default=1.0)
    
    # Metadata
    metadata_ = Column("metadata", JSON, default=dict)
    
    # Relationship
    project = relationship("Project", back_populates="constraints")


# ============================================
# Policies Table (for Mission 05+)
# ============================================
class Policy(Base):
    """
    Policies table - Versioned generation policies.
    """
    __tablename__ = "policies"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    
    version = Column(Integer, nullable=False, index=True)
    parent_version = Column(Integer, nullable=True)
    configuration = Column(JSON, nullable=False)
    
    # Tracking
    weave_run_id = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)


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
