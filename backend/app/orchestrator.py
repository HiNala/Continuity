"""
Continuity - Orchestrator Module
Mission 06: Coordinates all agents into a converging, non-infinite improvement loop.

The Orchestrator manages the complete pipeline:
Project Creation → Requirements → Spatial Analysis → Generation Loop → Completion

It handles retries, policy updates, and ensures deterministic termination.
"""

import asyncio
import time
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List, Tuple
from uuid import UUID

import weave
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.config import settings
from app.models import (
    Project, Requirements, OrchestrationLog, Iteration,
    OrchestrationState, OrchestrationTrigger, GenerationPhase,
    ProjectStatus, EvaluationStatus
)
from app.agents.requirements_agent import requirements_agent
from app.agents.spatial_agent import spatial_agent
from app.agents.generation_agent import generation_agent
from app.agents.qc_agent import qc_agent


# ============================================
# Orchestration Configuration
# ============================================
class OrchestrationConfig:
    """Configurable parameters for orchestration."""
    MAX_RETRIES_PER_PHASE: int = 3
    EVALUATION_THRESHOLD: float = 0.7
    TIMEOUT_SECONDS: int = 300
    AUTO_ADVANCE_ON_MAX_RETRY: bool = True


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
            # Analyze the goal
            if self.project.goal:
                analysis = await requirements_agent.analyze_goal(self.project.goal)
                
                if analysis.get("questions_needed") and analysis.get("questions"):
                    # Need clarification
                    await self.transition(
                        OrchestrationState.AWAITING_CLARIFICATION,
                        OrchestrationTrigger.SUCCESS,
                        {
                            "questions_count": len(analysis.get("questions", [])),
                            "identified": analysis.get("identified", {}),
                        }
                    )
                else:
                    # No questions needed - save requirements and proceed
                    await self._save_default_requirements(analysis.get("identified", {}))
                    await self.transition(
                        OrchestrationState.ANALYZING_SPACE,
                        OrchestrationTrigger.SUCCESS,
                        {"message": "Requirements complete, no clarification needed"}
                    )
            else:
                # No goal - fail
                await self.transition(
                    OrchestrationState.FAILED,
                    OrchestrationTrigger.FAILURE,
                    {"error": "No goal provided"}
                )
                
        except Exception as e:
            await self.transition(
                OrchestrationState.FAILED,
                OrchestrationTrigger.FAILURE,
                {"error": str(e)}
            )
    
    async def _save_default_requirements(self, identified: Dict[str, Any]) -> None:
        """Save requirements when no clarification needed."""
        from app.models import Requirements
        
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
        
        if not phase:
            await self.transition(
                OrchestrationState.FAILED,
                OrchestrationTrigger.FAILURE,
                {"error": f"Cannot determine phase from state: {state}"}
            )
            return
        
        self.project.current_phase = phase
        
        try:
            # Determine input image
            input_image = await self._get_input_for_phase(phase)
            
            # Load requirements for fixture/style phases
            requirements = await generation_agent.load_requirements(self.session, self.project_id)
            constraints, _ = await generation_agent.load_constraints(self.session, self.project_id)
            policy = await generation_agent.load_policy(self.session, self.project_id)
            
            # Execute phase
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
            
            # Store output for next phase
            if result.get("output_path"):
                self._current_input_image = result["output_path"]
            
            # Move to evaluation
            eval_state = f"evaluating_{phase}"
            await self.transition(
                eval_state,
                OrchestrationTrigger.SUCCESS,
                {"iteration_id": result.get("iteration_id")}
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
            eval_result = await qc_agent.compute_overall_evaluation(
                self.session, iteration.id
            )
            
            if eval_result.get("passed"):
                # Passed - move to next phase or complete
                await self._advance_to_next_phase(phase)
            else:
                # Failed - retry or move on
                await self._handle_evaluation_failure(phase, {
                    "score": eval_result.get("overall_score"),
                    "iteration_id": str(iteration.id),
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
            
            if iteration:
                # Analyze and apply policy changes
                analysis = await qc_agent.analyze_failure(self.session, iteration.id)
                recommended_changes = analysis.get("recommended_changes", [])
                
                if recommended_changes:
                    await qc_agent.apply_policy_changes(
                        self.session, self.project_id, recommended_changes, iteration.id
                    )
            
            # Increment retry count and go back to generation
            self.project.retry_count += 1
            gen_state = f"generating_{phase}"
            
            await self.transition(
                gen_state,
                OrchestrationTrigger.USER_ACTION,
                {"retry_number": self.project.retry_count}
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
    
    async def _advance_to_next_phase(self, current_phase: str, max_retries: bool = False) -> None:
        """Advance to the next phase or complete."""
        next_phase = NEXT_PHASE.get(current_phase)
        
        # Reset retry count for new phase
        self.project.retry_count = 0
        
        if next_phase:
            # Move to next phase
            gen_state = f"generating_{next_phase}"
            trigger = OrchestrationTrigger.MAX_RETRIES if max_retries else OrchestrationTrigger.SUCCESS
            await self.transition(
                gen_state,
                trigger,
                {"from_phase": current_phase, "to_phase": next_phase}
            )
        else:
            # All phases complete
            if self.project.has_warnings:
                await self.transition(
                    OrchestrationState.COMPLETED_WITH_WARNINGS,
                    OrchestrationTrigger.SUCCESS,
                    {"message": "All phases complete with some warnings"}
                )
            else:
                await self.transition(
                    OrchestrationState.COMPLETED,
                    OrchestrationTrigger.SUCCESS,
                    {"message": "All phases complete successfully"}
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
            result = await requirements_agent.process_responses(
                self.session, self.project_id, answers
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
        
        return {
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
