# Mission 04: Main Generation Agent

## Project Context

You are building Continuity, a self-improving agent system for architectural and interior design visualization. The system transforms raw photographs of unfinished or existing spaces into realistic, professionally staged renovation visualizations through phased iteration rather than single-shot generation.

Mission 01 established the system foundation. Mission 02 built the Requirements Agent that gathers structured user goals. Mission 03 built the Spatial Analysis Agent that extracts physical constraints. This mission builds the agent that actually generates the visualizations.

---

## Mission Objective

Build the Main Generation Agent that transforms input spaces through phased iteration, producing images that progressively move from the input state to finished visualizations. This agent does not attempt to generate the final result in one shot. Instead, it works through logical phases that each accomplish one transformation while respecting the constraints identified by the Spatial Analysis Agent.

The core insight is that asking an image generator to go directly from "construction site photo" to "luxury finished bathroom" produces hallucinations. But asking it to first clean up debris, then complete the structure, then place fixtures, then apply styling produces coherent results because each step has clear grounding.

---

## Why This Agent Matters

This is where the actual visual output is created. All the work from previous missions—gathering requirements, analyzing constraints—feeds into this agent. If this agent does not work well, the entire system fails to deliver value.

The phased approach is the core innovation that makes Continuity different from other AI visualization tools. Each phase has a specific job: Cleanup removes distractions, Structural Completion finishes the space, Fixture Placement installs the essentials, and Style Application adds the design vision. By separating these concerns, each generation call has a focused task that the model can accomplish reliably.

Critically, this agent is intentionally "dumb" in that it does not modify its own behavior. It follows a policy configuration that tells it how to execute each phase. The Quality Control Agent (Mission 05) is responsible for modifying the policy when results are poor. This separation makes the self-improvement loop concrete and testable.

---

## Requirements

The agent must execute four distinct generation phases:

**Cleanup Phase**: Remove construction debris, temporary items, and visual distractions from the input image while preserving the underlying space geometry and constraint indicators.

**Structural Completion Phase**: If the space is unfinished or partially complete, finish the walls, ceiling, and flooring to create a clean canvas. Preserve all locked constraints.

**Fixture Placement Phase**: Install fixtures (toilet, sink, shower, etc.) in their correct positions according to the locked constraints. Add standard items like mirrors and towel bars.

**Style Application Phase**: Apply the target style(s) specified in the requirements. Produce multiple variations if the user requested different styles. Maintain all constraints and fixture positions.

Each phase uses the previous phase's output as input, creating a chain of incremental transformations.

The agent operates according to a policy configuration that specifies parameters for each phase including prompt templates, creativity levels, and constraint emphasis. This policy is stored in the database and can be modified by the Quality Control Agent.

All generation calls must be traced in Weave with complete context including prompts, inputs, outputs, and timing.

---

## Acceptance Criteria

This mission is complete when all of the following are true:

1. The backend has a Generation Agent module that can execute all four generation phases

2. Each phase produces an output image by calling Gemini with an appropriate prompt

3. The output of phase N is used as the input for phase N+1 (chained transformation)

4. Locked constraints from Spatial Analysis are included in generation prompts and respected in outputs

5. The agent reads its behavior parameters from a policy configuration stored in the database

6. The agent does not modify its own policy (that is the Quality Control Agent's responsibility)

7. Every generation call is logged to Weave with the prompt used, input image reference, output image, latency, and any errors

8. Phase outputs are saved to PostgreSQL with iteration metadata including phase type, iteration number, and policy version

9. Generated images are stored (locally or in cloud storage) and retrievable by the frontend

10. The frontend displays the generation progress and shows each phase output as it completes

11. A complete four-phase run produces a coherent timeline from input to styled output

---

## Database Schema

Create or update the following tables:

**policies table**:
- id: unique identifier
- project_id: foreign key (null for default policies)
- version: integer version number
- parent_policy_id: reference to the policy this was derived from (for tracking evolution)
- cleanup_config: JSON containing parameters for cleanup phase
- structural_config: JSON containing parameters for structural completion phase
- fixture_config: JSON containing parameters for fixture placement phase
- style_config: JSON containing parameters for style application phase
- created_at: timestamp
- created_by: enum of system, quality_control, or user

**iterations table**:
- id: unique identifier
- project_id: foreign key
- phase: enum of cleanup, structural, fixture, style
- iteration_number: which attempt this is within the phase (1, 2, 3...)
- policy_version: which policy version was used
- input_image_path: path to the input image for this iteration
- output_image_path: path to the generated output image
- prompt_used: the full prompt sent to the generation model
- generation_latency_ms: how long the generation call took
- weave_trace_id: reference to the Weave trace for this call
- status: enum of pending, completed, failed
- error_message: if failed, what went wrong
- created_at: timestamp

---

## Step-by-Step Instructions

Before you begin any work, create a todo list file called MISSION_04_TODO.md. This todo list should contain every task below as a checkbox item. As you complete each task, mark it complete. Do not consider this mission finished until every checkbox is marked and all acceptance criteria are verified.

**Step 1: Create the database tables**

Create the policies table and iterations table as specified in the database schema section. Write migration or setup code that creates these tables if they do not exist. Create a default policy with reasonable starting parameters that will be used when no custom policy exists for a project.

**Step 2: Design the policy configuration structure**

Define the structure for each phase's configuration. Each phase config should include:

- prompt_template: the base prompt to use, with placeholders for dynamic content
- creativity_level: a number from 0.0 to 1.0 indicating how much freedom the model has
- constraint_emphasis: how strongly to emphasize constraint preservation in the prompt (low, medium, high)
- max_retries: how many times to retry if generation fails
- style_guidance: specific style instructions for this phase (mainly used in style phase)

Document this structure clearly so the Quality Control Agent knows what it can modify.

**Step 3: Create the prompt construction logic**

For each phase, create a function that builds the complete prompt by combining:

- The phase-specific prompt template from the policy
- The spatial constraints relevant to this phase
- The requirements (space type, target styles)
- Dynamic instructions based on constraint emphasis setting

The prompt construction should be deterministic given the same inputs, which makes debugging and improvement possible.

**Step 4: Create the Generation Agent module**

In the backend, create a new module for the Generation Agent. This module should have the following functions:

A function to load policy that retrieves the current policy configuration for a project, falling back to the default policy if none exists.

A function to execute cleanup phase that takes the original input image and policy, constructs the appropriate prompt, calls Gemini for image generation, and returns the result.

A function to execute structural phase that takes the cleanup output and policy, focuses on completing walls/ceiling/floor, and returns the result.

A function to execute fixture phase that takes the structural output and policy, places fixtures according to locked constraints, and returns the result.

A function to execute style phase that takes the fixture output, policy, and style targets, applies the requested styles, and returns one or more styled variations.

A function to run full pipeline that orchestrates all four phases in sequence, handling the input/output chaining, saving each iteration to the database, and returning the complete set of outputs.

**Step 5: Implement the Gemini image generation calls**

Create a utility function that calls Gemini for image generation. This function should:

- Accept the input image and prompt
- Call the Gemini API with appropriate parameters
- Handle rate limiting and retries
- Return the generated image or raise an informative error

Wrap this function with the Weave operation decorator and ensure all relevant data is captured in the trace.

**Step 6: Implement constraint injection in prompts**

The Generation Agent must respect spatial constraints. Create logic that takes the constraint map from Spatial Analysis and injects relevant constraints into generation prompts.

For locked constraints, the prompt should explicitly state that these elements must not move. For example: "The toilet must remain positioned near the floor drain visible in the lower left area of the image. Do not move or relocate the toilet."

For preferred constraints, the prompt should suggest preservation but allow flexibility: "The existing window should ideally be preserved in its current location."

For flexible items, the prompt can indicate these can be changed: "The construction debris visible in the image should be removed."

**Step 7: Wrap all functions with Weave operations**

Every function in the Generation Agent module should be decorated with the Weave operation decorator. This is especially critical for generation calls since the Quality Control Agent will analyze these traces to understand what prompts produced what outputs.

Ensure traces include:
- The complete prompt used
- Reference to the input image
- Reference to the output image
- Generation latency
- Policy version used
- Any errors encountered

**Step 8: Implement iteration storage**

After each generation call, save a record to the iterations table with all relevant metadata. Store the generated images in a consistent location (local file system with organized paths, or cloud storage if configured).

Create a clear file naming convention like: {project_id}/{phase}_{iteration_number}_{timestamp}.png

**Step 9: Create the backend API endpoints**

Create the following endpoints:

POST /api/projects/{project_id}/generate to trigger the full generation pipeline. This endpoint loads the policy, runs all four phases, saves all iterations, and returns the paths to all generated images.

POST /api/projects/{project_id}/generate/{phase} to trigger a single phase. This is useful for testing and for the Quality Control loop which may need to rerun specific phases.

GET /api/projects/{project_id}/iterations to retrieve all iteration records for a project.

GET /api/projects/{project_id}/images/{image_path} to retrieve a generated image file.

GET /api/projects/{project_id}/policy to retrieve the current policy for a project.

**Step 10: Build the frontend generation display**

In the frontend, create a component that shows generation progress. As each phase completes, display the output image. Show a timeline view that builds up as phases complete:

[Original] → [Cleanup] → [Structural] → [Fixture] → [Style 1] [Style 2] [Style 3]

Include loading indicators while phases are in progress. Show timing information (how long each phase took).

**Step 11: Integrate with the project flow**

Update the frontend flow so that after spatial analysis completes, the user can trigger generation. Consider whether generation should start automatically or require user confirmation. For hackathon demo purposes, automatic triggering with clear progress display is recommended.

**Step 12: Test the complete pipeline**

Test the full four-phase pipeline with different input types:

- An unfinished construction space (all phases should contribute meaningfully)
- A partially finished space (structural phase may have less to do)
- A finished space being redesigned (cleanup and structural phases may be minimal)

Verify that constraints are respected throughout all phases. A floor drain identified in spatial analysis should result in the toilet being placed near it in all style variations.

**Step 13: Verify all acceptance criteria**

Go through each acceptance criterion and verify it is met. Do not mark this mission complete until all criteria are satisfied.

---

## Prompt Engineering Notes

The quality of generated images depends heavily on prompt quality. Some guidance:

Be specific about what should change and what should not change. Vague prompts produce unpredictable results.

For cleanup phase, explicitly list what to remove and what to preserve. "Remove the visible construction debris, tools, and dust. Preserve all walls, the floor drain, and the window. Keep the perspective and room dimensions exactly as shown."

For structural phase, describe the desired end state clearly. "Complete the unfinished walls with smooth drywall. Add a finished ceiling with recessed lighting. Install light gray porcelain tile flooring. The floor drain must remain visible and accessible in its current location."

For fixture phase, be precise about positions relative to visible landmarks. "Install a modern wall-mounted toilet positioned directly above the floor drain. Install a floating vanity with undermount sink on the wall with the plumbing stub."

For style phase, reference specific design styles clearly. "Transform this bathroom into a Japandi style with natural wood tones, clean lines, and minimalist fixtures. Maintain all fixture positions exactly as shown."

---

## Output Artifacts

By the end of this mission, the following should exist:

- Backend module for Generation Agent with all phase execution functions
- Database tables for policies and iterations
- Default policy configuration with reasonable starting parameters
- API endpoints for triggering generation and retrieving results
- Image storage with organized file structure
- Frontend generation progress display
- Weave traces showing all generation operations
- MISSION_04_TODO.md with all tasks checked off

---

## Important Reminders

This agent does not evaluate its own outputs. It generates according to policy and trusts that the Quality Control Agent will evaluate results and modify the policy if needed. Keep this separation clean.

The policy must be the single source of truth for how generation behaves. Do not hardcode behavior that should be configurable through policy. The Quality Control Agent will modify policy parameters, and those modifications must actually affect generation behavior.

Generation calls are slow and expensive. Show good progress feedback in the UI so users (and judges) know the system is working.

---

## Do Not Stop Until

You have created the todo list, completed every item on it, and verified all acceptance criteria are met. The system must be able to run all four generation phases, chain their outputs correctly, respect spatial constraints, store all iterations with full metadata, display progress and results in the frontend, and trace everything in Weave.
