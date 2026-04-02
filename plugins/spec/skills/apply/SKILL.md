---
name: apply
description: Implement tasks from a spec change
disable-model-invocation: true
argument-hint: "[change-name]"
metadata:
  author: Till Gartner
---

Implement tasks from a spec change.

**Input**: Optionally specify a change name (e.g., `/spec:apply add-auth`). If
omitted, check if it can be inferred from conversation context. If vague or
ambiguous you MUST prompt for available changes.

**Steps**

1. **Select the change**

   If a name is provided, use it. Otherwise:
   - Infer from conversation context if the user mentioned a change
   - Auto-select if only one active change exists in `spec/changes/`
   - If ambiguous, list the directories in `spec/changes/` (excluding `archive/`)
     and use the **AskUserQuestion tool** to let the user select

   Always announce: "Using change: <name>" and how to override (e.g.,
   `/spec:apply <other>`).

2. **Read context artifacts**

   Read the change's artifacts from `spec/changes/<name>/`:
   - `proposal.md` — what and why
   - `domain.md` — domain concepts (if present)
   - `design.md` — technical approach
   - `tasks.md` — implementation steps

   **If tasks.md is missing**: show message, suggest using `/spec:propose` first.

3. **Show current progress**

   Parse `tasks.md` and count `- [ ]` (pending) vs `- [x]` (complete).

   Display:
   - Progress: "N/M tasks complete"
   - Remaining tasks overview

   **If all tasks are already complete**: congratulate, suggest `/spec:archive`.

4. **Implement tasks (loop until done or blocked)**

   For each pending task:
   - Show which task is being worked on
   - Make the code changes required
   - Keep changes minimal and focused
   - Mark task complete in tasks.md: `- [ ]` → `- [x]`
   - Continue to next task

   **Pause if:**
   - Task is unclear → ask for clarification
   - Implementation reveals a design issue → suggest updating artifacts
   - Error or blocker encountered → report and wait for guidance
   - User interrupts

5. **On completion or pause, show status**

   Display:
   - Tasks completed this session
   - Overall progress: "N/M tasks complete"
   - If all done: suggest archive
   - If paused: explain why and wait for guidance

**Output During Implementation**

```
## Implementing: <change-name>

Working on task 3/7: <task description>
[...implementation happening...]
✓ Task complete

Working on task 4/7: <task description>
[...implementation happening...]
✓ Task complete
```

**Output On Completion**

```
## Implementation Complete

**Change:** <change-name>
**Progress:** 7/7 tasks complete ✓

### Completed This Session
- [x] Task 1
- [x] Task 2
...

All tasks complete! You can archive this change with `/spec:archive`.
```

**Output On Pause (Issue Encountered)**

```
## Implementation Paused

**Change:** <change-name>
**Progress:** 4/7 tasks complete

### Issue Encountered
<description of the issue>

**Options:**
1. <option 1>
2. <option 2>
3. Other approach

What would you like to do?
```

**Guardrails**

- Keep going through tasks until done or blocked
- Always read all context artifacts before starting
- If task is ambiguous, pause and ask before implementing
- If implementation reveals issues, pause and suggest artifact updates
- Keep code changes minimal and scoped to each task
- Update task checkbox immediately after completing each task
- Pause on errors, blockers, or unclear requirements — don't guess

**Fluid Workflow Integration**

This skill supports the "actions on a change" model:

- **Can be invoked anytime**: Before all artifacts are done (if tasks exist),
  after partial implementation, interleaved with other actions
- **Allows artifact updates**: If implementation reveals design issues, suggest
  updating artifacts — not phase-locked, work fluidly
