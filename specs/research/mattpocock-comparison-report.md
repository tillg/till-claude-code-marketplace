---
title: Pocock skills vs. our spec workflow
created: 2026-10-05
edited: 2026-10-05
status: research
subtitle: mattpocock/skills v1.3.1 compared with the `spec` plugin and w12spec, checked against karpathy_app and w12-free.
---

:::tldr
**Short answer:** Matt optimises the **path into code**: grill, ticket graph, parallel worktree agents, then a retro that hardens the environment. We optimise **what the repo knows afterwards**: a living `specs/system/` folded back at archive, Verify commands on every step, three-axis review and a `DECISIONS.md` for unattended runs.

- **He is stronger** at parallelism (`implement-spec`), using the issue tracker as shared state, context hygiene, and starting small: `/implement` is 4 lines.
- **We are stronger** at long-term spec truth (his specs are never updated once they become issues), checkable test-first plans, review depth, and auditable autonomy.
- **Our weak spot is cost on small changes.** In karpathy_app a 12-line request produced ≈370 lines of spec for ≈50 lines of UI. w12-free had to invent a light `tweak` tier for exactly this reason.
- **Best moves:** borrow his `retro`, his tracker-as-state and his worktree parallelism. Add a light lane, plus a review step for open decisions. Keep the system fold-back.
:::

## Context {#context}

Matt Pocock released **v1.3.1** of [mattpocock/skills](https://github.com/mattpocock/skills) on 2026-10-04. This report compares it with our workflow on four questions: what the steps are, where each side is stronger, how each scales, and what to borrow.

"Our workflow" turned out to be **two** things:

- **`spec` plugin** (this marketplace, spec 11.0.0, autonomous 1.0.0, md2html 0.6.0). karpathy_app uses it.
- **w12spec**, the in-repo workflow of **w12-free**: about 45 skills, a 545-line contract (`specs/platform/w12spec.md`) and a 2,046-line `scripts/workflow.sh`. w12-free does **not** use the `spec` plugin. w12spec is a heavier sibling that shares the same ideas: fresh context per phase, on-disk handoff, the coder never grades its own work, and "decide and log" when unattended.

The two projects used as evidence:

| Project | Size | Pace | Workflow |
| --- | --- | --- | --- |
| karpathy_app ("smaller") | ≈14k LOC app + deploy, ≈13k test LOC, 512 files | 155 commits in 11 days, 9 archived changes | `spec` plugin + `/autonomous` + Pocock grilling/glossary |
| w12-free ("larger") | ≈2M LOC Java/TS (≈60 % tests), ≈6 active humans | 18,218 commits in 5.5 months, ≈189 epics/bugs | w12spec (own), Pocock grilling adapted |

karpathy_app is not tiny. It is small compared with w12-free, but the overhead on small changes shows up *inside* it, change by change.

## Steps side by side {#steps}

| Phase | Pocock (v1.3.1) | `spec` plugin | w12spec (w12-free) |
| --- | --- | --- | --- |
| Setup | `/setup-matt-pocock-skills` → `docs/agents/` (tracker, labels, domain) | `/spec:document-system` → `specs/system/{domain,architecture,functional}.md` | `specs/system`, `specs/modules` (27.7k lines), `specs/platform` |
| Orient / route | `ask-matt` router + `PHASE-BOUNDARIES.md` | `/spec:overview` (phase, maturity, YOU ARE HERE) | `workflow.sh next-story` / `story-health` |
| Think | `/grill-with-docs` → `GLOSSARY.md`, ADRs in `docs/adr/` | `/spec:explore`, `/spec:grill` (calls Pocock's grilling + domain-modeling, writes into the change's `domain.md` / architecture decisions) | `grill-me` / `grill-with-docs` adapted to `specs/system/domain.md` and ADRs |
| Prototype | `/prototype` (throwaway HTML on its own branch), `/handoff` | — | — |
| Specify | `/to-spec` → **issue** (user stories, test seams, no file paths) | `/spec:propose` → `specs/changes/<name>/` with `proposal`, `domain`, `architecture`, `plan` (frontmatter, status) | `create-epic` / `create-story` → `epic.md` (median 225 lines), `spec.md` (94) |
| Refine | — | `/spec:iterate` (consolidates the user's inline annotations) | `plan` → `plan.md` (median 155), learnings search |
| Slice | `/to-tickets` → vertical-slice issues with **blocking edges** | Plan steps (`Test first:` / `Verify:`) inside `plan.md` | Stories under an epic, `.meta` files, epic branch |
| Build | `/implement` (tdd → code-review → commit, fresh context per ticket) or `/implement-spec` (**parallel worktree subagents**, integration branch) | `/spec:apply` (baseline suite, red → green → refactor per step, tick only when Verify is green) | `pick-up` → `execute`; overnight `run-epic` (Codex/pi writes, Claude reviews) |
| Review | `code-review`: 2 axes (Standards, Spec), parallel | `/spec:adversarial-code-review`: 3 axes (Defects, Standards + smell baseline, Spec + `DECISIONS.md`) | Independent `review:` / `review-fix:` loop (630 / 259 commits) |
| Ship | `pr` (Merge Danger, Before/After) | `/spec:archive`: re-run suite, update `specs/system/*`, 2 commits, delete change dir | `complete-story` / `complete-epic`: fold into module specs, ADRs, learnings, delete change dir |
| Learn | `/retro` → linter rules, hooks, CI, `CODING_STANDARDS.md` | — | `specs/learnings/` (174 files) searched at plan time |
| Unattended | AFK only per ticket/subagent; `chief-of-staff` experimental on `main` | `/autonomous`: decide, log in `DECISIONS.md`, test-first, self-review | `run-epic-overnight.sh` (935 lines), "decide and log" policy |
| Small change | `/grill-with-docs` → `/implement` | none: always 4 artifacts | `w12spec-tweak` (no change dir, spec updated in place) |

## Where Pocock is stronger {#pocock-stronger}

| Area | Pocock | Us | |
| --- | --- | --- | --- |
| Parallel build | `implement-spec`: task graph, worktree per ticket, merger subagent | One change at a time; parallel changes discouraged, no worktree flow | :verdict[Pocock]{tone="go"} |
| Shared state | Issue tracker (GitHub/GitLab/local `.scratch/`) with native blocking links; any session claims a ready ticket | Files in `specs/changes/`; no notion of "ready" or claiming | :verdict[Pocock]{tone="go"} |
| Learning loop | `/retro` turns mistakes into linters, hooks and CI; `CLAUDE.md` stays thin | Nothing in the plugin; w12spec has learnings, but those are prose | :verdict[Pocock]{tone="go"} |
| Context hygiene | `PHASE-BOUNDARIES.md`: continue → `/clear` → `/handoff` → subagent → `/compact`, ≈150k "smart zone" | Implicit (fresh contexts per agent) | :verdict[Pocock]{tone="partial"} |
| Getting started | `/implement` is 4 lines; skills are composable, "not a framework" | ≈11k words across spec skills; propose always writes 4 files and starts a viewer | :verdict[Pocock]{tone="go"} |
| Design vocabulary | `codebase-design` (deep modules, seams, deletion test), test seams agreed up front | Plan steps name tests, but no shared design vocabulary | :verdict[Pocock]{tone="partial"} |
| Triage / intake | `/triage` with label states and `.out-of-scope/` memory | — (w12-free: backlog of 1,037 files, 221 needing a human decision) | :verdict[Pocock]{tone="go"} |
| Portability | Claude Code + Codex (`agents/openai.yaml`) | Claude Code only (w12spec: Claude/Codex/pi) | :verdict[Pocock]{tone="partial"} |

## Where we are stronger {#we-stronger}

| Area | Us | Pocock | |
| --- | --- | --- | --- |
| Spec truth after shipping | `specs/system/` is updated at every archive (karpathy_app: 14 commits, ≈2.1k lines, current) | Specs live in issues, are never updated, ban file paths; only `GLOSSARY.md` + ADRs persist | :verdict[we]{tone="go"} |
| Verifiable plans | Every step has `Test first:` and a runnable `Verify:`; a step is ticked only when green; archive re-runs the suite | `tdd` at agreed seams; `implement` has no explicit acceptance check | :verdict[we]{tone="go"} |
| Review depth | 3 separate axes incl. **Defects**; it finds real bugs (karpathy_app: SVG sanitising, fail-closed egress, DNS token owner) | 2 axes (Standards, Spec); no dedicated defect hunt | :verdict[we]{tone="go"} |
| Unattended work | `/autonomous` + `DECISIONS.md` (karpathy_app: 7 runs, 80 decisions with alternatives and rollback) | No decision log, no stop conditions | :verdict[we]{tone="go"} |
| Mechanical checks | md2html lint hook on spec frontmatter and status; deterministic HTML view | Prose discipline (but `retro` pushes towards checks) | :verdict[we]{tone="go"} |
| Lifecycle visibility | `status` (`exploring → proposed → applying → applied`), `/spec:overview`, `/spec:view` | Labels on issues; no local overview | :verdict[we]{tone="partial"} |
| E2E QA | `/autonomous` keeps testing end to end (Playwright); karpathy_app has ≈50 `fix-<issue>` regression specs | No browser/E2E step in the main flow | :verdict[we]{tone="go"} |

## Small vs. large projects {#scaling}

### Smaller: karpathy_app {#small}

It works:

- MVP, deploy pipeline, 7 features and ≈40 bug fixes in 11 days.
- Test code ≈ product code.
- The glossary vocabulary shows up consistently in specs and UI.

The cost:

- **Spec size does not scale down.** Spec size stays 400–1,400 lines whatever the size of the change:

  | Change | Spec lines | Source lines | Spec : source |
  | --- | --- | --- | --- |
  | separate-settings | 395 | +31/−22 | ≈7.5 : 1 |
  | product-website | 398 | 267 | ≈1.5 : 1 |
  | ai-open-page | 875 | ≈980 | ≈0.9 : 1 |
  | web-search | 731 | ≈2,450 | ≈0.3 : 1 |

- **Nobody reviews the decisions.** All 80 entries are still `Status: open`. Several of them override guardrails: a prod deploy, treating `/spec:apply` as permission to change tests, archiving without the re-run, calling a failing test flaky. This cuts against "we're better at autonomy". Logging works; review of the log does not happen.

- **Archive gets shortcut** because the full e2e suite takes 11 minutes.

- **Leftover proposals.** Parallel agents left 2 of 4 proposals unapplied.

- **ADRs went stale** (3, all from day one). Real architecture choices land in `DECISIONS.md` instead.

- **Pocock skills load twice.** 13 of them are copied into `.claude/skills/`, and the auto-updating plugin is enabled too.

- **Old file name.** It still uses `CONTEXT.md`, which v1.3.0 renamed to `GLOSSARY.md` (breaking).

For truly small projects, Pocock's `/grill-with-docs` → `/implement` is far cheaper. Ours only pays off once `specs/system/` is worth keeping current.

### Larger: w12-free {#large}

w12spec shows what our ideas need at ≈2M LOC and ≈6 people. It has **added** what neither the plugin nor Pocock has:

- **Tier split.** `w12spec-tweak` handles small changes and bugs with no change dir.
- **Learnings.** 174 learning notes, searched at plan time.
- **Script-owned state.** `workflow.sh` decides the next story, so agents don't re-read `.meta` files to work out the order.
- **Cross-engine review.** Codex or pi writes the code, Claude reviews it.
- **Size caps.** `check-doc-thinness.sh` keeps `CLAUDE.md` and rules files thin.

It also shows the failure modes at scale:

- **Backlog explosion.** 1,037 files. Unattended runs route every discovery to `backlog-note`, and nothing drains the backlog.
- **251 ADRs**, with number collisions solved by random suffixes.
- **24 "thinness" fix commits** after merges.
- **Test bloat** from mandatory TDD, later reined in (`test-consolidation`).
- **≈6,500 lines of SKILL.md** that have drifted across `.claude/` and `.agents/`.
- **Rework.** 630 `review:` + 259 `review-fix:` commits.

Pocock's approach at this scale: the tracker as shared state, `/triage` with `.out-of-scope/`, `wayfinder` for unclear efforts, and `implement-spec` for parallelism. That covers exactly w12-free's pain points (backlog, parallel work, intake). It does not cover w12-free's strength: **living module specs**.

## Worth borrowing {#recommendation}

From Pocock into `spec`:

1. **`/spec:retro`**, modelled on his `/retro`. It ends a change by proposing linter rules, hooks or CI checks instead of more prose. This is also a counter to SKILL.md growth.
2. **A light lane**, e.g. `/spec:tweak`: one `plan.md` with Test first / Verify, folded straight into `specs/system/` with no proposal/domain/architecture files. w12-free proves it is needed.
3. **Parallel apply.** Run the independent plan steps in worktree subagents (in `.worktrees/`), like `implement-spec`, with a merger step and an explicit conflict strategy (his is underspecified).
4. **Context-boundary guidance.** A short table of when to `/clear`, `/handoff` or use a subagent between propose, apply and review.
5. **Track the GLOSSARY rename.** Make sure `/spec:grill` copes with `GLOSSARY.md`. In karpathy_app, `git mv CONTEXT.md GLOSSARY.md` and remove the copied `.claude/skills/` duplicates.
6. **Consider pinning** the mattpocock-skills dependency. It is currently unpinned and changes when his plugin updates, and v1.3.0 shows he makes breaking renames.

From us to keep (and harden):

1. **Keep** the archive fold-back into `specs/system/`. It is the clearest advantage over Pocock.
2. **Keep** the 3-axis review and the per-step Verify.
3. **Add a decision-review step.** Make `/spec:overview` or `/spec:archive` surface `DECISIONS.md` entries still `open`, and require confirm/revert before archive, at least for guardrail overrides.
4. **Promote durable decisions to ADRs** at archive. That way `DECISIONS.md` stays a run log and ADRs don't go stale.
5. **Cap the backlog.** If unattended runs add backlog notes, give them a triage/out-of-scope path (Pocock's `/triage` idea) before they pile up like in w12-free.

## Sources {#sources}

- [github.com/mattpocock/skills](https://github.com/mattpocock/skills) at `4588b32` (2026-10-05): `CHANGELOG.md`, `skills/engineering/ask-matt/SKILL.md`, `ask-matt/PHASE-BOUNDARIES.md`, `implement-spec`, `retro`, `to-spec`, `to-tickets`, `code-review`, `skills/in-progress/chief-of-staff/SKILL.md`; releases v1.3.0 / v1.3.1 (2026-10-04).
- This repo: `plugins/spec/skills/*/SKILL.md`, `plugins/spec/reference/{frontmatter,plan,decisions}.md`, `plugins/autonomous/skills/autonomous/SKILL.md`, `plugins/md2html/hooks/hooks.json`, `specs/changes/review/review.md`, `.claude-plugin/marketplace.json`.
- karpathy_app: `CLAUDE.md`, `CONTEXT.md`, `DECISIONS.md`, `specs/system/`, `specs/changes/`, `docs/adr/`, `.claude/skills/`, git history (e.g. `34eb15c`, `373e5df`, `402d1f9`).
- w12-free: `specs/platform/w12spec.md`, `scripts/workflow.sh`, `scripts/run-epic-overnight.sh`, `specs/backlog/TRIAGE_REPORT.md`, `specs/architecture/`, `specs/learnings/`, `.claude/skills/`, git history (e.g. `924d46f8a1`, `bc6792300e`, `345ce21c87`).
- Gathered by four parallel research agents on 2026-10-05; numbers are approximate counts from files and `git log`.
