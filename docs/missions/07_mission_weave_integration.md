# Mission 07: Weave Observability Integration

## Project Context

You are building Continuity, a self-improving agent system for architectural and interior design visualization. The system uses Weave from Weights & Biases as the observability layer that makes genuine self-improvement possible.

Previous missions built individual components and wired them together. This mission ensures Weave integration is comprehensive, correct, and demo-ready. Weave is not an afterthought—it is the substrate that enables the Quality Control Agent to analyze execution and make evidence-based improvements.

---

## Mission Objective

Ensure Weave observability is thoroughly integrated throughout the entire system. Every significant operation should be traced. Traces should be structured as a clear hierarchy that tells the story of execution. The Quality Control Agent must be able to query traces programmatically. The Weave UI must show a clear, understandable picture of what the system did.

This mission is about audit and completion. You have been adding Weave decorators in previous missions, but this mission ensures nothing was missed, traces are properly structured, and the integration is demo-ready.

---

## Why This Matters

The hackathon theme is self-improving agents. Weave is what makes Continuity's self-improvement concrete rather than hand-wavy. The Quality Control Agent reads Weave traces to understand what went wrong and propose fixes. Without proper tracing, the agent would be guessing.

Judges will look at Weave traces. A clean, hierarchical trace that shows exactly what happened is impressive. A messy, incomplete trace undermines the credibility of the self-improvement claims.

This mission ensures we have the former, not the latter.

---

## Requirements

Every agent operation must be wrapped as a Weave operation using the @weave.op() decorator or equivalent.

Traces must be hierarchical. The orchestration run should be the top-level trace, with agent calls nested beneath it, and individual operations (API calls, database writes) nested beneath those.

Traces must capture meaningful context:
- For generation calls: the prompt, input image reference, output image reference, latency
- For evaluation calls: the criteria scores, pass/fail decision, reasons
- For analysis calls: the insights extracted, recommendations produced
- For policy changes: the old values, new values, rationale

The Quality Control Agent must be able to retrieve traces programmatically to analyze them.

The Weave UI must show a clear picture when judges click through.

---

## Acceptance Criteria

This mission is complete when all of the following are true:

1. Every agent function is decorated with @weave.op()

2. Traces form a clear hierarchy from orchestration down to individual operations

3. Generation calls include prompt, input reference, output reference, and timing

4. Evaluation calls include scores, decisions, and reasons

5. Policy modifications include before/after values and rationale

6. The Quality Control Agent successfully retrieves and parses traces to extract insights

7. Viewing a project's traces in Weave UI tells a complete, understandable story

8. Trace names are human-readable and follow consistent naming conventions

9. No significant operations are missing from traces

10. Demo preparation: a sample run exists with clean traces that can be shown to judges

---

## Weave Integration Audit Checklist

Go through each module and verify tracing is complete:

**Requirements Agent**
- [ ] Goal analysis function is traced
- [ ] Question generation function is traced
- [ ] Response processing function is traced
- [ ] Final specification creation is traced
- [ ] Trace includes: goal text, questions generated, answers received, final spec

**Spatial Analysis Agent**
- [ ] Image preparation function is traced
- [ ] Vision API call is traced
- [ ] Element classification function is traced
- [ ] Construction state assessment is traced
- [ ] Constraint saving function is traced
- [ ] Trace includes: image references, vision API response, constraints identified

**Generation Agent**
- [ ] Policy loading is traced
- [ ] Prompt construction for each phase is traced
- [ ] Image generation API calls are traced (this is critical)
- [ ] Result saving is traced
- [ ] Trace includes: full prompt used, input image, output image, latency

**Quality Control Agent**
- [ ] Each evaluation criterion function is traced
- [ ] Overall evaluation function is traced
- [ ] Trace retrieval functions are traced (meta!)
- [ ] Analysis functions are traced
- [ ] Policy modification proposal is traced
- [ ] Policy version creation is traced
- [ ] Trace includes: scores, pass/fail, reasons, proposed changes

**Orchestrator**
- [ ] The main run loop is traced as parent
- [ ] Each state transition is logged within the parent trace
- [ ] Agent calls appear as children of orchestrator trace
- [ ] Trace includes: state transitions, timing, any errors

---

## Step-by-Step Instructions

Before you begin any work, create a todo list file called MISSION_07_TODO.md. This todo list should contain every task below as a checkbox item. As you complete each task, mark it complete. Do not consider this mission finished until every checkbox is marked and all acceptance criteria are verified.

**Step 1: Audit existing Weave integration**

Go through each module that was built in previous missions. For every function that does meaningful work, check whether it is decorated with @weave.op(). Make a list of any missing decorators.

**Step 2: Add missing decorators**

For any functions identified in Step 1 as missing Weave decorators, add them. Pay special attention to:

- API calls to external services (Gemini, any other LLMs)
- Database writes (especially for iterations, constraints, policies)
- Image processing operations
- Any function that takes more than a few milliseconds

**Step 3: Verify trace hierarchy**

Run a test project through the system and examine the traces in Weave UI. Verify that:

- The orchestration run appears as a top-level trace
- Agent calls appear nested under the orchestration
- Individual operations appear nested under agent calls
- The hierarchy makes intuitive sense

If traces are flat when they should be hierarchical, check that parent operations are calling child operations directly rather than through separate execution contexts.

**Step 4: Improve trace naming**

Examine the names that appear in Weave UI. Are they human-readable? Can a judge understand what each trace represents?

Default function names may be acceptable, but consider adding explicit names:
```python
@weave.op(name="generate_cleanup_phase")
def execute_cleanup(...)
```

Create a naming convention and apply it consistently:
- Agents: {agent_name}_{action} (e.g., "generation_agent_cleanup_phase")
- API calls: {service}_{operation} (e.g., "gemini_generate_image")
- Database: db_{operation}_{table} (e.g., "db_save_iteration")

**Step 5: Verify context capture**

For each major operation type, verify the trace captures useful context:

**Generation calls must capture:**
- The complete prompt (stored as input)
- Reference to input image
- Reference to output image
- Generation latency
- Any errors

**Evaluation calls must capture:**
- Input: image reference, constraint map
- Output: scores per criterion, overall pass/fail
- Reasons for failure if applicable

**Policy changes must capture:**
- Input: current policy, evaluation results
- Output: proposed changes with rationale
- New policy version created

If any context is missing, add it by ensuring function parameters and return values include the needed information.

**Step 6: Implement trace retrieval for QC Agent**

The Quality Control Agent needs to programmatically retrieve traces to analyze them. Verify this works:

Test that given an iteration's weave_trace_id, the agent can retrieve the full trace.

Test that the agent can parse the trace to extract:
- The prompt used
- Generation latency
- Any retry patterns

If this is not working, debug the Weave API calls. Ensure you are using the correct API to retrieve trace data.

**Step 7: Test the analysis pipeline**

Run a complete flow where:
1. Generation produces a poor output
2. QC evaluates and detects the problem
3. QC retrieves the generation trace
4. QC analyzes the trace and identifies issues
5. QC proposes specific policy changes based on trace data

Verify that trace data actually influences the analysis. If QC is proposing generic changes rather than trace-informed changes, the integration needs improvement.

**Step 8: Create a clean demo trace**

Run a complete project through the system specifically to create a demo-worthy trace. Choose an input that will exercise all phases and preferably trigger at least one retry to show the improvement loop.

Document the project ID and trace IDs so they can be quickly accessed during the demo.

**Step 9: Verify Weave UI presentation**

Open the demo traces in Weave UI and verify:

- The hierarchy is clear and logical
- Timing information is visible
- You can expand to see inputs and outputs
- The story of execution is understandable

If anything is confusing, improve naming or add additional context.

**Step 10: Document Weave integration patterns**

Create a brief document in the codebase explaining:

- How Weave is integrated
- The naming conventions used
- How to add tracing to new functions
- How the QC agent retrieves and uses traces

This helps judges understand the integration and helps future developers maintain it.

**Step 11: Verify all acceptance criteria**

Go through each acceptance criterion and verify it is met. Do not mark this mission complete until all criteria are satisfied.

---

## Weave Best Practices

**Naming**: Use descriptive names that would make sense to someone unfamiliar with the code. "run_phase" is unclear; "generation_agent_cleanup_phase" is clear.

**Inputs and Outputs**: Weave automatically captures function inputs and outputs. Ensure your functions have clear parameters and return values. Avoid side effects that create important state not visible in the trace.

**Large Data**: For large data like images, store references (file paths, URLs) rather than the actual data. Weave traces with embedded images become unwieldy.

**Errors**: Weave captures exceptions automatically. Ensure your error messages are informative so traces of failures are debuggable.

**Hierarchy**: Weave automatically creates hierarchy based on call structure. If function A calls function B, and both are traced, B will appear as a child of A. Use this to create logical groupings.

---

## QC Agent Trace Analysis

The Quality Control Agent's trace analysis is the most important use of Weave in this project. Ensure this works well:

**What to extract from generation traces:**
- The exact prompt used (to see if constraints were stated)
- Timing (to see if model struggled)
- Retry count (to see if there were failures)
- Any error messages

**How to correlate with failures:**
- If constraint was violated, check if prompt mentioned the constraint
- If hallucination occurred, check creativity parameter used
- If style was wrong, check style guidance clarity

**How to propose changes:**
- Changes must reference specific trace findings
- "Constraint not emphasized in prompt" → increase constraint_emphasis
- "High creativity with hallucination" → reduce creativity_level

---

## Output Artifacts

By the end of this mission, the following should exist:

- Complete Weave integration across all modules (audit verified)
- Clear trace hierarchy from orchestration to individual operations
- Meaningful context captured in all significant traces
- Working trace retrieval for QC agent analysis
- Demo-ready trace from a complete project run
- Documentation of Weave integration patterns
- MISSION_07_TODO.md with all tasks checked off

---

## Important Reminders

Weave is essential, not decorative. The project's claim to be self-improving depends on Weave providing the data for improvement. Half-hearted integration undermines the entire project narrative.

Judges will click through traces. Make sure what they see tells a clear story. Confusing traces make the whole project seem less credible.

The QC agent must actually use trace data. If it is not using traces, it is not really self-improving based on evidence. Verify this works end-to-end.

---

## Do Not Stop Until

You have created the todo list, completed every item on it, and verified all acceptance criteria are met. Every significant operation must be traced. Traces must form a clear hierarchy. The QC agent must successfully retrieve and analyze traces. The Weave UI must show an understandable story of execution.
