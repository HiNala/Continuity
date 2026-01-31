# Weave Integration Guide

## Overview

Continuity uses [Weave](https://wandb.ai/site/weave) from Weights & Biases as its observability layer. Weave provides complete traceability of all AI operations, enabling the Quality Control Agent to analyze execution patterns and make evidence-based improvements.

## How Weave is Integrated

### Initialization

Weave is initialized at application startup in `backend/app/main.py`:

```python
import weave

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize Weave for observability
    if settings.wandb_api_key:
        weave.init(settings.weave_project_name)
```

### Operation Tracing

All significant operations are decorated with `@weave.op()`:

```python
@weave.op(name="agent_name_operation_name")
async def some_operation(self, param1, param2):
    # Operation code here
    return result
```

## Naming Conventions

All traced operations follow a consistent naming convention:

### Agents
Format: `{agent_name}_{action}`

Examples:
- `requirements_agent_analyze_goal`
- `requirements_agent_generate_questions`
- `spatial_agent_analyze_image`
- `generation_agent_cleanup_phase`
- `qc_evaluate_constraint_compliance`

### API Calls
Format: `{service}_{operation}`

Examples:
- `gemini_generate_image`
- `gemini_vision_analysis`

### Orchestration
Format: `orchestrator_{action}`

Examples:
- `orchestrator_run_pipeline`
- `orchestrator_state_transition`

## Trace Hierarchy

Traces automatically form a hierarchy based on call structure:

```
orchestrator_run_pipeline
├── orchestrator_state_transition (CREATED → GATHERING_REQUIREMENTS)
├── requirements_agent_analyze_goal
├── requirements_agent_generate_questions
├── orchestrator_state_transition (GATHERING_REQUIREMENTS → ANALYZING_SPACE)
├── spatial_agent_analyze_image
│   └── gemini_vision_analysis
├── spatial_agent_save_constraints
├── orchestrator_state_transition (ANALYZING_SPACE → GENERATING_CLEANUP)
├── generation_agent_cleanup_phase
│   ├── generation_agent_load_policy
│   ├── generation_agent_load_constraints
│   └── gemini_generate_image
├── qc_compute_overall_evaluation
│   ├── qc_evaluate_constraint_compliance
│   ├── qc_evaluate_geometry_preservation
│   ├── qc_evaluate_hallucinations
│   ├── qc_evaluate_style_execution
│   └── qc_evaluate_phase_completion
└── ... (continues for each phase)
```

## Context Captured

### Generation Operations

The `gemini_generate_image` trace captures:
- **Input**: prompt, input_image_path, phase, policy config
- **Output**: output_image_path, generation_time_ms, success/failure
- **Errors**: Any exceptions with full stack traces

### Evaluation Operations

The `qc_compute_overall_evaluation` trace captures:
- **Input**: iteration_id, target_style
- **Output**: overall_score, passed (boolean), status, individual criterion scores
- **Details**: Reasons for pass/fail on each criterion

### Policy Changes

The `qc_apply_policy_changes` trace captures:
- **Input**: project_id, proposed changes, trigger iteration
- **Output**: old_version, new_version, changes_applied
- **Rationale**: Why each change was recommended

## How to Add Tracing to New Functions

1. Import weave at the top of the module:
   ```python
   import weave
   ```

2. Add the decorator with a descriptive name:
   ```python
   @weave.op(name="module_function_description")
   async def your_function(self, param1: Type1) -> ReturnType:
       # Function implementation
       return result
   ```

3. Ensure return values include meaningful data:
   ```python
   return {
       "success": True,
       "result": computed_value,
       "details": additional_context,
   }
   ```

## How the QC Agent Uses Traces

### Trace Retrieval

The Quality Control Agent can retrieve traces by weave_trace_id stored on iterations:

```python
# The iteration stores the trace ID
iteration.weave_trace_id = current_trace_id

# Later, traces can be queried via Weave API
```

### Trace Analysis

When analyzing a failed generation, the QC Agent:

1. Retrieves the generation trace
2. Extracts the prompt used
3. Checks if constraints were properly emphasized
4. Looks at generation timing (long times may indicate struggles)
5. Proposes specific policy changes based on findings

Example analysis flow:
```
Failure: Constraint violated (toilet moved from floor drain)
→ Trace shows: constraint_emphasis was 0.7
→ Insight: "Constraint not strongly emphasized in prompt"
→ Recommendation: Increase constraint_emphasis to 0.9
```

## Viewing Traces in Weave UI

1. Go to [wandb.ai](https://wandb.ai)
2. Select your project (default: "continuity")
3. Navigate to the Weave section
4. Find traces by:
   - Time range
   - Operation name
   - Filtering by inputs/outputs

### What to Look For

- **Hierarchy**: Should show clear parent-child relationships
- **Timing**: Each operation shows duration
- **Inputs/Outputs**: Expandable to see full data
- **Errors**: Red highlighting for failed operations

## Best Practices

1. **Use Descriptive Names**: Names should be understandable without context
   - Good: `generation_agent_cleanup_phase`
   - Bad: `run_phase`

2. **Return Meaningful Data**: Include context in return values
   ```python
   return {
       "success": True,
       "iteration_id": str(iteration.id),
       "score": 0.85,
       "phase": "cleanup",
   }
   ```

3. **Store References, Not Data**: For large data like images
   ```python
   # Good
   return {"image_path": "/outputs/generated.png"}
   
   # Bad
   return {"image_data": base64_encoded_image}
   ```

4. **Handle Errors Gracefully**: Weave captures exceptions automatically
   ```python
   try:
       result = await api_call()
   except Exception as e:
       # Exception will appear in trace
       raise
   ```

## Environment Setup

Required environment variables:

```bash
WANDB_API_KEY=your_api_key_here
WEAVE_PROJECT_NAME=continuity
```

Get your API key from: https://wandb.ai/authorize

## Troubleshooting

### Traces Not Appearing

1. Verify `WANDB_API_KEY` is set
2. Check that `weave.init()` was called
3. Confirm the operation has `@weave.op()` decorator

### Flat Hierarchy

If traces appear flat instead of nested:
- Ensure parent functions call child functions directly
- Avoid running child operations in separate async tasks
- Both parent and child must have `@weave.op()` decorators

### Missing Context

If traces lack important data:
- Ensure function parameters include needed values
- Return comprehensive result dictionaries
- Add explicit logging for important state changes
