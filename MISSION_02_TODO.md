# Mission 02: Requirements & Clarification Agent

## Task Checklist

### Step 1: Create the Projects Table
- [ ] Create projects table schema
- [ ] Add id, user_id, created_at, status fields
- [ ] Add images field (JSON array)
- [ ] Add goal field for original text
- [ ] Create SQLAlchemy model

### Step 2: Create the Requirements Table
- [ ] Create requirements table schema
- [ ] Add foreign key to projects
- [ ] Add space_type, style_targets, accessibility_required fields
- [ ] Add budget_tier, additional_constraints fields
- [ ] Add clarification_responses JSON field
- [ ] Add timestamps
- [ ] Create SQLAlchemy model

### Step 3: Design Question Generation Logic
- [ ] Define required information fields
- [ ] Create logic to detect specified information from goal
- [ ] Create logic to identify missing information
- [ ] Implement 5-question limit with prioritization

### Step 4: Create Requirements Agent Module
- [ ] Create backend/app/agents/ directory
- [ ] Create requirements_agent.py module
- [ ] Implement analyze_goal() function
- [ ] Implement generate_questions() function
- [ ] Implement process_responses() function
- [ ] Implement save_requirements() function

### Step 5: Wrap Functions with Weave Operations
- [ ] Add @weave.op() to analyze_goal
- [ ] Add @weave.op() to generate_questions
- [ ] Add @weave.op() to process_responses
- [ ] Add @weave.op() to save_requirements

### Step 6: Create Backend API Endpoints
- [ ] POST /api/projects - Create project
- [ ] POST /api/projects/{id}/analyze-goal - Trigger analysis
- [ ] POST /api/projects/{id}/submit-answers - Submit answers
- [ ] GET /api/projects/{id}/requirements - Get requirements

### Step 7: Build Frontend Clarification Interface
- [ ] Create clarification page/component
- [ ] Display questions as cards
- [ ] Add answer buttons for each question
- [ ] Add "Continue" button
- [ ] Show all questions at once

### Step 8: Connect Frontend Flow
- [ ] Call analyze-goal endpoint after upload
- [ ] Display returned questions
- [ ] Send answers on Continue click
- [ ] Show confirmation with structured requirements

### Step 9: Handle Edge Cases
- [ ] Handle complete goals (skip questions)
- [ ] Handle LLM errors with retry
- [ ] Allow going back to edit goal

### Step 10: Test Complete Flow
- [ ] Test vague goal generates questions
- [ ] Test detailed goal skips questions
- [ ] Verify Weave traces work
- [ ] Verify PostgreSQL storage

### Step 11: Verify Acceptance Criteria
- [ ] Backend Requirements Agent module exists
- [ ] At most 5 questions generated
- [ ] Questions returned as structured data
- [ ] Frontend shows clickable buttons
- [ ] User selections captured
- [ ] Final specification created
- [ ] Requirements stored in PostgreSQL
- [ ] All operations traced in Weave
- [ ] Complete flow works end-to-end

---

## Notes

- Focus on push-button interface, NOT chat-like experience
- Keep LLM calls minimal for reliability
- Trace everything in Weave for self-improvement loop
- Stay in scope - no spatial analysis or image generation

---

## Completion Status

**IN PROGRESS**
