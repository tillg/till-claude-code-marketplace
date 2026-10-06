---
description: Archive a completed spec change
disable-model-invocation: true
argument-hint: "[change-name]"
metadata:
  author: Till Gartner
---

Archive a completed change. This updates the system description, commits the
work, then cleans up.

**Input**: Optionally specify a change name after `/spec:archive` (e.g.,
`/spec:archive add-auth`). If omitted, check if it can be inferred from
conversation context. If vague or ambiguous you MUST prompt for available
changes.

**Steps**

1. **Select the change**

   If no change name provided, list directories in `specs/changes/`. Use the **AskUserQuestion tool** to let the user select.

   **IMPORTANT**: Do NOT guess or auto-select a change. Always let the user
   choose.

2. **Check readiness**

   a. **Check artifacts exist.** Read the change's directory
      `specs/changes/<name>/` and verify the expected files are present
      (`proposal.md`, `architecture.md`, `plan.md`, and optionally `domain.md`).

      If any are missing, warn the user and ask for confirmation to continue.

   b. **Check task completion.** Read `plan.md` and count `- [ ]` (incomplete)
      vs `- [x]` (complete).

      If incomplete steps remain, display a warning with the count and ask for
      confirmation to continue.

      If no `plan.md` exists, proceed without warning.

   c. **Run the tests.** Run the project's full test suite and every
      `Verify:` command in `plan.md`. Show the result. If anything fails,
      say what, and recommend fixing it (`/spec:apply`) before archiving;
      continue only if the user explicitly confirms. Archiving records the
      change as part of the system — it should be green.

   d. **Review the change's decisions.** If `DECISIONS.md` exists at the
      project root, read "Reviewing decisions" in `../../reference/decisions.md`
      (which decisions are the change's, the review flow, pending reverts),
      then run the review flow over the change's `open` decisions.

      **Gate:** don't archive while any of the change's decisions is still
      `open` (skipped or "Stop reviewing") or a **pending revert**
      (`reverted` without `Undone in …`). Stop, name what has to be undone
      and how (`/spec:tweak` or `/spec:apply`), and say to run
      `/spec:archive` again. This gate is not a readiness warning: "archive
      anyway" does not pass it.

      Open decisions that are **not** the change's: report the count ("N
      other open decisions — `/spec:overview` offers to review them"). They
      don't block.

      **Inside an `/autonomous` run** (rules: `../../reference/unattended.md`):
      skip the questions and the gate; the change's decisions stay `open` and
      are listed (id and title) in the step-5 commit body and the run's report.
      Log archiving past the gate once per run as an `Overrides` decision. Don't
      archive at all if an artifact is missing (2a), a step is unticked (2b) or
      the suite or a `Verify:` is red (2c) — log it and leave the change open.

3. **Ensure a system description exists**

   Check if `specs/system/` exists with at least `domain.md` and
   `architecture.md`.

   **If no system description exists:** Ask the user if you should create one
   now using `/spec:document-system`. Wait for their answer. If yes, invoke it
   before continuing. If no, proceed without. Inside an `/autonomous` run,
   create it (follow `../document-system/SKILL.md`) and log that
   (`../../reference/unattended.md`).

4. **Update the system description**

   Read all artifacts from the change (`proposal.md`, `domain.md`, `architecture.md`,
   `plan.md`) and the current system description files in `specs/system/`.

   Update **every relevant perspective** of the system description to reflect
   what this change introduced:

   - **domain.md** — New or changed domain concepts, vocabulary, processes,
     actors, roles
   - **architecture.md** — New components, changed interactions, updated system
     boundaries, technology additions
   - **functional.md** — New or changed features, user journeys, states,
     permissions, inputs/outputs
   - **Any other files in `specs/system/`** — Update whatever is relevant. If
     the change touches aspects not yet captured, add them.

   Use Mermaid diagrams to visualize new or changed structures, flows, and
   relationships. Update existing diagrams in the system description if this
   change alters them.

   **Frontmatter:** see `../../reference/frontmatter.md` (relative to this skill's directory). When carrying content into `specs/system/`,
   never copy `feature`, `status` or `order` — system docs keep only
   `title`, `created`, `edited`; set `edited` to today on every system file
   you touch.

   The goal: after archiving, the system description fully reflects the current
   state of the system including this change. Don't leave knowledge only in the
   archived change artifacts.

   **Promote lasting decisions.** Promote the change's `confirmed` decisions
   as "Promotion" in `../../reference/decisions.md` says (which ones, into
   `docs/adr/` or a **Key decisions** table, link back, `Promoted to …`).

5. **Prepare commit and suggest to the user**

   Draft a concise, descriptive commit message summarizing what this change
   accomplished (not the archive action, but the actual work). For example:

   > Add role-based access control with JWT authentication

   Present the commit message to the user and suggest they commit now. Use the
   **AskUserQuestion tool** to confirm. Wait for approval before proceeding.

   Once approved, stage and commit all current changes (implementation code +
   updated system description).

   **Inside an `/autonomous` run** the standing permission is the approval —
   don't ask, and commit, stage and close as `../../reference/unattended.md`
   says. The change's own files here are: the files its steps touched,
   `specs/changes/<name>/` (so its artifacts reach git history before step 6
   deletes them), `specs/system/`, `DECISIONS.md` and any ADR from step 4.

   **Linked issue** (an `**Issue:**` line under the proposal's heading): close
   it as "Closing a linked issue" in `../../reference/issue-tracker.md` says —
   a `Closes #N` trailer on the GitHub/GitLab commit message, and in the same
   approval question the offer to comment and close it now. The cleanup
   commit (step 6) appends ` - cleaned from change` to the subject line only,
   without the trailer.

6. **Delete the change**

   First make sure `specs/changes/<name>/` is in git history
   (`git log --oneline -1 -- specs/changes/<name>/` shows a commit, and
   `git status --porcelain specs/changes/<name>/` is empty) — if not, stop:
   deleting it would lose the artifacts. Then remove the change directory:
   ```bash
   rm -rf specs/changes/<name>
   ```

   Stage only that deletion (`git add -A specs/changes/<name>`) and commit with the same message appended with
   ` - cleaned from change`. For example:

   > Add role-based access control with JWT authentication - cleaned from change

7. **Display summary**

   ```
   ## Archive Complete

   **Change:** <change-name>

   ### Commits
   1. <commit message> — implementation + system description update
   2. <commit message> - cleaned from change

   ### System Description Updated
   - specs/system/domain.md — <brief summary of updates>
   - specs/system/architecture.md — <brief summary of updates>
   - specs/system/functional.md — <brief summary of updates>

   Next: `/spec:retro <change-name>` — turn what went wrong into checks
   ```

**Guardrails**

- Always prompt for change selection if not provided
- Don't block archive on readiness warnings — just inform and confirm (a
  failing test suite needs an explicit "archive anyway"). The decision gate
  (2d) is the exception: it blocks
- Always update the system description before committing — don't leave
  knowledge stranded in change artifacts
- Never commit without the user's approval of the commit message (inside an
  `/autonomous` run: its standing permission, and only the change's files)
- The first commit includes all implementation work and system description
  updates; the second commit only removes the change directory
- Use Mermaid as the preferred format for all diagrams in the system description
- Edit spec files with the Edit/Write tools, not sed/python in Bash, so the
  md2html lint hook sees every change
