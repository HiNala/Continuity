# Mission 02: Requirements & Clarification Agent

## Project Context

You are building Continuity, a self-improving agent system for architectural and interior design visualization. The system transforms raw photographs of unfinished or existing spaces into realistic, professionally staged renovation visualizations. The complete system uses multiple specialized agents that work together in a loop, with Weave observability enabling genuine self-improvement based on execution data.

Mission 01 established the system foundation with a working Next.js frontend, FastAPI backend, PostgreSQL database, and Weave integration. This mission builds the first agent in the pipeline.

---

## Mission Objective

Build the Requirements and Clarification Agent that converts ambiguous user goals into structured, actionable specifications. This agent is the gatekeeper of the entire system. Bad inputs waste compute and produce nonsense outputs, so this agent prevents garbage-in by enforcing clarity before any expensive processing begins.

When a user uploads images and writes something vague like "make this bathroom look nice in a few different styles," the system cannot just pass that to an image generator. The Requirements Agent must determine what type of space this is, what styles the user wants, whether there are accessibility requirements, and any other information needed to produce useful results.

The agent asks clarifying questions through a simple push-button interface, not a chatty back-and-forth conversation. Users select from predefined options to keep interaction fast and ensure answers are structured data that downstream agents can use directly.

---

## Why This Agent Matters

Every subsequent agent depends on clear requirements. The Spatial Analysis Agent needs to know what kind of space it is analyzing. The Generation Agent needs to know what styles to produce. The Quality Control Agent needs to know what success looks like. Without structured requirements, all of these agents would be guessing.

This agent also sets the user experience tone. A confused, overly chatty clarification process frustrates users. A clean, fast, push-button process builds confidence that the system knows what it is doing.

---

## Requirements

The agent must be able to analyze a user's text goal and identify what information is missing or ambiguous. It must generate clarifying questions that are specific and answerable through multiple-choice selection. It must respect a hard limit on questions (no more than 5) to avoid frustrating users. It must produce a structured output that downstream agents can consume without parsing natural language.

All operations must be traced in Weave so that later analysis can understand what requirements were gathered and how.

The frontend must present questions as clickable buttons or cards, not as a chat interface or free text input.

---

## Acceptance Criteria

This mission is complete when all of the following are true:

1. The backend has a Requirements Agent module that can analyze a text goal and identify missing information

2. The agent generates at most 5 clarifying questions based on what is ambiguous in the user's goal

3. Questions are returned as structured data with a question text and an array of possible answers

4. The frontend displays these questions as clickable options (buttons or cards), not free text input

5. User selections are captured and sent back to the backend

6. The agent produces a final structured specification that includes space type, style targets, accessibility requirements, and any identified constraints

7. The final specification is stored in PostgreSQL in a requirements table linked to the project

8. All agent operations are traced in Weave including the goal analysis, question generation, and final specification creation

9. A complete flow works end-to-end: user enters goal, sees questions, clicks answers, and the system stores the structured requirements

---

## Database Schema

Create a requirements table in PostgreSQL with the following structure:

- id: unique identifier for the requirements record
- project_id: foreign key linking to the projects table (create a basic projects table if it does not exist)
- original_goal: the raw text the user entered
- space_type: the determined type of space (bathroom, kitchen, office, conference room, etc.)
- style_targets: an array or JSON field containing the target styles
- accessibility_required: boolean indicating whether accessibility compliance is needed
- budget_tier: the budget level (luxury, mid-range, budget-conscious)
- additional_constraints: JSON field for any other extracted constraints
- clarification_responses: JSON field storing the questions asked and answers received
- created_at: timestamp of creation
- updated_at: timestamp of last update

---

## Step-by-Step Instructions

Before you begin any work, create a todo list file called MISSION_02_TODO.md. This todo list should contain every task below as a checkbox item. As you complete each task, mark it complete. Do not consider this mission finished until every checkbox is marked and all acceptance criteria are verified.

**Step 1: Create the projects table**

If it does not already exist from Mission 01, create a projects table in PostgreSQL that will serve as the parent record for all project data. The table should have id, user_id (can be a placeholder string for now since we have no auth), created_at, status, and a field for the original uploaded images (store as JSON array of file paths or URLs).

**Step 2: Create the requirements table**

Create the requirements table as specified in the database schema section above. Ensure foreign key relationships are properly defined. Write migration or setup code that creates this table if it does not exist.

**Step 3: Design the question generation logic**

The agent needs to determine what questions to ask based on what is missing from the user's goal. Design the logic as follows:

First, identify what information we need for a complete specification: space type, desired styles, accessibility requirements, budget tier, and intended use (client presentation, internal planning, marketing).

Second, analyze the user's goal text to see which of these are already specified. For example, if the user says "modern bathroom," we know the space type is bathroom and one style target is modern.

Third, generate questions only for the missing information. If the user already specified the space type, do not ask about it.

Fourth, limit total questions to 5. If more than 5 pieces of information are missing, prioritize the most important ones (space type and styles are more important than intended use).

**Step 4: Create the Requirements Agent module**

In the backend, create a new module for the Requirements Agent. This module should have the following functions:

A function to analyze the user goal that takes the goal text as input and returns a list of identified information and a list of missing information. This function should use an LLM (Gemini) to parse the natural language goal and extract structured information.

A function to generate questions that takes the list of missing information and returns structured question objects. Each question object should have a question_id, question_text, and an array of possible_answers where each answer has an answer_id and answer_text.

A function to process responses that takes the original analysis and the user's answer selections and produces the final structured specification.

A function to save requirements that takes the specification and stores it in PostgreSQL.

**Step 5: Wrap all functions with Weave operations**

Every function in the Requirements Agent module should be decorated with the Weave operation decorator. This ensures that when the Quality Control agent later analyzes what happened, it can see exactly what the Requirements Agent did, what inputs it received, and what outputs it produced.

**Step 6: Create the backend API endpoints**

Create the following endpoints:

POST /api/projects to create a new project. This endpoint receives the uploaded images and initial goal text, creates a project record, and returns the project_id.

POST /api/projects/{project_id}/analyze-goal to trigger goal analysis. This endpoint calls the Requirements Agent to analyze the goal and returns the list of clarifying questions.

POST /api/projects/{project_id}/submit-answers to submit the user's answers. This endpoint receives the answer selections, calls the agent to produce the final specification, saves it to the database, and returns the structured requirements.

GET /api/projects/{project_id}/requirements to retrieve the stored requirements for a project.

**Step 7: Build the frontend clarification interface**

In the frontend, create a new page or component for the clarification flow. After the user uploads images and enters their goal, they should see a screen that displays the clarifying questions.

Each question should be displayed as a card with the question text and a set of buttons for each possible answer. The user clicks a button to select their answer. Once all questions are answered, a "Continue" button becomes enabled.

The interface should feel fast and decisive, not like a slow conversation. All questions can be displayed at once (not one at a time) so the user can answer them quickly.

**Step 8: Connect the frontend flow**

Wire up the frontend to the backend endpoints. When the user submits their initial upload and goal, the frontend calls the analyze-goal endpoint and displays the returned questions. When the user clicks Continue after answering, the frontend calls the submit-answers endpoint with all selections.

After successful submission, the frontend should display a confirmation showing the structured requirements in a human-readable format (for example, "Space: Bathroom, Styles: Modern, Japandi, Industrial, Accessibility: Required").

**Step 9: Handle edge cases**

Consider and handle these edge cases:

If the user's goal is so complete that no questions are needed, skip the clarification step and go directly to saving requirements.

If the goal analysis fails (LLM error, timeout), display a friendly error and allow retry.

If the user wants to go back and change their goal after seeing questions, provide a way to do so.

**Step 10: Test the complete flow**

Test the following scenarios:

A vague goal like "make it look nice" should generate multiple questions.

A detailed goal like "show me this commercial bathroom in three modern accessible styles for a client presentation" should generate few or no questions.

The Weave traces should show all agent operations.

The requirements should be correctly stored in PostgreSQL.

**Step 11: Verify all acceptance criteria**

Go through each acceptance criterion and verify it is met. Do not mark this mission complete until all criteria are satisfied.

---

## LLM Integration Notes

For the goal analysis and question generation, you will call Gemini or another LLM. Structure your prompts carefully:

For goal analysis, provide the LLM with the user's text and ask it to extract any specified information (space type, styles, etc.) and identify what is not specified. Ask for structured JSON output.

For question generation, you can either have the LLM generate the questions or generate them programmatically based on the missing fields. Programmatic generation is more predictable and recommended for hackathon reliability.

Keep LLM calls minimal in this agent since it is early in the pipeline and reliability matters more than sophistication.

---

## Output Artifacts

By the end of this mission, the following should exist:

- Backend module for Requirements Agent with all functions
- Database tables for projects and requirements
- API endpoints for the clarification flow
- Frontend clarification interface with push-button questions
- Weave traces showing all agent operations
- MISSION_02_TODO.md with all tasks checked off

---

## Important Reminders

The Requirements Agent does not do spatial analysis, image generation, or quality evaluation. It only gathers and structures requirements. Stay focused on this scope.

The push-button interface is critical. Judges will immediately notice if clarification feels like a chatbot conversation versus a clean selection interface. Make it feel like a well-designed form, not a chat.

Trace everything in Weave. The self-improvement loop depends on being able to analyze what happened at every step, including requirements gathering.

---

## Do Not Stop Until

You have created the todo list, completed every item on it, and verified all acceptance criteria are met. A user must be able to enter a goal, see clarifying questions, click answers, and have structured requirements stored in the database with full Weave tracing.
