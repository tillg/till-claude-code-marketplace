---
description: Propose a new change - create it and generate all artifacts in one step
disable-model-invocation: true
argument-hint: "[change-name or description]"
metadata:
  author: Till Gartner
---

Propose a new change - create the change and generate all artifacts in one step.

First I check for changes still open in `specs/changes/` and suggest
archiving them before starting a new one. Then I create a change with
artifacts:

- proposal.md (what & why)
- domain.md (new domain concepts)
- architecture.md (how)
- plan.md (test-first implementation steps)

Then I open the change as HTML in your browser (same as `/spec:view`).

When ready to implement, run /spec:apply

---

**Input**: The argument after `/spec:propose` is the change name (kebab-case),
OR a description of what the user wants to build.

**Steps**

1. **If no input provided, ask what they want to build**

   Use the **AskUserQuestion tool** (open-ended, no preset options) to ask:

   > "What change do you want to work on? Describe what you want to build or
   > fix."

   From their description, derive a kebab-case name (e.g., "add user
   authentication" → `add-user-auth`).

   **IMPORTANT**: Do NOT proceed without understanding what the user wants to
   build.

1. **Check for work in progress**

   List the directories in `specs/changes/` (excluding `archive/`) other than
   the one being proposed, and read each one's `status` (majority rule, see
   "When the files disagree" in `../../reference/frontmatter.md`; no frontmatter → infer as
   `/spec:overview` does).

   **If none:** continue.

   **If any exist**, show them (name · status · `N/M` steps) and recommend
   finishing them first — a new proposal is built on `specs/system/`, and
   that is only current once earlier changes are archived:
   - `applied` → "`<x>` is done but not archived. Archive it first so the new
     proposal builds on an up-to-date system description."
   - `applying` / `paused` / `proposed` / `exploring` → "`<x>` is still in
     progress (`<status>`). Finish it and archive it first, or work on both
     in parallel?"

   Ask with the **AskUserQuestion tool**:
   - **Archive `<x>` first (Recommended)** (offer only for an `applied`
     change) — read `../archive/SKILL.md` and follow it for `<x>`, then
     continue here.
   - **Stop here** — finish the open change first.
   - **Continue anyway** — propose in parallel.

   If running unattended: don't archive (it commits and deletes), continue,
   and name the open changes in the summary.

1. **Ensure a system description exists**

   Check if `specs/system/` exists with at least `domain.md` and
   `architecture.md`.

   **If no system description exists:** Ask the user if you should create one
   now using `/spec:document-system`. Wait for their answer. If yes, invoke it
   before continuing. If no, proceed without.

1. **Create the change directory**

   Create the directory `specs/changes/<name>/`.

   If a change with that name already exists, ask if user wants to continue it
   or create a new one.

1. **Create artifacts in sequence**

   Use the **Task\* family of tools** to track progress through the artifacts.

   Create each artifact in order, since later artifacts depend on earlier ones:
   - **proposal.md** — What and why. Describe the change, its motivation, scope,
     and expected outcome. Read the codebase as needed to ground the proposal in
     reality. Use Mermaid diagrams to illustrate scope or impact where helpful.
   - **domain.md** — New findings about the domain we work on. New concepts,
     terms, processes, involved parties. Or changed concepts, terms, processes,
     parties. Use Mermaid diagrams to visualize entity relationships, process
     flows, or actor interactions.
   - **architecture.md** — How. Read proposal.md for context first. Describe the
     technical approach, key decisions, tradeoffs considered, and integration
     points. Use Mermaid diagrams for component interactions, data flows, and
     sequence diagrams.
   - **plan.md** — Implementation steps, test-first. Read proposal.md and
     architecture.md for context first. Break the architecture into concrete,
     ordered checkbox steps in the format of `../../reference/plan.md`
     (relative to this skill's directory; read it now): every step names the
     test written before its code (`Test first:`) and the command that proves
     it done (`Verify:`). Each step is small enough for one red → green
     cycle. No step for updating `specs/system/*` — that's `/spec:archive`'s
     job; the plan ends with the plain note (not a checkbox): "System docs
     are updated at `/spec:archive`."

   Every artifact starts with spec frontmatter (see **Spec frontmatter** below),
   `status: proposed`, `order` 1–4 in the sequence above. Keep the body's own
   `# Title` heading.

Show brief progress after each: "Created proposal.md", etc.

If an artifact requires user input (unclear context), use **AskUserQuestion
tool** to clarify, then continue. If running unattended (no user to answer), make a
sensible choice, note it, and continue.

1. **Open the HTML view (runs `/spec:view` for this change)**

   Read `../view/SKILL.md` (next to this skill's directory) and follow its
   steps 1–6 with the new change name as the argument. That builds the `.html`
   files of the change and the project index, reuses (or starts) the
   project's watcher and server, and opens the change's first page in the
   browser. Skip view's step 7 report: its details go into the summary below.

   If md2html ≥ 0.3.0 isn't available (view step 1 stops), don't fail the
   proposal: the summary says the HTML view needs md2html ≥ 0.3.0 and that
   `/spec:view` sets it up once it is installed.

1. **Show summary** (always the last output)

   After completing all artifacts and the HTML view, summarize:
   - Change name and location
   - List of artifacts created with brief descriptions
   - HTML view: the URL that was opened, the watcher and server PIDs (marked
     "reused" where they were) and the stop command — or the one line on why
     there is no HTML view
   - What's ready: "All artifacts created! Ready for implementation."
   - Last line, always: "Run `/spec:apply` to start implementing."

**Spec frontmatter**

The schema — keys, allowed `status` values and what each means in reality —
is defined once in `../../reference/frontmatter.md` (relative to this skill's
directory). Read it before writing the first artifact. In short, every `.md`
in a change directory starts with:

```yaml
---
feature: <change-name>
title: "<Artifact>: <short title>"
status: proposed
order: 1
created: YYYY-MM-DD
edited: YYYY-MM-DD
---
```

**Guardrails**

- Create ALL four artifacts (proposal, domain, architecture, plan)
- Always read earlier artifacts before creating later ones
- If context is critically unclear, ask the user — but prefer making reasonable
  decisions to keep momentum
- If running unattended (no user to answer), make a sensible choice, note it,
  and continue.
- Edit spec files with the Edit/Write tools, not sed/python in Bash, so the
  md2html lint hook sees every change
- Verify each artifact file exists after writing before proceeding to next
- Every plan step has a `Test first:` and a `Verify:` line — a plan without
  them isn't proposed yet
- Don't start a new change silently while another is open — say so and
  recommend archiving it first
- Every artifact carries spec frontmatter with `feature: <name>` and
  `status: proposed`; when continuing an existing change at `exploring`, move
  all its files to `proposed` (never downgrade `applying`/`paused`/`applied`)
- Use Mermaid diagrams liberally — they are the preferred format for all
  diagrams in spec artifacts
