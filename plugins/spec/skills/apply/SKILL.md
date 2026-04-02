---
description: Implement the plan from a spec change
disable-model-invocation: true
argument-hint: "[change-name]"
metadata:
  author: Till Gartner
---

Implement the plan from a spec change.

**Input**: Optionally specify a change name (e.g., `/spec:apply add-auth`). If
omitted, check if it can be inferred from conversation context. If vague or
ambiguous you MUST prompt for available changes.

**Steps**

1. **Select the change**

   If a name is provided, use it. Otherwise:
   - Infer from conversation context if the user mentioned a change
   - Auto-select if only one active change exists in `specs/changes/`
   - If ambiguous, list the directories in `specs/changes/` (excluding `archive/`)
     and use the **AskUserQuestion tool** to let the user select

   Always announce: "Using change: <name>" and how to override (e.g.,
   `/spec:apply <other>`).

2. **Read context artifacts**

   Read the change's artifacts from `specs/changes/<name>/`:
   - `proposal.md` — what and why
   - `domain.md` — domain concepts (if present)
   - `architecture.md` — technical approach
   - `plan.md` — implementation steps

   **If plan.md is missing**: show message, suggest using `/spec:propose` first.

3. **Show current progress**

   Parse `plan.md` and count `- [ ]` (pending) vs `- [x]` (complete).

   Display:
   - Progress: "N/M steps complete"
   - Remaining steps overview

   **If all steps are already complete**: congratulate, suggest `/spec:archive`.

4. **Implement steps (loop until done or blocked)**

   For each pending step:
   - Show which step is being worked on
   - Make the code changes required
   - Keep changes minimal and focused
   - Mark step complete in plan.md: `- [ ]` → `- [x]`
   - Continue to next step

   **Pause if:**
   - Step is unclear → ask for clarification
   - Implementation reveals an architectural issue → suggest updating artifacts
   - Error or blocker encountered → report and wait for guidance
   - User interrupts

5. **On completion or pause, show status**

   Display:
   - Steps completed this session
   - Overall progress: "N/M steps complete"
   - If all done: suggest archive
   - If paused: explain why and wait for guidance

**Output During Implementation**

```
## Implementing: <change-name>

Working on step 3/7: <step description>
[...implementation happening...]
✓ Step complete

Working on step 4/7: <step description>
[...implementation happening...]
✓ Step complete
```

**Output On Completion**

```
## Implementation Complete

**Change:** <change-name>
**Progress:** 7/7 steps complete ✓

### Completed This Session
- [x] Step 1
- [x] Step 2
...

All steps complete! You can archive this change with `/spec:archive`.
```

**Output On Pause (Issue Encountered)**

```
## Implementation Paused

**Change:** <change-name>
**Progress:** 4/7 steps complete

### Issue Encountered
<description of the issue>

**Options:**
1. <option 1>
2. <option 2>
3. Other approach

What would you like to do?
```

**Guardrails**

- Keep going through steps until done or blocked
- Always read all context artifacts before starting
- If a step is ambiguous, pause and ask before implementing
- If implementation reveals issues, pause and suggest artifact updates
- Keep code changes minimal and scoped to each step
- Update step checkbox immediately after completing each step
- Pause on errors, blockers, or unclear requirements — don't guess

**Fluid Workflow Integration**

This skill supports the "actions on a change" model:

- **Can be invoked anytime**: Before all artifacts are done (if a plan exists),
  after partial implementation, interleaved with other actions
- **Allows artifact updates**: If implementation reveals architectural issues, suggest
  updating artifacts — not phase-locked, work fluidly
