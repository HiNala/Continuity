# Mission 03: Spatial Analysis Agent

## Task Checklist

### Step 1: Create Database Tables
- [x] Create constraints table schema
- [x] Add element_type, location, classification fields
- [x] Add confidence_score and source_image fields
- [x] Create project_analysis table for overall findings
- [x] Add construction_state and analysis_summary fields
- [x] Update SQLAlchemy models

### Step 2: Design Element Classification Taxonomy
- [x] Define structural elements (walls, floors, ceilings, etc.)
- [x] Define plumbing indicators (floor_drain, toilet_flange, etc.)
- [x] Define electrical indicators (panel, outlets, etc.)
- [x] Define HVAC indicators (vents, ducts, etc.)
- [x] Define movable items (debris, furniture, etc.)
- [x] Document as constants/enum in code

### Step 3: Create Spatial Analysis Agent Module
- [x] Create backend/app/agents/spatial_agent.py
- [x] Implement prepare_images() function
- [x] Implement analyze_single_image() with Gemini vision
- [x] Implement merge_multi_image_analysis()
- [x] Implement classify_elements() function
- [x] Implement assess_construction_state()
- [x] Implement save_constraints() function

### Step 4: Craft Vision Analysis Prompt
- [x] Create detailed prompt for Gemini vision
- [x] Request structured JSON output
- [x] Include all element categories
- [x] Add confidence scoring guidance
- [ ] Test prompt reliability *(needs Gemini API key)*

### Step 5: Implement Classification Logic
- [x] Define locked elements (floor_drain, structural column, etc.)
- [x] Define preferred elements (existing fixtures, etc.)
- [x] Define flexible elements (debris, styling, etc.)
- [x] Document classification rules

### Step 6: Wrap with Weave Operations
- [x] Add @weave.op() to prepare_images
- [x] Add @weave.op() to analyze_single_image
- [x] Add @weave.op() to merge_multi_image_analysis
- [x] Add @weave.op() to classify_elements
- [x] Add @weave.op() to assess_construction_state
- [x] Add @weave.op() to save_constraints

### Step 7: Create Backend API Endpoints
- [x] POST /api/projects/{id}/analyze-space - Trigger analysis
- [x] GET /api/projects/{id}/constraints - Get constraints
- [x] GET /api/projects/{id}/analysis-summary - Get summary

### Step 8: Build Frontend Constraints Display
- [x] Create constraints summary component
- [x] Show construction state assessment
- [x] Display locked/preferred/flexible counts
- [x] Show recommended phases
- [x] Add loading state for analysis

### Step 9: Integrate with Project Flow
- [x] Button to trigger after requirements complete
- [x] Show loading state during analysis
- [x] Display results in UI
- [x] Handle errors gracefully

### Step 10: Handle Edge Cases
- [x] Handle no visible constraints (placeholder analysis)
- [x] Handle low-quality images (note confidence)
- [x] Handle conflicting multi-image data (merge logic)

### Step 11: Test with Various Inputs
- [ ] Test unfinished construction site image *(needs Docker running)*
- [ ] Test partially finished space *(needs Docker running)*
- [ ] Test fully finished redesign space *(needs Docker running)*
- [ ] Verify element detection accuracy *(needs Docker running)*

### Step 12: Verify Acceptance Criteria
- [x] Spatial Analysis Agent module exists
- [x] Agent calls Gemini vision API
- [x] Structural elements identified (via taxonomy)
- [x] Constraint indicators identified (via taxonomy)
- [x] Movable objects identified (via taxonomy)
- [x] Elements classified as locked/preferred/flexible
- [x] Construction state assessed
- [x] JSON constraint map output
- [ ] Constraints stored in PostgreSQL *(needs Docker running)*
- [ ] Vision calls traced in Weave *(needs Docker running)*
- [x] Frontend displays constraint summary

---

## Notes

- This agent does NOT generate images - only analyzes
- Constraint map is for machines, display is for humans
- Trace vision API calls thoroughly (expensive operations)
- Keep prompts specific but flexible for unexpected elements

---

## Completion Status

**CODE COMPLETE**

All code implementation is complete:
- Spatial Analysis Agent with Gemini vision integration
- Classification taxonomy for all element types
- Database models for Constraint and ProjectAnalysis
- API endpoints for triggering and retrieving analysis
- Frontend UI for displaying constraints with counts
- Weave tracing on all agent operations

Pending runtime verification:
- Start Docker with `docker compose up --build -d`
- Test spatial analysis at http://localhost:3000/project
- Verify Weave traces at https://wandb.ai

Ready to proceed to Mission 04: Generation Agent
