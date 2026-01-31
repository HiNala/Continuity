# Mission 06: Orchestration & Control Loop

## Project Context

You are building Continuity, a self-improving agent system for architectural and interior design visualization. The system uses multiple specialized agents (Requirements, Spatial Analysis, Generation, Quality Control) that must work together in a coordinated loop.

Missions 01-05 built the individual components: the foundation, requirements gathering, spatial analysis, image generation, and quality control. This mission wires them all together into a coherent, converging system.

---

## Mission Objective

Build the Orchestration layer that coordinates all agents into a converging, non-infinite improvement loop. Agents without orchestration become chaos. The Orchestrator defines the system's "will"—it decides when to continue, when to retry, when to modify, and when to stop.

The Orchestrator manages the complete pipeline from user input to final output. It sequences agent calls, handles retries with policy updates, ensures the loop terminates deterministically, and tracks the complete state through all iterations.

---

## Why This Layer Matters

Individual agents are useless without coordination. The Generation Agent does not know when to run. The Quality Control Agent does not know when to evaluate. The self-improvement loop does not exist without something to drive it.

The Orchestrator is also critical for preventing infinite loops. If the system keeps failing and retrying forever, it burns API credits and never produces output. The Orchestrator ensures deterministic termination—either success or graceful failure with partial results.

For the hackathon demo, the Orchestrator makes the difference between a smooth, impressive flow and a chaotic mess that requires manual intervention.

---

## Requirements

The Orchestrator must manage the complete project lifecycle:

**Phase 1: Initialization**
- Receive project creation request with images and goal
- Create project record
- Trigger Requirements Agent

**Phase 2: Requirements**
- Run Requirements Agent until structured requirements are gathered
- Handle clarification questions and user responses
- Store finalized requirements

**Phase 3: Analysis**
- Trigger Spatial Analysis Agent
- Wait for constraint extraction to complete
- Store constraints

**Phase 4: Generation Loop (per generation phase)**
- Load current policy
- Trigger Generation Agent for current phase
- Trigger Quality Control evaluation
- If passed: save as accepted, move to next phase
- If failed: analyze traces, modify policy, retry
- If max retries reached: save best attempt, move to next phase with warning
- Repeat for all phases (Cleanup → Structural → Fixture → Style)

**Phase 5: Completion**
- Compile final outputs
- Store completion status
- Return results to user

The Orchestrator must handle failures gracefully at every stage. A failure in one phase should not crash the entire system. Partial results are better than no results.

---

## Acceptance Criteria

This mission is complete when all of the following are true:

1. The backend has an Orchestrator module that coordinates all agents

2. The Orchestrator correctly sequences: Project Creation → Requirements → Spatial Analysis → Generation Loop → Completion

3. The generation loop correctly iterates: Generate → Evaluate → (if fail: Analyze → Modify Policy → Retry)

4. Policy updates from Quality Control are applied to subsequent generation runs

5. The loop terminates deterministically with configurable max retries per phase

6. Phase transitions happen cleanly with proper state handoff (output of phase N is input of phase N+1)

7. Failure handling prevents infinite loops and provides graceful degradation

8. Partial results are saved and returnable even if some phases fail

9. Complete execution state is tracked and queryable

10. The entire flow is traceable through Weave with clear parent-child relationships

11. The frontend can display real-time status updates as the orchestrator progresses

---

## State Machine Design

The Orchestrator should be implemented as a state machine with clear states and transitions:

**States:**
- CREATED: Project exists but processing has not started
- GATHERING_REQUIREMENTS: Requirements Agent is working
- AWAITING_CLARIFICATION: Waiting for user to answer clarifying questions
- ANALYZING_SPACE: Spatial Analysis Agent is working
- GENERATING_CLEANUP: Generation Agent running cleanup phase
- EVALUATING_CLEANUP: Quality Control evaluating cleanup output
- RETRYING_CLEANUP: Cleanup failed, retrying with modified policy
- GENERATING_STRUCTURAL: Generation Agent running structural phase
- EVALUATING_STRUCTURAL: Quality Control evaluating structural output
- RETRYING_STRUCTURAL: Structural failed, retrying
- GENERATING_FIXTURE: Generation Agent running fixture phase
- EVALUATING_FIXTURE: Quality Control evaluating fixture output
- RETRYING_FIXTURE: Fixture failed, retrying
- GENERATING_STYLE: Generation Agent running style phase
- EVALUATING_STYLE: Quality Control evaluating style output
- RETRYING_STYLE: Style failed, retrying
- COMPLETED: All phases done successfully
- COMPLETED_WITH_WARNINGS: Some phases had issues but partial results available
- FAILED: Unrecoverable failure

**Transitions:**
Each state has defined transitions based on events (success, failure, user input, timeout).

---

## Database Schema

Create or update tables for orchestration tracking:

**projects table** (update if needed):
- Add orchestration_state: current state from the state machine
- Add current_phase: which generation phase is active
- Add retry_count: number of retries for current phase
- Add started_at: when processing began
- Add completed_at: when processing finished

**orchestration_log table** (new):
- id: unique identifier
- project_id: foreign key
- from_state: state before transition
- to_state: state after transition
- trigger: what caused the transition (success, failure, timeout, user_action)
- details: JSON with additional context
- created_at: timestamp

This log provides complete visibility into how the project progressed through the pipeline.

---

## Step-by-Step Instructions

Before you begin any work, create a todo list file called MISSION_06_TODO.md. This todo list should contain every task below as a checkbox item. As you complete each task, mark it complete. Do not consider this mission finished until every checkbox is marked and all acceptance criteria are verified.

**Step 1: Create the database updates**

Update the projects table with orchestration fields. Create the orchestration_log table. Write migration or setup code as needed.

**Step 2: Design the configuration constants**

Define configurable parameters for the orchestration:

- MAX_RETRIES_PER_PHASE: default 3, how many times to retry a failing phase
- EVALUATION_THRESHOLD: default 0.7, minimum score to pass evaluation
- TIMEOUT_SECONDS: default 300, maximum time to wait for any single operation
- AUTO_ADVANCE_ON_MAX_RETRY: default true, whether to continue to next phase after max retries

Store these in a configuration module that can be adjusted without code changes.

**Step 3: Create the state machine implementation**

Create an Orchestrator class that implements the state machine:

Initialize with a project_id and load current state from database.

Create a method for each state that defines what happens in that state and what transitions are possible.

Create a transition method that validates the transition, logs it to orchestration_log, updates the project state, and calls the new state's handler.

Create a run method that drives the state machine forward until it reaches a terminal state (COMPLETED, COMPLETED_WITH_WARNINGS, or FAILED).

**Step 4: Implement the requirements phase handling**

Create methods to handle the GATHERING_REQUIREMENTS and AWAITING_CLARIFICATION states:

In GATHERING_REQUIREMENTS, call the Requirements Agent to analyze the goal and generate questions. If questions are generated, transition to AWAITING_CLARIFICATION. If no questions needed, transition directly to ANALYZING_SPACE.

In AWAITING_CLARIFICATION, the orchestrator waits for user input. When answers are received, call the Requirements Agent to finalize the specification and transition to ANALYZING_SPACE.

**Step 5: Implement the analysis phase handling**

Create a method to handle the ANALYZING_SPACE state:

Call the Spatial Analysis Agent to extract constraints.

On success, transition to GENERATING_CLEANUP.

On failure, log the error and either retry or transition to FAILED with explanation.

**Step 6: Implement the generation loop**

For each generation phase (cleanup, structural, fixture, style), implement three states:

GENERATING_X: Call the Generation Agent for phase X. On completion, transition to EVALUATING_X.

EVALUATING_X: Call the Quality Control Agent to evaluate. If passed (score >= threshold), transition to the next phase's GENERATING state (or COMPLETED if this was style). If failed, transition to RETRYING_X.

RETRYING_X: Check retry count. If under max, call QC to analyze and modify policy, increment retry count, transition back to GENERATING_X. If at max, save best attempt, transition to next phase with warning flag set.

**Step 7: Implement the completion handling**

Create methods to handle terminal states:

COMPLETED: All phases passed evaluation. Compile the final timeline (original → cleanup → structural → fixture → style variations). Update project with completion status and timestamp.

COMPLETED_WITH_WARNINGS: Some phases reached max retries. Compile whatever outputs exist. Note which phases had issues. Update project status.

FAILED: Unrecoverable error occurred. Save whatever partial state exists. Update project with failure reason.

**Step 8: Implement input/output chaining**

The output of each phase becomes the input of the next phase. Create helper methods to:

Determine the correct input image for each phase (original for cleanup, cleanup output for structural, etc.)

Handle cases where a previous phase produced multiple outputs (style phase produces multiple variations)

Store references correctly so the chain is traceable

**Step 9: Wrap the orchestrator with Weave operations**

The orchestrator's main run loop should be a Weave operation. Each state transition should be logged within that operation. This creates a hierarchical trace where the top level is the complete orchestration and nested levels show individual agent calls.

This structure makes it easy to see the complete flow in Weave UI and understand how long each phase took.

**Step 10: Create the backend API endpoints**

Create endpoints for orchestration control:

POST /api/projects/{project_id}/start to begin orchestration for a project that is in CREATED state.

POST /api/projects/{project_id}/submit-clarification to submit user answers when in AWAITING_CLARIFICATION state.

GET /api/projects/{project_id}/status to get current orchestration state and progress details.

POST /api/projects/{project_id}/retry to retry a FAILED project from the beginning or from a specific phase.

GET /api/projects/{project_id}/log to retrieve the orchestration log showing all state transitions.

**Step 11: Build the frontend progress interface**

Update the frontend to show orchestration progress:

Display the current state in human-readable form ("Analyzing your space...", "Generating cleanup version...", "Quality check passed, moving to next phase...")

Show a progress bar or step indicator that fills as phases complete

Display any warnings or issues as they occur

Show the retry count if in a retry state

When complete, show the final results with any warnings noted

**Step 12: Implement real-time status updates**

For a good user experience, the frontend should update as orchestration progresses without requiring page refresh.

Option A: Polling - Frontend periodically calls the status endpoint and updates display.

Option B: WebSocket - Backend pushes updates to connected clients.

For hackathon purposes, polling every 2-3 seconds is sufficient and simpler to implement.

**Step 13: Test the complete flow**

Test the entire pipeline end-to-end:

Create a new project with test images and a goal
Watch orchestration progress through all states
Verify state transitions are logged correctly
Verify Weave traces show the complete hierarchy
Verify the final output includes all phase results

Test failure scenarios:
Simulate a generation failure and verify retry logic works
Verify max retry limit is respected
Verify partial results are saved when phases fail

**Step 14: Verify all acceptance criteria**

Go through each acceptance criterion and verify it is met. Do not mark this mission complete until all criteria are satisfied.

---

## Async Execution Considerations

Orchestration involves long-running operations. Consider these patterns:

**Synchronous (simple but blocking):** The orchestration runs in a single request that does not return until complete. Simple but may timeout for long processes.

**Async with polling (recommended for hackathon):** The start endpoint kicks off orchestration in a background task and returns immediately with a job ID. Frontend polls status endpoint for updates. Straightforward to implement.

**Async with WebSocket (polished but complex):** Background task sends updates through WebSocket. Real-time updates without polling. More complex to implement.

Choose the pattern that fits the time available. Async with polling is the recommended balance of user experience and implementation effort.

---

## Failure Recovery

The Orchestrator should be resumable. If the server crashes mid-orchestration:

On restart, load all projects in non-terminal states
For each, determine where it left off based on saved state
Resume from that point

This requires that state updates are persisted immediately, not batched. Every transition should write to the database before proceeding.

---

## Output Artifacts

By the end of this mission, the following should exist:

- Backend Orchestrator module implementing the state machine
- Database updates for orchestration tracking
- Orchestration log table with complete transition history
- API endpoints for orchestration control and status
- Frontend progress display with real-time updates
- Weave traces showing complete orchestration hierarchy
- Working end-to-end flow from project creation to completion
- MISSION_06_TODO.md with all tasks checked off

---

## Important Reminders

The Orchestrator does not implement agent logic. It only coordinates when agents run and handles their outputs. Keep agent logic in agent modules.

Deterministic termination is critical. Every path through the state machine must eventually reach a terminal state. No infinite loops, no deadlocks.

Log everything. The orchestration log should tell the complete story of how a project was processed. This is valuable for debugging, for demos, and for understanding system behavior.

---

## Do Not Stop Until

You have created the todo list, completed every item on it, and verified all acceptance criteria are met. The system must be able to coordinate all agents through the complete pipeline, handle failures gracefully, track state persistently, and provide real-time progress to the frontend.
