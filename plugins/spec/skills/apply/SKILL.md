---
description: Implement the plan from a spec change
disable-model-invocation: true
argument-hint: "[change-name]"
metadata:
  author: Till Gartner
---

Implement the plan from a spec change, test-first: for every step the test is
written and seen failing before the code, and the step is ticked only when its
verify command passes.

**Input**: Optionally specify a change name (e.g., `/spec:apply add-auth`). If
omitted, check if it can be inferred from conversation context. If vague or
ambiguous you MUST prompt for available changes.

**Steps**

1. **Select the change**

   If a name is provided, use it. Otherwise:
   - Infer from conversation context if the user mentioned a change
   - Auto-select if only one active change exists in `specs/changes/`
   - If ambiguous, list the directories in `specs/changes/` and use the
     **AskUserQuestion tool** to let the user select
   - If running unattended (no user to answer), make a sensible choice,
     log it in `DECISIONS.md` at the project root (format: `../../reference/decisions.md`), and continue

   Always announce: "Using change: <name>" and how to override (e.g.,
   `/spec:apply <other>`).

2. **Read context artifacts**

   Read the change's artifacts from `specs/changes/<name>/`:
   - `proposal.md` — what and why
   - `domain.md` — domain concepts (if present)
   - `architecture.md` — technical approach
   - `plan.md` — implementation steps

   Also read `../../reference/plan.md` (relative to this skill's directory):
   the step format and the red → green cycle this skill runs.

   **If plan.md is missing**: show message, suggest using `/spec:propose` first.

3. **Show current progress**

   Parse `plan.md` and count `- [ ]` (pending) vs `- [x]` (complete).

   Display:
   - Progress: "N/M steps complete"
   - Remaining steps overview

   **If all steps are already complete**: congratulate, suggest
   `/spec:adversarial-code-review`, then `/spec:archive`.

   **Steps without `Test first:` / `Verify:`** (older plans): derive both from
   the step and `architecture.md`, write them into `plan.md` before starting
   that step, and say so.

   Find the project's test command (README, `package.json` scripts,
   `Makefile`, `pyproject.toml`, …) and run the full suite once before the
   first step, so a red baseline isn't mistaken for your own breakage. No
   test harness at all: the first step sets one up (add it to `plan.md` if
   the plan lacks it).

4. **Implement steps (loop until done or blocked)**

   For each pending step, run the cycle from `../../reference/plan.md`:
   - Show which step is being worked on
   - **Red** — write the test named in `Test first:`. Run it and show that it
     fails, and that it fails for the stated reason. If it passes already,
     the test doesn't test the step: fix the test, not the plan. Steps marked
     `Test first: none — …` skip this.
   - **Green** — write the minimum code that makes the test pass. Keep
     changes minimal and focused on the step.
   - **Refactor** — tidy up while the test stays green.
   - **Verify** — run the step's `Verify:` command and the full test suite.
     Both must pass; show the result.
   - Only then mark the step complete in plan.md: `- [ ]` → `- [x]` (bump
     plan.md's `edited` to today)
   - After the **first** completed step, if the status is not yet `applying`,
     set `status: applying` in the frontmatter of **every** `.md` in the change
     directory (a status change alone does not bump `edited`)
   - Continue to next step

   When every plan step is `[x]`, set `status: applied` on every file of the
   change.

   Frontmatter schema and status meanings: `../../reference/frontmatter.md`.
   Files that lack frontmatter get it now, with the current status.
   `applied` means every step is `[x]` **and** the full suite is green.

   **Pause if:**
   - Step is unclear → ask for clarification
   - Implementation reveals an architectural issue → suggest updating artifacts
   - Error or blocker encountered → report and wait for guidance
   - The test can't be made to fail first, or Verify keeps failing → report
     both outputs and wait
   - User interrupts

   If running unattended (no user to answer), make a sensible choice for an
   unclear step, log it in `DECISIONS.md` at the project root (format: `../../reference/decisions.md`), and continue instead of pausing — but never tick a
   step whose Verify fails, and never weaken a test to get there: stop at
   that step and report.

5. **On completion or pause, show status**

   Display:
   - Steps completed this session
   - Overall progress: "N/M steps complete"
   - If all done: suggest `/spec:adversarial-code-review`, then `/spec:archive`
   - Decisions logged in `DECISIONS.md` this run, if any
   - If paused: explain why and wait for guidance

**Output During Implementation**

```
## Implementing: <change-name>

Working on step 3/7: <step description>
✗ Red: <test> fails — <reason, as the plan expected>
[...implementation happening...]
✓ Green: <test> passes
✓ Verify: <command> — all green
✓ Step complete

Working on step 4/7: <step description>
...
```

**Output On Completion**

```
## Implementation Complete

**Change:** <change-name>
**Progress:** 7/7 steps complete ✓
**Tests:** <suite command> — all green

### Completed This Session
- [x] Step 1
- [x] Step 2
...

All steps complete! Review it with `/spec:adversarial-code-review`, then
archive it with `/spec:archive`.
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
- Tests first, always: no production code for a step before its test has been
  seen failing
- Tick a step only after its Verify and the full suite pass — then
  immediately
- Never make a test pass by weakening, skipping, deleting or mocking it
  without the user's explicit agreement
- Keep `status` identical in all files of the change (`applying` while in
  progress, `applied` when done)
- Pause on errors, blockers, or unclear requirements — don't guess
- Edit spec files with the Edit/Write tools, not sed/python in Bash, so the
  md2html lint hook sees every change
- Don't call the spec HTML stale: if the `/spec:view` watcher is running it
  rebuilds the HTML automatically

**Fluid Workflow Integration**

This skill supports the "actions on a change" model:

- **Can be invoked anytime**: Before all artifacts are done (if a plan exists),
  after partial implementation, interleaved with other actions
- **Allows artifact updates**: If implementation reveals architectural issues, suggest
  updating artifacts — not phase-locked, work fluidly
