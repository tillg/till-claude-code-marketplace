---
description: Use when reviewing implemented code for bugs, regressions, edge cases, race conditions, and plan drift. Reviews the diff since a fixed point along three separate axes — Defects, Standards (repo coding standards plus a code-smell baseline) and Spec (does it match the spec change?) — in parallel sub-agents, findings first. Useful after /spec:apply and before /spec:archive, across several changes, or for "review since X".
argument-hint: "[fixed-point] [change-name]"
metadata:
  author: Till Gartner
---

# Adversarial Code Review

Review code with a hostile mindset. Assume something is wrong and try to find it.

Use this after `/spec:apply` has ticked the plan and before `/spec:archive` folds the change into
`specs/system/` — or with a fixed point to review several changes at once.

The review runs along three axes, each in its own sub-agent so they don't pollute each other's context:

- **Defects**: bugs, regressions, edge cases, state and security problems.
- **Standards**: does the code follow this repo's documented coding standards (plus the smell baseline)?
- **Spec**: does the code faithfully implement the spec change it belongs to?

## 1. Pin the scope

**Input**: optionally a fixed point (commit SHA, branch, tag, `main`, `HEAD~5`, …) and a change name
(e.g. `/spec:adversarial-code-review main add-auth`).

- With a fixed point: the diff is `git diff <fixed-point>...HEAD` (three-dot, against the
  merge-base); note the commits with `git log <fixed-point>..HEAD --oneline`.
- Without one, start from the actual change: the current `git diff`, the staged diff if
  present, and the branch diff against `main` when relevant.

Confirm the fixed point resolves (`git rev-parse <fixed-point>`) and the diff is non-empty
before spawning anything. A bad ref or an empty diff should fail here, not inside three
sub-agents.

Each sub-agent then inspects the touched files and any directly connected code paths.

## 2. Find the spec and the standards

**Spec source**, in this order:

1. The change name passed as an argument: `specs/changes/<name>/` (`proposal.md`,
   `domain.md`, `architecture.md`, `plan.md` with its `Test first:` / `Verify:` lines, plus
   any other files there), plus the change's entries in `DECISIONS.md` at the project root
   (choices made unattended — check the code matches them).
2. The active change in `specs/changes/` matching the branch name or the touched area; if
   exactly one change is active, use it.
3. Issue references in the commit messages (`#123`, `Closes #45`, …) or a spec path the user
   gave.
4. Nothing found: ask the user. If there is no spec, skip the Spec axis and say "no spec
   available" in the report. If running unattended, skip it without asking and log that in
   `DECISIONS.md` (format: `../../reference/decisions.md`).

**Standards sources**: anything in the repo that documents how code should be written, such
as `CODING_STANDARDS.md`, `CONTRIBUTING.md`, `CLAUDE.md`, `AGENTS.md`, linter configs'
documented rules, `specs/system/architecture.md`, the vocabulary in `specs/system/domain.md`
and the change's `domain.md` (names in code should use those terms), and the test-first rules
in `../../reference/plan.md` (relative to this skill's directory).

On top of whatever the repo documents, the Standards axis always carries the **smell
baseline** below: a fixed set of Fowler code smells (_Refactoring_, ch. 3) that applies even
when a repo documents nothing. Two rules bind it:

- **The repo overrides.** A documented repo standard always wins; where it endorses
  something the baseline would flag, suppress the smell.
- **Always a judgement call.** Each smell is a labelled heuristic ("possible Feature Envy"),
  never a hard violation. Like any standard here, skip anything tooling already enforces.

Each smell reads *what it is* → *how to fix*; match it against the diff:

- **Mysterious Name**: a function, variable, or type whose name doesn't reveal what it does
  or holds. → rename it; if no honest name comes, the design's murky.
- **Duplicated Code**: the same logic shape appears in more than one hunk or file in the
  change. → extract the shared shape, call it from both.
- **Feature Envy**: a method that reaches into another object's data more than its own. →
  move the method onto the data it envies.
- **Data Clumps**: the same few fields or params keep travelling together (a type wanting to
  be born). → bundle them into one type, pass that.
- **Primitive Obsession**: a primitive or string standing in for a domain concept that
  deserves its own type. → give the concept its own small type.
- **Repeated Switches**: the same `switch`/`if`-cascade on the same type recurs across the
  change. → replace with polymorphism, or one map both sites share.
- **Shotgun Surgery**: one logical change forces scattered edits across many files in the
  diff. → gather what changes together into one module.
- **Divergent Change**: one file or module is edited for several unrelated reasons. → split
  so each module changes for one reason.
- **Speculative Generality**: abstraction, parameters, or hooks added for needs the spec
  doesn't have. → delete it; inline back until a real need shows.
- **Message Chains**: long `a.b().c().d()` navigation the caller shouldn't depend on. → hide
  the walk behind one method on the first object.
- **Middle Man**: a class or function that mostly just delegates onward. → cut it, call the
  real target direct.
- **Refused Bequest**: a subclass or implementer that ignores or overrides most of what it
  inherits. → drop the inheritance, use composition.

## 3. Spawn the three sub-agents in parallel

Give every sub-agent the diff command and the commit list (or the working-tree diff).

**Defects sub-agent**: the checklist below, and the brief: "Find defects in this diff and the
code paths it touches. Report each as `[CRITICAL/HIGH/MEDIUM/LOW] Short description / File:
path:line / Risk: what breaks / Fix: what to change`, ordered by severity. Prefer concrete
failure paths. Add a `Security Concerns` list if relevant."

- **Behavioral regressions**: changed semantics behind existing APIs or UI flows; missing
  updates in callers after a model or DTO change; routes, queries, or mutation flows no
  longer aligned.
- **Edge cases**: empty or null inputs; deleted or missing related entities; duplicate
  submissions; stale data or race windows; partial update paths.
- **State and consistency**: invalid transitions; the same enum or constant defined in
  several places drifting apart; schema or persistence assumptions not reflected in code;
  changes to data shapes, config or a public interface whose schema, migration, fixtures or
  user-facing docs (README, …) weren't updated with it. Don't flag `specs/system/` — it is
  updated at `/spec:archive`.
- **Tests**: missing tests where they hide real behavioral risk; tests that can't fail
  (assert nothing, or mock the very thing under test); the suite not green.
- **Security**: likely security issues, listed under `Security Concerns` so they can be
  followed up with `/security-review`.

**Standards sub-agent**: the standards-source files from step 2, **plus the smell baseline
pasted in full** (it has no other access to it), and the brief: "Report, per file/hunk where
relevant, (a) every place the diff violates a documented standard: cite the standard (file +
the rule); and (b) any baseline smell you spot: name it and quote the hunk. Distinguish hard
violations from judgement calls: documented-standard breaches can be hard, but baseline
smells are always judgement calls, and a documented repo standard overrides the baseline.
Skip anything tooling enforces. Under 400 words."

**Spec sub-agent** (skip if there is no spec): the spec paths (or fetched issue contents), and
the brief: "Report: (a) requirements or plan steps that are missing or partial; (b) behaviour
in the diff that wasn't asked for (scope creep); (c) requirements that look implemented but
where the implementation looks wrong; (d) shortcuts that weaken correctness or test coverage
compared with the plan; (e) test-first gaps: a ticked step whose `Test first:` test is
missing, doesn't assert the step's behavior, or doesn't pass, and a step whose `Verify:`
command fails when you run it. Quote the spec or plan line for each finding. Under 400
words."

## 4. Report

Present the three reports under `## Defects`, `## Standards` and `## Spec`, verbatim or
lightly cleaned. Do **not** merge or rerank findings across axes (see _Why separate axes_).
Defects stay ordered by severity:

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

End with a one-line summary: findings per axis and the worst issue *within each axis*. Don't
pick a single winner across axes.

If no axis has findings:

```text
No findings — adversarial code review passed.
```

## Why separate axes

A change can pass one axis and fail another:

- Code that follows every standard but implements the wrong thing → **Standards pass, Spec
  fail.**
- Code that does exactly what the spec asked but breaks the project's conventions → **Spec
  pass, Standards fail.**
- Code that is on-spec and idiomatic but crashes on an empty list → **only Defects catches
  it.**

Reporting them separately stops one axis from masking another.

## Review Rules

- Defects: focus on defects, not style nits; prefer concrete exploit or failure paths
- Standards: style and smells belong here, labelled as judgement calls unless a documented
  rule is broken
- call out missing tests when they hide real behavioral risk
- keep summaries brief and secondary to findings
- the review is read-only: report, don't fix
