---
description: Use when reviewing implemented code for bugs, regressions, edge cases, race conditions, and plan drift. Prioritizes findings over summaries and is useful after a story, before completion, or across an epic.
metadata:
  author: Till Gartner
---

# Adversarial Code Review

Review code with a hostile mindset. Assume something is wrong and try to find it.

Use this after implementation work, especially before `complete-story` or during `complete-epic`.

## Scope

Start from the actual change:

- current `git diff`
- staged diff if present
- branch diff against `main` when relevant

Then inspect the touched files and any directly connected code paths.

## What to Look For

### Behavioral Regressions

- changed semantics behind existing APIs or UI flows
- missing updates in callers after a model or DTO change
- routes, queries, or mutation flows no longer aligned

### Edge Cases

- empty or null inputs
- deleted or missing related entities
- duplicate submissions
- stale data or race windows
- partial update paths

### State And Consistency

- invalid transitions
- src/backend/frontend enum drift
- schema or persistence assumptions not reflected in code
- data changes that forgot `src/db/schema.sql` or `CURRENT_DATABASE.md`

### Review Against Plan

- planned work missing
- unplanned work added
- shortcuts that weaken correctness or test coverage

### Security Concerns

If you find likely security issues, include a `Security Concerns` section so the workflow can trigger `security-review`.

## Output

Findings first, ordered by severity:

```text
[CRITICAL/HIGH/MEDIUM/LOW] Short description
File: path/to/file:line
Risk: What breaks or regresses
Fix: What to change
```

Then, if relevant:

```text
Security Concerns:
- <concern 1>
- <concern 2>
```

If no findings exist:

```text
No findings — adversarial code review passed.
```

## Review Rules

- focus on defects, not style nits
- prefer concrete exploit or failure paths
- call out missing tests when they hide real behavioral risk
- keep summaries brief and secondary to findings
