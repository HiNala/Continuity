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
from app.models import (
    Project, Requirements, ProjectStatus, Constraint, ProjectAnalysis,
    Iteration, Policy, GenerationPhase, IterationStatus, EvaluationDetail,
    PolicyChange, EvaluationStatus
)
from app.agents.requirements_agent import requirements_agent
from app.agents.spatial_agent import spatial_agent
from app.agents.generation_agent import generation_agent
from app.agents.qc_agent import qc_agent


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
    prompt_used: Optional[str]
    generation_latency_ms: Optional[int]
    policy_version: Optional[int]
    status: str
    error_message: Optional[str]
    created_at: str
    metadata: Optional[Dict[str, Any]]


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
    """
    result = await session.execute(
        select(Iteration)
        .where(Iteration.project_id == project_id)
        .order_by(Iteration.created_at)
    )
    iterations = result.scalars().all()
    
    return [
        IterationResponse(
            id=str(i.id),
            phase=i.phase,
            iteration_number=i.iteration_number,
            input_image_path=i.input_image_path,
            output_image_path=i.output_image_path,
            prompt_used=i.prompt_used[:500] if i.prompt_used else None,  # Truncate for response
            generation_latency_ms=i.generation_latency_ms,
            policy_version=i.policy_version,
            status=i.status,
            error_message=i.error_message,
            created_at=i.created_at.isoformat(),
            metadata=i.metadata_,
        )
        for i in iterations
    ]


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
    # Get iteration
    result = await session.execute(
        select(Iteration).where(Iteration.id == iteration_id)
    )
    iteration = result.scalar_one_or_none()
    
    if not iteration:
        raise HTTPException(status_code=404, detail="Iteration not found")
    
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
