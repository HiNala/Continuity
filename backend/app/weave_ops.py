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
