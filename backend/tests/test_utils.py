"""
Continuity - Test Utilities
Common fixtures and helpers for testing the self-improvement loop.
"""

import asyncio
import os
import sys
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from uuid import uuid4
import json

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import weave
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.models import (
    Base, Project, Requirements, Policy, Constraint, Iteration,
    OrchestrationState, ProjectStatus, ConstraintClassification,
    GenerationPhase, EvaluationStatus, PolicyCreator
)


# ============================================
# Test Configuration
# ============================================
class TestConfig:
    """Configuration for test runs."""
    # Database URL (uses same as app)
    DATABASE_URL = settings.database_url.replace("postgresql://", "postgresql+asyncpg://")
    
    # Test image (base64 placeholder or URL)
    TEST_IMAGE_URL = "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800"
    
    # Test parameters
    TEST_PROJECT_PREFIX = "test_self_improvement_"
    CLEANUP_TEST_PROJECTS = True
    
    # Weave project for tests
    WEAVE_PROJECT = settings.weave_project_name or "continuity-tests"


# ============================================
# Database Session Factory
# ============================================
_engine = None
_async_session = None


async def get_test_session() -> AsyncSession:
    """Get an async database session for testing."""
    global _engine, _async_session
    
    if _engine is None:
        _engine = create_async_engine(
            TestConfig.DATABASE_URL,
            echo=False,
            pool_pre_ping=True,
        )
        _async_session = sessionmaker(
            _engine,
            class_=AsyncSession,
            expire_on_commit=False,
        )
    
    return _async_session()


async def cleanup_test_session(session: AsyncSession):
    """Close and cleanup test session."""
    await session.close()


# ============================================
# Test Project Factory
# ============================================
async def create_test_project(
    session: AsyncSession,
    name: Optional[str] = None,
    goal: str = "Transform this bathroom into a modern spa-like retreat",
    style_targets: List[str] = None,
    images: List[str] = None,
) -> Project:
    """Create a test project with initial data."""
    project = Project(
        id=uuid4(),
        goal=goal,
        images=images or [TestConfig.TEST_IMAGE_URL],
        status=ProjectStatus.CREATED,
        orchestration_state=OrchestrationState.CREATED,
        metadata_={"name": name or f"{TestConfig.TEST_PROJECT_PREFIX}{datetime.now().strftime('%H%M%S')}"},
    )
    session.add(project)
    await session.flush()
    return project


async def create_test_requirements(
    session: AsyncSession,
    project_id,
    requirements_data: Optional[Dict[str, Any]] = None,
) -> Requirements:
    """Create test requirements for a project."""
    data = requirements_data or {
        "space_type": "bathroom",
        "style_preferences": ["modern", "spa"],
        "budget_tier": "mid-range",
        "accessibility_required": False,
        "use_case": "personal",
    }
    
    req = Requirements(
        project_id=project_id,
        original_goal="Transform into modern spa bathroom",
        space_type=data.get("space_type", "bathroom"),
        style_targets=data.get("style_preferences", ["modern"]),
        budget_tier=data.get("budget_tier", "mid-range"),
        accessibility_required=data.get("accessibility_required", False),
        intended_use=data.get("use_case", "personal"),
        clarification_responses={},
        analysis_complete=True,
    )
    session.add(req)
    await session.flush()
    return req


async def create_test_policy(
    session: AsyncSession,
    project_id,
    version: int = 1,
) -> Policy:
    """Create a test policy for a project."""
    policy = Policy(
        project_id=project_id,
        version=version,
        created_by=PolicyCreator.USER,
        cleanup_config={
            "prompt_template": "Clean up the space, remove debris and construction materials.",
            "max_retries": 2,
            "creativity_level": 0.5,
            "constraint_emphasis": "medium",
        },
        structural_config={
            "prompt_template": "Complete walls, ceiling, and flooring.",
            "max_retries": 2,
            "creativity_level": 0.5,
            "constraint_emphasis": "medium",
        },
        fixture_config={
            "prompt_template": "Install fixtures and features appropriate for the space.",
            "max_retries": 2,
            "creativity_level": 0.5,
            "constraint_emphasis": "medium",
        },
        style_config={
            "prompt_template": "Apply the target design style with appropriate materials.",
            "max_retries": 2,
            "creativity_level": 0.7,
            "constraint_emphasis": "medium",
        },
    )
    session.add(policy)
    await session.flush()
    return policy


async def create_test_constraints(
    session: AsyncSession,
    project_id,
) -> List[Constraint]:
    """Create test constraints for a project."""
    constraints = [
        Constraint(
            project_id=project_id,
            element_type="window",
            element_location="right wall",
            classification=ConstraintClassification.LOCKED,
            confidence_score=0.95,
            notes="Detected by spatial_agent",
        ),
        Constraint(
            project_id=project_id,
            element_type="door",
            element_location="left wall",
            classification=ConstraintClassification.LOCKED,
            confidence_score=0.92,
            notes="Detected by spatial_agent",
        ),
        Constraint(
            project_id=project_id,
            element_type="toilet",
            element_location="back corner",
            classification=ConstraintClassification.LOCKED,
            confidence_score=0.88,
            notes="Detected by spatial_agent",
        ),
    ]
    
    for c in constraints:
        session.add(c)
    await session.flush()
    return constraints


async def create_test_iteration(
    session: AsyncSession,
    project_id,
    policy_version: int,
    phase: GenerationPhase = GenerationPhase.CLEANUP,
    iteration_number: int = 1,
    passed: bool = False,
    score: float = 0.5,
) -> Iteration:
    """Create a test iteration for evaluation testing."""
    from app.models import IterationStatus
    
    iteration = Iteration(
        project_id=project_id,
        policy_version=policy_version,
        phase=phase,
        iteration_number=iteration_number,
        input_image_path=TestConfig.TEST_IMAGE_URL,
        output_image_path=TestConfig.TEST_IMAGE_URL,  # Same for test
        prompt_used="Test prompt for generation",
        status=IterationStatus.COMPLETED,
        evaluation_status=EvaluationStatus.PASSED if passed else EvaluationStatus.FAILED,
        evaluation_score=score,
        evaluation_result="accepted" if passed else "rejected",
        evaluation_reasons=[{"test": True}],
        evaluated_at=datetime.now(timezone.utc) if passed else None,
        metadata_={
            "test_iteration": True,
            "target_style": "modern",
        },
    )
    session.add(iteration)
    await session.flush()
    return iteration


# ============================================
# Test Result Tracking
# ============================================
class TestResult:
    """Track results from a test run."""
    
    def __init__(self, test_name: str):
        self.test_name = test_name
        self.started_at = datetime.now(timezone.utc)
        self.completed_at: Optional[datetime] = None
        self.passed = False
        self.steps: List[Dict[str, Any]] = []
        self.errors: List[str] = []
        self.metrics: Dict[str, Any] = {}
        self.weave_trace_url: Optional[str] = None
    
    def add_step(self, name: str, status: str, details: Optional[Dict] = None):
        """Add a test step result."""
        self.steps.append({
            "name": name,
            "status": status,
            "details": details or {},
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        print(f"  [{status.upper()}] {name}")
    
    def add_error(self, error: str):
        """Add an error message."""
        self.errors.append(error)
        print(f"  [ERROR] {error}")
    
    def complete(self, passed: bool):
        """Mark test as complete."""
        self.passed = passed
        self.completed_at = datetime.now(timezone.utc)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "test_name": self.test_name,
            "passed": self.passed,
            "started_at": self.started_at.isoformat(),
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "duration_ms": int((self.completed_at - self.started_at).total_seconds() * 1000) if self.completed_at else None,
            "steps": self.steps,
            "errors": self.errors,
            "metrics": self.metrics,
            "weave_trace_url": self.weave_trace_url,
        }
    
    def print_summary(self):
        """Print a summary of the test."""
        status = "PASSED" if self.passed else "FAILED"
        duration = ""
        if self.completed_at:
            ms = int((self.completed_at - self.started_at).total_seconds() * 1000)
            duration = f" ({ms}ms)"
        
        print(f"\n{'='*60}")
        print(f"Test: {self.test_name} - {status}{duration}")
        print(f"{'='*60}")
        
        for step in self.steps:
            print(f"  [{step['status'].upper():8}] {step['name']}")
        
        if self.errors:
            print(f"\nErrors:")
            for error in self.errors:
                print(f"  - {error}")
        
        if self.metrics:
            print(f"\nMetrics:")
            for key, value in self.metrics.items():
                print(f"  {key}: {value}")
        
        if self.weave_trace_url:
            print(f"\nWeave Trace: {self.weave_trace_url}")


# ============================================
# Weave Integration Helpers
# ============================================
def init_weave_for_tests():
    """Initialize Weave for test runs."""
    try:
        weave.init(TestConfig.WEAVE_PROJECT)
        print(f"Weave initialized: {TestConfig.WEAVE_PROJECT}")
        return True
    except Exception as e:
        print(f"Weave initialization failed: {e}")
        return False


def get_weave_trace_url() -> Optional[str]:
    """Get the URL for the current Weave trace."""
    try:
        # Weave doesn't expose this directly, but we can construct it
        entity = os.getenv("WANDB_ENTITY", "")
        project = TestConfig.WEAVE_PROJECT.split("/")[-1] if "/" in TestConfig.WEAVE_PROJECT else TestConfig.WEAVE_PROJECT
        return f"https://wandb.ai/{entity}/{project}/weave"
    except Exception:
        return None


# ============================================
# Cleanup Helpers
# ============================================
async def cleanup_test_project(session: AsyncSession, project_id):
    """Clean up a test project and related data."""
    from sqlalchemy import delete
    from app.models import PolicyChange, EvaluationDetail, ProjectAnalysis
    
    try:
        # Delete in order due to foreign keys (most dependent first)
        # PolicyChange references iterations, so delete it first
        await session.execute(delete(PolicyChange).where(PolicyChange.project_id == project_id))
        # EvaluationDetail references iterations
        await session.execute(
            delete(EvaluationDetail).where(
                EvaluationDetail.iteration_id.in_(
                    select(Iteration.id).where(Iteration.project_id == project_id)
                )
            )
        )
        await session.execute(delete(Iteration).where(Iteration.project_id == project_id))
        await session.execute(delete(Constraint).where(Constraint.project_id == project_id))
        await session.execute(delete(ProjectAnalysis).where(ProjectAnalysis.project_id == project_id))
        await session.execute(delete(Policy).where(Policy.project_id == project_id))
        await session.execute(delete(Requirements).where(Requirements.project_id == project_id))
        await session.execute(delete(Project).where(Project.id == project_id))
        await session.commit()
    except Exception as e:
        print(f"Cleanup error: {e}")
        await session.rollback()
