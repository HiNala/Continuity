# Mission 08: Frontend User Experience

## Project Context

You are building Continuity, a self-improving agent system for architectural and interior design visualization. The system has a powerful backend with multiple agents, a self-improvement loop, and comprehensive Weave observability.

Previous missions built the backend functionality. This mission ensures the frontend presents that functionality in a way that is understandable, trustworthy, and demo-ready. A brilliant backend with a confusing UI loses hackathon judges instantly.

---

## Mission Objective

Build a frontend user experience that makes the system understandable, guides users through the process confidently, and showcases the self-improvement capabilities clearly. The interface should feel professional and polished while remaining simple enough to build in hackathon timeframes.

The frontend has three jobs: collect user input, show progress during processing, and present results clearly. Each of these must work well for the demo to succeed.

---

## Why This Matters

Judges have limited time and attention. If they cannot understand what the system does within the first 30 seconds of the demo, you have lost them. The frontend is the first thing they see and the lens through which they understand the entire project.

A clean, professional UI signals that this is a serious project. A confusing or ugly UI signals that the team does not care about user experience, which undermines confidence in the technical work.

For Continuity specifically, showing the self-improvement loop visually is critical. Judges need to see the before/after, see the policy change, see the improvement. The frontend must make this visible and obvious.

---

## Requirements

**Input Flow**: Users must be able to upload images, enter their goal, and answer clarifying questions through a clean wizard-style interface.

**Progress Display**: While the system processes, users must see real-time status including current phase, iteration count, and intermediate outputs as they become available.

**Results Display**: Final output must be presented as a visual timeline showing the transformation from input through all phases to styled variations.

**Improvement Visibility**: When the self-improvement loop activates (retry with policy change), this must be visible to the user, not hidden.

**Weave Links**: For transparency and judge inspection, Weave trace links should be accessible.

**Responsive Feedback**: The interface should never appear frozen. Loading states, progress indicators, and status messages keep users informed.

---

## Acceptance Criteria

This mission is complete when all of the following are true:

1. The upload interface accepts multiple images via drag-and-drop or file selection

2. The goal input field accepts text and is clearly labeled

3. Clarifying questions appear as clickable cards/buttons, not free text input

4. A progress display shows current phase, iteration count, and status messages

5. Intermediate outputs display as thumbnail previews as each phase completes

6. Final results display as a timeline from original through all phases to styled outputs

7. A comparison view allows selecting two images for side-by-side display

8. Policy changes and retries are visually indicated (not hidden)

9. Weave trace links are accessible for each iteration

10. The interface handles errors gracefully with helpful messages

11. A non-technical judge can understand what is happening within 30 seconds

12. The interface looks professional, not like a hackathon prototype

---

## UI Component Breakdown

### Component 1: Project Upload Screen

This is the first screen users see. It must be inviting and clear.

**Elements:**
- Large drop zone for image upload with clear instructions ("Drag photos of your space here or click to browse")
- Preview thumbnails of uploaded images with ability to remove
- Text area for goal input with helpful placeholder text
- Clear "Start" or "Continue" button
- Brief explanation of what the system does

**Behavior:**
- Images can be drag-dropped or selected via file picker
- Multiple images are supported
- Previews show immediately on selection
- Button is disabled until at least one image and some goal text exists

### Component 2: Clarification Questions Screen

When the Requirements Agent has questions, display them here.

**Elements:**
- Clear header indicating this is a clarification step
- Each question displayed as a card with the question text
- Answer options displayed as clickable buttons within each card
- Selected answer is highlighted
- "Continue" button at bottom

**Behavior:**
- All questions visible at once (not one-at-a-time)
- Clicking an answer selects it and deselects any previous selection for that question
- Continue button enabled when all questions have answers
- If no questions needed, this screen is skipped

### Component 3: Progress Display Screen

While processing, keep users informed.

**Elements:**
- Step indicator showing pipeline stages (Requirements → Analysis → Cleanup → Structure → Fixture → Style)
- Current stage highlighted
- Status message describing what is happening ("Analyzing spatial constraints...", "Generating cleanup version...", "Quality check in progress...")
- Iteration counter if in retry loop ("Attempt 2 of 3")
- Thumbnail grid showing outputs as they become available
- Elapsed time indicator

**Behavior:**
- Updates in real-time via polling or WebSocket
- Thumbnails appear as each phase completes
- If a retry happens, display a message explaining ("Improving approach based on analysis...")
- Never appears frozen—always show activity

### Component 4: Results Display Screen

Present the final output impressively.

**Elements:**
- Visual timeline showing: Original → Cleanup → Structural → Fixture → Style variations
- Large view of selected image
- Navigation to select different images for large view
- Comparison toggle to enable side-by-side mode
- Comparison slider when in comparison mode
- Download options (individual images, full timeline, PDF)
- Summary of what the system did

**Behavior:**
- Click any thumbnail to see it large
- Comparison mode shows two images with slider to blend
- Download initiates file download
- If there were retries, option to see the improvement story

### Component 5: Improvement Story Panel (Optional but Impressive)

For demos, showing the self-improvement story is powerful.

**Elements:**
- Timeline of iterations for phases that required retry
- Before/after comparison for the improvement
- Brief explanation of what changed ("Adjusted constraint emphasis", "Reduced creativity to prevent hallucination")
- Link to Weave trace for the technical details

**Behavior:**
- Collapsed by default, expandable
- Shows that improvement was based on real analysis, not random retry

### Component 6: Error States

Errors must be handled gracefully.

**Elements:**
- Clear error message explaining what went wrong
- Suggestion for what user can do (retry, modify input, contact support)
- Option to retry if applicable
- Link to see partial results if any exist

**Behavior:**
- Never show raw error messages or stack traces
- Always provide a path forward

---

## Step-by-Step Instructions

Before you begin any work, create a todo list file called MISSION_08_TODO.md. This todo list should contain every task below as a checkbox item. As you complete each task, mark it complete. Do not consider this mission finished until every checkbox is marked and all acceptance criteria are verified.

**Step 1: Design the overall layout**

Before coding, sketch the layout for each screen. Decide on:
- Header/navigation structure
- Color palette (keep it professional—suggest neutral with one accent color)
- Typography (use system fonts or one clean web font)
- Spacing and padding conventions

Keep it simple. A minimal design well-executed beats an ambitious design poorly executed.

**Step 2: Build the upload screen**

Create the project upload component with:
- Drag-and-drop zone using a library like react-dropzone or native drag events
- Image preview grid showing thumbnails
- Goal text area with placeholder
- Start button with disabled state handling
- Basic validation (at least one image, some goal text)

Test that images upload correctly and previews display.

**Step 3: Build the clarification screen**

Create the clarification questions component with:
- Question card layout
- Answer button styling with selected state
- Answer selection state management
- Continue button with proper enablement logic

Connect to the backend endpoint that retrieves questions. Handle the case where no questions are needed (skip this screen).

**Step 4: Build the progress screen**

Create the progress display component with:
- Step indicator (horizontal progress bar or step dots)
- Status message display area
- Iteration counter
- Thumbnail grid for completed outputs
- Timer showing elapsed time

Implement polling to fetch status updates from the backend. Update the display when status changes. Show thumbnails as they become available.

**Step 5: Build the results screen**

Create the results display component with:
- Timeline layout showing all outputs
- Large image display area
- Image selection highlighting
- Comparison mode toggle
- Comparison slider (consider a library like react-compare-image)
- Download buttons

Ensure the timeline tells a clear visual story from original to final outputs.

**Step 6: Build the improvement story panel**

Create an expandable panel that shows:
- Phases that required retry
- What changed between attempts
- Policy modification summary
- Weave trace link

This panel is optional for basic functionality but important for demo impressiveness.

**Step 7: Implement navigation flow**

Wire the screens together so the user flows naturally:
1. Upload screen → (submit) → Clarification screen or Progress screen
2. Clarification screen → (continue) → Progress screen
3. Progress screen → (completion) → Results screen
4. Error at any point → Error display with recovery options

Implement routing if using Next.js App Router, or state-based navigation if simpler.

**Step 8: Add loading and transition states**

Ensure every async operation has a loading indicator:
- Image upload shows upload progress
- Form submission shows spinner on button
- Status polling shows that data is loading
- Screen transitions have subtle animation

Never leave the user wondering if something is happening.

**Step 9: Style for professionalism**

Review the entire interface and polish:
- Consistent spacing throughout
- Proper typography hierarchy (headings, body, captions)
- Color used intentionally (accent for actions, muted for secondary)
- Images displayed with proper aspect ratios
- Buttons have clear hover and active states
- Cards have subtle shadows or borders for definition

The interface should look like a product, not a prototype.

**Step 10: Add Weave trace links**

In appropriate places (progress screen, results screen, improvement story), add links to Weave traces. These can be simple text links that open in new tabs.

Format: "View technical details in Weave →" with link to the trace URL.

**Step 11: Test the complete flow**

Test the entire user journey:
1. Upload images and enter goal
2. Answer clarification questions
3. Watch progress as phases complete
4. View final results
5. Use comparison slider
6. Check improvement story panel
7. Click Weave links

Verify everything works smoothly without errors.

**Step 12: Test error scenarios**

Test how the interface handles:
- Backend unreachable
- Processing timeout
- Phase failure
- Partial results available

Verify error messages are helpful and recovery options are provided.

**Step 13: Optimize for demo**

For the hackathon demo specifically:
- Ensure the interface loads quickly
- Pre-populate or pre-load any data that speeds up the demo
- Verify the happy path works flawlessly
- Know how to recover if something goes wrong during demo

**Step 14: Verify all acceptance criteria**

Go through each acceptance criterion and verify it is met. Do not mark this mission complete until all criteria are satisfied.

---

## Design Recommendations

**Color Palette**: White or very light gray background. Dark gray or black text. One accent color (blue is safe, but choose something distinctive if desired). Avoid multiple bright colors.

**Typography**: Use the system font stack or one clean font like Inter. Avoid decorative fonts. Ensure good contrast and readable sizes.

**Spacing**: Pick a base unit (8px is common) and use multiples consistently. Generous padding makes interfaces feel professional.

**Images**: Display with consistent aspect ratios. Use object-fit: cover for thumbnails. Show actual images, not placeholders.

**Interactions**: Subtle hover effects. Clear focus states for accessibility. Smooth transitions (200-300ms duration).

---

## Responsive Considerations

For hackathon purposes, optimizing for desktop demo is sufficient. However, if time permits:

- Ensure the interface does not break on smaller screens
- Stack elements vertically on narrow viewports
- Make touch targets large enough for tablet use

Do not spend significant time on mobile optimization unless core functionality is complete.

---

## Output Artifacts

By the end of this mission, the following should exist:

- Upload screen component with drag-drop and preview
- Clarification screen component with question cards
- Progress screen component with status and thumbnails
- Results screen component with timeline and comparison
- Improvement story panel component
- Error handling components
- Complete navigation flow between screens
- Polished, professional styling throughout
- MISSION_08_TODO.md with all tasks checked off

---

## Important Reminders

The frontend is what judges see. A great backend with a bad frontend will not win.

Keep it simple. A minimal design well-executed is better than an ambitious design half-finished.

Test the complete flow multiple times. The demo must be smooth.

The self-improvement loop must be visible. Do not hide retries and policy changes—celebrate them as the core feature.

---

## Do Not Stop Until

You have created the todo list, completed every item on it, and verified all acceptance criteria are met. A user must be able to upload images, enter a goal, see progress, view results, and understand the self-improvement story through a polished, professional interface.
