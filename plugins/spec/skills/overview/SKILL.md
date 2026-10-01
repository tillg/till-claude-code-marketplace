---
description:
  Show the spec workflow overview and current status — where we are, what's next,
  and how mature the change is
disable-model-invocation: true
metadata:
  author: Till Gartner
---

Show the spec workflow overview and assess current status.

**Steps**

1. **Show plugin version and check for updates**

   Read the plugin's `plugin.json` (located in the `.claude-plugin/` directory
   of this plugin) and extract the `version` and `marketplace` fields.

   Display the installed version:
   > **spec** v6.1.0

   Then check for a newer version:
   - Use the `WebFetch` tool (or `curl` via Bash) to fetch the URL in the
     `marketplace` field of `plugin.json`.
   - Parse the returned JSON and find the entry where `name` matches this
     plugin's name.
   - Compare the remote `version` with the local `version`.

   **If a newer version is available:**
   > Update available: v6.1.0 → v6.2.0
   > Run `/plugin marketplace update <marketplace-name>` to update.

   **If up to date:** show nothing extra (no noise).

   **If the fetch fails** (offline, URL missing, etc.): silently skip the
   check — don't show an error, this is a nice-to-have.

2. **Assess active changes**

   List directories in `specs/changes/` (excluding `archive/`).

   **If no active change exists:** Report that and suggest next steps:
   > No active changes. Run `/spec:explore` to think through an idea, or
   > `/spec:propose` to start a new change.

   **If one or more active changes exist:**

   First, build a **summary table** of all active changes:

   | Change | Description | Phase | Next Step |
   |--------|-------------|-------|-----------|
   | `<name>` | 1-line summary from `proposal.md` | Phase with progress | Suggested action |

   The Phase column comes from the spec frontmatter (schema and status
   meanings in `../../reference/frontmatter.md`, relative to this skill's
   directory). Read the `status` key of every `.md` in the change
   directory:

   | `status` | Phase |
   |----------|-------|
   | `exploring` | Exploring |
   | `proposed` | Proposed (ready) |
   | `applying` | Applying (N/M, from `plan.md` checkboxes) |
   | `paused` | Paused (N/M) |
   | `applied` | Applied (ready to archive) |

   If the files disagree on `status` (or on `feature`, or `feature` ≠ the
   directory name), use the value most files carry; on a tie, the value of
   the tied file with the lowest `order` (the same rule md2html's lint and
   index use). Add a warning under the table, e.g.
   > ⚠ `add-x`: status mismatch — 3 files `applying`, plan.md `proposed`.
   > Run `/spec:iterate` or fix the frontmatter.

   Also warn if the status contradicts the checkboxes (e.g. `proposed` but
   `plan.md` has `[x]`, or `applying` with every step done).

   Count checkboxes mechanically, never by eye: N = `grep -c '^\s*- \[x\]' plan.md`,
   M = `grep -c '^\s*- \[[ x]\]' plan.md`.

   **Fallback** — if no file of the change has frontmatter (a legacy change),
   infer the phase from the files, as before, and mark it `(inferred)`:

   | Signal | Phase |
   |--------|-------|
   | No artifacts yet | Exploring |
   | `proposal.md` exists but no `architecture.md`/`plan.md` | Proposing (in progress) |
   | All artifacts exist, `plan.md` has no `[x]` checkboxes | Proposed (ready) |
   | `plan.md` has mix of `[ ]` and `[x]` | Applying (N/M) |
   | All `plan.md` checkboxes are `[x]` | Applied (ready to archive) |

   The Next Step column maps from the phase:
   - Exploring → `/spec:propose` to formalize
   - Proposing → Continue with `/spec:propose`
   - Proposed → `/spec:grill` to stress-test it, `/spec:iterate` after marking it up, or
     `/spec:apply` to start implementing
   - Applying → `/spec:apply` to continue
   - Paused → `/spec:apply` to resume
   - Applied → `/spec:adversarial-code-review`, then `/spec:archive` to wrap up

   An `applied` change whose files were last edited more than a few days ago
   gets a warning under the table: "⚠ `<name>` is done but not archived —
   `specs/system/` is out of date until you run `/spec:archive <name>`."

   Then, for each change, show a **detail block** below the table:

   a. **Read the artifacts** — Read whatever exists: `proposal.md`,
      `domain.md`, `architecture.md`, `plan.md`.

   b. **Summarize the change** — In 2 lines max: what is this change about and
      why is it being made?

   c. **Show the workflow with position** — Render the flow and mark where we
      are. Example:
      ```
      document-system → explore → propose → [grill | iterate] → apply ← YOU ARE HERE → adversarial-code-review → archive
      ```

   d. **Suggest what's next** — Based on the phase, recommend the natural next
      action. Examples:
      - "All artifacts look solid. Run `/spec:apply` to start implementing."
      - "3/7 steps done. Run `/spec:apply` to continue."
      - "All steps complete! Run `/spec:adversarial-code-review`, then
        `/spec:archive` to wrap up."

   e. **Give a maturity assessment** — Read through the artifacts and give an
      honest, brief judgement of how ready this change feels:
      - Are the artifacts thorough or thin?
      - Is the proposal clear about scope and motivation?
      - Does the architecture cover the key decisions and tradeoffs?
      - Is the plan concrete enough to implement step by step?
      - Is it test-first? Every step needs a `Test first:` and a `Verify:`
        line (format in `../../reference/plan.md`); a plan without them is
        at best **Almost there**.
      - Are there open questions, TODOs, or placeholders that need attention?

      Be direct. If it looks good, say so. If something feels undercooked,
      point it out specifically. Use a simple rating:

      - **Ready** — Artifacts are solid, no gaps, ready to move forward
      - **Almost there** — Minor gaps or questions, but workable
      - **Needs work** — Significant gaps, vague sections, or missing artifacts

3. **Check system description status**

   Check if `specs/system/` exists and contains files (at least `domain.md` or
   `architecture.md`).

   **If a system description exists:** Note it briefly:
   > System description: present (`specs/system/`)

   **If no system description exists:** Assess the codebase size to decide
   whether to suggest creating one:
   - Count source files and check for meaningful code (entry points, modules,
     configuration, dependencies, tests).
   - **If the codebase is substantial** (existing application with multiple
     modules, dependencies, config — a brownfield project): suggest running
     `/spec:document-system` to establish a shared foundation before making
     changes.
   - **If the codebase is minimal or empty** (greenfield project, just getting
     started): do NOT suggest creating a system description — there's nothing
     meaningful to document yet. Just note:
     > System description: not yet (project is just getting started — no need yet)

4. **Show the workflow reference**

   Display the reference section:

   ---

   # Spec Workflow

   A lightweight workflow for thinking through changes before implementing them.

   ```
   document-system → explore → propose → [grill | iterate] → apply → adversarial-code-review → archive
   ```

   `document-system` runs once per project; `explore` fits anywhere;
   `grill` and `iterate` are optional and repeatable; `view` opens the specs
   as HTML at any point.

   ## Skills

   | Skill                           | Purpose                                                                                       |
   | ------------------------------- | --------------------------------------------------------------------------------------------- |
   | `/spec:overview`                | Show status, phase, maturity and this reference                                               |
   | `/spec:document-system`         | Create a base description of the system                                                       |
   | `/spec:explore`                 | Think through ideas, investigate, clarify                                                     |
   | `/spec:propose`                 | Create a change with artifacts (proposal, domain, architecture, test-first plan)              |
   | `/spec:grill`                   | Get grilled on a change; answers are folded back into its artifacts (needs mattpocock-skills) |
   | `/spec:iterate`                 | Review artifacts, apply user annotations, and produce a clean consolidated version            |
   | `/spec:apply`                   | Implement the plan test-first: red → green → verify, then tick the step                       |
   | `/spec:adversarial-code-review` | Review the implementation along three axes: Defects, Standards, Spec                          |
   | `/spec:archive`                 | Run the tests, update the system description, commit, delete the change                       |
   | `/spec:view`                    | Open the change as HTML in the browser (needs the md2html plugin)                             |

   ## Typical Flow

   1. **Document** — Run `/spec:document-system` once to capture what the system is
      and does. This gives all other commands a shared foundation.
   1. **Explore** — Open-ended thinking. No code gets written. Read files, draw
      diagrams, compare approaches, question assumptions. Leave when you have
      clarity.
   1. **Propose** — Formalize a change: what, why, how, and the concrete plan.
      Creates `specs/changes/<name>/` with `proposal.md`, `domain.md`,
      `architecture.md`, and `plan.md`; every plan step names its test and
      verify command. If another change is still open, it suggests archiving
      that one first.
   1. **Grill** (optional, repeatable) — `/spec:grill` interviews you on the
      change until the open decisions are settled, and writes the answers into
      the artifacts.
   1. **Iterate** (optional, repeatable) — mark up the artifacts (`->`,
      `[ACCEPTED]`, `[REJECTED]`, comments); `/spec:iterate` folds the markup
      into a clean version. Going back to explore or propose is expected.
   1. **Apply** — Test-first, step by step: write the step's test, see it
      fail, write the code, run Verify and the full suite, then tick the
      step. Pause on blockers rather than guessing.
   1. **Review** — `/spec:adversarial-code-review` checks the implementation
      for defects, standards and fit with the spec.
   1. **Archive** — Run the tests, update the system description
      (`specs/system/`) to reflect everything this change introduced (domain,
      architecture, all perspectives), commit with a descriptive message, then
      delete the change directory and commit the cleanup.

   ## Artifacts

   Changes live in `specs/changes/<name>/` and contain:

   - **proposal.md** — What and why
   - **domain.md** — New domain concepts, vocabulary, processes
   - **architecture.md** — How
   - **plan.md** — Implementation steps (checkboxes), each with `Test first:`
     and `Verify:`

   Each file starts with spec frontmatter (`feature`, `title`, `status`,
   `order`, `created`, `edited`); `status` runs
   `exploring → proposed → applying → (paused) → applied`, and the change
   directory is deleted at archive.

   ---

5. **Format the output**

   ```
   ## Spec Overview

   **spec** v<version from plugin.json>

   ---

   ## Active Changes

   | Change | Description | Phase | Next Step |
   |--------|-------------|-------|-----------|
   | <name> | <summary>   | <phase> | <action> |

   ### <name>
   <2-line summary>

   **Phase:** <phase name>
   ```
   document-system → explore → propose → [grill | iterate] → apply ← HERE → adversarial-code-review → archive
   ```

   **Next:** <suggested action>

   **Maturity:** <Ready / Almost there / Needs work>
   <1-3 sentences explaining the assessment>

   ---

   ## System Description

   **System description:** [present / not yet / suggested]

   ---

   ## Workflow Reference

   [existing static reference block]
   ```

   When there are no active changes, the "Active Changes" section shows:

   ```
   No active changes. Run `/spec:explore` to think through an idea,
   or `/spec:propose` to start a new change.
   ```

**Guardrails**

- Lead with the active changes table — it's the most actionable information
- Read all available artifacts before making assessments — don't guess
- Be honest in the maturity assessment — a false "ready" wastes more time than
  a candid "needs work"
- Keep the change summary to 2 lines — this is an overview, not a deep dive
- If multiple changes exist, show status for each one
- Don't suggest `/spec:document-system` for greenfield projects — it's noise
  when there's barely any code
