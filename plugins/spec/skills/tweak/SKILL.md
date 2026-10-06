---
description: Make a small change test-first without a change directory - one inline plan, specs/system updated in place, one commit
disable-model-invocation: true
argument-hint: "[description of the small change]"
metadata:
  author: Till Gartner
---

The light lane for small changes: a bug fix, a dialog split, a renamed option. No
`specs/changes/<name>/`, no proposal, domain or architecture — one short inline plan, the same
red → green → verify cycle as `/spec:apply`, `specs/system/` updated in place, one commit.

A tweak lives in one session. If it turns out bigger than a tweak, it stops and hands over to
`/spec:propose`.

**Input**: a description of the change, or an **issue reference** (`#42`, an issue URL, a
`.scratch/…` path). For an issue reference, read `../../reference/issue-tracker.md` and fetch
the issue (body and comments) as its config says; it is the request, and the tweak's **linked
issue**. No tracker config → treat the reference as plain text and say so. If nothing is given,
use the **AskUserQuestion tool** (open-ended) to ask what to change.

**The tweak limits** (the one definition; `/spec:propose` points here). A tweak stays a tweak
while **all** of these hold:

- at most about 3 plan steps;
- no new domain term, no changed component boundary or interaction — nothing that would need
  a change's `domain.md` or `architecture.md`;
- no open design question the user has to settle;
- the project has a test harness (setting one up is a change of its own).

This is a judgement call, not a count of lines.

**Steps**

1. **Check the working tree**

   Run `git status --porcelain`. A tweak ends in one commit, which must not sweep in other
   work:
   - Clean → continue.
   - Uncommitted changes while a change in `specs/changes/` is `applying` or `applied` (not
     yet archived) → **refuse**: "There is uncommitted work from `<change>`. Finish or commit it first, then `/spec:tweak`."
   - Other uncommitted changes → list them and ask (**AskUserQuestion tool**): "Continue — the
     commit takes only the tweak's files" (recommended) / "Stop". Remember these files: if the
     tweak has to edit one of them too, ask before staging it, because its other hunks would
     be swept in.

2. **Understand the request**

   Read the request, the code it touches, and the relevant parts of `specs/system/`
   (`domain.md`, `architecture.md`, `functional.md`, others as needed). If `specs/system/`
   doesn't exist, note it for step 6.

3. **Check the limits — before any code**

   If the request already breaks a limit (a new domain term, an open design question, no test
   harness), **escalate** (see below) without writing code.

4. **Show the inline plan**

   Write the plan in the chat, not in a file, in the step format of `../../reference/plan.md`
   (relative to this skill's directory; read it now): every step has `Test first:` and
   `Verify:`. A step with no runtime surface uses `Test first: none — <why>` as that reference
   allows. **More than about 3 steps → escalate.**

   Find the project's test command and run the full suite once as the **baseline**. If it is
   already red, show which tests fail and ask (**AskUserQuestion tool**): "Continue — done
   means no *new* failures" / "Stop". Unattended: continue on that rule and log it.

5. **Run each step test-first**

   Per step, the cycle from `../../reference/plan.md`: **red** (write the test, see it fail
   for the stated reason) → **green** (minimum code) → **refactor** → **verify** (the step's
   `Verify:` and the full suite: green, or no new failures against a red baseline). Show each
   result.

   After each step, check the limits again. If the tweak has outgrown them, finish the current
   step (green) and **escalate**.

6. **Update the system description in place**

   Update every `specs/system/*.md` the tweak changes the truth of (a renamed option in
   `functional.md`, a new rule in `domain.md`, …). Frontmatter rules: `../../reference/frontmatter.md`
   — set `edited` to today on each file you touch. Nothing to update → say so. No
   `specs/system/` at all → skip, and suggest `/spec:document-system` in the summary.

7. **Commit**

   Draft a commit message that says what the tweak did. Show it with the list of files to
   stage (code, tests, `specs/system/` — only the tweak's) and ask for approval
   (**AskUserQuestion tool**). If the user rejects or edits it, revise and ask again. Once
   approved, stage exactly those files and commit — one commit. If the tweak undoes a
   `reverted` decision in `DECISIONS.md`, append `Undone in <hash>.` to its Consequences
   ("Reviewing decisions" in `../../reference/decisions.md`).

   **Linked issue:** close it as "Closing a linked issue" in `../../reference/issue-tracker.md`
   says — a `Closes #N` trailer on a GitHub/GitLab commit, and in the same approval question
   the offer to comment and close it now.

8. **Summary** (last output)

   ```
   ## Tweak complete

   **Steps:** N/N, each test-first · **Tests:** <suite command> — <all green | no new failures>
   **System docs:** <files updated, "none needed", or "no specs/system/ — consider /spec:document-system">
   **Commit:** <hash> <message>
   ```

   If anything went sideways (a red Verify you didn't expect, a correction from the user, an
   escalation), add: "Run `/spec:retro` to turn that into a check."

**Escalate** (a limit broke): stop, and say which limit broke and what you learned. If code
was already written, list the files the tweak touched and ask (**AskUserQuestion tool**):
- **Commit what's done as a tweak** — only if every step so far is green and complete on its
  own: steps 6–7 for what exists, then propose the rest;
- **Hand it all to `/spec:propose`** — leave the files uncommitted and pass "already done:
  <files, tests>" in the proposal's input, so its plan builds on them.

Then offer `/spec:propose`, with the request, what you learned and the linked issue (if any)
as its input, marked as coming from an escalation (propose then doesn't offer the tweak
again, and links the issue instead of offering a tracking issue).

**Unattended, or inside an `/autonomous` run:** follow `../../reference/unattended.md`.
Specific to tweak: unattended it **doesn't commit** — it leaves its changes unstaged and lists
the files and the drafted commit message in the summary (on a dirty tree from step 1 it
continues; on escalation it stops and names it). Inside an `/autonomous` run it commits step 7
without asking and pushes.

**Guardrails**

- **Unattended runs** (no user to answer, or inside `/autonomous`): follow
  `../../reference/unattended.md`; log choices in `DECISIONS.md` in the format of
  `../../reference/decisions.md` (read it before the first entry).
- Tests first, always: no production code before its test has been seen failing (unless the
  step is `Test first: none — …`)
- Never make a test pass by weakening, skipping, deleting or mocking it without the user's
  explicit agreement
- Never create `specs/changes/<name>/` — a tweak that needs one is a change: escalate
- One commit, containing only the files the user approved in step 7
- Edit spec files with the Edit/Write tools, not sed/python in Bash, so the md2html lint hook
  sees every change
