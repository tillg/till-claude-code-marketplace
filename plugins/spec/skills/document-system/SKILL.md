---
description: "Document the system in its current state — domain, architecture, and all relevant perspectives."
disable-model-invocation: true
metadata:
  author: Till Gartner
---

Create a thorough documentation of the current system. This is the shared
foundation that all other spec skills build on.

The system description lives in `specs/system/` and captures what the system
**is** and **does** right now — not what it should become.

---

**Steps**

1. **Check for existing documentation**

   Check if `specs/system/` already exists. If it does, read all files in it to
   understand what's already documented.

   - If documentation exists: review it against the current codebase, update
     what's outdated, and fill gaps.
   - If no documentation exists: create it from scratch by exploring the
     codebase.

2. **Explore the codebase**

   Thoroughly investigate the project to understand:
   - What the system does (its purpose, who it serves)
   - How it's built (technologies, frameworks, patterns)
   - What domain it models (entities, processes, rules)
   - What it interacts with (external systems, APIs, services)

   Read configuration files, entry points, key modules, data models, and any
   existing documentation (README, comments, etc.).

3. **Create or update `specs/system/domain.md`**

   Document the domain the system models:

   - **Purpose** — What problem does this system solve? Who uses it?
   - **Vocabulary** — Domain-specific terms with clear definitions. These are
     the words the team uses when talking about the system.
   - **Concepts and entities** — The core things the system models and their
     relationships. Use Mermaid diagrams to visualize.
   - **Actors** — People, roles, and external systems that interact with the
     system. What can each actor do?
   - **Processes** — Key workflows and business processes. What triggers them?
     What are the steps? What are the outcomes?
   - **Rules and constraints** — Business rules, invariants, validation rules
     that the domain enforces.

4. **Create or update `specs/system/architecture.md`**

   Document how the system is built:

   - **Overview** — High-level architecture style (monolith, microservices,
     serverless, etc.). Use a Mermaid diagram to show the big picture.
   - **Technology stack** — Languages, frameworks, libraries, databases, and
     their roles.
   - **Components** — Major modules, services, or packages and what each is
     responsible for. How they communicate.
   - **Data** — How data is stored, what databases or stores are used, key data
     models and their relationships.
   - **System boundaries** — Where this system ends and others begin. APIs
     exposed, APIs consumed.
   - **External systems** — Third-party services, integrations, dependencies
     on other internal systems.
   - **Infrastructure** — How the system is deployed, hosted, and operated
     (if discoverable from the codebase).

5. **Create or update `specs/system/functional.md`**

   Document what the system does from a user's perspective — the capabilities
   it provides, independent of how they're implemented:

   - **Features** — The concrete things users can do. Group by area or module.
     For each feature: what it does, who uses it, and any notable behaviors.
   - **User journeys** — Key end-to-end flows that span multiple features.
     Use Mermaid sequence or flowchart diagrams to illustrate the most
     important ones.
   - **Inputs and outputs** — What data goes in, what comes out. Forms,
     uploads, reports, notifications, exports — document what the system
     accepts and produces.
   - **States and transitions** — Key entities that have lifecycle states
     (e.g., draft → published → archived). Use Mermaid state diagrams.
   - **Permissions and visibility** — What different user roles can see and
     do. Which features are gated behind roles, subscriptions, or flags.
   - **Edge cases and known limitations** — Documented or discovered limits,
     quotas, unsupported scenarios, and intentional omissions.

6. **Identify additional perspectives**

   If the codebase reveals other important aspects not covered by domain,
   architecture, and functional, create additional files in `specs/system/`.
   For example:

   - `security.md` — Authentication, authorization, data protection patterns
   - `api.md` — Public API surface, versioning, conventions
   - `data-model.md` — Detailed entity-relationship documentation

   Only create these if the codebase warrants it — don't force perspectives
   that aren't meaningful for this system.

7. **Present for review**

   Show the user a summary of what was documented:
   - Files created or updated
   - Key findings about the system
   - Any areas where information was unclear or assumptions were made

**Output**

```
## System Documentation Complete

**Location:** specs/system/

### Files
- domain.md — <brief summary>
- architecture.md — <brief summary>
- functional.md — <brief summary>

### Key Findings
- <notable discovery about the system>
- <notable discovery about the system>

### Assumptions / Gaps
- <anything unclear that the user should verify>
```

**Guardrails**

- Document what **is**, not what should be — this is a snapshot of the current
  system
- Ground everything in the actual codebase — don't speculate about things you
  can't find evidence for
- Use Mermaid diagrams wherever they help clarify structure or flow
- Flag assumptions clearly — if you're unsure about something, say so
- Keep vocabulary definitions precise — these terms become the shared language
  for all spec artifacts
- Don't duplicate what's already in a README — reference it instead
- When updating existing documentation, preserve information that's still
  accurate and note what changed
