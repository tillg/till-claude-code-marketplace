---
description:
  Show the spec workflow overview — how explore, propose, apply, and archive fit
  together
disable-model-invocation: true
metadata:
  author: Till Gartner
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
   Creates `specs/changes/<name>/` with `proposal.md`, `domain.md`, `architecture.md`,
   and `plan.md`.
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
