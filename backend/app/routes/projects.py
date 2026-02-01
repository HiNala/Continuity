"""
Continuity - Projects API Routes
Handles project creation, requirements gathering, spatial analysis, and project management.
"""

import asyncio
import json
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional, AsyncGenerator
from uuid import UUID

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload

from app.database import get_async_session
from app.config import settings
from app.models import (
    Project, Requirements, ProjectStatus, Constraint, ProjectAnalysis,
    Iteration, EvaluationDetail, OrchestrationLog,
    EvaluationStatus, OrchestrationState
)
from app.agents.requirements_agent import requirements_agent
from app.agents.spatial_agent import spatial_agent
from app.agents.generation_agent import generation_agent
from app.agents.qc_agent import qc_agent
from app.orchestrator import Orchestrator


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
    question_type: Optional[str] = None
    scene_scope: Optional[str] = None


class InspirationImage(BaseModel):
    """An inspiration image from Browserbase."""
    id: str
    url: str
    thumbnail: str
    description: str
    source: str


class StyleInspiration(BaseModel):
    """Inspiration images for a specific style."""
    style: str
    images: List[InspirationImage]


class InspirationData(BaseModel):
    """Collection of inspiration images."""
    inspiration_available: bool = True
    style_inspiration: List[StyleInspiration] = []
    space_inspiration: List[InspirationImage] = []
    general_inspiration: List[InspirationImage] = []


class ImageAnalysisResult(BaseModel):
    """Result of image analysis before asking questions."""
    analyzed: bool = False
    space_type: Optional[str] = None
    space_type_confidence: Optional[float] = None
    space_type_reasoning: Optional[str] = None
    construction_state: Optional[str] = None
    existing_styles: List[str] = []
    accessibility_features: List[str] = []


class AnalyzeGoalResponse(BaseModel):
    """Response from goal analysis, including inspiration images."""
    project_id: str
    original_goal: str
    identified: Dict[str, Any]
    questions: List[ClarifyingQuestion]
    questions_needed: bool
    inspiration: Optional[InspirationData] = None
    # NEW: Explicit image analysis results for frontend display
    image_analysis: Optional[ImageAnalysisResult] = None


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
    
    This endpoint is now SMART about image analysis:
    1. First analyzes uploaded images to detect space type, existing styles, etc.
    2. Combines image analysis with text analysis
    3. Only asks questions for truly missing/ambiguous information
    4. Provides context in questions when we detected something from images
    
    This reduces unnecessary questions like "What type of space is this?"
    when we can clearly see the environment from the uploaded photo.
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
    
    # ============================================
    # Step 1: Analyze images if present
    # ============================================
    image_analysis = None
    if project.images and len(project.images) > 0:
        try:
            image_analysis = await requirements_agent.analyze_images(project.images)
        except Exception as e:
            # Log but don't fail - image analysis is optional enhancement
            print(f"Image analysis failed for project {project_id}: {e}")
            image_analysis = None
    
    # ============================================
    # Step 2: Analyze goal text + image results
    # ============================================
    analysis = requirements_agent.analyze_goal(project.goal, image_analysis)
    
    # ============================================
    # Step 3: Generate smart questions
    # ============================================
    questions_data = requirements_agent.generate_questions(analysis)
    
    # Convert to response format, including suggested answers if available
    questions = []
    for q in questions_data:
        question = ClarifyingQuestion(
            question_id=q["question_id"],
            question_text=q["question_text"],
            possible_answers=[
                QuestionOption(answer_id=a["answer_id"], answer_text=a["answer_text"])
                for a in q["possible_answers"]
            ],
            multi_select=q.get("multi_select", False),
            question_type=q.get("question_type"),
            scene_scope=q.get("scene_scope"),
        )
        questions.append(question)

    # Add cross-scene batch questions when multiple images are present
    if project.images and len(project.images) > 1:
        batch_questions = requirements_agent.generate_batch_questions(
            analysis,
            image_analysis=image_analysis
        )
        for q in batch_questions:
            if len(questions) >= requirements_agent.max_questions:
                break
            questions.append(
                ClarifyingQuestion(
                    question_id=q["question_id"],
                    question_text=q["question_text"],
                    possible_answers=[
                        QuestionOption(answer_id=a["answer_id"], answer_text=a["answer_text"])
                        for a in q["possible_answers"]
                    ],
                    multi_select=q.get("multi_select", False),
                    question_type=q.get("question_type"),
                    scene_scope=q.get("scene_scope"),
                )
            )
    
    # Build response with auto-detected info
    identified = analysis["identified"]
    
    # Add auto_detected info to identified for frontend display
    if analysis.get("auto_detected"):
        identified["_auto_detected"] = analysis["auto_detected"]
        identified["_image_analysis_used"] = analysis.get("image_analysis_used", False)
    
    # ============================================
    # Step 4: Fetch inspiration images (Browserbase)
    # ============================================
    inspiration_data = None
    try:
        # Extract detected values for inspiration search
        space_type = identified.get("space_type")
        if not space_type and analysis.get("auto_detected", {}).get("space_type_suggestion"):
            space_type = analysis["auto_detected"]["space_type_suggestion"]["value"]
        
        styles = identified.get("styles", [])
        if not styles and analysis.get("auto_detected", {}).get("style_suggestions"):
            styles = analysis["auto_detected"]["style_suggestions"]
        
        # Fetch inspiration
        inspiration = await requirements_agent.fetch_inspiration(
            goal=project.goal,
            space_type=space_type,
            styles=styles,
            limit=8,
        )
        
        if inspiration.get("inspiration_available"):
            # Convert to response model
            style_inspiration = [
                StyleInspiration(
                    style=s["style"],
                    images=[InspirationImage(**img) for img in s.get("images", [])]
                )
                for s in inspiration.get("style_inspiration", [])
            ]
            
            inspiration_data = InspirationData(
                inspiration_available=True,
                style_inspiration=style_inspiration,
                space_inspiration=[
                    InspirationImage(**img) for img in inspiration.get("space_inspiration", [])
                ],
                general_inspiration=[
                    InspirationImage(**img) for img in inspiration.get("general_inspiration", [])
                ],
            )
    except Exception as e:
        print(f"Inspiration fetch failed: {e}")
        # Continue without inspiration - it's enhancement only
    
    # Build image analysis result for frontend
    image_analysis_result = None
    if image_analysis and image_analysis.get("analyzed"):
        image_analysis_result = ImageAnalysisResult(
            analyzed=True,
            space_type=image_analysis.get("space_type"),
            space_type_confidence=image_analysis.get("space_type_confidence"),
            space_type_reasoning=image_analysis.get("space_type_reasoning"),
            construction_state=image_analysis.get("construction_state"),
            existing_styles=image_analysis.get("existing_styles", []),
            accessibility_features=image_analysis.get("accessibility_features", []),
        )
    
    return AnalyzeGoalResponse(
        project_id=str(project_id),
        original_goal=project.goal,
        identified=identified,
        questions=questions,
        questions_needed=len(questions) > 0,
        inspiration=inspiration_data,
        image_analysis=image_analysis_result,
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
    
    This endpoint also uses image analysis to combine auto-detected
    information with user responses.
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
    
    # Re-analyze images if present (for process_responses to use auto-detected values)
    image_analysis = None
    if project.images and len(project.images) > 0:
        try:
            image_analysis = await requirements_agent.analyze_images(project.images)
        except Exception:
            pass
    
    # Re-analyze the goal to get the analysis object (with image context)
    analysis = requirements_agent.analyze_goal(project.goal, image_analysis)
    
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


# ============================================
# Generation Models (Mission 04)
# ============================================
class GenerateRequest(BaseModel):
    """Request to trigger generation."""
    input_image_url: Optional[str] = Field(
        default=None,
        description="URL of the input image. If not provided, uses first project image."
    )


class PhaseResult(BaseModel):
    """Result from a single generation phase."""
    phase: str
    iteration_id: str
    input_path: Optional[str]
    output_path: Optional[str]
    success: bool
    error: Optional[str]
    latency_ms: Optional[int]
    style: Optional[str] = None


class GenerationResponse(BaseModel):
    """Response from full generation pipeline."""
    project_id: str
    input_image: str
    policy_version: int
    construction_state: Optional[str]
    phases: List[PhaseResult]
    style_variations: List[PhaseResult]
    total_latency_ms: int
    success: bool
    error: Optional[str] = None


class IterationResponse(BaseModel):
    """Response for a single iteration record."""
    id: str
    phase: str
    iteration_number: int
    input_image_path: Optional[str]
    output_image_path: Optional[str]
    output_image_url: Optional[str] = None  # Full URL for frontend
    prompt_used: Optional[str]
    generation_latency_ms: Optional[int]
    policy_version: Optional[int]
    status: str
    error_message: Optional[str]
    created_at: str
    metadata: Optional[Dict[str, Any]]
    # Evaluation fields
    evaluation_status: Optional[str] = None
    evaluation_score: Optional[float] = None
    evaluation_passed: Optional[bool] = None
    # Weave trace ID for linking to traces
    weave_run_id: Optional[str] = None


class PolicyResponse(BaseModel):
    """Response for policy configuration."""
    id: Optional[int]
    version: int
    cleanup_config: Dict[str, Any]
    structural_config: Dict[str, Any]
    fixture_config: Dict[str, Any]
    style_config: Dict[str, Any]


# ============================================
# Generation Endpoints (Mission 04)
# ============================================
@router.post("/{project_id}/generate", response_model=GenerationResponse)
async def generate(
    project_id: UUID,
    request: Optional[GenerateRequest] = None,
    session: AsyncSession = Depends(get_async_session)
):
    """
    Trigger the full generation pipeline for a project.
    
    Runs all four phases: Cleanup → Structural → Fixture → Style.
    Each phase's output becomes the next phase's input.
    """
    # Get the project
    result = await session.execute(
        select(Project).where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Determine input image
    input_image = (
        request.input_image_url if request and request.input_image_url
        else (project.images[0] if project.images else None)
    )
    
    if not input_image:
        raise HTTPException(
            status_code=400,
            detail="No input image available. Provide input_image_url or add images to project."
        )
    
    # Run the full pipeline
    results = await generation_agent.run_full_pipeline(
        session, project_id, input_image
    )
    
    await session.commit()
    
    return GenerationResponse(
        project_id=results["project_id"],
        input_image=results["input_image"],
        policy_version=results.get("policy_version", 1),
        construction_state=results.get("construction_state"),
        phases=[PhaseResult(**p) for p in results["phases"]],
        style_variations=[PhaseResult(**s) for s in results["style_variations"]],
        total_latency_ms=results["total_latency_ms"],
        success=results["success"],
        error=results.get("error"),
    )


@router.post("/{project_id}/generate/{phase}")
async def generate_single_phase(
    project_id: UUID,
    phase: str,
    request: Optional[GenerateRequest] = None,
    session: AsyncSession = Depends(get_async_session)
):
    """
    Trigger a single generation phase.
    
    Useful for testing or re-running specific phases.
    Valid phases: cleanup, structural, fixture, style
    """
    valid_phases = ["cleanup", "structural", "fixture", "style"]
    if phase.lower() not in valid_phases:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid phase. Must be one of: {valid_phases}"
        )
    
    # Get the project
    result = await session.execute(
        select(Project).where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Determine input image
    input_image = (
        request.input_image_url if request and request.input_image_url
        else (project.images[0] if project.images else None)
    )
    
    if not input_image:
        raise HTTPException(
            status_code=400,
            detail="No input image available."
        )
    
    # Load requirements
    policy = await generation_agent.load_policy(session, project_id)
    constraints, _ = await generation_agent.load_constraints(session, project_id)
    requirements = await generation_agent.load_requirements(session, project_id)
    
    # Execute the requested phase
    phase_lower = phase.lower()
    
    if phase_lower == "cleanup":
        result = await generation_agent.execute_cleanup_phase(
            session, project_id, input_image, policy, constraints
        )
    elif phase_lower == "structural":
        result = await generation_agent.execute_structural_phase(
            session, project_id, input_image, policy, constraints
        )
    elif phase_lower == "fixture":
        result = await generation_agent.execute_fixture_phase(
            session, project_id, input_image, policy, constraints, requirements
        )
    elif phase_lower == "style":
        style = requirements.get("style_targets", ["modern"])[0]
        result = await generation_agent.execute_style_phase(
            session, project_id, input_image, policy, constraints, requirements, style
        )
    
    await session.commit()
    
    return PhaseResult(**result)


@router.get("/{project_id}/iterations", response_model=List[IterationResponse])
async def get_iterations(
    project_id: UUID,
    session: AsyncSession = Depends(get_async_session)
):
    """
    Retrieve all generation iterations for a project.
    Includes ALL iterations - both successful and failed - for complete visibility.
    """
    result = await session.execute(
        select(Iteration)
        .where(Iteration.project_id == project_id)
        .order_by(Iteration.created_at)
    )
    iterations = result.scalars().all()
    
    responses = []
    for i in iterations:
        # Build full URL for image access
        output_url = None
        if i.output_image_path:
            # Convert local path to URL (e.g., "generated_images/gen_123.png" -> "/generated_images/gen_123.png")
            if i.output_image_path.startswith("generated_images"):
                output_url = f"/{i.output_image_path}"
            elif i.output_image_path.startswith("/"):
                output_url = i.output_image_path
            else:
                output_url = f"/generated_images/{i.output_image_path.split('/')[-1]}"
        
        # Determine evaluation pass/fail
        eval_passed = None
        if i.evaluation_status:
            eval_passed = i.evaluation_status == "passed"
        
        responses.append(IterationResponse(
            id=str(i.id),
            phase=i.phase,
            iteration_number=i.iteration_number,
            input_image_path=i.input_image_path,
            output_image_path=i.output_image_path,
            output_image_url=output_url,
            prompt_used=i.prompt_used[:500] if i.prompt_used else None,
            generation_latency_ms=i.generation_latency_ms,
            policy_version=i.policy_version,
            status=i.status,
            error_message=i.error_message,
            created_at=i.created_at.isoformat(),
            metadata=i.metadata_,
            evaluation_status=i.evaluation_status,
            evaluation_score=i.evaluation_score,
            evaluation_passed=eval_passed,
            weave_run_id=i.weave_run_id,
        ))
    
    return responses


@router.get("/{project_id}/policy", response_model=PolicyResponse)
async def get_policy(
    project_id: UUID,
    session: AsyncSession = Depends(get_async_session)
):
    """
    Retrieve the current policy configuration for a project.
    """
    policy = await generation_agent.load_policy(session, project_id)
    
    return PolicyResponse(
        id=policy.get("id"),
        version=policy["version"],
        cleanup_config=policy["cleanup_config"],
        structural_config=policy["structural_config"],
        fixture_config=policy["fixture_config"],
        style_config=policy["style_config"],
    )


# ============================================
# QC & Evaluation Models (Mission 05)
# ============================================
class EvaluationRequest(BaseModel):
    """Request to evaluate an iteration."""
    target_style: Optional[str] = None


class CriterionResult(BaseModel):
    """Result for a single evaluation criterion."""
    criterion: str
    passed: bool
    score: float
    details: str
    evidence: Dict[str, Any]


class EvaluationResponse(BaseModel):
    """Response from iteration evaluation."""
    success: bool
    iteration_id: str
    overall_score: Optional[float] = None
    passed: Optional[bool] = None
    status: Optional[str] = None
    evaluations: Optional[List[CriterionResult]] = None
    threshold: float = 0.7
    error: Optional[str] = None


class FailureAnalysisResponse(BaseModel):
    """Response from failure analysis."""
    iteration_id: str
    phase: str
    overall_score: Optional[float]
    failed_criteria: List[Dict[str, Any]]
    insights: List[str]
    recommended_changes: List[Dict[str, Any]]


class ApplyChangesRequest(BaseModel):
    """Request to apply policy changes."""
    changes: List[Dict[str, Any]]
    trigger_iteration_id: Optional[str] = None


class ApplyChangesResponse(BaseModel):
    """Response from applying policy changes."""
    success: bool
    old_version: int
    new_version: int
    new_policy_id: int
    changes_applied: List[Dict[str, Any]]


class PolicyChangeRecord(BaseModel):
    """Record of a policy change."""
    id: str
    old_policy_id: int
    new_policy_id: int
    trigger_iteration_id: Optional[str]
    trigger_reason: Optional[str]
    changes_made: List[Dict[str, Any]]
    rationale: Optional[str]
    created_at: str


class EvaluationDetailResponse(BaseModel):
    """Detailed evaluation for an iteration."""
    iteration_id: str
    evaluation_status: str
    overall_score: Optional[float]
    evaluated_at: Optional[str]
    criteria: List[CriterionResult]


# ============================================
# QC & Evaluation Endpoints (Mission 05)
# ============================================
@router.post("/{project_id}/iterations/{iteration_id}/evaluate", response_model=EvaluationResponse)
async def evaluate_iteration(
    project_id: UUID,
    iteration_id: UUID,
    request: Optional[EvaluationRequest] = None,
    session: AsyncSession = Depends(get_async_session)
):
    """
    Evaluate a generation iteration against all criteria.
    
    Runs constraint compliance, geometry, hallucination, style, and phase checks.
    """
    target_style = request.target_style if request else None
    
    result = await qc_agent.compute_overall_evaluation(
        session, iteration_id, target_style
    )
    
    if not result.get("success"):
        return EvaluationResponse(
            success=False,
            iteration_id=str(iteration_id),
            error=result.get("error", "Evaluation failed")
        )
    
    await session.commit()
    
    return EvaluationResponse(
        success=True,
        iteration_id=result["iteration_id"],
        overall_score=result["overall_score"],
        passed=result["passed"],
        status=result["status"],
        evaluations=[CriterionResult(**e) for e in result["evaluations"]],
        threshold=result["threshold"],
    )


@router.get("/{project_id}/iterations/{iteration_id}/evaluation", response_model=EvaluationDetailResponse)
async def get_iteration_evaluation(
    project_id: UUID,
    iteration_id: UUID,
    session: AsyncSession = Depends(get_async_session)
):
    """
    Retrieve stored evaluation results for an iteration.
    """
    # Get iteration - validate it belongs to the project for security
    result = await session.execute(
        select(Iteration).where(
            Iteration.id == iteration_id,
            Iteration.project_id == project_id
        )
    )
    iteration = result.scalar_one_or_none()
    
    if not iteration:
        raise HTTPException(status_code=404, detail="Iteration not found or does not belong to this project")
    
    # Get evaluation details
    details_result = await session.execute(
        select(EvaluationDetail).where(EvaluationDetail.iteration_id == iteration_id)
    )
    details = details_result.scalars().all()
    
    return EvaluationDetailResponse(
        iteration_id=str(iteration_id),
        evaluation_status=iteration.evaluation_status or EvaluationStatus.PENDING,
        overall_score=iteration.evaluation_score,
        evaluated_at=iteration.evaluated_at.isoformat() if iteration.evaluated_at else None,
        criteria=[
            CriterionResult(
                criterion=d.criterion,
                passed=d.passed,
                score=d.score,
                details=d.details or "",
                evidence=d.evidence or {},
            )
            for d in details
        ],
    )


@router.post("/{project_id}/analyze-failure", response_model=FailureAnalysisResponse)
async def analyze_failure(
    project_id: UUID,
    iteration_id: UUID,
    session: AsyncSession = Depends(get_async_session)
):
    """
    Analyze a failed iteration to understand what went wrong.
    
    Returns insights and recommended policy changes.
    """
    analysis = await qc_agent.analyze_failure(session, iteration_id)
    
    if not analysis.get("iteration_id"):
        raise HTTPException(status_code=404, detail="Iteration not found")
    
    return FailureAnalysisResponse(
        iteration_id=analysis["iteration_id"],
        phase=analysis["phase"],
        overall_score=analysis["overall_score"],
        failed_criteria=analysis["failed_criteria"],
        insights=analysis["insights"],
        recommended_changes=analysis["recommended_changes"],
    )


@router.post("/{project_id}/apply-policy-change", response_model=ApplyChangesResponse)
async def apply_policy_change(
    project_id: UUID,
    request: ApplyChangesRequest,
    session: AsyncSession = Depends(get_async_session)
):
    """
    Apply recommended policy changes and create a new policy version.
    """
    trigger_id = UUID(request.trigger_iteration_id) if request.trigger_iteration_id else None
    
    result = await qc_agent.apply_policy_changes(
        session, project_id, request.changes, trigger_id
    )
    
    if not result.get("success"):
        raise HTTPException(status_code=500, detail="Failed to apply policy changes")
    
    await session.commit()
    
    return ApplyChangesResponse(
        success=True,
        old_version=result["old_version"],
        new_version=result["new_version"],
        new_policy_id=result["new_policy_id"],
        changes_applied=result["changes_applied"],
    )


@router.get("/{project_id}/policy-history", response_model=List[PolicyChangeRecord])
async def get_policy_history(
    project_id: UUID,
    session: AsyncSession = Depends(get_async_session)
):
    """
    Retrieve the history of policy changes for a project.
    
    Shows how the policy evolved through the self-improvement loop.
    """
    history = await qc_agent.get_policy_history(session, project_id)
    
    return [
        PolicyChangeRecord(
            id=h["id"],
            old_policy_id=h["old_policy_id"],
            new_policy_id=h["new_policy_id"],
            trigger_iteration_id=h["trigger_iteration_id"],
            trigger_reason=h["trigger_reason"],
            changes_made=h["changes_made"],
            rationale=h["rationale"],
            created_at=h["created_at"],
        )
        for h in history
    ]


@router.post("/{project_id}/evaluate-and-improve")
async def evaluate_and_improve(
    project_id: UUID,
    iteration_id: UUID,
    session: AsyncSession = Depends(get_async_session)
):
    """
    Full QC pipeline: evaluate iteration, analyze if failed, apply improvements.
    
    This is the core self-improvement endpoint that:
    1. Evaluates the iteration
    2. If failed, analyzes the failure
    3. Applies recommended policy changes
    4. Returns all results
    """
    # Step 1: Evaluate
    eval_result = await qc_agent.compute_overall_evaluation(session, iteration_id)
    
    if not eval_result.get("success"):
        raise HTTPException(status_code=500, detail="Evaluation failed")
    
    response = {
        "evaluation": {
            "passed": eval_result["passed"],
            "score": eval_result["overall_score"],
            "status": eval_result["status"],
        },
        "analysis": None,
        "policy_update": None,
    }
    
    # Step 2: If failed, analyze and improve
    if not eval_result["passed"]:
        analysis = await qc_agent.analyze_failure(session, iteration_id)
        response["analysis"] = {
            "insights": analysis.get("insights", []),
            "recommended_changes": analysis.get("recommended_changes", []),
        }
        
        # Step 3: Apply changes if any recommended
        recommended = analysis.get("recommended_changes", [])
        if recommended:
            policy_result = await qc_agent.apply_policy_changes(
                session, project_id, recommended, iteration_id
            )
            response["policy_update"] = {
                "old_version": policy_result["old_version"],
                "new_version": policy_result["new_version"],
                "changes_applied": policy_result["changes_applied"],
            }
    
    await session.commit()
    
    return response


# ============================================
# Orchestration Models (Mission 06)
# ============================================
class StartOrchestrationRequest(BaseModel):
    """Request to start orchestration."""
    skip_requirements: bool = False  # Skip to spatial analysis if requirements exist
    batch_mode: bool = True  # Process each image independently (default for virtual staging)


class ClarificationSubmitRequest(BaseModel):
    """Request to submit clarification answers."""
    answers: Dict[str, str]


class RetryRequest(BaseModel):
    """Request to retry orchestration."""
    from_phase: Optional[str] = None  # If None, restart from beginning


class OrchestrationStatusResponse(BaseModel):
    """Response for orchestration status."""
    project_id: str
    state: str
    status: str
    current_phase: Optional[str]
    retry_count: int
    has_warnings: bool
    warning_details: Optional[List[Dict[str, Any]]]
    started_at: Optional[str]
    completed_at: Optional[str]
    recent_transitions: List[Dict[str, Any]]
    is_batch: Optional[bool] = None
    total_scenes: Optional[int] = None
    completed_scenes: Optional[int] = None
    scene_progress: Optional[List[Dict[str, Any]]] = None


class OrchestrationLogEntry(BaseModel):
    """Single log entry."""
    id: str
    from_state: str
    to_state: str
    trigger: str
    details: Dict[str, Any]
    duration_ms: Optional[int]
    created_at: str


# ============================================
# Orchestration Endpoints (Mission 06)
# ============================================
@router.post("/{project_id}/start")
async def start_orchestration(
    project_id: UUID,
    request: Optional[StartOrchestrationRequest] = None,
    session: AsyncSession = Depends(get_async_session)
):
    """
    Start orchestration for a project.
    
    Begins the full pipeline: Requirements → Spatial Analysis → Generation → QC Loop
    """
    # Verify project exists
    result = await session.execute(
        select(Project).where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Check state
    if project.orchestration_state not in [OrchestrationState.CREATED, OrchestrationState.FAILED]:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot start from state: {project.orchestration_state}"
        )
    
    # Reset to CREATED if retrying from FAILED
    if project.orchestration_state == OrchestrationState.FAILED:
        project.orchestration_state = OrchestrationState.CREATED
        project.retry_count = 0
        project.has_warnings = False
        project.warning_details = []
        project.started_at = None
        project.completed_at = None
    
    # Create orchestrator
    orchestrator = Orchestrator(session, project_id)
    
    # Determine processing mode
    batch_mode = request.batch_mode if request else True
    
    # If batch mode and multiple images, run batch processing
    images = project.images or []
    if batch_mode and len(images) > 1:
        # Initialize scenes for batch processing
        await orchestrator.initialize_scenes()
        await session.commit()
        
        # Run batch pipeline
        result = await orchestrator.run_batch()
    else:
        # Single image mode - run regular pipeline
        result = await orchestrator.run()
    
    return result


@router.post("/{project_id}/submit-clarification")
async def submit_clarification(
    project_id: UUID,
    request: ClarificationSubmitRequest,
    session: AsyncSession = Depends(get_async_session)
):
    """
    Submit clarification answers during orchestration.
    
    Must be in AWAITING_CLARIFICATION state.
    """
    orchestrator = Orchestrator(session, project_id)
    
    try:
        result = await orchestrator.submit_clarification(request.answers)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{project_id}/status", response_model=OrchestrationStatusResponse)
async def get_orchestration_status(
    project_id: UUID,
    session: AsyncSession = Depends(get_async_session)
):
    """
    Get current orchestration status.
    
    Use for polling to track progress.
    """
    orchestrator = Orchestrator(session, project_id)
    
    try:
        status = await orchestrator.get_status()
        return OrchestrationStatusResponse(**status)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/{project_id}/scenes")
async def get_project_scenes(
    project_id: UUID,
    session: AsyncSession = Depends(get_async_session)
):
    """
    Get all scenes for a batch project.
    
    Returns progress and output for each scene.
    """
    from app.models import Scene
    
    result = await session.execute(
        select(Scene)
        .where(Scene.project_id == project_id)
        .order_by(Scene.scene_index)
    )
    scenes = result.scalars().all()
    
    return {
        "project_id": str(project_id),
        "total_scenes": len(scenes),
        "scenes": [
            {
                "id": str(s.id),
                "scene_index": s.scene_index,
                "name": s.name,
                "input_image": s.input_image_path,
                "output_image": s.output_image_path,
                "status": s.status,
                "orchestration_state": s.orchestration_state,
                "current_phase": s.current_phase,
                "space_type": s.space_type_detected,
                "has_warnings": s.has_warnings,
                "error_message": s.error_message,
                "started_at": s.started_at.isoformat() if s.started_at else None,
                "completed_at": s.completed_at.isoformat() if s.completed_at else None,
            }
            for s in scenes
        ]
    }


@router.get("/{project_id}/batch-patterns")
async def get_batch_patterns(
    project_id: UUID,
    session: AsyncSession = Depends(get_async_session)
):
    """Get detected batch patterns across scenes."""
    orchestrator = Orchestrator(session, project_id)
    return {
        "project_id": str(project_id),
        "patterns": await orchestrator.get_batch_patterns()
    }


@router.get("/{project_id}/batch-insights")
async def get_batch_insights(
    project_id: UUID,
    session: AsyncSession = Depends(get_async_session)
):
    """Get cross-scene insights and recommendations."""
    orchestrator = Orchestrator(session, project_id)
    return await orchestrator.get_batch_insights()


@router.get("/{project_id}/batch-report")
async def get_batch_report(
    project_id: UUID,
    session: AsyncSession = Depends(get_async_session)
):
    """Get a comprehensive batch report for demo and QA."""
    orchestrator = Orchestrator(session, project_id)
    return await orchestrator.get_batch_report()


@router.post("/{project_id}/retry")
async def retry_orchestration(
    project_id: UUID,
    request: Optional[RetryRequest] = None,
    session: AsyncSession = Depends(get_async_session)
):
    """
    Retry a failed or completed-with-warnings project.
    
    Can restart from beginning or from a specific phase.
    """
    # Get project
    result = await session.execute(
        select(Project).where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Can only retry from terminal states
    terminal_states = {
        OrchestrationState.FAILED,
        OrchestrationState.COMPLETED,
        OrchestrationState.COMPLETED_WITH_WARNINGS,
    }
    
    if project.orchestration_state not in terminal_states:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot retry from state: {project.orchestration_state}"
        )
    
    # Reset state
    from_phase = request.from_phase if request else None
    
    if from_phase:
        # Resume from specific phase
        project.orchestration_state = f"generating_{from_phase}"
        project.current_phase = from_phase
    else:
        # Full restart
        project.orchestration_state = OrchestrationState.CREATED
        project.current_phase = None
    
    project.retry_count = 0
    project.has_warnings = False
    project.warning_details = []
    project.started_at = None
    project.completed_at = None
    
    await session.flush()
    
    # Run orchestrator
    orchestrator = Orchestrator(session, project_id)
    result = await orchestrator.run()
    
    return result


@router.get("/{project_id}/log", response_model=List[OrchestrationLogEntry])
async def get_orchestration_log(
    project_id: UUID,
    session: AsyncSession = Depends(get_async_session)
):
    """
    Get complete orchestration log for a project.
    
    Shows all state transitions with timestamps.
    """
    orchestrator = Orchestrator(session, project_id)
    
    try:
        log = await orchestrator.get_log()
        return [OrchestrationLogEntry(**entry) for entry in log]
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ============================================
# Streaming Updates Endpoint (SSE)
# ============================================
class StreamEvent(BaseModel):
    """Event sent via SSE stream."""
    event: str  # "agent", "thinking", "progress", "error", "complete"
    agent: Optional[str] = None  # "requirements", "spatial", "generation", "qc", "orchestrator"
    action: Optional[str] = None  # "analyzing", "generating", "evaluating", etc.
    message: str
    details: Optional[Dict[str, Any]] = None
    timestamp: str


async def generate_orchestration_stream(
    session: AsyncSession,
    project_id: UUID
) -> AsyncGenerator[str, None]:
    """
    Generator for streaming orchestration progress events.
    Sends Server-Sent Events (SSE) format.
    
    Includes batch processing events:
    - batch_progress: Overall batch completion status
    - scene_start: Scene processing started
    - scene_complete: Scene processing completed
    - learning: Policy improvement or cross-scene learning events
    """
    from app.models import OrchestrationLog, Project, OrchestrationState, Scene, SceneStatus
    
    def format_sse(event: str, data: dict) -> str:
        """Format data as SSE event."""
        return f"event: {event}\ndata: {json.dumps(data)}\n\n"
    
    # Get project
    result = await session.execute(
        select(Project).where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    
    if not project:
        yield format_sse("error", {
            "event": "error",
            "message": "Project not found",
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        return
    
    # Check if this is a batch project
    is_batch = project.is_batch and project.total_scenes > 1
    
    # Build Weave trace URL for frontend display
    weave_url = None
    if settings.wandb_api_key and settings.weave_project_name:
        if "/" in settings.weave_project_name:
            project_path = settings.weave_project_name
        elif settings.wandb_entity:
            project_path = f"{settings.wandb_entity}/{settings.weave_project_name}"
        else:
            project_path = settings.weave_project_name
        weave_url = f"https://wandb.ai/{project_path}/weave"
    
    # Send initial state
    initial_details = {
        "state": project.orchestration_state, 
        "phase": project.current_phase,
        "weave_trace_url": weave_url,  # Include weave URL in initial event
    }
    if is_batch:
        initial_details["is_batch"] = True
        initial_details["total_scenes"] = project.total_scenes
        initial_details["completed_scenes"] = project.completed_scenes
    
    yield format_sse("progress", {
        "event": "progress",
        "agent": "orchestrator",
        "action": "starting",
        "message": f"Starting orchestration. Current state: {project.orchestration_state}",
        "details": initial_details,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    # IMPORTANT: If project is already in terminal state, replay all historical logs
    # This ensures frontend sees the full progress history even if it connected late
    terminal_check_states = {
        OrchestrationState.COMPLETED,
        OrchestrationState.COMPLETED_WITH_WARNINGS,
        OrchestrationState.FAILED,
    }
    
    if project.orchestration_state in terminal_check_states:
        # Replay all historical log entries
        history_result = await session.execute(
            select(OrchestrationLog)
            .where(OrchestrationLog.project_id == project_id)
            .order_by(OrchestrationLog.created_at)
        )
        historical_logs = history_result.scalars().all()
        
        for log in historical_logs:
            agent = "orchestrator"
            action = "thinking"
            
            if "requirements" in log.to_state or "clarification" in log.to_state:
                agent = "requirements"
                action = "analyzing" if "gathering" in log.to_state else "question"
            elif "analyzing_space" in log.to_state:
                agent = "spatial"
                action = "analyzing"
            elif "generating" in log.to_state:
                agent = "generation"
                phase = log.to_state.replace("generating_", "")
                action = f"generating_{phase}"
            elif "evaluating" in log.to_state:
                agent = "qc"
                action = "evaluating"
            elif "retrying" in log.to_state:
                agent = "qc"
                action = "policy_update"
            elif log.to_state in ["completed", "completed_with_warnings"]:
                agent = "orchestrator"
                action = "success"
            elif log.to_state == "failed":
                agent = "orchestrator"
                action = "error"
            
            event_details = {
                "from_state": log.from_state,
                "to_state": log.to_state,
                "trigger": log.trigger,
                "duration_ms": log.duration_ms,
                **log.details
            }
            
            yield format_sse("agent", {
                "event": "agent",
                "agent": agent,
                "action": action,
                "message": log.details.get("message", f"Transition: {log.from_state} → {log.to_state}"),
                "details": event_details,
                "timestamp": log.created_at.isoformat()
            })
        
        # Send complete event for terminal state
        final_event_type = "complete" if project.orchestration_state != OrchestrationState.FAILED else "error"
        yield format_sse(final_event_type, {
            "event": final_event_type,
            "agent": "orchestrator",
            "action": "complete" if final_event_type == "complete" else "error",
            "message": f"Orchestration {project.orchestration_state}",
            "details": {
                "state": project.orchestration_state,
                "has_warnings": project.has_warnings,
                "warning_details": project.warning_details,
            },
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        return  # Exit - no need to poll for completed project
    
    # For batch projects, track scene progress
    last_scene_status = {} if is_batch else None
    
    # Track last log entry
    last_log_id = None
    result = await session.execute(
        select(OrchestrationLog)
        .where(OrchestrationLog.project_id == project_id)
        .order_by(desc(OrchestrationLog.created_at))
        .limit(1)
    )
    last_log = result.scalar_one_or_none()
    if last_log:
        last_log_id = last_log.id
    
    # Poll for updates
    max_iterations = 300  # 5 minutes max
    iteration = 0
    terminal_states = {
        OrchestrationState.COMPLETED,
        OrchestrationState.COMPLETED_WITH_WARNINGS,
        OrchestrationState.FAILED,
        OrchestrationState.AWAITING_CLARIFICATION,
    }
    
    while iteration < max_iterations:
        iteration += 1
        
        # Refresh project state
        await session.refresh(project)
        
        # Get new log entries
        query = select(OrchestrationLog).where(
            OrchestrationLog.project_id == project_id
        ).order_by(OrchestrationLog.created_at)
        
        if last_log_id:
            query = query.where(OrchestrationLog.id > last_log_id)
        
        result = await session.execute(query)
        new_logs = result.scalars().all()
        
        # Process new log entries
        for log in new_logs:
            # Determine agent and action from state
            agent = "orchestrator"
            action = "thinking"
            
            if "requirements" in log.to_state or "clarification" in log.to_state:
                agent = "requirements"
                action = "analyzing" if "gathering" in log.to_state else "question"
            elif "analyzing_space" in log.to_state:
                agent = "spatial"
                action = "analyzing"
            elif "generating" in log.to_state:
                agent = "generation"
                action = "generating"
                # Extract phase
                phase = log.to_state.replace("generating_", "")
                action = f"generating_{phase}"
            elif "evaluating" in log.to_state:
                agent = "qc"
                action = "evaluating"
            elif "retrying" in log.to_state:
                agent = "qc"
                action = "policy_update"
                # Extract phase being retried
                phase = log.to_state.replace("retrying_", "")
            elif log.to_state in ["completed", "completed_with_warnings"]:
                agent = "orchestrator"
                action = "success"
            elif log.to_state == "failed":
                agent = "orchestrator"
                action = "error"
            
            # Create message
            message = f"Transitioning from {log.from_state} to {log.to_state}"
            if log.details:
                if log.details.get("message"):
                    message = log.details["message"]
                elif log.details.get("error"):
                    message = f"Error: {log.details['error']}"
            
            # Build event details with retry info if applicable
            event_details = {
                "from_state": log.from_state,
                "to_state": log.to_state,
                "trigger": log.trigger,
                "duration_ms": log.duration_ms,
                **log.details
            }
            
            # Add retry-specific info
            if "retrying" in log.to_state:
                event_details["retry_number"] = project.retry_count + 1
                event_details["phase"] = log.to_state.replace("retrying_", "")
                event_details["failure_reason"] = log.details.get("failure_reason", "Quality evaluation below threshold")
                event_details["changes_applied"] = log.details.get("changes_applied", [])
            
            yield format_sse("agent", {
                "event": "agent",
                "agent": agent,
                "action": action,
                "message": message,
                "details": event_details,
                "timestamp": log.created_at.isoformat()
            })
            
            last_log_id = log.id
        
        # Check for terminal state
        if project.orchestration_state in terminal_states:
            event_type = "complete"
            if project.orchestration_state == OrchestrationState.FAILED:
                event_type = "error"
            elif project.orchestration_state == OrchestrationState.AWAITING_CLARIFICATION:
                event_type = "question"
            
            yield format_sse(event_type, {
                "event": event_type,
                "agent": "orchestrator",
                "action": "complete" if event_type == "complete" else event_type,
                "message": f"Orchestration {project.orchestration_state}",
                "details": {
                    "state": project.orchestration_state,
                    "has_warnings": project.has_warnings,
                    "warning_details": project.warning_details,
                },
                "timestamp": datetime.now(timezone.utc).isoformat()
            })
            break
        
        # For batch projects, check scene progress
        if is_batch and last_scene_status is not None:
            scene_result = await session.execute(
                select(Scene).where(Scene.project_id == project_id).order_by(Scene.scene_index)
            )
            scenes = scene_result.scalars().all()
            
            for scene in scenes:
                scene_id = str(scene.id)
                current_status = scene.status
                
                # Check if scene status changed
                if scene_id not in last_scene_status or last_scene_status[scene_id] != current_status:
                    if current_status == SceneStatus.ANALYZING:
                        yield format_sse("scene_start", {
                            "event": "scene_start",
                            "agent": "orchestrator",
                            "action": "scene_processing",
                            "message": f"Processing scene {scene.scene_index + 1} of {project.total_scenes}",
                            "details": {
                                "scene_id": scene_id,
                                "scene_index": scene.scene_index,
                                "input_image": scene.input_image_path,
                                "total_scenes": project.total_scenes,
                            },
                            "timestamp": datetime.now(timezone.utc).isoformat()
                        })
                    elif current_status == SceneStatus.COMPLETED:
                        # Check for learning events
                        learning_info = {}
                        if scene.metadata_ and scene.metadata_.get("policy_improvements"):
                            learning_info = {
                                "improvements_made": scene.metadata_["policy_improvements"],
                                "learning_applied": True,
                            }
                        
                        yield format_sse("scene_complete", {
                            "event": "scene_complete",
                            "agent": "orchestrator",
                            "action": "scene_success",
                            "message": f"Scene {scene.scene_index + 1} completed successfully",
                            "details": {
                                "scene_id": scene_id,
                                "scene_index": scene.scene_index,
                                "output_image": scene.output_image_path,
                                "space_type": scene.space_type_detected,
                                **learning_info,
                            },
                            "timestamp": datetime.now(timezone.utc).isoformat()
                        })
                        
                        # If learning occurred, emit learning event
                        if learning_info.get("learning_applied"):
                            yield format_sse("learning", {
                                "event": "learning",
                                "agent": "qc",
                                "action": "cross_scene_improvement",
                                "message": f"Policy improved from scene {scene.scene_index + 1} - future scenes will benefit",
                                "details": {
                                    "scene_id": scene_id,
                                    "improvements": learning_info["improvements_made"],
                                    "benefiting_scenes": project.total_scenes - scene.scene_index - 1,
                                },
                                "timestamp": datetime.now(timezone.utc).isoformat()
                            })
                    elif current_status == SceneStatus.FAILED:
                        yield format_sse("scene_error", {
                            "event": "scene_error",
                            "agent": "orchestrator",
                            "action": "scene_failed",
                            "message": f"Scene {scene.scene_index + 1} failed: {scene.error_message or 'Unknown error'}",
                            "details": {
                                "scene_id": scene_id,
                                "scene_index": scene.scene_index,
                                "error": scene.error_message,
                            },
                            "timestamp": datetime.now(timezone.utc).isoformat()
                        })
                    
                    last_scene_status[scene_id] = current_status
            
            # Emit batch progress update
            await session.refresh(project)
            if project.completed_scenes > 0:
                yield format_sse("batch_progress", {
                    "event": "batch_progress",
                    "agent": "orchestrator",
                    "action": "batch_update",
                    "message": f"Batch progress: {project.completed_scenes}/{project.total_scenes} scenes completed",
                    "details": {
                        "completed": project.completed_scenes,
                        "total": project.total_scenes,
                        "progress_percent": int((project.completed_scenes / project.total_scenes) * 100),
                    },
                    "timestamp": datetime.now(timezone.utc).isoformat()
                })
        
        # Send heartbeat
        if iteration % 10 == 0:
            heartbeat_details = {"state": project.orchestration_state}
            if is_batch:
                heartbeat_details["completed_scenes"] = project.completed_scenes
                heartbeat_details["total_scenes"] = project.total_scenes
            
            yield format_sse("heartbeat", {
                "event": "heartbeat",
                "message": "Connection alive",
                "details": heartbeat_details,
                "timestamp": datetime.now(timezone.utc).isoformat()
            })
        
        await asyncio.sleep(1)
    
    # Final message if max iterations reached
    if iteration >= max_iterations:
        yield format_sse("error", {
            "event": "error",
            "message": "Stream timeout - orchestration still running",
            "details": {"state": project.orchestration_state},
            "timestamp": datetime.now(timezone.utc).isoformat()
        })


@router.get("/{project_id}/stream")
async def stream_orchestration(
    project_id: UUID,
    session: AsyncSession = Depends(get_async_session)
):
    """
    Stream orchestration progress updates via Server-Sent Events.
    
    Use this for real-time UI updates showing agent reasoning and progress.
    
    Events:
    - agent: Agent activity (analyzing, generating, evaluating)
    - thinking: Agent reasoning/thought process
    - progress: General progress updates
    - question: Clarification needed from user
    - error: Error occurred
    - complete: Orchestration complete
    - heartbeat: Connection keepalive
    """
    return StreamingResponse(
        generate_orchestration_stream(session, project_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


# ============================================
# Agent Reasoning Endpoint
# ============================================
class AgentReasoningResponse(BaseModel):
    """Response containing agent reasoning traces."""
    project_id: str
    reasoning_steps: List[Dict[str, Any]]
    weave_trace_url: Optional[str] = None


@router.get("/{project_id}/reasoning", response_model=AgentReasoningResponse)
async def get_agent_reasoning(
    project_id: UUID,
    session: AsyncSession = Depends(get_async_session)
):
    """
    Get all agent reasoning and tool calls for a project.
    
    Returns the chain of thought from all agents.
    """
    from app.config import settings
    
    # Get orchestration log
    result = await session.execute(
        select(OrchestrationLog)
        .where(OrchestrationLog.project_id == project_id)
        .order_by(OrchestrationLog.created_at)
    )
    logs = result.scalars().all()
    
    # Get iterations for more detail
    iterations_result = await session.execute(
        select(Iteration)
        .where(Iteration.project_id == project_id)
        .order_by(Iteration.created_at)
    )
    iterations = iterations_result.scalars().all()
    
    reasoning_steps = []
    
    # Add orchestration transitions as reasoning steps
    for log in logs:
        step = {
            "type": "transition",
            "agent": "orchestrator",
            "from_state": log.from_state,
            "to_state": log.to_state,
            "trigger": log.trigger,
            "details": log.details,
            "duration_ms": log.duration_ms,
            "timestamp": log.created_at.isoformat(),
        }
        
        # Add agent-specific reasoning
        if "requirements" in log.to_state:
            step["agent"] = "requirements"
            step["reasoning"] = "Analyzing user goal to extract structured requirements"
        elif "analyzing_space" in log.to_state:
            step["agent"] = "spatial"
            step["reasoning"] = "Examining images to identify physical constraints"
        elif "generating" in log.to_state:
            step["agent"] = "generation"
            phase = log.to_state.replace("generating_", "")
            step["reasoning"] = f"Generating {phase} phase transformation"
        elif "evaluating" in log.to_state:
            step["agent"] = "qc"
            step["reasoning"] = "Evaluating output quality against criteria"
        elif "retrying" in log.to_state:
            step["agent"] = "qc"
            step["reasoning"] = "Analyzing failure and updating policy for retry"
        
        reasoning_steps.append(step)
    
    # Add iteration details
    for iteration in iterations:
        step = {
            "type": "generation",
            "agent": "generation",
            "phase": iteration.phase,
            "iteration_number": iteration.iteration_number,
            "prompt_used": iteration.prompt_used[:500] if iteration.prompt_used else None,
            "status": iteration.status,
            "latency_ms": iteration.generation_latency_ms,
            "evaluation_score": iteration.evaluation_score,
            "evaluation_status": iteration.evaluation_status,
            "timestamp": iteration.created_at.isoformat(),
            "reasoning": f"Executed {iteration.phase} generation (iteration {iteration.iteration_number})"
        }
        reasoning_steps.append(step)
    
    # Sort by timestamp
    reasoning_steps.sort(key=lambda x: x.get("timestamp", ""))
    
    # Build Weave trace URL if available
    weave_url = None
    if settings.wandb_api_key and settings.weave_project_name:
        if "/" in settings.weave_project_name:
            project_path = settings.weave_project_name
        elif settings.wandb_entity:
            project_path = f"{settings.wandb_entity}/{settings.weave_project_name}"
        else:
            project_path = settings.weave_project_name
        weave_url = f"https://wandb.ai/{project_path}/weave"
    
    return AgentReasoningResponse(
        project_id=str(project_id),
        reasoning_steps=reasoning_steps,
        weave_trace_url=weave_url,
    )
