# Mission 09: Demo & Narrative Readiness

## Project Context

You are building Continuity, a self-improving agent system for architectural and interior design visualization. The system is feature-complete with all agents, orchestration, Weave integration, and frontend.

Previous missions built the technical functionality. This mission prepares for the hackathon presentation. Technical excellence means nothing if judges do not understand what they are seeing. This mission ensures a flawless, compelling demo.

---

## Mission Objective

Prepare a flawless, judge-friendly demo that communicates the value of Continuity in approximately three minutes. This includes selecting the right demo inputs, rehearsing the narrative, recording backup videos, and anticipating what can go wrong.

Winning hackathons is about storytelling as much as technical achievement. This mission transforms working code into a winning presentation.

---

## Why This Matters

Judges will see dozens of projects. They have limited time and attention. A confusing demo loses them in the first 30 seconds. A smooth, compelling demo with a clear narrative sticks in their memory.

The demo must communicate three things:
1. This solves a real commercial problem (visualization for real estate/architecture)
2. The self-improvement is genuine (not random retry, but evidence-based)
3. Weave is essential (the system cannot function without it)

Everything in the demo must serve these messages.

---

## Requirements

**Demo Script**: A written script covering what to say and do at each point, timed to fit in three minutes.

**Demo Input**: One or more test inputs that have been verified to work well and demonstrate the self-improvement loop.

**Backup Recording**: A video of a successful demo run, in case live demo fails.

**Failure Recovery Plan**: Known issues and workarounds for things that might go wrong.

**Talking Points**: Concise explanations for likely judge questions.

---

## Acceptance Criteria

This mission is complete when all of the following are true:

1. A written demo script exists with timing marks

2. At least one demo input is selected and tested that reliably shows the improvement loop

3. A backup video exists showing a complete successful run

4. The demo has been rehearsed at least three times end-to-end

5. A list of potential failure points exists with recovery steps

6. Talking points for common judge questions are documented

7. The demo can be delivered in under three minutes

8. A non-technical observer who watches the demo understands the project's value

9. The narrative emphasizes the three key messages (commercial value, genuine self-improvement, Weave essential)

10. All team members who might present can deliver the demo

---

## Demo Structure: The Three-Minute Pitch

The demo follows a tight narrative structure. Every second counts.

### Minute 1: The Problem (60 seconds)

**What to show:**
- A raw, unfinished construction photo of a bathroom (or similar space)
- A single-shot AI generation attempt using a generic tool (or simulated result)
- The obvious failures: toilet in wrong place, geometry changed, hallucinations

**What to say:**
"Real estate developers and architects need to show clients what spaces could look like after renovation. Traditional visualization costs thousands and takes weeks. AI promised to fix this, but look what happens when we ask a standard AI tool to visualize this bathroom finished."

[Show the bad result]

"The toilet moved to an impossible location. The room got bigger. There's a window that did not exist. This is why AI visualization has not replaced professional rendering—the results are not credible. The problem is that single-shot generation ignores physical constraints."

**Goal of this minute:** Establish that there is a real problem worth solving, and current tools fail.

### Minute 2: The Solution (60 seconds)

**What to show:**
- Enter the same image and goal into Continuity
- Quick clicks through any clarifying questions
- The spatial analysis results (floor drain detected, plumbing wall identified)
- The first generation attempt (show briefly)
- Open Weave to show the trace
- Show Quality Control detecting an issue
- Show the policy modification
- Trigger the retry

**What to say:**
"Continuity approaches this differently. It first analyzes the space to understand physical constraints—here it detected the floor drain and the plumbing wall. Then it generates through phases."

[Show first attempt]

"But here's where it gets interesting. Our Quality Control agent evaluates every output."

[Show Weave trace and QC evaluation]

"It detected that the constraint emphasis was too low—the generation ignored the floor drain location. So it adjusts the policy..."

[Show policy change]

"And runs again with stronger constraint enforcement."

**Goal of this minute:** Show the self-improvement loop is real and evidence-based. Make Weave's role obvious.

### Minute 3: The Result (60 seconds)

**What to show:**
- The improved output
- The complete timeline from construction to finished
- Multiple style variations
- The comparison slider showing before/after
- The toilet in the correct position across all variations

**What to say:**
"Now look at the result. The toilet stayed where it needs to be—right above the floor drain. The geometry is stable. And we have multiple style variations that are all physically plausible."

[Show comparison slider]

"Nothing changed except the process—and Weave told us exactly what to fix. This is not random retry. This is evidence-based improvement."

[Quick pause]

"Continuity turns observability into performance. Every agent team building AI applications needs this kind of feedback loop. Weave makes it possible."

**Goal of this minute:** Show impressive results and hammer home the key message about Weave enabling genuine improvement.

---

## Step-by-Step Instructions

Before you begin any work, create a todo list file called MISSION_09_TODO.md. This todo list should contain every task below as a checkbox item. As you complete each task, mark it complete. Do not consider this mission finished until every checkbox is marked and all acceptance criteria are verified.

**Step 1: Select demo inputs**

Find or create input images that will demonstrate the system well. Ideal inputs:
- Show a clearly unfinished or renovatable space
- Have visible constraint indicators (floor drain, plumbing wall)
- Are likely to trigger at least one retry (so the improvement loop is shown)
- Produce attractive final results

Test multiple inputs and select the one that works best. Have a backup input ready.

**Step 2: Test the selected input end-to-end**

Run the complete pipeline with the selected input at least three times. Verify:
- All phases complete without crashing
- At least one phase triggers a retry (for demo purposes)
- Final results look good
- Timing is reasonable (complete within demo timeframe)

If the input does not reliably trigger a retry, you may need to adjust default policy parameters to make the first attempt more likely to fail.

**Step 3: Write the demo script**

Write out exactly what will be said and done. Include:
- Opening line to grab attention
- Transition phrases between sections
- Key technical explanations in simple language
- Closing statement

Time each section. The complete script should be around 3 minutes read aloud at natural pace.

**Step 4: Record a backup video**

Record a screen capture of a successful demo run. This serves as:
- Backup if live demo fails
- Reference for rehearsal
- Proof of functionality

Use a screen recording tool. Record at good quality. Include your narration.

**Step 5: Rehearse the demo**

Practice the demo at least three times:
- First time: Get familiar with the flow
- Second time: Refine timing and pacing
- Third time: Simulate demo conditions (pressure, distractions)

Time each rehearsal. Make adjustments to fit the time limit.

**Step 6: Identify failure points**

List everything that could go wrong during demo:
- Backend not responding
- Generation taking too long
- Weave not loading
- Image upload failing
- Network issues

For each, document:
- How to detect the issue quickly
- What to do (switch to backup video, skip section, explain and move on)

**Step 7: Prepare the demo environment**

Before the actual demo:
- Close unnecessary applications
- Pre-load the demo page
- Have backup video ready to play
- Have Weave pre-loaded with the demo traces
- Test audio/screen sharing if presenting remotely

**Step 8: Document talking points**

Judges may ask questions. Prepare concise answers for:

"How does this actually self-improve?"
- The Quality Control agent evaluates outputs against spatial constraints
- It retrieves Weave traces to see what prompts were used
- It identifies specific issues (constraint not emphasized, creativity too high)
- It modifies policy with specific changes
- Next generation uses the modified policy

"Why is Weave essential?"
- The QC agent literally reads Weave traces to make decisions
- Without trace data, it would be guessing
- Weave provides the feedback loop that enables improvement
- You can see this in the trace—the analysis references specific trace data

"What's the commercial value?"
- Real estate visualization is a $500M+ market
- Current AI tools fail because they ignore physical reality
- Continuity's constraint-aware approach makes outputs credible
- This could be used by architects, developers, brokers, facilities teams

"What would you do next?"
- Expand to full building photo shoots (batch processing)
- Add user correction interface for constraints
- Train on domain-specific data for better understanding
- Productize the improvement loop as infrastructure other agent teams could use

**Step 9: Prepare the opening hook**

The first 10 seconds determine whether judges pay attention. Craft a strong opening:

Bad: "Hi, we're team X and we built a thing called Continuity that uses agents to..."

Better: "What if AI could actually help architects visualize renovations instead of producing impossible hallucinations?"

Or: "This construction site bathroom needs to become a luxury executive restroom. Watch what happens when we ask AI to help."

Start with the problem, not the solution. Start with something visual or provocative.

**Step 10: Prepare the closing**

The last thing you say is what judges remember. Craft a strong close:

"Continuity turns observability into performance. Weave doesn't just log what agents do—it enables agents to learn what to do better. That's the difference between agents that iterate and agents that improve."

End with confidence. Do not trail off with "so yeah, that's our project."

**Step 11: Do a final dress rehearsal**

One complete run-through in demo conditions:
- Full script
- Actual system
- Timed
- Ideally with someone watching who can give feedback

Adjust based on feedback. Lock the demo plan.

**Step 12: Verify all acceptance criteria**

Go through each acceptance criterion and verify it is met. Do not mark this mission complete until all criteria are satisfied.

---

## Demo Day Checklist

On the day of the demo, verify:

- [ ] Laptop charged or plugged in
- [ ] WiFi connected and working
- [ ] Backend running
- [ ] Frontend running
- [ ] Demo input uploaded and ready
- [ ] Weave logged in and traces accessible
- [ ] Backup video accessible
- [ ] Script/notes accessible
- [ ] Water available (presenting is thirsty work)
- [ ] Phone silenced
- [ ] Unnecessary apps closed

---

## What Judges Look For

Understand what makes projects win:

**Technical Achievement**: Does it actually work? Is it impressive technically?

**Relevance to Theme**: For WeaveHacks, does it genuinely use Weave in a non-trivial way?

**Commercial Viability**: Could this be a real product? Does it solve a real problem?

**Presentation Quality**: Was the demo clear and compelling?

**Creativity**: Is this a fresh idea or just a tutorial project?

Continuity should score well on all of these. Make sure the demo communicates all of these aspects.

---

## Common Demo Mistakes to Avoid

**Too much technical detail**: Judges do not need to know your database schema. Focus on what it does and why it matters.

**Apologizing**: Do not say "we didn't have time to..." or "this is still buggy." Present confidently.

**Reading slides**: If you have slides, talk to the judges, not the screen.

**Running over time**: Practice until you reliably finish on time. Going over is disrespectful and gets you cut off.

**Burying the lead**: Start with the impressive thing, not the setup. "Watch this" is better than "let me explain our architecture."

**No clear ask**: End with what you want (the prize, feedback, etc.) or at least a strong summary.

---

## Output Artifacts

By the end of this mission, the following should exist:

- Written demo script with timing marks
- Selected and tested demo input(s)
- Backup video of successful demo
- Failure point list with recovery plans
- Talking points document for judge questions
- Demo day checklist
- MISSION_09_TODO.md with all tasks checked off

---

## Important Reminders

The demo is the product for judges. All the technical work is only valuable if the demo communicates it.

Practice builds confidence. Rehearse until you can deliver smoothly under pressure.

Have a backup plan. Live demos fail. Be ready to switch to video smoothly if needed.

Tell a story. Problem → Solution → Result. Not a feature list.

---

## Do Not Stop Until

You have created the todo list, completed every item on it, and verified all acceptance criteria are met. You must be able to deliver a compelling three-minute demo that clearly communicates the project's value, demonstrates genuine self-improvement, and shows why Weave is essential.
