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
   > **spec** v6.0.0

   Then check for a newer version:
   - Use the `WebFetch` tool (or `curl` via Bash) to fetch the URL in the
     `marketplace` field of `plugin.json`.
   - Parse the returned JSON and find the entry where `name` matches this
     plugin's name.
   - Compare the remote `version` with the local `version`.

   **If a newer version is available:**
   > Update available: v6.0.0 → v6.1.0
   > Run `/plugin marketplace update <marketplace-name>` to update.

   **If up to date:** show nothing extra (no noise).

   **If the fetch fails** (offline, URL missing, etc.): silently skip the
   check — don't show an error, this is a nice-to-have.

2. **Show the workflow reference**

   Always start by displaying this reference section:

   ---

   # Spec Workflow

   A lightweight workflow for thinking through changes before implementing them.

   ```
   explore → [iterate] → propose → apply → archive
   ```

   ## Skills

   | Skill                   | Purpose                                                                                   |
   | ----------------------- | ----------------------------------------------------------------------------------------- |
   | `/spec:document-system` | Create a base description of the system                                                   |
   | `/spec:explore`         | Think through ideas, investigate, clarify                                                 |
   | `/spec:propose`         | Create a change with artifacts (proposal, architecture, plan)                             |
   | `/spec:iterate`         | Review artifacts, apply user annotations, and produce a clean consolidated version         |
   | `/spec:apply`           | Implement the plan from a change                                                          |
   | `/spec:archive`         | Archive a completed change                                                                |

   ## Typical Flow

   1. **Document** — Run `/spec:document-system` once to capture what the system is
      and does. This gives all other commands a shared foundation.
   1. **Explore** — Open-ended thinking. No code gets written. Read files, draw
      diagrams, compare approaches, question assumptions. Leave when you have
      clarity.
   1. **Iterate** — Exploration and proposing often alternate. You may explore,
      propose, then re-explore when new questions surface. This is expected.
   1. **Propose** — Formalize a change: what, why, how, and the concrete plan.
      Creates `specs/changes/<name>/` with `proposal.md`, `domain.md`,
      `architecture.md`, and `plan.md`.
   1. **Apply** — Work through the plan, marking each step done. Pause on blockers
      rather than guessing.
   1. **Archive** — Verify readiness, update the system description
      (`specs/system/`) to reflect everything this change introduced (domain,
      architecture, all perspectives), commit with a descriptive message, then
      delete the change directory and commit the cleanup.

   ## Artifacts

   Changes live in `specs/changes/<name>/` and contain:

   - **proposal.md** — What and why
   - **domain.md** — New domain concepts, vocabulary, processes
   - **architecture.md** — How
   - **plan.md** — Implementation steps (checkboxes)

   ---

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

4. **Assess the current change**

   List directories in `specs/changes/` (excluding `archive/`).

   **If no active change exists:** Report that and suggest next steps:
   > No active change. Run `/spec:explore` to think through an idea, or
   > `/spec:propose` to start a new change.

   **If one or more active changes exist:** For each change:

   a. **Read the artifacts** — Read whatever exists: `proposal.md`,
      `domain.md`, `architecture.md`, `plan.md`.

   b. **Summarize the change** — In 2 lines max: what is this change about and
      why is it being made?

   c. **Determine the current phase** — Based on which artifacts exist and their
      state, figure out where this change is in the workflow:

      | Signal | Phase |
      |--------|-------|
      | No artifacts yet | Exploring |
      | `proposal.md` exists but no `architecture.md`/`plan.md` | Proposing (in progress) |
      | All artifacts exist, `plan.md` has no `[x]` checkboxes | Proposed (ready to apply) |
      | `plan.md` has mix of `[ ]` and `[x]` | Applying (in progress) |
      | All `plan.md` checkboxes are `[x]` | Applied (ready to archive) |

   d. **Show the workflow with position** — Render the flow and mark where we
      are. Example:
      ```
      explore → propose → apply ← YOU ARE HERE → archive
      ```

   e. **Suggest what's next** — Based on the phase, recommend the natural next
      action. Examples:
      - "All artifacts look solid. Run `/spec:apply` to start implementing."
      - "3/7 steps done. Run `/spec:apply` to continue."
      - "All steps complete! Run `/spec:archive` to wrap up."

   f. **Give a maturity assessment** — Read through the artifacts and give an
      honest, brief judgement of how ready this change feels:
      - Are the artifacts thorough or thin?
      - Is the proposal clear about scope and motivation?
      - Does the architecture cover the key decisions and tradeoffs?
      - Is the plan concrete enough to implement step by step?
      - Are there open questions, TODOs, or placeholders that need attention?

      Be direct. If it looks good, say so. If something feels undercooked,
      point it out specifically. Use a simple rating:

      - **Ready** — Artifacts are solid, no gaps, ready to move forward
      - **Almost there** — Minor gaps or questions, but workable
      - **Needs work** — Significant gaps, vague sections, or missing artifacts

5. **Format the output**

   ```
   ## Spec Overview

   **spec** v<version from plugin.json>

   [workflow reference from step 2]

   ---

   ## Current Status

   **System description:** [present / not yet / suggested]

   ### Change: <name>
   <2-line summary>

   **Phase:** <phase name>
   ```
   explore → propose ← HERE → apply → archive
   ```

   **Next:** <suggested action>

   **Maturity:** <Ready / Almost there / Needs work>
   <1-3 sentences explaining the assessment>
   ```

**Guardrails**

- Always show the workflow reference first — it's useful even when there's no
  active change
- Read all available artifacts before making assessments — don't guess
- Be honest in the maturity assessment — a false "ready" wastes more time than
  a candid "needs work"
- Keep the change summary to 2 lines — this is an overview, not a deep dive
- If multiple changes exist, show status for each one
- Don't suggest `/spec:document-system` for greenfield projects — it's noise
  when there's barely any code
