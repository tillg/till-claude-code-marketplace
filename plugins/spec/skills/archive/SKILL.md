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

   If no change name provided, list directories in `spec/changes/` (excluding
   `archive/`). Use the **AskUserQuestion tool** to let the user select.

   **IMPORTANT**: Do NOT guess or auto-select a change. Always let the user
   choose.

2. **Check readiness**

   a. **Check artifacts exist.** Read the change's directory
      `spec/changes/<name>/` and verify the expected files are present
      (`proposal.md`, `design.md`, `tasks.md`, and optionally `domain.md`).

      If any are missing, warn the user and ask for confirmation to continue.

   b. **Check task completion.** Read `tasks.md` and count `- [ ]` (incomplete)
      vs `- [x]` (complete).

      If incomplete tasks remain, display a warning with the count and ask for
      confirmation to continue.

      If no `tasks.md` exists, proceed without warning.

3. **Ensure a system description exists**

   Check if `specs/system/` exists with at least `domain.md` and
   `architecture.md`.

   **If no system description exists:** Ask the user if you should create one
   now using `/spec:document-system`. Wait for their answer. If yes, invoke it
   before continuing. If no, proceed without.

4. **Update the system description**

   Read all artifacts from the change (`proposal.md`, `domain.md`, `design.md`,
   `tasks.md`) and the current system description files in `specs/system/`.

   Update **every relevant perspective** of the system description to reflect
   what this change introduced:

   - **domain.md** — New or changed domain concepts, vocabulary, processes,
     actors, roles
   - **architecture.md** — New components, changed interactions, updated system
     boundaries, technology additions
   - **Any other files in `specs/system/`** — Update whatever is relevant. If
     the change touches aspects not yet captured, add them.

   Use Mermaid diagrams to visualize new or changed structures, flows, and
   relationships. Update existing diagrams in the system description if this
   change alters them.

   The goal: after archiving, the system description fully reflects the current
   state of the system including this change. Don't leave knowledge only in the
   archived change artifacts.

5. **Prepare commit and suggest to the user**

   Draft a concise, descriptive commit message summarizing what this change
   accomplished (not the archive action, but the actual work). For example:

   > Add role-based access control with JWT authentication

   Present the commit message to the user and suggest they commit now. Use the
   **AskUserQuestion tool** to confirm. Wait for approval before proceeding.

   Once approved, stage and commit all current changes (implementation code +
   updated system description).

6. **Delete the change**

   Remove the change directory:
   ```bash
   rm -rf spec/changes/<name>
   ```

   Then commit again with the same message appended with
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
   ```

**Guardrails**

- Always prompt for change selection if not provided
- Don't block archive on readiness warnings — just inform and confirm
- Always update the system description before committing — don't leave
  knowledge stranded in change artifacts
- Never commit without the user's approval of the commit message
- The first commit includes all implementation work and system description
  updates; the second commit only removes the change directory
- Use Mermaid as the preferred format for all diagrams in the system description
