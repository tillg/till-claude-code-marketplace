# Decisions log (`DECISIONS.md`)

When a spec skill runs **unattended** (no user to answer) and has to make a choice it would
normally ask about, it records that choice in `DECISIONS.md` at the **project root** (the git
root). One file per project, shared by all changes, so the user can review every choice made
without them in one place.

Interactive runs don't write here: the user answered, and the answer lands in the artifacts.

## What goes in

A choice that the user would otherwise have been asked about, or that the artifacts leave
open:

- an unclear plan step and how it was read
- picking one option where the architecture names several (or none)
- a change selected by inference instead of by the user
- a check skipped (e.g. the Spec axis of a review with no spec)
- an open change left in place when proposing a new one

Not: routine work the plan already spells out.

## Format

Create the file with a `# Decisions` heading if it is missing. Append new entries at the end,
never rewrite old ones (except their `Status`).

```markdown
## 2026-10-02 · add-auth · /spec:apply step 3

- **Question:** Store sessions in Redis or Postgres? `architecture.md` names no store.
- **Chose:** Postgres — already a dependency, one less service.
- **Alternatives:** Redis
- **Status:** open
```

| Field | Content |
|---|---|
| heading | ISO date · change name (or `—`) · skill and step |
| Question | what had to be decided, and why the artifacts didn't settle it |
| Chose | the choice and a one-line reason |
| Alternatives | the options not taken |
| Status | `open` when written; the user changes it to `confirmed` or `reverted` after review |

## After the run

The skill's final summary lists the entries it added ("2 decisions logged in
`DECISIONS.md`"). A choice that turns out to matter for the change is also written into the
change's artifacts (usually `architecture.md`, Key decisions) once the user confirms it.
