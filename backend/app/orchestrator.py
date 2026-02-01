"""
Continuity - Orchestrator Module
Mission 06: Coordinates all agents into a converging, non-infinite improvement loop.

The Orchestrator manages the complete pipeline:
Project Creation → Requirements → Spatial Analysis → Generation Loop → Completion

It handles retries, policy updates, and ensures deterministic termination.
"""

import time
import asyncio
from collections import defaultdict
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from uuid import UUID

import weave
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models import (
    Project, Requirements, OrchestrationLog, Iteration, Scene,
    OrchestrationState, OrchestrationTrigger, GenerationPhase,
    ProjectStatus, SceneStatus, Constraint, EvaluationDetail
)
from app.database import AsyncSessionLocal
from app.agents.requirements_agent import requirements_agent
from app.agents.spatial_agent import spatial_agent
from app.agents.generation_agent import generation_agent
from app.agents.qc_agent import qc_agent
from app.weave_ops import record_batch_learning, record_cross_project_learning


# ============================================
# Orchestration Configuration
# ============================================
class OrchestrationConfig:
    """Configurable parameters for orchestration."""
    MAX_RETRIES_PER_PHASE: int = 3
    EVALUATION_THRESHOLD: float = 0.7
    TIMEOUT_SECONDS: int = 300
    AUTO_ADVANCE_ON_MAX_RETRY: bool = True
    BATCH_CONCURRENCY: int = 3


# ============================================
# State Transitions Map
# ============================================
# Defines valid transitions from each state
STATE_TRANSITIONS = {
    OrchestrationState.CREATED: [
        OrchestrationState.GATHERING_REQUIREMENTS,
        OrchestrationState.FAILED,
    ],
    OrchestrationState.GATHERING_REQUIREMENTS: [
        OrchestrationState.AWAITING_CLARIFICATION,
        OrchestrationState.ANALYZING_SPACE,
        OrchestrationState.FAILED,
    ],
    OrchestrationState.AWAITING_CLARIFICATION: [
        OrchestrationState.ANALYZING_SPACE,
        OrchestrationState.FAILED,
    ],
    OrchestrationState.ANALYZING_SPACE: [
        OrchestrationState.GENERATING_CLEANUP,
        OrchestrationState.FAILED,
    ],
    OrchestrationState.GENERATING_CLEANUP: [
        OrchestrationState.EVALUATING_CLEANUP,
        OrchestrationState.FAILED,
    ],
    OrchestrationState.EVALUATING_CLEANUP: [
        OrchestrationState.GENERATING_STRUCTURAL,
        OrchestrationState.RETRYING_CLEANUP,
        OrchestrationState.FAILED,
    ],
    OrchestrationState.RETRYING_CLEANUP: [
        OrchestrationState.GENERATING_CLEANUP,
        OrchestrationState.GENERATING_STRUCTURAL,  # After max retries
        OrchestrationState.FAILED,
    ],
    OrchestrationState.GENERATING_STRUCTURAL: [
        OrchestrationState.EVALUATING_STRUCTURAL,
        OrchestrationState.FAILED,
    ],
    OrchestrationState.EVALUATING_STRUCTURAL: [
        OrchestrationState.GENERATING_FIXTURE,
        OrchestrationState.RETRYING_STRUCTURAL,
        OrchestrationState.FAILED,
    ],
    OrchestrationState.RETRYING_STRUCTURAL: [
        OrchestrationState.GENERATING_STRUCTURAL,
        OrchestrationState.GENERATING_FIXTURE,
        OrchestrationState.FAILED,
    ],
    OrchestrationState.GENERATING_FIXTURE: [
        OrchestrationState.EVALUATING_FIXTURE,
        OrchestrationState.FAILED,
    ],
    OrchestrationState.EVALUATING_FIXTURE: [
        OrchestrationState.GENERATING_STYLE,
        OrchestrationState.RETRYING_FIXTURE,
        OrchestrationState.FAILED,
    ],
    OrchestrationState.RETRYING_FIXTURE: [
        OrchestrationState.GENERATING_FIXTURE,
        OrchestrationState.GENERATING_STYLE,
        OrchestrationState.FAILED,
    ],
    OrchestrationState.GENERATING_STYLE: [
        OrchestrationState.EVALUATING_STYLE,
        OrchestrationState.FAILED,
    ],
    OrchestrationState.EVALUATING_STYLE: [
        OrchestrationState.COMPLETED,
        OrchestrationState.COMPLETED_WITH_WARNINGS,
        OrchestrationState.RETRYING_STYLE,
        OrchestrationState.FAILED,
    ],
    OrchestrationState.RETRYING_STYLE: [
        OrchestrationState.GENERATING_STYLE,
        OrchestrationState.COMPLETED,
        OrchestrationState.COMPLETED_WITH_WARNINGS,
        OrchestrationState.FAILED,
    ],
}

# Terminal states (no further transitions)
TERMINAL_STATES = {
    OrchestrationState.COMPLETED,
    OrchestrationState.COMPLETED_WITH_WARNINGS,
    OrchestrationState.FAILED,
}

# Phase mapping
PHASE_STATES = {
    GenerationPhase.CLEANUP: (
        OrchestrationState.GENERATING_CLEANUP,
        OrchestrationState.EVALUATING_CLEANUP,
        OrchestrationState.RETRYING_CLEANUP,
    ),
    GenerationPhase.STRUCTURAL: (
        OrchestrationState.GENERATING_STRUCTURAL,
        OrchestrationState.EVALUATING_STRUCTURAL,
        OrchestrationState.RETRYING_STRUCTURAL,
    ),
    GenerationPhase.FIXTURE: (
        OrchestrationState.GENERATING_FIXTURE,
        OrchestrationState.EVALUATING_FIXTURE,
        OrchestrationState.RETRYING_FIXTURE,
    ),
    GenerationPhase.STYLE: (
        OrchestrationState.GENERATING_STYLE,
        OrchestrationState.EVALUATING_STYLE,
        OrchestrationState.RETRYING_STYLE,
    ),
}

NEXT_PHASE = {
    GenerationPhase.CLEANUP: GenerationPhase.STRUCTURAL,
    GenerationPhase.STRUCTURAL: GenerationPhase.FIXTURE,
    GenerationPhase.FIXTURE: GenerationPhase.STYLE,
    GenerationPhase.STYLE: None,  # Terminal
}


# ============================================
# Orchestrator Class
# ============================================
class Orchestrator:
    """
    The Orchestrator coordinates all agents through the complete pipeline.
    Implements a state machine for deterministic execution flow.
    """
    
    def __init__(
        self,
        session: AsyncSession,
        project_id: UUID,
        config: Optional[OrchestrationConfig] = None
    ):
        self.session = session
        self.project_id = project_id
        self.config = config or OrchestrationConfig()
        self.project: Optional[Project] = None
        self.state_start_time: Optional[float] = None
        self._current_input_image: Optional[str] = None
        self._current_scene: Optional[Scene] = None
    
    # ==========================================
    # Batch Processing Methods
    # ==========================================
    
    @weave.op(name="orchestrator_initialize_scenes")
    async def initialize_scenes(self) -> List[Scene]:
        """
        Create Scene records from uploaded images for batch processing.
        Each scene represents one input image that will produce one output.
        """
        await self.load_project()
        images = self.project.images or []
        
        if not images:
            return []
        
        scenes = []
        for idx, image_path in enumerate(images):
            # Extract filename for scene name
            name = image_path.split("/")[-1] if "/" in image_path else image_path.split("\\")[-1]
            
            scene = Scene(
                project_id=self.project_id,
                scene_index=idx,
                name=name,
                input_image_path=image_path,
                status=SceneStatus.PENDING,
                orchestration_state=OrchestrationState.CREATED,
            )
            self.session.add(scene)
            scenes.append(scene)
        
        # Update project batch tracking
        self.project.is_batch = len(images) > 1
        self.project.total_scenes = len(images)
        self.project.completed_scenes = 0
        
        await self.session.flush()
        return scenes
    
    async def get_scenes(self) -> List[Scene]:
        """Get all scenes for the project, ordered by index."""
        result = await self.session.execute(
            select(Scene)
            .where(Scene.project_id == self.project_id)
            .order_by(Scene.scene_index)
        )
        return result.scalars().all()
    
    async def get_pending_scenes(self) -> List[Scene]:
        """Get scenes that haven't been processed yet."""
        result = await self.session.execute(
            select(Scene)
            .where(Scene.project_id == self.project_id)
            .where(Scene.status == SceneStatus.PENDING)
            .order_by(Scene.scene_index)
        )
        return result.scalars().all()
    
    @weave.op(name="orchestrator_run_batch")
    async def run_batch(self) -> Dict[str, Any]:
        """
        Process all scenes in a batch project with cross-scene learning.
        
        This is the main entry point for batch processing:
        1. Requirements are gathered ONCE for the entire batch
        2. Policy is SEEDED from past successful projects (cross-project learning)
        3. Each image is processed independently through the pipeline
        4. Policy improvements from early scenes benefit later scenes
        5. Progress is tracked per-scene and for the overall batch
        6. Learning summary is generated at the end
        """
        await self.load_project()
        
        # Mark start time
        if not self.project.started_at:
            self.project.started_at = datetime.now(timezone.utc)
        
        # Initialize scenes if not already done
        scenes = await self.get_scenes()
        if not scenes:
            scenes = await self.initialize_scenes()
        
        if not scenes:
            return {
                "success": False,
                "error": "No images to process",
                "project_id": str(self.project_id),
            }
        
        # Step 1: Requirements gathering (once for entire batch)
        await self._ensure_requirements_complete()
        
        # Step 2: Seed policy from cross-project learnings
        learning_summary = {"seeded_from_past": False, "improvements_made": 0, "scenes_benefited": []}
        try:
            requirements = await generation_agent.load_requirements(self.session, self.project_id)
            space_type = requirements.get("space_type") if requirements else None
            
            seed_result = await qc_agent.seed_policy_from_learnings(
                self.session, self.project_id, space_type=space_type
            )
            if seed_result.get("seeded"):
                learning_summary["seeded_from_past"] = True
                learning_summary["seed_details"] = seed_result
        except Exception as e:
            # Log but don't fail - seeding is enhancement only
            print(f"Policy seeding failed: {e}")
        
        # Step 3: Process each scene with cross-scene learning
        results = []
        pending_scenes = [s for s in scenes if s.status not in [SceneStatus.COMPLETED, SceneStatus.SKIPPED]]
        if pending_scenes and self.config.BATCH_CONCURRENCY > 1:
            results = await self._process_scenes_concurrently(pending_scenes)
        else:
            for idx, scene in enumerate(scenes):
                if scene.status in [SceneStatus.COMPLETED, SceneStatus.SKIPPED]:
                    results.append({
                        "scene_id": str(scene.id),
                        "status": scene.status,
                        "output": scene.output_image_path,
                    })
                    continue

                self._current_scene = scene
                scene_result = await self._process_scene(scene)
                results.append(scene_result)

                # Track policy improvements for learning summary
                if scene.metadata_ and scene.metadata_.get("policy_improvements"):
                    learning_summary["improvements_made"] += scene.metadata_["policy_improvements"]
                    # Scenes after this one will benefit from the improved policy
                    if idx < len(scenes) - 1:
                        learning_summary["scenes_benefited"].extend([
                            str(s.id) for s in scenes[idx+1:]
                            if s.status not in [SceneStatus.COMPLETED, SceneStatus.SKIPPED]
                        ])

                # Update project progress
                if scene_result.get("status") == SceneStatus.COMPLETED:
                    self.project.completed_scenes += 1

                await self.session.flush()

        # Reload scenes to compute accurate progress and improvements
        scenes = await self.get_scenes()
        self.project.completed_scenes = sum(1 for s in scenes if s.status == SceneStatus.COMPLETED)
        for idx, scene in enumerate(scenes):
            if scene.metadata_ and scene.metadata_.get("policy_improvements"):
                learning_summary["improvements_made"] += scene.metadata_["policy_improvements"]
                if idx < len(scenes) - 1:
                    learning_summary["scenes_benefited"].extend([
                        str(s.id) for s in scenes[idx+1:]
                        if s.status not in [SceneStatus.COMPLETED, SceneStatus.SKIPPED]
                    ])
        
        # Mark batch complete
        self.project.completed_at = datetime.now(timezone.utc)
        
        if self.project.completed_scenes == self.project.total_scenes:
            self.project.status = ProjectStatus.COMPLETED
            self.project.orchestration_state = OrchestrationState.COMPLETED
        elif self.project.completed_scenes > 0:
            self.project.status = ProjectStatus.COMPLETED
            self.project.orchestration_state = OrchestrationState.COMPLETED_WITH_WARNINGS
        else:
            self.project.status = ProjectStatus.FAILED
            self.project.orchestration_state = OrchestrationState.FAILED
        
        await self.session.commit()
        
        # Compile final learning summary
        learning_summary["scenes_benefited"] = list(set(learning_summary["scenes_benefited"]))
        
        # Record batch learning to Weave for observability
        record_batch_learning(
            project_id=str(self.project_id),
            total_scenes=self.project.total_scenes,
            completed_scenes=self.project.completed_scenes,
            improvements_made=learning_summary["improvements_made"],
            scenes_benefited=learning_summary["scenes_benefited"],
            seeded_from_past=learning_summary["seeded_from_past"],
            effective_patterns=learning_summary.get("seed_details", {}).get("changes_applied", [])
        )
        
        return {
            "success": True,
            "project_id": str(self.project_id),
            "total_scenes": self.project.total_scenes,
            "completed_scenes": self.project.completed_scenes,
            "results": results,
            "learning_summary": learning_summary,
        }

    async def _process_scenes_concurrently(self, scenes: List[Scene]) -> List[Dict[str, Any]]:
        """Process scenes in parallel with isolated sessions."""
        concurrency = max(1, self.config.BATCH_CONCURRENCY)
        semaphore = asyncio.Semaphore(concurrency)

        async def run_scene(scene_id: UUID) -> Dict[str, Any]:
            async with semaphore:
                async with AsyncSessionLocal() as session:
                    orchestrator = Orchestrator(session, self.project_id, self.config)
                    result = await session.execute(
                        select(Scene).where(Scene.id == scene_id)
                    )
                    scene = result.scalar_one_or_none()
                    if not scene:
                        return {"scene_id": str(scene_id), "status": SceneStatus.FAILED, "error": "Scene not found"}
                    scene_result = await orchestrator._process_scene(scene)
                    await session.commit()
                    return scene_result

        tasks = [run_scene(scene.id) for scene in scenes]
        return await asyncio.gather(*tasks)

    @weave.op(name="orchestrator_get_batch_patterns")
    async def get_batch_patterns(self) -> List[Dict[str, Any]]:
        """Identify common patterns across batch scenes."""
        await self.load_project()
        scenes = await self.get_scenes()
        if len(scenes) < 2:
            return []

        total = len(scenes)
        patterns: List[Dict[str, Any]] = []

        # Space type patterns
        space_counts: Dict[str, List[str]] = defaultdict(list)
        for scene in scenes:
            if scene.space_type_detected:
                space_counts[scene.space_type_detected].append(str(scene.id))

        for space_type, scene_ids in space_counts.items():
            frequency = len(scene_ids) / total
            patterns.append({
                "pattern_type": "space_type",
                "description": f"Detected {space_type.replace('_', ' ')} across {len(scene_ids)} scenes",
                "frequency": frequency,
                "confidence": min(0.9, 0.5 + (0.4 * frequency)),
                "supporting_scenes": scene_ids,
            })

        # Constraint patterns
        constraint_result = await self.session.execute(
            select(Constraint).where(Constraint.project_id == self.project_id)
        )
        constraints = constraint_result.scalars().all()
        constraint_map: Dict[str, set] = defaultdict(set)
        for c in constraints:
            if c.element_type and c.scene_id:
                constraint_map[c.element_type].add(str(c.scene_id))

        for element_type, scene_ids in constraint_map.items():
            frequency = len(scene_ids) / total
            if frequency >= 0.5:
                patterns.append({
                    "pattern_type": "constraint",
                    "description": f"{element_type.replace('_', ' ')} appears in {len(scene_ids)} scenes",
                    "frequency": frequency,
                    "confidence": min(0.9, 0.55 + (0.35 * frequency)),
                    "supporting_scenes": list(scene_ids),
                })

        return patterns

    @weave.op(name="orchestrator_get_batch_insights")
    async def get_batch_insights(self) -> Dict[str, Any]:
        """Generate batch insights and recommendations."""
        await self.load_project()
        scenes = await self.get_scenes()
        patterns = await self.get_batch_patterns()

        commonalities = [p for p in patterns if p.get("frequency", 0) >= 0.5]
        differences = [p for p in patterns if p.get("frequency", 0) < 0.5]

        recommendations = []
        for pattern in commonalities:
            if pattern["pattern_type"] == "constraint":
                recommendations.append({
                    "title": "Preserve common constraints across all scenes",
                    "rationale": pattern["description"],
                    "priority": "high",
                })
            elif pattern["pattern_type"] == "space_type":
                recommendations.append({
                    "title": "Align style direction across shared space types",
                    "rationale": pattern["description"],
                    "priority": "medium",
                })

        return {
            "project_id": str(self.project_id),
            "total_scenes": len(scenes),
            "commonalities": commonalities,
            "differences": differences,
            "recommendations": recommendations,
        }

    @weave.op(name="orchestrator_get_batch_report")
    async def get_batch_report(self) -> Dict[str, Any]:
        """Generate a comprehensive batch report."""
        await self.load_project()
        scenes = await self.get_scenes()
        patterns = await self.get_batch_patterns()
        insights = await self.get_batch_insights()

        # Collect evaluation scores
        eval_result = await self.session.execute(
            select(Iteration).where(Iteration.project_id == self.project_id)
        )
        iterations = eval_result.scalars().all()
        scores = [i.evaluation_score for i in iterations if i.evaluation_score is not None]
        avg_score = sum(scores) / len(scores) if scores else None

        return {
            "batch_id": str(self.project_id),
            "project_id": str(self.project_id),
            "summary": {
                "total_scenes": len(scenes),
                "completed": sum(1 for s in scenes if s.status == SceneStatus.COMPLETED),
                "average_qc_score": avg_score,
                "started_at": self.project.started_at.isoformat() if self.project.started_at else None,
                "completed_at": self.project.completed_at.isoformat() if self.project.completed_at else None,
                "patterns_identified": len(patterns),
            },
            "patterns": patterns,
            "commonalities": insights.get("commonalities", []),
            "differences": insights.get("differences", []),
            "recommendations": insights.get("recommendations", []),
            "individual_scenes": [
                {
                    "scene_id": str(s.id),
                    "scene_index": s.scene_index,
                    "status": s.status,
                    "input_image": s.input_image_path,
                    "output_image": s.output_image_path,
                    "space_type": s.space_type_detected,
                    "has_warnings": s.has_warnings,
                }
                for s in scenes
            ],
        }
    
    async def _ensure_requirements_complete(self) -> None:
        """Ensure requirements gathering is complete for the batch."""
        if self.project.orchestration_state == OrchestrationState.CREATED:
            await self.transition(
                OrchestrationState.GATHERING_REQUIREMENTS,
                OrchestrationTrigger.START,
            )
            await self._handle_gathering_requirements()
    
    @weave.op(name="orchestrator_process_scene")
    async def _process_scene(self, scene: Scene) -> Dict[str, Any]:
        """
        Process a single scene through the complete pipeline.
        Each scene gets its own spatial analysis and generation phases.
        """
        scene.status = SceneStatus.ANALYZING
        scene.started_at = datetime.now(timezone.utc)
        await self.session.flush()
        
        try:
            # Step 1: Spatial analysis for this scene
            analysis_result = await spatial_agent.analyze_images(
                self.session,
                self.project_id,
                [scene.input_image_path],
                scene_id=scene.id  # Link constraints to scene
            )
            
            scene.space_type_detected = analysis_result.get("space_type")
            scene.status = SceneStatus.GENERATING
            await self.session.flush()
            
            # Step 2: Run generation phases
            self._current_input_image = scene.input_image_path
            current_image = scene.input_image_path
            
            phases = [
                GenerationPhase.CLEANUP,
                GenerationPhase.STRUCTURAL,
                GenerationPhase.FIXTURE,
                GenerationPhase.STYLE,
            ]
            
            for phase in phases:
                result = await self._run_phase_for_scene(scene, phase, current_image)
                
                if result.get("output_path"):
                    current_image = result["output_path"]
                else:
                    # Phase failed, record warning but continue
                    scene.has_warnings = True
                    # Ensure warning_details is initialized before appending
                    if scene.warning_details is None:
                        scene.warning_details = []
                    scene.warning_details.append({
                        "phase": phase,
                        "error": result.get("error", "Unknown error"),
                    })
            
            # Store final output
            scene.output_image_path = current_image
            scene.status = SceneStatus.COMPLETED
            scene.completed_at = datetime.now(timezone.utc)
            scene.orchestration_state = OrchestrationState.COMPLETED
            
            return {
                "scene_id": str(scene.id),
                "status": SceneStatus.COMPLETED,
                "input": scene.input_image_path,
                "output": scene.output_image_path,
                "space_type": scene.space_type_detected,
            }
            
        except Exception as e:
            scene.status = SceneStatus.FAILED
            scene.error_message = str(e)
            scene.orchestration_state = OrchestrationState.FAILED
            return {
                "scene_id": str(scene.id),
                "status": SceneStatus.FAILED,
                "error": str(e),
            }
    
    async def _run_phase_for_scene(
        self,
        scene: Scene,
        phase: str,
        input_image: str
    ) -> Dict[str, Any]:
        """Run a single generation phase for a scene with retries and learning."""
        scene.current_phase = phase
        await self.session.flush()
        
        requirements = await generation_agent.load_requirements(self.session, self.project_id)
        constraints, _ = await generation_agent.load_constraints(
            self.session, self.project_id, scene_id=scene.id
        )
        policy = await generation_agent.load_policy(self.session, self.project_id)
        
        max_retries = self.config.MAX_RETRIES_PER_PHASE
        last_policy_id = policy.get("id")  # Track for improvement verification
        policy_changed = False
        
        for attempt in range(max_retries + 1):
            try:
                if phase == GenerationPhase.CLEANUP:
                    result = await generation_agent.execute_cleanup_phase(
                        self.session, self.project_id, input_image, policy, constraints,
                        scene_id=scene.id
                    )
                elif phase == GenerationPhase.STRUCTURAL:
                    result = await generation_agent.execute_structural_phase(
                        self.session, self.project_id, input_image, policy, constraints,
                        scene_id=scene.id
                    )
                elif phase == GenerationPhase.FIXTURE:
                    result = await generation_agent.execute_fixture_phase(
                        self.session, self.project_id, input_image, policy, constraints, requirements,
                        scene_id=scene.id
                    )
                elif phase == GenerationPhase.STYLE:
                    styles = requirements.get("style_targets", ["modern"])
                    result = await generation_agent.execute_style_phase(
                        self.session, self.project_id, input_image, policy, constraints,
                        requirements, styles[0], scene_id=scene.id
                    )
                
                if result.get("output_path"):
                    # Evaluate result
                    iteration_id = result.get("iteration_id")
                    if iteration_id:
                        eval_result = await qc_agent.compute_overall_evaluation(
                            self.session, iteration_id
                        )
                        
                        if eval_result.get("passed"):
                            # SUCCESS! If we had a policy change, mark it as effective
                            if policy_changed and policy.get("id"):
                                await qc_agent.mark_improvement_effective(
                                    self.session, self.project_id, policy["id"], effective=True
                                )
                            return result
                        
                        # Failed evaluation - try to improve policy
                        if attempt < max_retries:
                            analysis = await qc_agent.analyze_failure(self.session, iteration_id)
                            changes = analysis.get("recommended_changes", [])
                            if changes:
                                policy_result = await qc_agent.apply_policy_changes(
                                    self.session, self.project_id, changes, iteration_id
                                )
                                policy = await generation_agent.load_policy(self.session, self.project_id)
                                policy_changed = True
                                
                                # Track that policy was updated for this scene
                                if not scene.metadata_:
                                    scene.metadata_ = {}
                                scene.metadata_["policy_improvements"] = scene.metadata_.get("policy_improvements", 0) + 1
                                scene.metadata_["last_improvement_phase"] = phase
                    else:
                        return result
                        
            except Exception as e:
                if attempt == max_retries:
                    return {"error": str(e)}
        
        # Max retries exceeded - mark last policy change as ineffective
        if policy_changed and policy.get("id"):
            await qc_agent.mark_improvement_effective(
                self.session, self.project_id, policy["id"], effective=False
            )
        
        return {"error": "Max retries exceeded"}
    
    async def load_project(self) -> Project:
        """Load project from database."""
        result = await self.session.execute(
            select(Project).where(Project.id == self.project_id)
        )
        self.project = result.scalar_one_or_none()
        if not self.project:
            raise ValueError(f"Project {self.project_id} not found")
        return self.project
    
    @weave.op(name="orchestrator_state_transition")
    async def transition(
        self,
        to_state: str,
        trigger: str,
        details: Optional[Dict[str, Any]] = None
    ) -> None:
        """
        Execute a state transition with validation and logging.
        """
        if not self.project:
            await self.load_project()
        
        from_state = self.project.orchestration_state
        
        # Validate transition
        valid_transitions = STATE_TRANSITIONS.get(from_state, [])
        if to_state not in valid_transitions:
            raise ValueError(
                f"Invalid transition: {from_state} -> {to_state}. "
                f"Valid transitions: {valid_transitions}"
            )
        
        # Calculate duration
        duration_ms = None
        if self.state_start_time:
            duration_ms = int((time.time() - self.state_start_time) * 1000)
        
        # Log the transition
        log_entry = OrchestrationLog(
            project_id=self.project_id,
            from_state=from_state,
            to_state=to_state,
            trigger=trigger,
            details=details or {},
            duration_ms=duration_ms,
        )
        self.session.add(log_entry)
        
        # Update project state
        self.project.orchestration_state = to_state
        self.project.updated_at = datetime.now(timezone.utc)
        
        # Handle terminal states
        if to_state in TERMINAL_STATES:
            self.project.completed_at = datetime.now(timezone.utc)
            if to_state == OrchestrationState.COMPLETED:
                self.project.status = ProjectStatus.COMPLETED
            elif to_state == OrchestrationState.COMPLETED_WITH_WARNINGS:
                self.project.status = ProjectStatus.COMPLETED
                self.project.has_warnings = True
            else:
                self.project.status = ProjectStatus.FAILED
        
        await self.session.flush()
        self.state_start_time = time.time()
    
    @weave.op(name="orchestrator_run_pipeline")
    async def run(self) -> Dict[str, Any]:
        """
        Drive the state machine until a terminal state is reached.
        Returns the final project state and results.
        """
        await self.load_project()
        
        # Mark start time
        if not self.project.started_at:
            self.project.started_at = datetime.now(timezone.utc)
        
        self.state_start_time = time.time()
        
        # Run until terminal state
        while self.project.orchestration_state not in TERMINAL_STATES:
            state = self.project.orchestration_state
            
            try:
                # Dispatch to state handler
                if state == OrchestrationState.CREATED:
                    await self._handle_created()
                elif state == OrchestrationState.GATHERING_REQUIREMENTS:
                    await self._handle_gathering_requirements()
                elif state == OrchestrationState.AWAITING_CLARIFICATION:
                    # This state waits for user input - break the loop
                    break
                elif state == OrchestrationState.ANALYZING_SPACE:
                    await self._handle_analyzing_space()
                elif state.startswith("generating_"):
                    await self._handle_generating()
                elif state.startswith("evaluating_"):
                    await self._handle_evaluating()
                elif state.startswith("retrying_"):
                    await self._handle_retrying()
                else:
                    # Unknown state - fail
                    await self.transition(
                        OrchestrationState.FAILED,
                        OrchestrationTrigger.FAILURE,
                        {"error": f"Unknown state: {state}"}
                    )
                    
            except Exception as e:
                # Handle any unexpected errors
                await self.transition(
                    OrchestrationState.FAILED,
                    OrchestrationTrigger.FAILURE,
                    {"error": str(e), "state": state}
                )
        
        await self.session.commit()
        
        return {
            "project_id": str(self.project_id),
            "state": self.project.orchestration_state,
            "status": self.project.status,
            "has_warnings": self.project.has_warnings,
            "started_at": self.project.started_at.isoformat() if self.project.started_at else None,
            "completed_at": self.project.completed_at.isoformat() if self.project.completed_at else None,
        }
    
    # ==========================================
    # State Handlers
    # ==========================================
    
    async def _handle_created(self) -> None:
        """Handle CREATED state - start requirements gathering."""
        await self.transition(
            OrchestrationState.GATHERING_REQUIREMENTS,
            OrchestrationTrigger.START,
            {"message": "Starting requirements gathering"}
        )
    
    async def _handle_gathering_requirements(self) -> None:
        """Handle GATHERING_REQUIREMENTS - run requirements agent."""
        try:
            # Skip if requirements already exist
            existing_req = await self.session.execute(
                select(Requirements).where(Requirements.project_id == self.project_id)
            )
            requirements = existing_req.scalar_one_or_none()
            
            if requirements:
                # Requirements already submitted via /submit-answers
                await self.transition(
                    OrchestrationState.ANALYZING_SPACE,
                    OrchestrationTrigger.SKIP,
                    {
                        "message": "Requirements already available, skipping clarification",
                        "space_type": requirements.space_type,
                        "style_targets": requirements.style_targets,
                    }
                )
                return

            # No existing requirements - analyze the goal
            if not self.project.goal:
                await self.transition(
                    OrchestrationState.FAILED,
                    OrchestrationTrigger.FAILURE,
                    {"error": "No goal provided"}
                )
                return

            # Analyze goal (sync function - no await)
            analysis = requirements_agent.analyze_goal(self.project.goal)
            
            # Generate questions (sync function - no await)  
            questions = requirements_agent.generate_questions(analysis)

            if questions:
                # Need clarification from user
                await self.transition(
                    OrchestrationState.AWAITING_CLARIFICATION,
                    OrchestrationTrigger.SUCCESS,
                    {
                        "questions_count": len(questions),
                        "identified": analysis.get("identified", {}),
                    }
                )
            else:
                # No questions needed - save default requirements and proceed
                await self._save_default_requirements(analysis.get("identified", {}))
                await self.transition(
                    OrchestrationState.ANALYZING_SPACE,
                    OrchestrationTrigger.SUCCESS,
                    {"message": "Requirements complete, no clarification needed"}
                )
                
        except Exception as e:
            import traceback
            error_details = {
                "error": str(e),
                "type": type(e).__name__,
                "traceback": traceback.format_exc()
            }
            print(f"[Orchestrator] _handle_gathering_requirements failed: {error_details}")
            await self.transition(
                OrchestrationState.FAILED,
                OrchestrationTrigger.FAILURE,
                {"error": str(e), "error_type": type(e).__name__}
            )
    
    async def _save_default_requirements(self, identified: Dict[str, Any]) -> None:
        """Save requirements when no clarification needed."""
        
        req = Requirements(
            project_id=self.project_id,
            original_goal=self.project.goal or "",
            space_type=identified.get("space_type", "room"),
            style_targets=identified.get("styles", ["modern"]),
            accessibility_required=identified.get("accessibility", False),
            budget_tier=identified.get("budget", "mid_range"),
            intended_use=identified.get("intended_use", "personal"),
            analysis_complete=True,
        )
        self.session.add(req)
        await self.session.flush()
    
    async def _handle_analyzing_space(self) -> None:
        """Handle ANALYZING_SPACE - run spatial analysis agent."""
        try:
            # Get images
            images = self.project.images or []
            
            if not images:
                # No images - still proceed but with placeholder analysis
                await self.transition(
                    OrchestrationState.GENERATING_CLEANUP,
                    OrchestrationTrigger.SKIP,
                    {"message": "No images provided, skipping spatial analysis"}
                )
                return
            
            # Run spatial analysis
            result = await spatial_agent.analyze_images(
                self.session,
                self.project_id,
                images
            )
            
            # Set initial input image
            self._current_input_image = images[0] if images else None
            
            await self.transition(
                OrchestrationState.GENERATING_CLEANUP,
                OrchestrationTrigger.SUCCESS,
                {
                    "constraints_count": result.get("constraints_count", 0),
                    "construction_state": result.get("construction_state"),
                }
            )
            
        except Exception as e:
            await self.transition(
                OrchestrationState.FAILED,
                OrchestrationTrigger.FAILURE,
                {"error": str(e)}
            )
    
    async def _handle_generating(self) -> None:
        """Handle GENERATING_X states - run generation agent for current phase."""
        state = self.project.orchestration_state
        phase = self._get_phase_from_state(state)
        
        # Human-readable phase descriptions for frontend display
        phase_descriptions = {
            "cleanup": {
                "name": "Cleanup",
                "description": "Removing debris and normalizing the space",
                "index": 1,
            },
            "structural": {
                "name": "Structural Completion", 
                "description": "Completing walls, ceiling, and flooring",
                "index": 2,
            },
            "fixture": {
                "name": "Fixture Placement",
                "description": "Placing fixtures according to spatial constraints",
                "index": 3,
            },
            "style": {
                "name": "Style Application",
                "description": "Applying final aesthetic styling",
                "index": 4,
            },
        }
        
        if not phase:
            await self.transition(
                OrchestrationState.FAILED,
                OrchestrationTrigger.FAILURE,
                {"error": f"Cannot determine phase from state: {state}"}
            )
            return
        
        self.project.current_phase = phase
        phase_info = phase_descriptions.get(phase, {"name": phase, "description": "", "index": 0})
        
        try:
            # Determine input image
            input_image = await self._get_input_for_phase(phase)
            
            # Load requirements for fixture/style phases
            requirements = await generation_agent.load_requirements(self.session, self.project_id)
            constraints, _ = await generation_agent.load_constraints(self.session, self.project_id)
            policy = await generation_agent.load_policy(self.session, self.project_id)
            
            # Execute phase with enhanced messaging
            start_time = time.time()
            if phase == GenerationPhase.CLEANUP:
                result = await generation_agent.execute_cleanup_phase(
                    self.session, self.project_id, input_image, policy, constraints
                )
            elif phase == GenerationPhase.STRUCTURAL:
                result = await generation_agent.execute_structural_phase(
                    self.session, self.project_id, input_image, policy, constraints
                )
            elif phase == GenerationPhase.FIXTURE:
                result = await generation_agent.execute_fixture_phase(
                    self.session, self.project_id, input_image, policy, constraints, requirements
                )
            elif phase == GenerationPhase.STYLE:
                # Run style for each target style
                styles = requirements.get("style_targets", ["modern"])
                result = await generation_agent.execute_style_phase(
                    self.session, self.project_id, input_image, policy, constraints,
                    requirements, styles[0]
                )
            
            generation_time_ms = int((time.time() - start_time) * 1000)
            
            # Store output for next phase
            output_path = result.get("output_path")
            if output_path:
                self._current_input_image = output_path
            
            # Move to evaluation - include detailed info for frontend demo display
            eval_state = f"evaluating_{phase}"
            await self.transition(
                eval_state,
                OrchestrationTrigger.SUCCESS,
                {
                    "iteration_id": result.get("iteration_id"),
                    "output_path": output_path,
                    "phase": phase,
                    "phase_name": phase_info["name"],
                    "phase_index": phase_info["index"],
                    "total_phases": 4,
                    "generation_time_ms": generation_time_ms,
                    "constraints_count": len(constraints) if constraints else 0,
                    "message": f"Phase {phase_info['index']} of 4 ({phase_info['name']}) - Generation complete in {generation_time_ms}ms",
                }
            )
            
        except Exception as e:
            await self.transition(
                OrchestrationState.FAILED,
                OrchestrationTrigger.FAILURE,
                {"error": str(e), "phase": phase}
            )
    
    async def _handle_evaluating(self) -> None:
        """Handle EVALUATING_X states - run QC evaluation."""
        state = self.project.orchestration_state
        phase = self._get_phase_from_state(state)
        
        if not phase:
            await self.transition(
                OrchestrationState.FAILED,
                OrchestrationTrigger.FAILURE,
                {"error": f"Cannot determine phase from state: {state}"}
            )
            return
        
        try:
            # Get latest iteration for this phase
            iteration = await self._get_latest_iteration(phase)
            
            if not iteration:
                # No iteration found - retry or fail
                await self._handle_evaluation_failure(phase, {"error": "No iteration found"})
                return
            
            # Run evaluation
            eval_start = time.time()
            eval_result = await qc_agent.compute_overall_evaluation(
                self.session, iteration.id
            )
            eval_time_ms = int((time.time() - eval_start) * 1000)
            
            # Include output path for frontend display
            output_path = iteration.output_image_path
            eval_score = eval_result.get("overall_score", 0)
            criteria_results = eval_result.get("criteria", [])
            
            # Build detailed evaluation feedback for frontend
            passed_criteria = sum(1 for c in criteria_results if c.get("passed", False))
            total_criteria = len(criteria_results)
            failed_details = [
                {
                    "criterion": c.get("criterion", "unknown"),
                    "score": c.get("score"),
                    "details": c.get("details", "") or ""
                }
                for c in criteria_results if not c.get("passed", True)
            ]
            primary_failure_reason = next(
                (d["details"] for d in failed_details if d.get("details")),
                None
            )
            
            if eval_result.get("passed"):
                # Passed - move to next phase or complete
                # Store the output path and score for the advance transition
                self._last_eval_output = output_path
                self._last_eval_score = eval_score
                await self._advance_to_next_phase(
                    phase, 
                    output_path=output_path, 
                    eval_score=eval_score,
                    eval_time_ms=eval_time_ms,
                    passed_criteria=passed_criteria,
                    total_criteria=total_criteria
                )
            else:
                # Failed - retry or move on
                failed_criteria = [c.get("criterion", "unknown") for c in criteria_results if not c.get("passed", True)]
                await self._handle_evaluation_failure(phase, {
                    "score": eval_score,
                    "iteration_id": str(iteration.id),
                    "output_path": output_path,
                    "evaluation_passed": False,
                    "eval_time_ms": eval_time_ms,
                    "passed_criteria": passed_criteria,
                    "total_criteria": total_criteria,
                    "failed_criteria": failed_criteria,
                    "failure_reasons": failed_criteria,
                    "failure_details": failed_details,
                    "primary_failure_reason": primary_failure_reason or "Quality check below threshold",
                    "human_readable_reason": primary_failure_reason or "Quality check below threshold",
                    "message": f"Quality check failed ({passed_criteria}/{total_criteria} criteria passed, score: {eval_score:.2%})",
                })
                
        except Exception as e:
            await self._handle_evaluation_failure(phase, {"error": str(e)})
    
    async def _handle_retrying(self) -> None:
        """Handle RETRYING_X states - analyze failure and modify policy."""
        state = self.project.orchestration_state
        phase = self._get_phase_from_state(state)
        
        if not phase:
            await self.transition(
                OrchestrationState.FAILED,
                OrchestrationTrigger.FAILURE,
                {"error": f"Cannot determine phase from state: {state}"}
            )
            return
        
        # Check retry count
        if self.project.retry_count >= self.config.MAX_RETRIES_PER_PHASE:
            # Max retries reached
            if self.config.AUTO_ADVANCE_ON_MAX_RETRY:
                # Record warning and move to next phase
                self.project.has_warnings = True
                warning = {
                    "phase": phase,
                    "issue": "Max retries reached",
                    "retry_count": self.project.retry_count,
                }
                warnings = self.project.warning_details or []
                warnings.append(warning)
                self.project.warning_details = warnings
                
                await self._advance_to_next_phase(phase, max_retries=True)
            else:
                await self.transition(
                    OrchestrationState.FAILED,
                    OrchestrationTrigger.MAX_RETRIES,
                    {"phase": phase, "retry_count": self.project.retry_count}
                )
            return
        
        try:
            # Get latest iteration and analyze failure
            iteration = await self._get_latest_iteration(phase)
            
            policy_result = None
            changes_applied: list = []
            old_version = None
            new_version = None

            if iteration:
                # Analyze and apply policy changes
                analysis = await qc_agent.analyze_failure(self.session, iteration.id)
                recommended_changes = analysis.get("recommended_changes", [])
                
                if recommended_changes:
                    policy_result = await qc_agent.apply_policy_changes(
                        self.session, self.project_id, recommended_changes, iteration.id
                    )
                    if policy_result and policy_result.get("success"):
                        changes_applied = policy_result.get("changes_applied", [])
                        old_version = policy_result.get("old_version")
                        new_version = policy_result.get("new_version")
            
            # Increment retry count and go back to generation
            self.project.retry_count += 1
            gen_state = f"generating_{phase}"
            
            await self.transition(
                gen_state,
                OrchestrationTrigger.USER_ACTION,
                {
                    "retry_number": self.project.retry_count,
                    "phase": phase,
                    "changes_applied": changes_applied,
                    "previous_policy_version": old_version,
                    "policy_version": new_version,
                }
            )
            
        except Exception as e:
            await self.transition(
                OrchestrationState.FAILED,
                OrchestrationTrigger.FAILURE,
                {"error": str(e)}
            )
    
    async def _handle_evaluation_failure(self, phase: str, details: Dict[str, Any]) -> None:
        """Handle a failed evaluation - transition to retry state."""
        retry_state = f"retrying_{phase}"
        await self.transition(
            retry_state,
            OrchestrationTrigger.FAILURE,
            details
        )
    
    async def _advance_to_next_phase(
        self, 
        current_phase: str, 
        max_retries: bool = False,
        output_path: Optional[str] = None,
        eval_score: Optional[float] = None,
        eval_time_ms: Optional[int] = None,
        passed_criteria: Optional[int] = None,
        total_criteria: Optional[int] = None
    ) -> None:
        """Advance to the next phase or complete."""
        next_phase = NEXT_PHASE.get(current_phase)
        
        # Phase indices for frontend display
        phase_indices = {"cleanup": 1, "structural": 2, "fixture": 3, "style": 4}
        current_idx = phase_indices.get(current_phase, 0)
        
        # Reset retry count for new phase
        self.project.retry_count = 0
        
        score_str = f"{eval_score:.2f}" if eval_score else "N/A"
        criteria_str = f"{passed_criteria}/{total_criteria}" if passed_criteria is not None else ""
        
        if next_phase:
            next_idx = phase_indices.get(next_phase, current_idx + 1)
            # Move to next phase
            gen_state = f"generating_{next_phase}"
            trigger = OrchestrationTrigger.MAX_RETRIES if max_retries else OrchestrationTrigger.SUCCESS
            await self.transition(
                gen_state,
                trigger,
                {
                    "from_phase": current_phase, 
                    "to_phase": next_phase,
                    "output_path": output_path,
                    "evaluation_passed": True,
                    "score": eval_score,
                    "eval_time_ms": eval_time_ms,
                    "passed_criteria": passed_criteria,
                    "total_criteria": total_criteria,
                    "phase_index": next_idx,
                    "total_phases": 4,
                    "message": f"✓ Phase {current_idx}/4 ({current_phase}) passed QC ({criteria_str}, score: {score_str}). Starting phase {next_idx}/4 ({next_phase})...",
                }
            )
        else:
            # All phases complete
            if self.project.has_warnings:
                await self.transition(
                    OrchestrationState.COMPLETED_WITH_WARNINGS,
                    OrchestrationTrigger.SUCCESS,
                    {
                        "message": f"✓ All 4 phases complete with warnings. Final score: {score_str}",
                        "final_output_path": output_path,
                        "final_score": eval_score,
                        "total_phases": 4,
                        "completed_phases": 4,
                    }
                )
            else:
                await self.transition(
                    OrchestrationState.COMPLETED,
                    OrchestrationTrigger.SUCCESS,
                    {
                        "message": f"✓ All 4 phases complete successfully! Final score: {score_str}",
                        "final_output_path": output_path,
                        "final_score": eval_score,
                        "total_phases": 4,
                        "completed_phases": 4,
                    }
                )
    
    # ==========================================
    # Helper Methods
    # ==========================================
    
    def _get_phase_from_state(self, state: str) -> Optional[str]:
        """Extract the generation phase from a state name."""
        for phase, states in PHASE_STATES.items():
            if state in states:
                return phase
        return None
    
    async def _get_input_for_phase(self, phase: str) -> str:
        """Determine the input image for a generation phase."""
        if phase == GenerationPhase.CLEANUP:
            # Use original image
            images = self.project.images or []
            return images[0] if images else ""
        
        # For subsequent phases, use output of previous phase
        if self._current_input_image:
            return self._current_input_image
        
        # Fallback: get output from previous phase's iteration
        prev_phase = {
            GenerationPhase.STRUCTURAL: GenerationPhase.CLEANUP,
            GenerationPhase.FIXTURE: GenerationPhase.STRUCTURAL,
            GenerationPhase.STYLE: GenerationPhase.FIXTURE,
        }.get(phase)
        
        if prev_phase:
            iteration = await self._get_latest_iteration(prev_phase, accepted_only=True)
            if iteration and iteration.output_image_path:
                return iteration.output_image_path
        
        # Ultimate fallback: original image
        images = self.project.images or []
        return images[0] if images else ""
    
    async def _get_latest_iteration(
        self,
        phase: str,
        accepted_only: bool = False
    ) -> Optional[Iteration]:
        """Get the latest iteration for a phase."""
        from sqlalchemy import desc
        
        query = select(Iteration).where(
            Iteration.project_id == self.project_id,
            Iteration.phase == phase
        )
        
        if accepted_only:
            query = query.where(Iteration.evaluation_result == "accepted")
        
        query = query.order_by(desc(Iteration.created_at)).limit(1)
        
        result = await self.session.execute(query)
        return result.scalar_one_or_none()
    
    # ==========================================
    # External Interface Methods
    # ==========================================
    
    async def submit_clarification(self, answers: Dict[str, str]) -> Dict[str, Any]:
        """
        Handle user submission of clarification answers.
        Called when project is in AWAITING_CLARIFICATION state.
        """
        await self.load_project()
        
        if self.project.orchestration_state != OrchestrationState.AWAITING_CLARIFICATION:
            raise ValueError(
                f"Cannot submit clarification in state: {self.project.orchestration_state}"
            )
        
        try:
            # Process answers and finalize requirements
            analysis = requirements_agent.analyze_goal(self.project.goal or "")
            specification = requirements_agent.process_responses(analysis, answers)
            await requirements_agent.save_requirements(
                self.session, self.project_id, specification
            )
            
            # Transition to analysis
            await self.transition(
                OrchestrationState.ANALYZING_SPACE,
                OrchestrationTrigger.USER_ACTION,
                {"answers_count": len(answers)}
            )
            
            # Continue the run loop
            return await self.run()
            
        except Exception as e:
            await self.transition(
                OrchestrationState.FAILED,
                OrchestrationTrigger.FAILURE,
                {"error": str(e)}
            )
            return {
                "project_id": str(self.project_id),
                "state": OrchestrationState.FAILED,
                "error": str(e),
            }
    
    async def get_status(self) -> Dict[str, Any]:
        """Get current orchestration status."""
        await self.load_project()
        
        # Get recent logs
        from sqlalchemy import desc
        logs_result = await self.session.execute(
            select(OrchestrationLog)
            .where(OrchestrationLog.project_id == self.project_id)
            .order_by(desc(OrchestrationLog.created_at))
            .limit(5)
        )
        recent_logs = logs_result.scalars().all()
        
        status_payload = {
            "project_id": str(self.project_id),
            "state": self.project.orchestration_state,
            "status": self.project.status,
            "current_phase": self.project.current_phase,
            "retry_count": self.project.retry_count,
            "has_warnings": self.project.has_warnings,
            "warning_details": self.project.warning_details,
            "started_at": self.project.started_at.isoformat() if self.project.started_at else None,
            "completed_at": self.project.completed_at.isoformat() if self.project.completed_at else None,
            "recent_transitions": [
                {
                    "from": log.from_state,
                    "to": log.to_state,
                    "trigger": log.trigger,
                    "at": log.created_at.isoformat(),
                }
                for log in recent_logs
            ],
        }

        if self.project.is_batch and self.project.total_scenes > 1:
            scenes_result = await self.session.execute(
                select(Scene)
                .where(Scene.project_id == self.project_id)
                .order_by(Scene.scene_index)
            )
            scenes = scenes_result.scalars().all()
            status_payload.update({
                "is_batch": True,
                "total_scenes": len(scenes),
                "completed_scenes": sum(1 for s in scenes if s.status == SceneStatus.COMPLETED),
                "scene_progress": [
                    {
                        "scene_id": str(s.id),
                        "scene_index": s.scene_index,
                        "status": s.status,
                        "current_phase": s.current_phase,
                        "orchestration_state": s.orchestration_state,
                        "has_warnings": s.has_warnings,
                    }
                    for s in scenes
                ],
            })

        return status_payload
    
    async def get_log(self) -> List[Dict[str, Any]]:
        """Get complete orchestration log."""
        result = await self.session.execute(
            select(OrchestrationLog)
            .where(OrchestrationLog.project_id == self.project_id)
            .order_by(OrchestrationLog.created_at)
        )
        logs = result.scalars().all()
        
        return [
            {
                "id": str(log.id),
                "from_state": log.from_state,
                "to_state": log.to_state,
                "trigger": log.trigger,
                "details": log.details,
                "duration_ms": log.duration_ms,
                "created_at": log.created_at.isoformat(),
            }
            for log in logs
        ]


# ============================================
# Helper function for creating orchestrator
# ============================================
async def create_orchestrator(
    session: AsyncSession,
    project_id: UUID,
    config: Optional[OrchestrationConfig] = None
) -> Orchestrator:
    """Create and return an Orchestrator instance."""
    return Orchestrator(session, project_id, config)
