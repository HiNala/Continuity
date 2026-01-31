"""
Continuity - Projects API Routes
Handles project creation, requirements gathering, spatial analysis, and project management.
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
from app.models import Project, Requirements, ProjectStatus, Constraint, ProjectAnalysis
from app.agents.requirements_agent import requirements_agent
from app.agents.spatial_agent import spatial_agent


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


# ============================================
# Spatial Analysis Models (Mission 03)
# ============================================
class ConstraintItem(BaseModel):
    """A single spatial constraint."""
    id: str
    element_type: str
    location: Optional[str]
    classification: str
    confidence: float
    notes: Optional[str]


class AnalysisSummaryResponse(BaseModel):
    """High-level spatial analysis summary."""
    project_id: str
    construction_state: Optional[str]
    image_quality: Optional[str]
    confidence_overall: float
    locked_count: int
    preferred_count: int
    flexible_count: int
    summary: str
    recommended_phases: List[str]
    analyzed_at: str


class ConstraintsResponse(BaseModel):
    """Full constraints response with all identified elements."""
    project_id: str
    total_constraints: int
    locked: List[ConstraintItem]
    preferred: List[ConstraintItem]
    flexible: List[ConstraintItem]


class AnalyzeSpaceRequest(BaseModel):
    """Request to analyze space - can override project images."""
    image_urls: Optional[List[str]] = Field(
        default=None,
        description="Optional image URLs to analyze. If not provided, uses project images."
    )


# ============================================
# Spatial Analysis Endpoints (Mission 03)
# ============================================
@router.post("/{project_id}/analyze-space", response_model=AnalysisSummaryResponse)
async def analyze_space(
    project_id: UUID,
    request: Optional[AnalyzeSpaceRequest] = None,
    session: AsyncSession = Depends(get_async_session)
):
    """
    Trigger spatial analysis on the project's images.
    
    The Spatial Analysis Agent examines the uploaded images to identify
    physical constraints like floor drains, plumbing, structural elements,
    and movable items.
    """
    # Get the project
    result = await session.execute(
        select(Project).where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Check if analysis already exists
    existing = await session.execute(
        select(ProjectAnalysis).where(ProjectAnalysis.project_id == project_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail="Spatial analysis already completed for this project"
        )
    
    # Get images to analyze
    images = (request.image_urls if request and request.image_urls else project.images) or []
    
    if not images:
        # No images - create a placeholder analysis
        placeholder_analysis = ProjectAnalysis(
            project_id=project_id,
            construction_state=None,
            analysis_summary={"summary": "No images provided for analysis"},
            recommended_phase_sequence=["style"],
            locked_count=0,
            preferred_count=0,
            flexible_count=0,
            image_quality_assessment="none",
            confidence_overall=0.0,
        )
        session.add(placeholder_analysis)
        project.status = ProjectStatus.ANALYZING
        await session.commit()
        
        return AnalysisSummaryResponse(
            project_id=str(project_id),
            construction_state=None,
            image_quality="none",
            confidence_overall=0.0,
            locked_count=0,
            preferred_count=0,
            flexible_count=0,
            summary="No images provided for analysis. Add images to get spatial constraints.",
            recommended_phases=["style"],
            analyzed_at=datetime.now(timezone.utc).isoformat(),
        )
    
    # Prepare and analyze each image
    analyses = []
    for idx, image_path in enumerate(images):
        prepared = spatial_agent.prepare_image(image_path)
        if prepared:
            analysis = await spatial_agent.analyze_single_image(prepared, idx)
            analyses.append(analysis)
    
    # Merge results if multiple images
    merged = spatial_agent.merge_multi_image_analysis(analyses)
    
    # Classify elements
    elements = merged.get("elements", [])
    classified = spatial_agent.classify_elements(elements)
    
    # Assess construction state
    construction_state = spatial_agent.assess_construction_state(merged)
    merged["construction_state"] = construction_state
    
    # Save to database
    project_analysis = await spatial_agent.save_constraints(
        session, project_id, merged, classified
    )
    
    await session.commit()
    
    return AnalysisSummaryResponse(
        project_id=str(project_id),
        construction_state=project_analysis.construction_state,
        image_quality=project_analysis.image_quality_assessment,
        confidence_overall=project_analysis.confidence_overall,
        locked_count=project_analysis.locked_count,
        preferred_count=project_analysis.preferred_count,
        flexible_count=project_analysis.flexible_count,
        summary=merged.get("summary", "Analysis complete"),
        recommended_phases=project_analysis.recommended_phase_sequence or [],
        analyzed_at=project_analysis.created_at.isoformat(),
    )


@router.get("/{project_id}/constraints", response_model=ConstraintsResponse)
async def get_constraints(
    project_id: UUID,
    session: AsyncSession = Depends(get_async_session)
):
    """
    Retrieve all spatial constraints for a project.
    """
    # Get all constraints for the project
    result = await session.execute(
        select(Constraint).where(Constraint.project_id == project_id)
    )
    constraints = result.scalars().all()
    
    if not constraints:
        raise HTTPException(
            status_code=404,
            detail="No constraints found. Call /analyze-space first."
        )
    
    # Group by classification
    locked = []
    preferred = []
    flexible = []
    
    for c in constraints:
        item = ConstraintItem(
            id=str(c.id),
            element_type=c.element_type,
            location=c.element_location,
            classification=c.classification,
            confidence=c.confidence_score,
            notes=c.notes,
        )
        
        if c.classification == "locked":
            locked.append(item)
        elif c.classification == "preferred":
            preferred.append(item)
        else:
            flexible.append(item)
    
    return ConstraintsResponse(
        project_id=str(project_id),
        total_constraints=len(constraints),
        locked=locked,
        preferred=preferred,
        flexible=flexible,
    )


@router.get("/{project_id}/analysis-summary", response_model=AnalysisSummaryResponse)
async def get_analysis_summary(
    project_id: UUID,
    session: AsyncSession = Depends(get_async_session)
):
    """
    Retrieve the high-level spatial analysis summary.
    """
    result = await session.execute(
        select(ProjectAnalysis).where(ProjectAnalysis.project_id == project_id)
    )
    analysis = result.scalar_one_or_none()
    
    if not analysis:
        raise HTTPException(
            status_code=404,
            detail="Analysis not found. Call /analyze-space first."
        )
    
    return AnalysisSummaryResponse(
        project_id=str(project_id),
        construction_state=analysis.construction_state,
        image_quality=analysis.image_quality_assessment,
        confidence_overall=analysis.confidence_overall,
        locked_count=analysis.locked_count,
        preferred_count=analysis.preferred_count,
        flexible_count=analysis.flexible_count,
        summary=analysis.analysis_summary.get("summary", "") if analysis.analysis_summary else "",
        recommended_phases=analysis.recommended_phase_sequence or [],
        analyzed_at=analysis.created_at.isoformat(),
    )
