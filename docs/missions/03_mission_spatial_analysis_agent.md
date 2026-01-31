# Mission 03: Spatial Analysis Agent

## Project Context

You are building Continuity, a self-improving agent system for architectural and interior design visualization. The system transforms raw photographs of unfinished or existing spaces into realistic, professionally staged renovation visualizations. The key innovation is that Continuity respects physical constraints—toilets stay near floor drains, sinks stay near plumbed walls, room geometry does not magically change.

Mission 01 established the system foundation. Mission 02 built the Requirements Agent that gathers structured user goals. This mission builds the agent that makes constraint-aware generation possible.

---

## Mission Objective

Build the Spatial Analysis Agent that examines input images to extract ground truth physical constraints. This agent is the anti-hallucination layer. Without it, the Generation Agent would produce beautiful but physically impossible results—toilets floating in the middle of rooms, walls disappearing, spaces growing larger than the original.

The agent uses vision capabilities to analyze uploaded photographs and identify what exists in the space, what can move, and what cannot move. It produces a constraint map that all subsequent generation phases must respect.

---

## Why This Agent Matters

This is the most critical agent for preventing hallucinations. Single-shot image generation tools fail in commercial contexts precisely because they ignore physical reality. A floor drain indicates where a toilet must go—you cannot move the floor drain without major construction. Plumbing stubs on a specific wall indicate where a sink must connect. A structural column cannot be removed.

The Spatial Analysis Agent extracts this ground truth from the input images and makes it explicit. Every subsequent generation phase receives these constraints and must preserve them. This is what makes Continuity's outputs physically plausible and commercially credible.

---

## Requirements

The agent must analyze one or more input images using a vision model (Gemini). It must identify structural elements including walls, floors, ceilings, doors, and windows. It must identify constraint indicators including floor drains, plumbing stubs, electrical outlets, structural columns, and HVAC elements. It must identify movable objects including construction debris, temporary fixtures, furniture, and equipment.

Each identified element must be classified into one of three categories:

- Locked: Cannot change under any circumstances (floor drains, structural walls, plumbing connections)
- Preferred: Should be preserved but could theoretically change (existing fixtures in good condition, window locations)
- Flexible: Can be freely modified or removed (debris, temporary items, styling elements)

The agent must also assess the construction state of the space: unfinished (exposed studs, no finishes), partially complete (some finishes, missing fixtures), or existing finish (currently usable space being redesigned).

All analysis operations must be traced in Weave.

---

## Acceptance Criteria

This mission is complete when all of the following are true:

1. The backend has a Spatial Analysis Agent module that can analyze uploaded images

2. The agent calls Gemini vision to examine the images and extract spatial information

3. The agent identifies structural elements (walls, floors, ceilings, boundaries) from the images

4. The agent identifies constraint indicators (floor drains, plumbing, columns) when visible

5. The agent identifies movable objects (debris, temporary items) when visible

6. Each identified element is classified as locked, preferred, or flexible

7. The agent assesses the overall construction state of the space

8. The output is a structured constraint map in JSON format that downstream agents can consume

9. The constraint map is stored in PostgreSQL in a constraints table linked to the project

10. All vision analysis calls and classification decisions are traced in Weave

11. The frontend displays a summary of identified constraints after analysis completes

---

## Database Schema

Create a constraints table in PostgreSQL with the following structure:

- id: unique identifier for the constraint record
- project_id: foreign key linking to the projects table
- element_type: the type of element (wall, floor_drain, sink_plumbing, column, debris, etc.)
- element_location: description or coordinates of where the element is in the image
- classification: enum of locked, preferred, or flexible
- confidence_score: how confident the agent is in this identification (0.0 to 1.0)
- notes: any additional notes about the element
- source_image: which uploaded image this element was identified in
- created_at: timestamp

Also create or update a project_analysis table to store the overall analysis:

- id: unique identifier
- project_id: foreign key
- construction_state: enum of unfinished, partially_complete, existing_finish
- analysis_summary: JSON field with high-level findings
- recommended_phase_sequence: JSON array of recommended generation phases
- created_at: timestamp

---

## Step-by-Step Instructions

Before you begin any work, create a todo list file called MISSION_03_TODO.md. This todo list should contain every task below as a checkbox item. As you complete each task, mark it complete. Do not consider this mission finished until every checkbox is marked and all acceptance criteria are verified.

**Step 1: Create the database tables**

Create the constraints table and project_analysis table as specified in the database schema section. Write migration or setup code that creates these tables if they do not exist. Ensure foreign key relationships to the projects table are properly defined.

**Step 2: Design the element classification taxonomy**

Before writing analysis code, establish the complete list of element types the agent should look for. Organize them into categories:

Structural elements: exterior_wall, interior_wall, floor, ceiling, door, window, structural_column, beam

Plumbing indicators: floor_drain, toilet_flange, sink_plumbing_stub, shower_drain, water_heater_connection, pipe_chase

Electrical indicators: electrical_panel, outlet_location, light_fixture_junction, switch_location

HVAC indicators: vent_location, hvac_unit, ductwork

Movable items: construction_debris, temporary_fixture, furniture, equipment, staging_items

This taxonomy should be documented in the code as constants or an enum so that classifications are consistent.

**Step 3: Create the Spatial Analysis Agent module**

In the backend, create a new module for the Spatial Analysis Agent. This module should have the following functions:

A function to prepare images for analysis that takes the uploaded image file paths, loads them, and prepares them for the vision API call. This may include resizing if images are very large.

A function to analyze single image that takes one image and calls Gemini vision with a carefully crafted prompt asking it to identify all spatial elements, constraint indicators, and movable objects visible in the image. The prompt should instruct the model to return structured JSON.

A function to merge multi-image analysis that takes results from multiple images (if the user uploaded more than one) and combines them into a unified constraint map, handling any conflicts or redundancies.

A function to classify elements that takes the raw vision output and applies the locked/preferred/flexible classification rules. Some classifications are deterministic (floor drains are always locked) while others may require judgment.

A function to assess construction state that examines the overall findings and determines whether the space is unfinished, partially complete, or existing finish.

A function to save constraints that takes the final constraint map and stores all elements in PostgreSQL.

**Step 4: Craft the vision analysis prompt**

The prompt sent to Gemini vision is critical. It should clearly explain what we are looking for and request structured output. The prompt should include:

Context explaining that we are analyzing a space for renovation visualization and need to understand physical constraints.

A request to identify all visible structural elements with their approximate locations.

A request to identify any plumbing, electrical, or HVAC indicators that would constrain fixture placement.

A request to identify any movable or temporary items that could be removed.

A request to assess the overall construction state.

Instructions to return the response as structured JSON with consistent field names.

**Step 5: Implement the classification logic**

Create clear rules for how elements get classified:

Always locked: floor_drain, toilet_flange, structural_column, exterior_wall, electrical_panel, main water connection

Usually locked but check context: interior_wall (could be non-load-bearing), window (expensive to move but possible), door (location usually fixed)

Preferred: existing fixtures in good condition, established lighting layout, current flooring type

Flexible: debris, temporary fixtures, furniture, decorative elements, paint colors

Document these rules in comments so future developers understand the logic.

**Step 6: Wrap all functions with Weave operations**

Every function in the Spatial Analysis Agent module should be decorated with the Weave operation decorator. The vision API calls are especially important to trace since they are expensive and their outputs directly affect all downstream processing. Include the prompt and response in the trace.

**Step 7: Create the backend API endpoints**

Create the following endpoints:

POST /api/projects/{project_id}/analyze-space to trigger spatial analysis. This endpoint retrieves the project's uploaded images, calls the Spatial Analysis Agent, saves the results, and returns the constraint map.

GET /api/projects/{project_id}/constraints to retrieve the stored constraints for a project.

GET /api/projects/{project_id}/analysis-summary to retrieve the high-level analysis including construction state and recommended phases.

**Step 8: Build the frontend constraints display**

In the frontend, create a component that displays the spatial analysis results. After analysis completes, show the user:

A summary card showing the construction state assessment

A list of locked constraints with explanations (for example, "Floor drain detected - toilet must remain in this area")

A list of identified elements grouped by category

This display serves two purposes: it shows the user that the system understood their space, and it provides transparency that judges will appreciate.

**Step 9: Integrate with the project flow**

Update the frontend flow so that after requirements are gathered, the system automatically triggers spatial analysis. The user should see a loading state while analysis runs, then see the constraints summary.

Consider whether to make this step interactive. The user might want to correct misidentifications (mark something as locked that the agent thought was flexible, or vice versa). For hackathon scope, displaying results is sufficient; user corrections can be a stretch goal.

**Step 10: Test with various input types**

Test the agent with different types of input images:

An unfinished construction site with exposed studs, visible plumbing, debris

A partially finished space with some fixtures installed but not complete

A finished space that someone wants to redesign

Verify that the agent correctly identifies visible elements and appropriately assesses construction state for each type.

**Step 11: Handle edge cases**

Consider and handle these edge cases:

If no constraint indicators are visible, the agent should still identify structural boundaries and note that fixture placement is flexible within those boundaries.

If the image is too dark, blurry, or unclear, the agent should note low confidence in its analysis.

If multiple images show conflicting information, the agent should flag this for human review or use the clearest source.

**Step 12: Verify all acceptance criteria**

Go through each acceptance criterion and verify it is met. Do not mark this mission complete until all criteria are satisfied.

---

## Vision API Integration Notes

When calling Gemini vision, send the image along with your text prompt. The prompt should be specific enough to get structured output but not so rigid that the model cannot handle unexpected elements in the image.

Request JSON output explicitly in your prompt. Provide an example of the expected output format if needed to improve consistency.

Handle cases where the model returns malformed JSON by having a fallback parser or retry logic.

Vision API calls can be slow (several seconds). Ensure the frontend shows appropriate loading feedback.

---

## Output Artifacts

By the end of this mission, the following should exist:

- Backend module for Spatial Analysis Agent with all functions
- Database tables for constraints and project_analysis
- API endpoints for triggering analysis and retrieving results
- Frontend display component for constraint summary
- Weave traces showing all vision analysis operations
- MISSION_03_TODO.md with all tasks checked off

---

## Important Reminders

This agent does not generate images. It only analyzes input images and produces constraints. The Generation Agent (Mission 04) will use these constraints.

The constraint map is consumed by machines, not humans. It must be structured JSON that the Generation Agent can parse and use to construct prompts. The human-readable display is separate from the machine-readable constraint map.

Trace the vision API calls thoroughly. These are expensive operations and the Quality Control agent will need to understand what the Spatial Analysis agent saw and concluded.

---

## Do Not Stop Until

You have created the todo list, completed every item on it, and verified all acceptance criteria are met. The system must be able to analyze uploaded images, identify spatial constraints, classify them appropriately, store them in the database, display them to the user, and trace all operations in Weave.
