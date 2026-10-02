---
name: autonomous
description: Working alone, w/o having the user for feedback or answering questions. Use when user wants to make progress on a plan but doesn't have the time or energy or is not available.
argument-hint: "[task]"
metadata:
  author: Till Gartner
---

The user is away from the computer. Finish the task, even if you have to make assumptions and
decisions on your own. Don't wait for user feedback to keep making progress.

**Input**: the task. If it is a spec change (`specs/changes/<name>/` with the `spec` plugin
installed), the task is its plan: work through it as `/spec:apply` does.

**Steps**

1. **Decide instead of asking**

   Whenever you would ask the user, make a decision based on your best judgement and move on.
   Record every decision and assumption in `DECISIONS.md` at the project root, exactly in the
   format of `decisions-format.md` (next to this file; read it before the first entry):
   - this invocation is one **run** (`#` heading: start date and time, a summary title, then
     who started it and the task **exactly as the user gave it**);
   - each choice is one **decision** under it (`##` heading: time and the choice, then
     Status `open`, Context, Question, Decision, Why, Alternatives, Consequences);
   - the **Contents** list at the top gets the run and each decision in the same edit.

   Skills you drive (e.g. `/spec:apply`) add their decisions to this run, not a new one.

2. **Work until completely done**

   Don't stop until all functionality and all tests are complete. Work test-first: write the
   test, see it fail for the expected reason, implement, then run it and the full suite. Never
   call something done while a test fails, and never weaken, skip or delete a test to get there.

   Use agents as much as possible: parallelize the work, but only across sub-tasks you have
   identified as independent.

3. **Review your own work**

   Once you think you are done, review the work and make sure you didn't miss anything (for a
   spec change: `/spec:adversarial-code-review`). If you find something that needs fixing, fix
   it, don't wait for user feedback.

4. **Test until the user comes back**

   Test end-to-end. For a web app use the Playwright MCP: start the stack, enter data (feel free
   to create MANY test entries), try all kinds of functions — the ones just built as well as
   regressions. Create, search, edit, delete data. Without a UI, exercise the CLI or API the same
   way. Fix what you find (test first) and log any choice involved. Test forever, until the user
   comes back.

5. **Report**

   When the user returns (or there is truly nothing left), present this run's decisions from
   `DECISIONS.md` (titles and statuses, with a link to the file — or to its HTML page if
   `/spec:view` is running), what was built and tested, and what is still open.

**Guardrails**

- Don't do what can't be undone without the user: no `git push`, no `/spec:archive`, no
  deleting data outside the test data you created, no destructive git commands. Commit locally
  only if the project's workflow commits as it goes.
- Skip steps that need a person (e.g. `/spec:grill`) and log that.
- Edit `DECISIONS.md` and spec files with the Edit/Write tools, not sed/python in Bash, so the
  md2html lint hook (if installed) checks them.
