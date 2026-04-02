---
name: propose
description: Propose a new change - create it and generate all artifacts in one step
disable-model-invocation: true
argument-hint: "[change-name or description]"
metadata:
  author: Till Gartner
---

Propose a new change - create the change and generate all artifacts in one step.

I'll create a change with artifacts:

- proposal.md (what & why)
- domain.md (new domain concepts)
- design.md (how)
- tasks.md (implementation steps)

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

1. **Ensure a system description exists**

   Check if `specs/system/` exists with at least `domain.md` and
   `architecture.md`.

   **If no system description exists:** Ask the user if you should create one
   now using `/spec:document-system`. Wait for their answer. If yes, invoke it
   before continuing. If no, proceed without.

1. **Create the change directory**

   Create the directory `spec/changes/<name>/`.

   If a change with that name already exists, ask if user wants to continue it
   or create a new one.

1. **Create artifacts in sequence**

   Use the **Task\* family of tools** to track progress through the artifacts.

   Create each artifact in order, since later artifacts depend on earlier ones:
   - **proposal.md** — What and why. Describe the change, its motivation, scope,
     and expected outcome. Read the codebase as needed to ground the proposal in
     reality.
   - **domain.md** - New findings about the domain we work on. New concepts,
     terms, processes, involved parties. Or changed concepts, terms, processes,
     parties
   - **design.md** — How. Read proposal.md for context first. Describe the
     technical approach, key decisions, tradeoffs considered, and integration
     points. Use Mermaid diagrams where they help clarify.
   - **tasks.md** — Implementation steps. Read proposal.md and design.md for
     context first. Break the design into concrete, ordered tasks as a checkbox
     list (`- [ ] task`). Each task should be small enough to implement in one
     step.

Show brief progress after each: "Created proposal.md", etc.

If an artifact requires user input (unclear context), use **AskUserQuestion
tool** to clarify, then continue.

1. **Show summary**

   After completing all artifacts, summarize:
   - Change name and location
   - List of artifacts created with brief descriptions
   - What's ready: "All artifacts created! Ready for implementation."
   - Prompt: "Run `/spec:apply` to start implementing."

**Guardrails**

- Create ALL four artifacts (proposal, domain, design, tasks)
- Always read earlier artifacts before creating later ones
- If context is critically unclear, ask the user — but prefer making reasonable
  decisions to keep momentum
- Verify each artifact file exists after writing before proceeding to next
