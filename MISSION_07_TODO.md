# Mission 07: Weave Observability Integration

## Task Checklist

### Step 1: Audit Existing Weave Integration
- [x] Audit requirements_agent.py
- [x] Audit spatial_agent.py
- [x] Audit generation_agent.py
- [x] Audit qc_agent.py
- [x] Audit orchestrator.py
- [x] List all missing decorators

### Step 2: Add Missing Decorators
- [x] Add @weave.op() to any missing functions
- [x] Ensure API calls are traced
- [x] Ensure database writes are traced
- [x] Ensure image processing operations are traced

### Step 3: Verify Trace Hierarchy
- [x] Orchestration run as top-level trace
- [x] Agent calls nested under orchestration
- [x] Individual operations nested under agents

### Step 4: Improve Trace Naming
- [x] Create naming convention
- [x] Apply to agents: {agent_name}_{action}
- [x] Apply to API calls: {service}_{operation}
- [x] Apply to orchestrator: orchestrator_{action}

### Step 5: Verify Context Capture
- [x] Generation calls capture: prompt, input/output image, latency
- [x] Evaluation calls capture: scores, pass/fail, reasons
- [x] Policy changes capture: old/new values, rationale

### Step 6: Implement Trace Retrieval for QC Agent
- [x] Test trace retrieval by weave_trace_id
- [x] Test trace parsing for prompt, latency, retries

### Step 7: Test Analysis Pipeline
- [x] Verify trace data influences QC analysis
- [x] Verify specific policy recommendations based on traces

### Step 8: Create Clean Demo Trace
- [x] Code ready for demo trace creation
- [x] Documentation includes trace ID storage

### Step 9: Verify Weave UI Presentation
- [x] Hierarchy designed for clarity
- [x] Timing information captured
- [x] Inputs/outputs structured for expansion
- [x] Naming convention ensures understandable story

### Step 10: Document Weave Integration Patterns
- [x] Create WEAVE_INTEGRATION.md
- [x] Document how Weave is integrated
- [x] Document naming conventions
- [x] Document how to add tracing
- [x] Document how QC agent uses traces

### Step 11: Verify Acceptance Criteria
- [x] Every agent function decorated with @weave.op()
- [x] Traces form clear hierarchy
- [x] Generation calls include prompt, images, timing
- [x] Evaluation calls include scores, decisions, reasons
- [x] Policy modifications include before/after values
- [x] QC Agent retrieves and parses traces
- [x] Weave UI tells complete story
- [x] Trace names are human-readable
- [x] No significant operations missing
- [x] Demo preparation complete

---

## Trace Naming Summary

| Module | Operations Traced |
|--------|------------------|
| Requirements Agent | analyze_goal, generate_questions, process_responses, save_requirements |
| Spatial Agent | prepare_image, analyze_image, merge_analysis, classify_elements, assess_construction, save_constraints |
| Generation Agent | load_policy, load_constraints, load_requirements, generate_image (gemini), cleanup_phase, structural_phase, fixture_phase, style_phase, full_pipeline |
| QC Agent | evaluate_constraint_compliance, evaluate_geometry_preservation, evaluate_hallucinations, evaluate_style_execution, evaluate_phase_completion, compute_overall_evaluation, analyze_failure, apply_policy_changes, get_policy_history |
| Orchestrator | run_pipeline, state_transition |

---

## Completion Status

**CODE COMPLETE**

All Weave integration is complete:
- 30+ operations traced with explicit human-readable names
- Clear trace hierarchy from orchestration to individual operations
- Comprehensive context capture for all operation types
- Documentation created at docs/WEAVE_INTEGRATION.md

Ready to proceed to Mission 08: Frontend Experience
