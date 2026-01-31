# Mission 05: Quality Control & Optimizer Agent

## Project Context

You are building Continuity, a self-improving agent system for architectural and interior design visualization. The system transforms raw photographs into realistic renovation visualizations through a multi-agent pipeline with Weave observability enabling genuine self-improvement.

Mission 01 established the foundation. Mission 02 built Requirements gathering. Mission 03 built Spatial Analysis. Mission 04 built the Generation Agent. This mission builds the brain of the self-improvement loop.

---

## Mission Objective

Build the Quality Control and Optimizer Agent that evaluates generation outputs, decides whether to accept or reject them, and modifies the Generation Agent's policy when rejection occurs. This agent is what makes Continuity genuinely self-improving rather than just iterative.

The key insight is that self-improvement requires concrete feedback based on real data, not vague reflection. This agent inspects Weave traces to understand exactly what happened during generation, evaluates outputs against objective criteria, and proposes specific policy modifications when outputs fail to meet standards.

---

## Why This Agent Matters

This is the star of the hackathon demo. Judges have seen many "iterative" systems that claim to improve but actually just retry randomly. What makes Continuity different is that improvement is evidence-based: the Quality Control Agent reads Weave traces, identifies specific problems, and makes concrete changes.

Without this agent, the Generation Agent would just produce whatever it produces with no feedback loop. With this agent, poor outputs trigger analysis and policy updates that make subsequent attempts meaningfully different.

The dependency on Weave is not decorative—the Quality Control Agent literally cannot function without trace data. It needs to know what prompts were used, how long operations took, where retries happened, and what the model was asked to do. This makes the project a perfect fit for the WeaveHacks theme.

---

## Requirements

The agent must evaluate generation outputs on multiple criteria:

**Constraint Compliance**: Did fixtures move from their locked positions? Is the toilet still near the floor drain? Is the sink still on the plumbed wall?

**Geometry Preservation**: Did the room dimensions stay consistent? Did walls move or disappear? Did windows or doors change position inappropriately?

**Hallucination Detection**: Did new elements appear that were not in the input or requested? Extra windows, doors, rooms, or impossible spaces?

**Style Execution**: For style phase outputs, does the result actually reflect the requested style? Is it coherent and professional looking?

**Phase Completion**: Did the phase accomplish its specific goal? Cleanup should remove debris. Structural should complete unfinished elements. Style should apply styling.

When evaluation fails, the agent must analyze Weave traces to understand why. It then proposes specific, actionable policy modifications—not vague suggestions like "try harder" but concrete changes like "reduce creativity from 0.8 to 0.5" or "add explicit constraint reminder to prompt template."

All evaluation operations must be traced in Weave.

---

## Acceptance Criteria

This mission is complete when all of the following are true:

1. The backend has a Quality Control Agent module that can evaluate generation outputs

2. The agent evaluates outputs against spatial constraints and detects violations

3. The agent detects geometry changes that should not have occurred

4. The agent detects hallucinated elements that were not requested

5. For failed evaluations, the agent retrieves and analyzes the relevant Weave traces

6. Trace analysis produces insights about what went wrong (prompt issues, constraint clarity, etc.)

7. The agent proposes specific policy modifications with clear rationale

8. Policy modifications are actionable (specific parameter changes, prompt adjustments)

9. New policy versions are created and saved with reference to the parent policy

10. Good iterations are marked as accepted; bad iterations are marked as rejected with reasons

11. Improvement is demonstrable: rerunning with the modified policy produces different results

12. All evaluation operations are traced in Weave

---

## Database Schema

Update the iterations table to include evaluation fields:

- evaluation_status: enum of pending, passed, failed
- evaluation_score: numeric score from 0.0 to 1.0
- evaluation_reasons: JSON array of specific pass/fail reasons
- evaluated_at: timestamp when evaluation completed
- evaluator_weave_trace_id: reference to the Weave trace for the evaluation

Create an evaluation_details table for granular feedback:

- id: unique identifier
- iteration_id: foreign key to iterations
- criterion: which criterion this evaluates (constraint_compliance, geometry_preservation, etc.)
- passed: boolean
- score: numeric score for this criterion
- details: text explanation of the evaluation
- evidence: JSON with specific findings

Create a policy_changes table to track modifications:

- id: unique identifier
- project_id: foreign key
- old_policy_id: the policy being modified
- new_policy_id: the new policy version created
- trigger_iteration_id: which iteration failure triggered this change
- changes_made: JSON describing what changed
- rationale: text explanation of why these changes were made
- created_at: timestamp

---

## Step-by-Step Instructions

Before you begin any work, create a todo list file called MISSION_05_TODO.md. This todo list should contain every task below as a checkbox item. As you complete each task, mark it complete. Do not consider this mission finished until every checkbox is marked and all acceptance criteria are verified.

**Step 1: Create the database tables**

Create or update the tables as specified in the database schema section. Ensure the iterations table has the new evaluation fields. Create the evaluation_details and policy_changes tables.

**Step 2: Design the evaluation criteria**

Define each evaluation criterion in detail:

**Constraint Compliance (weight: 35%)**
- Compare locked constraint locations from Spatial Analysis with fixture positions in output
- Use vision analysis to verify fixtures have not moved significantly
- Pass if all locked constraints are satisfied; fail if any are violated

**Geometry Preservation (weight: 25%)**
- Compare room boundaries between input and output
- Check that walls, doors, and windows are in consistent positions
- Pass if geometry is stable; fail if room appears to have changed shape or size

**Hallucination Detection (weight: 20%)**
- Identify elements in output that were not in input or requirements
- Extra windows, doors, rooms, or impossible spaces are hallucinations
- Pass if no unexplained elements; fail if hallucinations detected

**Style Execution (weight: 10%)**
- For style phase only, assess whether the output matches the requested style
- This is more subjective but should catch obvious mismatches
- Pass if style is recognizable; fail if completely wrong style applied

**Phase Completion (weight: 10%)**
- Assess whether the phase accomplished its specific goal
- Cleanup: is debris removed? Structural: are surfaces finished? Fixture: are fixtures present?
- Pass if phase goal met; fail if phase had no meaningful effect

**Step 3: Create the evaluation functions**

In the backend, create a new module for the Quality Control Agent. This module should have:

A function to evaluate constraint compliance that takes the output image, the constraint map, and uses vision analysis to check if locked constraints are satisfied. Return a score and specific findings.

A function to evaluate geometry preservation that compares the input image boundaries with the output image boundaries. Return a score and any detected changes.

A function to evaluate hallucinations that examines the output for unexpected elements not present in input or requirements. Return a score and list of detected hallucinations.

A function to evaluate style execution that assesses whether the style phase output matches the requested style. Return a score and assessment.

A function to evaluate phase completion that checks if the phase accomplished its goal. Return a score and assessment.

A function to compute overall evaluation that combines all criterion scores using the weights, determines pass/fail based on a threshold, and returns the complete evaluation result.

**Step 4: Implement Weave trace retrieval**

Create functions to retrieve and parse Weave traces:

A function to get iteration trace that takes an iteration ID, looks up the weave_trace_id, and retrieves the full trace from Weave.

A function to extract trace insights that parses a trace and extracts relevant information: the prompt used, generation parameters, latency, any retry patterns, any errors encountered.

A function to compare traces that takes two traces (from a failed attempt and a successful attempt, if available) and identifies differences that might explain the different outcomes.

**Step 5: Implement trace analysis logic**

When an evaluation fails, the agent must analyze traces to understand why. Create functions that:

Analyze prompt effectiveness by examining the prompt in relation to the failure. If constraints were violated, check whether the prompt clearly stated those constraints. If geometry changed, check whether geometry preservation was emphasized.

Identify latency anomalies by checking if generation took unusually long, which might indicate model confusion or difficult prompts.

Detect retry patterns by checking if the generation required retries and what changed between attempts.

Correlate failures with prompt patterns by identifying specific prompt structures or phrases that correlate with failures across multiple evaluations.

**Step 6: Implement policy modification logic**

When analysis identifies problems, the agent must propose specific policy changes. Create functions that:

Generate constraint emphasis change if constraints were violated and the prompt did not strongly emphasize them, propose increasing constraint_emphasis from current level to higher level.

Generate creativity adjustment if hallucinations were detected, propose reducing creativity_level. If outputs are too bland, propose increasing it.

Generate prompt template change if specific prompt structures correlated with failures, propose modifications to the prompt template for that phase.

Generate phase split recommendation if a single phase is consistently failing because it tries to do too much, propose splitting it into sub-phases (this is an advanced modification).

Compile all changes into a policy delta with clear rationale for each change.

**Step 7: Implement policy versioning**

Create functions to manage policy versions:

A function to create new policy version that takes the current policy, applies the proposed changes, saves the new version with proper versioning, and records the change in the policy_changes table.

A function to get policy lineage that traces the history of policy changes for a project, showing how the policy evolved through iterations.

A function to rollback policy that reverts to a previous policy version if recent changes made things worse.

**Step 8: Wrap all functions with Weave operations**

Every function in the Quality Control Agent module should be decorated with the Weave operation decorator. This allows meta-analysis of the quality control process itself—if the QC agent is making bad decisions, we can inspect its traces to understand why.

**Step 9: Create the backend API endpoints**

Create the following endpoints:

POST /api/projects/{project_id}/iterations/{iteration_id}/evaluate to trigger evaluation of a specific iteration. Returns the evaluation result.

GET /api/projects/{project_id}/iterations/{iteration_id}/evaluation to retrieve the stored evaluation for an iteration.

POST /api/projects/{project_id}/analyze-failure to trigger trace analysis for a failed iteration and generate policy modification recommendations.

POST /api/projects/{project_id}/apply-policy-change to apply a recommended policy change, creating a new policy version.

GET /api/projects/{project_id}/policy-history to retrieve the history of policy changes.

**Step 10: Build the frontend evaluation display**

In the frontend, create components that show:

Evaluation results for each iteration with scores and pass/fail status
Specific feedback for failed evaluations explaining what went wrong
Policy change recommendations when available
Policy version history showing how the policy has evolved

This transparency is critical for the demo—judges need to see that the system is making intelligent decisions based on real data.

**Step 11: Integrate with the generation loop**

This is critical: the Quality Control Agent must be wired into the generation pipeline so that evaluation happens automatically after each generation and policy updates affect subsequent generations.

Update the orchestration (which will be formalized in Mission 06) so that:
1. Generation produces an output
2. QC evaluates the output
3. If passed, continue to next phase
4. If failed, analyze traces, modify policy, retry generation with new policy
5. Repeat until passed or max retries reached

**Step 12: Test the improvement loop**

Test that the self-improvement loop actually works:

1. Create a scenario where initial generation will likely fail (use an input that will probably cause constraint violations with default policy)
2. Run generation and observe the failure
3. Run QC evaluation and observe it detecting the problem
4. Run trace analysis and observe it identifying the cause
5. Apply the recommended policy change
6. Rerun generation and verify the output is different
7. The improvement does not need to be perfect, but it must be meaningfully different

**Step 13: Verify all acceptance criteria**

Go through each acceptance criterion and verify it is met. Do not mark this mission complete until all criteria are satisfied.

---

## Vision Analysis for Evaluation

Several evaluation criteria require vision analysis of the output image. Use Gemini vision for this:

For constraint compliance, send the output image with a prompt asking whether specific fixtures are in specific locations. For example: "Is there a toilet positioned in the lower left quadrant of this image, near where a floor drain would be located? Answer yes or no and explain your reasoning."

For geometry preservation, send both the input and output images asking the model to compare room boundaries and identify any significant changes.

For hallucination detection, send the output with a prompt asking it to list all major elements and flag any that seem unexpected or impossible given the space type.

---

## Policy Modification Examples

To make this concrete, here are example policy modifications the agent might propose:

**Example 1: Constraint violation detected**
- Problem: Toilet moved away from floor drain
- Trace analysis: Prompt mentioned constraint but not emphatically
- Proposed change: Increase constraint_emphasis from "medium" to "high", add to prompt template: "CRITICAL: The toilet MUST remain positioned directly above the floor drain. This is a physical constraint that cannot be violated."

**Example 2: Hallucination detected**
- Problem: Extra window appeared in output
- Trace analysis: Creativity level was 0.8, relatively high
- Proposed change: Reduce creativity_level from 0.8 to 0.5, add to prompt template: "Do not add any windows, doors, or openings that are not visible in the input image."

**Example 3: Style not applied**
- Problem: Requested Japandi style but output looks generic
- Trace analysis: Style guidance was brief, one sentence
- Proposed change: Expand style_guidance to include specific Japandi characteristics: "Apply Japandi style: natural wood tones (oak, walnut), clean lines, minimal ornamentation, washi paper textures, neutral palette with muted greens, low-profile furniture."

---

## Output Artifacts

By the end of this mission, the following should exist:

- Backend module for Quality Control Agent with all evaluation and analysis functions
- Database tables for evaluation details and policy changes
- API endpoints for evaluation, analysis, and policy management
- Frontend components showing evaluation results and policy history
- Weave traces for all QC operations
- Working improvement loop where policy changes affect subsequent generations
- MISSION_05_TODO.md with all tasks checked off

---

## Important Reminders

This agent does not generate images. It only evaluates outputs and modifies policies. The Generation Agent does the actual generation.

Modifications must be specific and actionable. "Be better at constraints" is not a valid policy change. "Increase constraint_emphasis to high and add explicit constraint statement to prompt template" is a valid policy change.

The loop must close. Policy modifications must actually be used by the Generation Agent on subsequent runs. Verify this works end-to-end, not just that policy changes are saved.

---

## Do Not Stop Until

You have created the todo list, completed every item on it, and verified all acceptance criteria are met. The system must be able to evaluate generation outputs, detect failures, analyze traces to understand why, propose specific policy modifications, and demonstrably improve on subsequent attempts.
