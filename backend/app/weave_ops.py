"""
Continuity - Weave Operations Module
Weave-traced operations for observability.

Weave is the core of Continuity's self-improvement capability.
Every significant operation is traced, allowing the Quality Control
agent to analyze what happened and modify the process accordingly.

All major agent operations are traced in their respective modules:
- app/agents/requirements_agent.py - Requirements gathering and clarification
- app/agents/spatial_agent.py - Spatial analysis and constraint extraction
- app/agents/generation_agent.py - Phased image generation
- app/agents/qc_agent.py - Quality control and policy optimization
- app/orchestrator.py - Pipeline orchestration and state management

Media Logging:
Weave supports logging images and media for visualization in the UI.
Use the log_image_media function to log generated images so they
appear in trace results for review.
"""

import base64
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Dict, Any, Annotated

import weave
from weave import Content


# ============================================
# Media Logging for Weave UI Visualization
# ============================================
@weave.op(name="weave_log_image")
def log_image_media(
    image_path: Annotated[str, Content],
    description: str = "Generated image",
    metadata: Optional[Dict[str, Any]] = None
) -> Annotated[bytes, Content]:
    """
    Log an image to Weave for visualization in the trace UI.
    """
    _ = description
    _ = metadata
    if image_path.startswith("data:"):
        _, encoded = image_path.split(",", 1)
        if not encoded:
            raise ValueError("Empty data URL")
        return base64.b64decode(encoded)
    if Path(image_path).exists():
        with open(image_path, "rb") as f:
            return f.read()
    raise FileNotFoundError(f"Image not found: {image_path}")


# ============================================
# Test Operations
# ============================================
@weave.op()
def test_weave_operation(input_text: str) -> str:
    """
    Simple test operation to verify Weave integration.
    
    This function is decorated with @weave.op() which means:
    - All inputs are logged
    - All outputs are logged
    - Execution time is tracked
    - The operation appears in the Weave UI
    
    Args:
        input_text: Any text input to process
        
    Returns:
        Processed text with timestamp
    """
    timestamp = datetime.now(timezone.utc).isoformat()
    result = f"[{timestamp}] Processed: {input_text}"
    return result


@weave.op()
def analyze_text(text: str, analysis_type: str = "basic") -> dict:
    """
    Example analysis operation for testing.
    
    This demonstrates how Weave traces can capture structured outputs,
    which is essential for the Quality Control agent to analyze.
    
    Args:
        text: Text to analyze
        analysis_type: Type of analysis to perform
        
    Returns:
        Analysis results as a dictionary
    """
    word_count = len(text.split())
    char_count = len(text)
    
    return {
        "analysis_type": analysis_type,
        "word_count": word_count,
        "char_count": char_count,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "status": "analyzed",
    }


# ============================================
# Self-Improvement Loop Utilities
# ============================================
@weave.op(name="weave_record_improvement")
def record_policy_improvement(
    project_id: str,
    old_policy_version: int,
    new_policy_version: int,
    changes_made: list,
    trigger_reason: str,
    evaluation_score: float
) -> Dict[str, Any]:
    """
    Record a policy improvement event in Weave traces.
    
    This creates a trace record of the self-improvement loop in action,
    which can be viewed in the Weave UI to understand how the system
    learns and adapts over time.
    
    Args:
        project_id: The project being improved
        old_policy_version: Previous policy version
        new_policy_version: New policy version after changes
        changes_made: List of changes applied
        trigger_reason: What triggered the improvement
        evaluation_score: Score that triggered the change
        
    Returns:
        Record of the improvement event
    """
    return {
        "event_type": "self_improvement",
        "project_id": project_id,
        "policy_transition": {
            "from": old_policy_version,
            "to": new_policy_version,
        },
        "changes_count": len(changes_made),
        "changes": changes_made,
        "trigger_reason": trigger_reason,
        "evaluation_score": evaluation_score,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "improvement_cycle": "complete",
    }


@weave.op(name="weave_record_batch_learning")
def record_batch_learning(
    project_id: str,
    total_scenes: int,
    completed_scenes: int,
    improvements_made: int,
    scenes_benefited: list,
    seeded_from_past: bool,
    effective_patterns: list
) -> Dict[str, Any]:
    """
    Record batch processing learning summary in Weave traces.
    
    This creates a trace record of cross-scene learning that occurred
    during batch processing, showing how early scenes' failures led
    to improvements for later scenes.
    
    Args:
        project_id: The batch project ID
        total_scenes: Total number of scenes in batch
        completed_scenes: Number successfully completed
        improvements_made: Number of policy improvements made
        scenes_benefited: List of scene IDs that benefited from improvements
        seeded_from_past: Whether policy was seeded from past projects
        effective_patterns: Patterns applied from cross-project learning
        
    Returns:
        Record of the batch learning event
    """
    return {
        "event_type": "batch_learning",
        "project_id": project_id,
        "batch_stats": {
            "total_scenes": total_scenes,
            "completed_scenes": completed_scenes,
            "success_rate": completed_scenes / total_scenes if total_scenes > 0 else 0,
        },
        "learning_metrics": {
            "improvements_made": improvements_made,
            "scenes_benefited_count": len(scenes_benefited),
            "scenes_benefited": scenes_benefited,
        },
        "cross_project_learning": {
            "seeded_from_past": seeded_from_past,
            "patterns_applied": effective_patterns,
        },
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@weave.op(name="weave_record_cross_project_learning")
def record_cross_project_learning(
    source_project_id: str,
    target_project_id: str,
    patterns_transferred: list,
    space_type: Optional[str] = None
) -> Dict[str, Any]:
    """
    Record cross-project learning event in Weave traces.
    
    This creates a trace record when learnings from one project
    are applied to a new project, showing the system's ability
    to improve across sessions.
    
    Args:
        source_project_id: Project where patterns were learned
        target_project_id: Project receiving the patterns
        patterns_transferred: List of patterns being applied
        space_type: Space type being processed
        
    Returns:
        Record of the cross-project learning event
    """
    return {
        "event_type": "cross_project_learning",
        "source_project": source_project_id,
        "target_project": target_project_id,
        "space_type": space_type,
        "patterns_transferred": patterns_transferred,
        "transfer_count": len(patterns_transferred),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@weave.op(name="weave_record_improvement_verified")
def record_improvement_verified(
    project_id: str,
    policy_id: int,
    improvement_effective: bool,
    retry_attempt: int,
    phase: str
) -> Dict[str, Any]:
    """
    Record when a policy improvement is verified as effective.
    
    This creates a trace record confirming whether a policy change
    actually helped improve generation quality, enabling the system
    to learn which changes are beneficial.
    
    Args:
        project_id: The project ID
        policy_id: The policy that was verified
        improvement_effective: Whether the improvement helped
        retry_attempt: Which retry attempt succeeded/failed
        phase: The generation phase being retried
        
    Returns:
        Record of the verification event
    """
    return {
        "event_type": "improvement_verified",
        "project_id": project_id,
        "policy_id": policy_id,
        "verification_result": "effective" if improvement_effective else "ineffective",
        "retry_attempt": retry_attempt,
        "phase": phase,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
