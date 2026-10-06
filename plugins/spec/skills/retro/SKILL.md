---
description: Retrospective after a change or tweak - find what went wrong and propose environment fixes, most mechanical first
disable-model-invocation: true
argument-hint: "[change-name | fixed-point]"
metadata:
  author: Till Gartner
---

Look back on a change, a tweak or a session and suggest improvements to the agent's
**environment** — not to the product. A mistake the agent made should become a check that
catches it next time, not another paragraph of prose. Adapted from Matt Pocock's `/retro`.

Run it after `/spec:archive` or `/spec:tweak`, or whenever a session went sideways.

**Input**: optionally a change name or a fixed point; without one, the current session. An
argument is a **change** if `specs/changes/<arg>/` exists, or if `DECISIONS.md` or the git log
names it (`` `<arg>` ``, `specs/changes/<arg>/`); otherwise a **fixed point** if
`git rev-parse <arg>` resolves (`HEAD~5`, a tag, a SHA). Ambiguous → ask. A change's commits
are `git log --format='%h %s' -- specs/changes/<name>/` and the commits between its first and
last one; a fixed point's are `git log <fixed-point>..HEAD`.

**Steps**

1. **Gather the evidence** — whatever exists:
   - **The session**: red Verify runs, failing suites, user corrections, re-dos, steps
     redone after review. If the session's history isn't in your context (after a `/clear`,
     or for an earlier session), find its log yourself: the transcript `.jsonl` files under
     `~/.claude/projects/<cwd with / replaced by ->/`, newest first; ask the user only if
     several fit.
   - **Review findings** from `/spec:adversarial-code-review` in the session or log.
   - **`DECISIONS.md`** runs for the change: decisions with `Overrides`, and `reverted` ones
     (a revert is a decision the agent got wrong).
   - **Git**: `git log <fixed-point>..HEAD` (or the change's commits) — fix-up, review-fix and
     revert commits.
   - The project's own checks: its test, lint and check commands, CI workflow, pre-commit
     hooks — a check that exists but isn't wired up is the finding, not a new one.

2. **Find what went wrong.** One item per root cause, not per symptom. Look in these
   categories (from Pocock's `/retro`): **navigation** (the agent took long to find
   something — a pointer would help), **automated checks** (a check could have caught it),
   **standards** (the reviewer should have caught it), **steering files** (CLAUDE.md
   instructions that do nothing, or belong in a check), **tool economy** (expensive or
   wasteful tool calls), **information access** (a log or service the agent couldn't see).
   Before editing a skill or CLAUDE.md, load `mattpocock-skills:writing-for-agents` with the
   Skill tool if it is installed.

3. **Pick one environment fix per item — the most mechanical kind that works:**
   1. a **test** or a `Verify:` command;
   2. a **lint rule, hook or CI check** (a mechanical mistake gets a deterministic check,
      full stop; a project with no guardrail at all is itself a finding);
   3. a **skill or reference edit** (when the instructions were wrong or missing);
   4. a **one-line CLAUDE.md pointer** to where the knowledge lives — never a paragraph.
      Judgement calls go into the project's coding standards (read at review), not into
      CLAUDE.md (read by every agent).

4. **Decide where each fix lands:**
   - **Project-level** — the project's tests, lint config, hooks, CI, coding standards,
     CLAUDE.md: applied in the project.
   - **Plugin-level** — a fix to an installed plugin (a spec skill, md2html's lint, one of
     Pocock's skills): **never edit the plugin cache** (`~/.claude/plugins/cache/…`), the next
     update overwrites it. Draft an **issue against the plugin's own repo** instead. Find
     the repo: the GitHub `owner/repo` of the marketplace the plugin was installed from
     (`~/.claude/plugins/known_marketplaces.json`: the entry's `source.repo` when
     `source.source` is `github`); else ask. For reference:
     spec, md2html and autonomous live in `tillg/till-claude-code-marketplace`, Pocock's
     skills in `mattpocock/skills`.
   - **Inside the plugin's own repo** (`git remote get-url origin` is that repo), the plugin
     *is* the project: the fix is project-level, apply it there.

5. **Present** the items, most severe first:

   ```
   ## Retro: <change | tweak | session>

   1. [HIGH] <what went wrong>
      Evidence: <red run / finding / commit / decision id>
      Fix (lint rule, project): <the fix>
   2. [MEDIUM] …
      Fix (skill edit, plugin → issue on tillg/till-claude-code-marketplace): <draft title>
   ```

   Then ask which to apply (**AskUserQuestion tool**, multi-select, at most 4 items per
   question — more items: several questions, most severe first).

6. **Apply what was picked**
   - Small project-level fixes: apply them now, test-first where they have a runtime surface
     (a new lint rule: show it fails on the old mistake, then passes).
   - Bigger ones: suggest `/spec:tweak` or `/spec:propose` with the item as input.
   - Plugin-level issues: show the draft (title, body, evidence) and publish it to the
     plugin's repo (`gh issue create -R <repo>`) only after the user approves that draft. If
     `gh` is missing, not logged in, or has no access, print the draft (title, body, repo URL)
     for the user to file by hand.

Retro writes no file of its own: the fixes are the record.

**Unattended, or inside an `/autonomous` run** (rules: `../../reference/unattended.md`):
unattended, retro only reports. Inside an `/autonomous` run it doesn't ask in step 5: it applies
the small **project-level** fixes itself (test-first where they have a runtime surface, each
logged as a decision) and **drafts** plugin-level issues into the run's report without
publishing them — other repos wait for the user.

**Guardrails**

- Environment, not product: no feature work, no product bug fixes (those are a tweak)
- One fix per item; mechanical before prose; CLAUDE.md last, one line
- Never edit files under `~/.claude/plugins/` — plugin fixes become drafted issues
- Never quote secrets (tokens, keys, passwords, `.env` values) from transcripts, logs or code
  into a report or issue — redact them
- Nothing is applied or published without the user's pick (inside `/autonomous`: project
  fixes applied and logged, plugin issues only drafted)
- Edit spec files with the Edit/Write tools, not sed/python in Bash, so the md2html lint hook
  sees every change
