"""
Continuity - Projects API Routes
Handles project creation, requirements gathering, and project management.
"""

from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import get_async_session
from app.models import Project, Requirements, ProjectStatus
from app.agents.requirements_agent import requirements_agent


router = APIRouter(prefix="/api/projects", tags=["Projects"])


# ============================================
# Request/Response Models
# ============================================
class CreateProjectRequest(BaseModel):
    """Request to create a new project."""
    goal: str = Field(..., min_length=1, description="The user's goal for the visualization")
    images: List[str] = Field(default=[], description="List of image URLs or paths")
    user_id: Optional[str] = Field(default=None, description="User identifier (optional)")


class CreateProjectResponse(BaseModel):
    """Response after creating a project."""
    project_id: str
    status: str
    created_at: str
    message: str


class QuestionOption(BaseModel):
    """A single answer option for a clarifying question."""
    answer_id: str
    answer_text: str


class ClarifyingQuestion(BaseModel):
    """A clarifying question to ask the user."""
    question_id: str
    question_text: str
    possible_answers: List[QuestionOption]
    multi_select: bool = False


class AnalyzeGoalResponse(BaseModel):
    """Response from goal analysis."""
    project_id: str
    original_goal: str
    identified: Dict[str, Any]
    questions: List[ClarifyingQuestion]
    questions_needed: bool


class SubmitAnswersRequest(BaseModel):
    """Request to submit answers to clarifying questions."""
    responses: Dict[str, Any] = Field(..., description="Map of question_id to answer_id(s)")


class RequirementsResponse(BaseModel):
    """Response containing structured requirements."""
    project_id: str
    original_goal: str
    space_type: Optional[str]
    style_targets: List[str]
    accessibility_required: bool
    budget_tier: Optional[str]
    intended_use: Optional[str]
    questions_asked: int
    created_at: str


class ProjectResponse(BaseModel):
    """Full project response."""
    project_id: str
    status: str
    goal: Optional[str]
    images: List[str]
    created_at: str
    updated_at: str
    has_requirements: bool


# ============================================
# API Endpoints
# ============================================
@router.post("", response_model=CreateProjectResponse)
async def create_project(
    request: CreateProjectRequest,
    session: AsyncSession = Depends(get_async_session)
):
    """
    Create a new visualization project.
    
    This is the starting point of the pipeline. The user provides
    their goal text and optionally image URLs.
    """
    project = Project(
        goal=request.goal,
        images=request.images,
        user_id=request.user_id,
        status=ProjectStatus.CREATED,
    )
    
    session.add(project)
    await session.commit()
    await session.refresh(project)
    
    return CreateProjectResponse(
        project_id=str(project.id),
        status=project.status,
        created_at=project.created_at.isoformat(),
        message="Project created successfully. Call /analyze-goal to begin requirements gathering.",
    )


@router.post("/{project_id}/analyze-goal", response_model=AnalyzeGoalResponse)
async def analyze_goal(
    project_id: UUID,
    session: AsyncSession = Depends(get_async_session)
):
    """
    Analyze the project's goal and generate clarifying questions.
    
    The Requirements Agent analyzes the goal text to identify what
    information is already specified and what needs to be clarified.
    """
    # Get the project
    result = await session.execute(
        select(Project).where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    if not project.goal:
        raise HTTPException(status_code=400, detail="Project has no goal text")
    
    # Analyze the goal
    analysis = requirements_agent.analyze_goal(project.goal)
    
    # Generate questions for missing information
    questions_data = requirements_agent.generate_questions(analysis)
    
    # Convert to response format
    questions = [
        ClarifyingQuestion(
            question_id=q["question_id"],
            question_text=q["question_text"],
            possible_answers=[
                QuestionOption(answer_id=a["answer_id"], answer_text=a["answer_text"])
                for a in q["possible_answers"]
            ],
            multi_select=q.get("multi_select", False),
        )
        for q in questions_data
    ]
    
    return AnalyzeGoalResponse(
        project_id=str(project_id),
        original_goal=project.goal,
        identified=analysis["identified"],
        questions=questions,
        questions_needed=len(questions) > 0,
    )


@router.post("/{project_id}/submit-answers", response_model=RequirementsResponse)
async def submit_answers(
    project_id: UUID,
    request: SubmitAnswersRequest,
    session: AsyncSession = Depends(get_async_session)
):
    """
    Submit answers to clarifying questions and save structured requirements.
    
    After the user answers all questions, this endpoint processes the
    responses and creates a structured requirements specification.
    """
    # Get the project
    result = await session.execute(
        select(Project).where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Check if requirements already exist
    req_result = await session.execute(
        select(Requirements).where(Requirements.project_id == project_id)
    )
    existing = req_result.scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=400,
            detail="Requirements already submitted for this project"
        )
    
    # Re-analyze the goal to get the analysis object
    analysis = requirements_agent.analyze_goal(project.goal)
    
    # Process the responses
    specification = requirements_agent.process_responses(analysis, request.responses)
    
    # Save to database
    requirements = await requirements_agent.save_requirements(
        session, project_id, specification
    )
    
    await session.commit()
    
    return RequirementsResponse(
        project_id=str(project_id),
        original_goal=requirements.original_goal,
        space_type=requirements.space_type,
        style_targets=requirements.style_targets or [],
        accessibility_required=requirements.accessibility_required,
        budget_tier=requirements.budget_tier,
        intended_use=requirements.intended_use,
        questions_asked=requirements.questions_asked,
        created_at=requirements.created_at.isoformat(),
    )


@router.get("/{project_id}/requirements", response_model=RequirementsResponse)
async def get_requirements(
    project_id: UUID,
    session: AsyncSession = Depends(get_async_session)
):
    """
    Retrieve the structured requirements for a project.
    """
    result = await session.execute(
        select(Requirements).where(Requirements.project_id == project_id)
    )
    requirements = result.scalar_one_or_none()
    
    if not requirements:
        raise HTTPException(
            status_code=404,
            detail="Requirements not found. Call /analyze-goal first."
        )
    
    return RequirementsResponse(
        project_id=str(project_id),
        original_goal=requirements.original_goal,
        space_type=requirements.space_type,
        style_targets=requirements.style_targets or [],
        accessibility_required=requirements.accessibility_required,
        budget_tier=requirements.budget_tier,
        intended_use=requirements.intended_use,
        questions_asked=requirements.questions_asked,
        created_at=requirements.created_at.isoformat(),
    )


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: UUID,
    session: AsyncSession = Depends(get_async_session)
):
    """
    Get project details.
    """
    result = await session.execute(
        select(Project)
        .options(selectinload(Project.requirements))
        .where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    return ProjectResponse(
        project_id=str(project.id),
        status=project.status,
        goal=project.goal,
        images=project.images or [],
        created_at=project.created_at.isoformat(),
        updated_at=project.updated_at.isoformat(),
        has_requirements=project.requirements is not None,
    )


@router.get("", response_model=List[ProjectResponse])
async def list_projects(
    session: AsyncSession = Depends(get_async_session),
    limit: int = 20,
    offset: int = 0,
):
    """
    List all projects.
    """
    result = await session.execute(
        select(Project)
        .options(selectinload(Project.requirements))
        .order_by(Project.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    projects = result.scalars().all()
    
    return [
        ProjectResponse(
            project_id=str(p.id),
            status=p.status,
            goal=p.goal,
            images=p.images or [],
            created_at=p.created_at.isoformat(),
            updated_at=p.updated_at.isoformat(),
            has_requirements=p.requirements is not None,
        )
        for p in projects
    ]
