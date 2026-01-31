# Mission 05: Quality Control & Optimizer Agent

## Task Checklist

### Step 1: Create Database Tables
- [ ] Add evaluation fields to iterations table
- [ ] Create evaluation_details table
- [ ] Create policy_changes table
- [ ] Write migration code

### Step 2: Design Evaluation Criteria
- [ ] Define Constraint Compliance (35%)
- [ ] Define Geometry Preservation (25%)
- [ ] Define Hallucination Detection (20%)
- [ ] Define Style Execution (10%)
- [ ] Define Phase Completion (10%)
- [ ] Document weights and thresholds

### Step 3: Create Evaluation Functions
- [ ] evaluate_constraint_compliance()
- [ ] evaluate_geometry_preservation()
- [ ] evaluate_hallucinations()
- [ ] evaluate_style_execution()
- [ ] evaluate_phase_completion()
- [ ] compute_overall_evaluation()

### Step 4: Implement Weave Trace Retrieval
- [ ] get_iteration_trace()
- [ ] extract_trace_insights()
- [ ] compare_traces()

### Step 5: Implement Trace Analysis Logic
- [ ] analyze_prompt_effectiveness()
- [ ] identify_latency_anomalies()
- [ ] detect_retry_patterns()
- [ ] correlate_failures_with_patterns()

### Step 6: Implement Policy Modification Logic
- [ ] generate_constraint_emphasis_change()
- [ ] generate_creativity_adjustment()
- [ ] generate_prompt_template_change()
- [ ] compile_policy_delta()

### Step 7: Implement Policy Versioning
- [ ] create_new_policy_version()
- [ ] get_policy_lineage()
- [ ] rollback_policy()

### Step 8: Wrap with Weave Operations
- [ ] Add @weave.op() to all evaluation functions
- [ ] Add @weave.op() to analysis functions
- [ ] Add @weave.op() to policy functions

### Step 9: Create Backend API Endpoints
- [ ] POST /{project_id}/iterations/{iteration_id}/evaluate
- [ ] GET /{project_id}/iterations/{iteration_id}/evaluation
- [ ] POST /{project_id}/analyze-failure
- [ ] POST /{project_id}/apply-policy-change
- [ ] GET /{project_id}/policy-history

### Step 10: Build Frontend Evaluation Display
- [ ] Evaluation results component
- [ ] Failed evaluation feedback
- [ ] Policy change recommendations
- [ ] Policy version history

### Step 11: Integrate with Generation Loop
- [ ] Auto-evaluate after generation
- [ ] Trigger policy update on failure
- [ ] Retry with updated policy

### Step 12: Test Improvement Loop
- [ ] Test failure detection
- [ ] Test trace analysis
- [ ] Test policy modification
- [ ] Verify changed results

### Step 13: Verify Acceptance Criteria
- [ ] QC Agent module exists
- [ ] Spatial constraint evaluation
- [ ] Geometry change detection
- [ ] Hallucination detection
- [ ] Weave trace analysis
- [ ] Specific policy modifications
- [ ] Policy versioning with lineage
- [ ] Iterations marked accepted/rejected
- [ ] Demonstrable improvement
- [ ] All operations traced in Weave

---

## Notes

- This is the core self-improvement mechanism
- Must produce SPECIFIC, ACTIONABLE policy changes (not vague suggestions)
- Weave traces are essential - QC cannot function without them
- The loop must close: policy changes must affect subsequent generations

---

## Completion Status

**CODE COMPLETE**

All code implementation is complete:
- EvaluationDetail and PolicyChange database models
- Quality Control Agent with 5 evaluation criteria
- Constraint compliance (35%), geometry preservation (25%), hallucination detection (20%), style execution (10%), phase completion (10%)
- Weave trace analysis for failure diagnosis
- Automatic policy modification with specific changes
- Policy versioning with lineage tracking
- Full API endpoints for evaluate, analyze, apply-changes, policy-history
- Frontend QC display with evaluation results and self-improvement feedback
- No TypeScript errors, build passes cleanly
- All unused code removed

Ready to proceed to Mission 06: Orchestration Loop
