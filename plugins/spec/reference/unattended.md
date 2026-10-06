# Unattended runs and `/autonomous`

The one place for how spec skills behave when no user answers. Each skill points here and
adds only what is specific to it (the table at the end).

## The three modes

| Mode | When | What changes |
|---|---|---|
| **Interactive** | A user answers questions | Nothing: ask, wait, follow the skill as written. |
| **Unattended** | No user answers (a headless run, a scheduled run, another agent driving the skill) | Decide instead of asking, and log. No commits unless the skill says so; no pushes; no writes to a remote tracker. |
| **Inside an `/autonomous` run** | The skill is followed by `/autonomous` (it reads the skill's `SKILL.md`) | Unattended **plus** the run's **standing permission**: commit, push, write to the tracker, archive — whatever the task needs to move on, within its three hard limits. |

## Unattended: decide and log

- Where the skill would ask, make a sensible choice and log it in `DECISIONS.md` at the
  project root, in the format of `decisions.md` (next to this file; read it before the first
  entry). Inside a run that already exists (e.g. `/autonomous` driving the skill), add to that
  run instead of starting one.
- A decision that bends a rule from a skill, a CLAUDE.md or the user's instructions gets
  `Overrides` — once per override kind per run.
- Never tick a step whose `Verify:` fails, and never weaken, skip or delete a test to get
  there: stop at that step and report.
- The summary names the run and the decisions logged.

## Inside an `/autonomous` run

Everything from "Unattended", and:

- **Commit** each green unit of work: a ticked plan step, a tweak, an archive. "Green" is the
  full suite green — or, if the suite was already red before the run, **no new failures**
  against that baseline (logged once). Never `--no-verify`. End the message with a
  `Decision: <decision id>` trailer when the commit carries out a logged decision.
- **Stage only the skill's own files** — the files the step, tweak or change touched, plus
  `specs/` and `DECISIONS.md` where the skill writes them. Never "all current changes". A file
  that was **dirty before the run** is never committed: log it and leave it for the user.
- **Push** the current branch after each commit, as `/autonomous`'s "Whatever it takes" says
  (rebase on rejection, a new branch and one PR for a protected branch).
- **Linked issue:** always the `Closes #N` trailer; close the issue right away only when the
  commit lands on the default branch, otherwise comment (rules: `issue-tracker.md`,
  "Closing a linked issue").
- **Tracker writes** (publish, comment, close) are allowed. Every issue, comment or PR body
  starts with the **AI disclaimer**:

  > Written by Claude (/autonomous) while the user was away.

- Questions the skill would ask the user are answered by the run itself and logged.

## Tracker writes outside `/autonomous`

Interactive: ask before each write (fold it into a question the skill asks anyway).
Unattended outside `/autonomous`: never write to a remote tracker; a local `.scratch/` tracker
may be written; log every skipped write so the user can do it later.

## What each skill does differently

| Skill | Unattended | Inside an `/autonomous` run |
|---|---|---|
| `/spec:propose` | Doesn't archive open changes or offer a tweak; continues and logs them. | Also publishes the tracking issue. |
| `/spec:apply` | Skips a step whose Verify fails (`--parallel`: marks it skipped; dependents wait). Commits only in `--parallel` mode. | Commits each ticked step and pushes — sequential and `--parallel` (after each green merge and each serial-fallback commit). |
| `/spec:tweak` | Doesn't commit: leaves the tweak's changes unstaged and lists files and the drafted message. Escalation: stops and names it. | Commits (step 7 without asking) and pushes. |
| `/spec:archive` | Doesn't run (it commits and deletes). | Runs: skips the decision questions and the gate (decisions stay `open`, listed in the commit body); refuses on a missing artifact, an unticked step or a red suite; creates a missing system description; stages `specs/changes/<name>/` so it is in history before step 6 deletes it. |
| `/spec:retro` | Only reports. | Applies project-level fixes itself (each logged); drafts plugin-level issues into the report without publishing them. |
| `/spec:grill` | Needs a user: says so and stops. | Same — `/autonomous` decides the open questions itself and logs them. |
| `/spec:adversarial-code-review` | No spec found: skips the Spec axis and logs it. | Same. |
