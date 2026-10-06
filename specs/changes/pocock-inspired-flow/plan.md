---
feature: pocock-inspired-flow
title: "Plan: Pocock-inspired spec flow"
status: applied
order: 4
created: 2026-10-05
edited: 2026-10-06
---

# Plan: Pocock-inspired spec flow

Every step changes prompt or docs text, so each one has `Test first: none` and a mechanical
`Verify`.

The full suite is the repo's only harness, `(cd plugins/md2html && npm test)`. It runs before
the first step and after every step.

The steps are grouped by feature. They are applied in the order **A, B, C, D, F, G, E**, and
`/spec:adversarial-code-review` runs after each group, so every review stays small (grill Q6).
There is one release at the end, with the version bump in E.

## A. Decision review gate

- [x] Add the optional `Overrides` field and a "Reviewing decisions" section to `plugins/spec/reference/decisions.md`. The section covers which decisions belong to a change, confirm/revert, and promotion to an ADR or a Key decisions row.
  - Test first: none — reference text with no runtime surface
  - Verify: `grep -q '\*\*Overrides:\*\*' plugins/spec/reference/decisions.md && grep -q '^## Reviewing decisions' plugins/spec/reference/decisions.md` → exit 0
- [x] Copy the updated format to its twin, `plugins/autonomous/skills/autonomous/decisions-format.md`
  - Test first: none — copy of a reference file
  - Verify: `cmp plugins/spec/reference/decisions.md plugins/autonomous/skills/autonomous/decisions-format.md` → exit 0
- [x] Add `Overrides (only when a guardrail is bent)` to the inline DECISIONS.md summary in every skill that carries one: propose, apply, adversarial-code-review and autonomous
  - Test first: none — prompt text; the grep below fails today for all four files
  - Verify: `test -z "$(grep -l 'Context, Question' plugins/spec/skills/*/SKILL.md plugins/autonomous/skills/autonomous/SKILL.md | xargs grep -L 'Overrides')"` → exit 0
- [x] Have `/autonomous` fill in `Overrides` whenever a decision bends a guardrail from a skill, a CLAUDE.md or the user's instructions
  - Test first: none — prompt text
  - Verify: `grep -q 'Overrides' plugins/autonomous/skills/autonomous/SKILL.md && grep -qi 'bends a guardrail' plugins/autonomous/skills/autonomous/SKILL.md` → exit 0
- [x] Add readiness check 2d, "Review the change's decisions", to `/spec:archive`. It selects the change's open decisions by name match, asks confirm/revert with overrides first, writes `Status`, stops while a decision is still open or a revert is pending (no `Undone in` yet), and only counts the decisions that aren't the change's.
  - Test first: none — prompt text
  - Verify: `grep -q "Review the change's decisions" plugins/spec/skills/archive/SKILL.md && grep -q 'reverted' plugins/spec/skills/archive/SKILL.md` → exit 0
- [x] Add promotion to `/spec:archive` step 4: a confirmed decision with lasting weight goes to `docs/adr/` if that exists, else to the Key decisions table in `specs/system/architecture.md`
  - Test first: none — prompt text
  - Verify: `grep -q 'docs/adr/' plugins/spec/skills/archive/SKILL.md && grep -q 'Key decisions' plugins/spec/skills/archive/SKILL.md` → exit 0
- [x] Show `Decisions: N open (K overrides)` in `/spec:overview` step 2 when `DECISIONS.md` has open decisions, then offer to review them right away (confirm/revert, overrides first, batches of 4, the user may decline)
  - Test first: none — prompt text
  - Verify: `grep -q 'K overrides' plugins/spec/skills/overview/SKILL.md && ! grep -rq 'override guardrails' plugins README.md && grep -qi 'review them' plugins/spec/skills/overview/SKILL.md` → exit 0

## B. `/spec:tweak`

- [x] Create `plugins/spec/skills/tweak/SKILL.md`:
  - user-invoked, with no `name:`
  - checks the tweak limits and escalates to `/spec:propose`
  - inline plan with Test first / Verify per step, using the `reference/plan.md` cycle
  - updates `specs/system/*` in place
  - one commit after the user approves the message; never commits when unattended
  - refuses to start on a tree that is dirty from an open apply
  - Test first: none — new prompt file; `test -f` fails today
  - Verify: `test -f plugins/spec/skills/tweak/SKILL.md && grep -q 'disable-model-invocation: true' plugins/spec/skills/tweak/SKILL.md && ! grep -q '^name:' plugins/spec/skills/tweak/SKILL.md && claude plugin validate plugins/spec` → exit 0, "Validation passed"
- [x] Have `/spec:propose` step 1 suggest `/spec:tweak` when the request is within the tweak limits, without redirecting on its own
  - Test first: none — prompt text
  - Verify: `grep -q '/spec:tweak' plugins/spec/skills/propose/SKILL.md` → exit 0
- [x] Add `/spec:tweak` to the workflow reference in `/spec:overview` (flow line and skill table)
  - Test first: none — prompt text
  - Verify: `grep -q '/spec:tweak' plugins/spec/skills/overview/SKILL.md` → exit 0

## C. `/spec:retro`

- [x] Create `plugins/spec/skills/retro/SKILL.md`:
  - user-invoked, with no `name:`, argument `[change-name | fixed-point]`
  - reads the evidence sources from the architecture
  - outputs a severity-ordered list with one fix each, most mechanical first (test → lint/hook/CI → skill/reference → CLAUDE.md pointer)
  - the user picks via multi-select; small fixes are applied, bigger ones go to tweak or propose
  - plugin-level fixes are never edited in the plugin cache; retro drafts an issue against the plugin's repo and publishes it only after approval
  - after `/clear`, it finds the session log itself (asks only if several fit)
  - writes no retro file
  - Test first: none — new prompt file; `test -f` fails today
  - Verify: `test -f plugins/spec/skills/retro/SKILL.md && grep -qi 'plugin cache' plugins/spec/skills/retro/SKILL.md && grep -q 'disable-model-invocation: true' plugins/spec/skills/retro/SKILL.md && ! grep -q '^name:' plugins/spec/skills/retro/SKILL.md && claude plugin validate plugins/spec` → exit 0, "Validation passed"
- [x] Have `/spec:archive`'s summary and `/spec:tweak`'s end suggest `/spec:retro`, and add it to `/spec:overview`'s workflow reference
  - Test first: none — prompt text
  - Verify: `grep -q '/spec:retro' plugins/spec/skills/archive/SKILL.md && grep -q '/spec:retro' plugins/spec/skills/tweak/SKILL.md && grep -q '/spec:retro' plugins/spec/skills/overview/SKILL.md` → exit 0

## D. `/spec:apply --parallel`

- [x] Document the optional `Depends on:` sub-bullet in `plugins/spec/reference/plan.md`: if any step has it, every step has it; `none` marks a root; it doesn't count toward N/M
  - Test first: none — reference text
  - Verify: `grep -q 'Depends on:' plugins/spec/reference/plan.md` → exit 0
- [x] Have `/spec:propose` write `Depends on:` lines when the plan has steps that don't build on each other, and leave them out for a plain sequence
  - Test first: none — prompt text
  - Verify: `grep -q 'Depends on:' plugins/spec/skills/propose/SKILL.md` → exit 0
- [x] Add the `--parallel` mode to `/spec:apply`:
  - preconditions: clean tree, green baseline, `.worktrees/` gitignored
  - at most 3 workers, each in `.worktrees/<change>/step-<n>` on branch `<change>-step-<n>` (renamed from `spec/<change>/step-<n>` after review: collides with an existing `spec` branch)
  - single writer: only the orchestrator touches `plan.md` and `DECISIONS.md`
  - serial merge, then the full suite
  - conflict or red → undo the merge and fall back to a serial re-run
  - cleanup of worktrees and branches
  - `argument-hint` gains `[--parallel]`
  - Test first: none — prompt text
  - Verify: `grep -q -- '--parallel' plugins/spec/skills/apply/SKILL.md && grep -q '.worktrees/' plugins/spec/skills/apply/SKILL.md && grep -q 'Serial fallback\|serial fallback' plugins/spec/skills/apply/SKILL.md && claude plugin validate plugins/spec` → exit 0

## F. Issue tracker

- [x] Create `plugins/spec/reference/issue-tracker.md`:
  - find `docs/agents/issue-tracker.md`; if it is missing, hint `/setup-matt-pocock-skills` and never block
  - the operations come from the config, never a hard-coded `gh`/`glab`
  - the `ready-for-agent` label comes from `triage-labels.md`
  - the `**Issue:**` line format
  - consent per write; unattended never writes to a remote tracker
  - Test first: none — reference text; `test -f` fails today
  - Verify: `test -f plugins/spec/reference/issue-tracker.md && grep -q 'docs/agents/issue-tracker.md' plugins/spec/reference/issue-tracker.md && grep -q '/setup-matt-pocock-skills' plugins/spec/reference/issue-tracker.md && grep -q '\*\*Issue:\*\*' plugins/spec/reference/issue-tracker.md` → exit 0
- [x] `/spec:propose` takes an issue reference as input (fetches body + comments, writes the `**Issue:**` line). Without one, and with the tracker configured, it offers a tracking issue labelled `ready-for-agent` that points at the change.
  - Test first: none — prompt text
  - Verify: `grep -q 'reference/issue-tracker.md' plugins/spec/skills/propose/SKILL.md && grep -q 'tracking issue' plugins/spec/skills/propose/SKILL.md` → exit 0
- [x] `/spec:tweak` takes an issue reference as input and closes it like archive does
  - Test first: none — prompt text
  - Verify: `grep -q 'reference/issue-tracker.md' plugins/spec/skills/tweak/SKILL.md && grep -q 'Closes #' plugins/spec/skills/tweak/SKILL.md` → exit 0
- [x] `/spec:archive` puts a `Closes #N` trailer in the commit message when the change has a linked issue. In the commit-approval question it offers to also comment the hash and close the issue (a local tracker gets `Status: resolved` and a `## Comments` entry, no trailer).
  - Test first: none — prompt text
  - Verify: `grep -q 'Closes #' plugins/spec/skills/archive/SKILL.md && grep -q 'reference/issue-tracker.md' plugins/spec/skills/archive/SKILL.md` → exit 0
- [x] The Spec axis of `/spec:adversarial-code-review` falls back to the issues referenced in the commits when there is no spec change, instead of skipping
  - Test first: none — prompt text
  - Verify: `grep -q 'reference/issue-tracker.md' plugins/spec/skills/adversarial-code-review/SKILL.md && grep -qi 'issues referenced' plugins/spec/skills/adversarial-code-review/SKILL.md` → exit 0
- [x] `/spec:overview` shows a hint line suggesting `/setup-matt-pocock-skills` when `docs/agents/issue-tracker.md` is missing
  - Test first: none — prompt text
  - Verify: `grep -q 'setup-matt-pocock-skills' plugins/spec/skills/overview/SKILL.md` → exit 0

## G. `/autonomous`: whatever it takes to move on

- [x] Replace the "Don't do what can't be undone … no `git push`, no `/spec:archive` …" guardrail in `plugins/autonomous/skills/autonomous/SKILL.md` with a **Whatever it takes** section:
  - the standing permission to take every action the task needs (examples: commit, push, branch + PR on a protected branch, tracker writes, archive, deploy)
  - log **one** `Overrides` decision per kind of bent rule per run; later occurrences are appended to its Consequences
  - drive spec skills by reading and following their `SKILL.md` (they are user-invoked only)
  - apply with `--parallel` by default when the plan has `Depends on:` lines and at least 2 steps are ready
  - after self-review and before the open-ended testing, run the `/spec:retro` flow over the run: apply project-level fixes (each logged as a decision), draft plugin-level issues into the report without publishing them
  - green commits only, with `Decision:` and `Refs`/`Closes` trailers; AI disclaimer on tracker texts
  - the three **hard limits**: no force-push or history rewrite of anything already pushed, no deleting data it didn't create, no exposing secrets
  - the report lists every commit, push, branch, tracker write, archive and deploy
  - Test first: none — prompt text; the first grep fails today
  - Verify: `grep -q 'Whatever it takes' plugins/autonomous/skills/autonomous/SKILL.md && grep -q 'Hard limits' plugins/autonomous/skills/autonomous/SKILL.md && grep -qi 'per kind' plugins/autonomous/skills/autonomous/SKILL.md && grep -q -- '--parallel' plugins/autonomous/skills/autonomous/SKILL.md && grep -q '/spec:retro' plugins/autonomous/skills/autonomous/SKILL.md && grep -q 'Decision:' plugins/autonomous/skills/autonomous/SKILL.md && ! grep -q 'no `git push`' plugins/autonomous/skills/autonomous/SKILL.md && claude plugin validate plugins/autonomous` → exit 0
- [x] Inside an `/autonomous` run, `/spec:archive` skips the decision questions. It leaves the change's decisions `open` and lists them in the archive commit body.
  - Test first: none — prompt text
  - Verify: `grep -qi 'inside an `/autonomous` run' plugins/spec/skills/archive/SKILL.md` → exit 0 (tightened during apply: the plain `/autonomous` grep already matched before)
- [x] (already written in F16, verified here) In `plugins/spec/reference/issue-tracker.md`, make the unattended rule say remote writes are allowed only inside an `/autonomous` run
  - Test first: none — reference text
  - Verify: `grep -q 'except inside an `/autonomous` run' plugins/spec/reference/issue-tracker.md` → exit 0 (tightened during apply)
- [x] Inside an `/autonomous` run, `/spec:apply` (sequential and `--parallel`) and `/spec:tweak` commit and push as the run's permissions allow. Outside one, unattended runs still never commit (tweak) or push (both).
  - Test first: none — prompt text
  - Verify: `grep -qi 'inside an `/autonomous` run' plugins/spec/skills/apply/SKILL.md && grep -qi 'inside an `/autonomous` run' plugins/spec/skills/tweak/SKILL.md` → exit 0 (tightened during apply: the plain `/autonomous` grep already matched before)
- [x] Update the `/autonomous` description in `README.md`: it does whatever it takes to move on, logs overrides, and keeps the three hard limits
  - Test first: none — docs
  - Verify: `! grep -q 'It never pushes' README.md && grep -A40 '### autonomous' README.md | grep -q 'force-push'` → exit 0

## H. Group shared rules (after the whole-diff review)

Rules that several spec skills need are written once in a reference file; each skill keeps a
pointer and only its own specifics. `/autonomous` keeps its own copy (each plugin must work
alone).

- [x] Create `plugins/spec/reference/unattended.md`: the three modes (interactive, unattended, inside an `/autonomous` run) and the rules shared by every skill that runs in them — decide and log, staging only the skill's own files, files dirty before the run, red baseline, commit and push, closing linked issues, tracker writes and the AI disclaimer — plus one table of what each skill does differently
  - Test first: none — reference text; `test -f` fails today
  - Verify: `f=plugins/spec/reference/unattended.md; test -f $f && grep -q '^## Inside an `/autonomous` run' $f && grep -q 'while the user was away' $f && grep -q 'dirty before the run' $f` → exit 0
- [x] Replace the inline `DECISIONS.md` format summary in propose, apply, adversarial-code-review and tweak with a pointer to `reference/decisions.md`
  - Test first: none — prompt text; the first check fails today (4 copies)
  - Verify: `test -z "$(grep -l 'Context, Question' plugins/spec/skills/*/SKILL.md)" && for s in propose apply adversarial-code-review tweak; do grep -q 'reference/decisions.md' plugins/spec/skills/$s/SKILL.md || exit 1; done` → exit 0
- [x] Replace the per-skill unattended / `/autonomous` rules in apply, archive, tweak, retro, propose and `reference/issue-tracker.md` with a pointer to `reference/unattended.md` plus only what is specific to that skill; the disclaimer text exists once in the spec plugin
  - Test first: none — prompt text; the checks fail today
  - Verify: `for s in apply archive tweak retro propose; do grep -q 'reference/unattended.md' plugins/spec/skills/$s/SKILL.md || exit 1; done; grep -q 'unattended.md' plugins/spec/reference/issue-tracker.md && test "$(grep -r 'while the user was away' plugins/spec | wc -l | tr -d ' ')" = 1` → exit 0
- [x] Archive's promotion paragraph points to "Promotion" in `reference/decisions.md` instead of restating its three tests
  - Test first: none — prompt text
  - Verify: `! grep -q 'hard to reverse' plugins/spec/skills/archive/SKILL.md && grep -q '"Promotion"' plugins/spec/skills/archive/SKILL.md` → exit 0

- [x] Cut what no plan step asked for: GitLab merge-request handling (`!67`) in `reference/issue-tracker.md` and the review's spec sources, and retro's `repository`-field lookup (no plugin here has that field)
  - Test first: none — prompt text; the check fails today
  - Verify: `! grep -rq '!67' plugins/spec && ! grep -q '`repository`' plugins/spec/skills/retro/SKILL.md && grep -q 'known_marketplaces.json' plugins/spec/skills/retro/SKILL.md` → exit 0

## E. Docs and versions

- [x] Update `README.md`:
  - skill-table rows for `/spec:tweak` and `/spec:retro`
  - `--parallel` on the `/spec:apply` row
  - the archive decision gate and the `Overrides` field in "Unattended runs leave a trail"
  - the flow line
  - an "Issue tracker" paragraph: run `/setup-matt-pocock-skills`, issue refs as input, `Closes #N` at archive
  - Test first: none — docs
  - Verify: `grep -q '/spec:tweak' README.md && grep -q '/spec:retro' README.md && grep -q -- '--parallel' README.md && grep -q 'Overrides' README.md && grep -q 'docs/agents/issue-tracker.md' README.md` → exit 0
- [x] Bump spec to 12.0.0 and autonomous to 2.0.0 in both `plugin.json` and `.claude-plugin/marketplace.json`
  - Test first: none — version metadata
  - Verify: `test "$(jq -r .version plugins/spec/.claude-plugin/plugin.json)" = 12.0.0 && test "$(jq -r '.plugins[]|select(.name=="spec").version' .claude-plugin/marketplace.json)" = 12.0.0 && test "$(jq -r .version plugins/autonomous/.claude-plugin/plugin.json)" = 2.0.0 && test "$(jq -r '.plugins[]|select(.name=="autonomous").version' .claude-plugin/marketplace.json)" = 2.0.0 && claude plugin validate plugins/autonomous && (cd plugins/md2html && npm test)` → exit 0, all green

System docs are updated at `/spec:archive`.
