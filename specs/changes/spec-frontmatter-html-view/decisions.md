---
feature: spec-frontmatter-html-view
title: "Decisions: spec frontmatter and HTML view (autonomous run)"
status: applied
order: 5
created: 2026-09-30
edited: 2026-09-30
---

# Decisions: spec frontmatter and HTML view (autonomous run, 2026-09-30)

Taken without the user during `/autonomous`. All reversible.

## Status (2026-09-30 16:10)

- **Built:** spec frontmatter in all spec skills + new `/spec:view` (spec 6.4.0); md2html spec profile — groups discovered per directory, inner nav with ↑ up link, project `index.html`, client-side Mermaid 12.0.0, `build --specs [--watch]`, spec lint (`spec-frontmatter`, `spec-consistency`), hook lints spec files only (md2html 0.2.0). Both versions synced in plugin.json + marketplace.json.
- **Tests:** `npm test` in plugins/md2html → **356/356**.
- **Verified for real:** headless Claude Code ran document-system → propose ×2 → view → hand edits under the watcher (0.4 s rebuild, files added/removed join/leave every nav) → apply (statuses moved together to applied) → overview → hook caught `status: done` and Claude fixed it. A second `/spec:view` run after the skill fixes set everything up unaided. Playwright: Mermaid renders to SVG, light/dark, 390 px no horizontal scroll, nav/up links/index correct.
- **Review:** 1 adversarial review (13 findings) + the dry run (4 bugs, 5 friction points) — all fixed (X1–X12, SK10–SK17, C12–C15).
- **Dogfooding:** this repo now has `reports.json` `{ "specs": {} }` and the gitignore lines; all spec files carry frontmatter; the watcher runs from the repo root and `http://localhost:55356/index.html` is open.
- **For you:** the biggest judgement call is **X1 — report sources now win over spec globs** (the architecture originally said spec wins; the review showed that overwrote committed report HTML). Also C2 (generated spec HTML of deleted files is removed automatically) and SL2 (key order is only a warning).

## Implementation decisions

- **C1 Spec build is all-or-nothing.** Whenever `build` (or a watcher batch) involves any spec file, *every* spec page plus the index is rebuilt (only changed bytes are written). This keeps every group's nav correct when files are added/removed; spec trees are small, so this costs milliseconds.
- **C2 Deleted spec files.** When a spec `.md` is gone, its generated `.html` (recognised by the md2html generator meta) is removed on the next spec build. Safe because spec HTML is gitignored and generated; report HTML is never auto-deleted (it is committed; `check` reports it as orphaned instead).
- **C3 Index guard** is a config error (exit 2) naming `specs.index`, raised before any spec page is written.
- **C4 Group consistency** (`spec-consistency`) runs only when linting all sources (`lint`, `check`), like the menu and theme checks; the hook lints one file and does not run it.
- **C5 Hook for spec files** runs `lintSpec` only: errors → exit 2 on stderr, warnings → `additionalContext`, never formats, never builds (the watcher builds).
- **SL1 Required keys.** `title`, `created`, `edited` are required in every spec file; `feature` and `status` also under `specs/changes/<dir>/` (matched anywhere in the root-relative path, `<dir>` = first directory below `changes/`). Outside change dirs `feature`/`status` are allowed but not required, and `feature` is not checked against a directory.
- **SL2 Key order is a warning.** architecture.md lists the errors (missing/unknown key, bad value, non-ISO date, `edited < created`, `feature` ≠ dir); key order is not among them, so out-of-order keys get a `[spec-frontmatter]` warning, like the no-frontmatter hint. The `artifact` key in architecture.md is stale: the closed schema has no `artifact`, so it is an unknown key.
- **SL3 Two rules, one id.** Errors (`specFrontmatter`) and hints (`specFrontmatterHints`: no frontmatter, key order) are separate unified-lint rules sharing ruleId `spec-frontmatter`, because unified-lint-rule sets one severity per rule. The YAML read (core schema, `logLevel: 'error'`, the ": " quoting hint) is duplicated from the report rule rather than refactoring `src/lint/frontmatter.mjs`.
- **SL4 Group check.** `lintSpecGroup` compares `feature` and `status` separately; items missing the key are skipped (the per-file rule reports them). Majority wins; a tie goes to the value of the tied file with the lowest integer `order`, then list order. Position: `lines[key]`, else `line`, else 1 (`specData(source)` supplies `lines`).
- **SK1 Canonical schema lives in `propose/SKILL.md`.** Full template + key table + status
  table there; the other skills reference `/spec:propose` and repeat only what they touch
  (explore shows a minimal `exploring` template, document-system a system-doc template).
- **SK2 A status-only change does not bump `edited`.** `edited` tracks content; apply/iterate
  flip `status` on all files of the change but bump `edited` only on files whose body changed
  (plan.md on every ticked step).
- **SK3 No status downgrades.** propose/iterate move `exploring → proposed` only; they never
  reset `applying`/`paused`/`applied`. explore keeps an existing status. `paused` is set on
  user request via apply; resuming sets `applying`.
- **SK4 overview mismatch rule.** Disagreeing files → use proposal.md's status (else the most
  common) and print a warning; also warn when status contradicts plan.md checkboxes. Legacy
  changes (no frontmatter anywhere) use the old heuristic, marked `(inferred)`. Added a
  `Paused` phase and `/spec:view` to the workflow table.
- **SK5 ready-or-not** gets a "Spec Frontmatter" section; every frontmatter problem is MEDIUM
  (Consistency category), mirroring md2html's lint rules.
- **SK6 archive** never copies `feature`/`status`/`order` into `specs/system/`; touched system
  files get `edited` = today, missing frontmatter is added.
- **SK7 `/spec:view` root/tool lookup** reuses md2html's build-skill snippet, falling back to
  the git root when there is no `reports.json`. It reuses a running watcher (pgrep) instead of
  starting a second, logs to `<root>/tmp/` if present else `/tmp/`, and opens the lowest-`order`
  file of the change (else the index when the change dir doesn't exist).
- **SK8 Dogfood dates.** add-md2html-plugin files: `status: applied` as instructed, although
  its plan.md still has 29 unticked `[ ]` boxes — `/spec:overview` will warn about that
  contradiction (by design). specs/system/*.md: `created`/`edited` from git first/last commit
  (both 2026-04-15), since adding frontmatter is not a content edit.
- **SK9 Not verified with md2html lint yet**: the in-progress CLI didn't load
  (`src/spec/index.mjs` missing at the time). Checked instead with a script: key order,
  feature = dir, status values, ISO dates, `edited ≥ created`, quoted titles.
- **C6 add-md2html-plugin plan boxes ticked.** That change was fully implemented and verified in the earlier run (incl. the manual hook check via headless Claude Code and the pilot), so its 29 `[ ]` were ticked to match `status: applied`. The last step ("system description updates happen at /spec:archive") is a note for archive, ticked too.
- **C7 spec plugin description** now ends "…apply, and archive changes, and view them as HTML" in plugin.json and marketplace.json.
- **R1 Spec CSS lives in `src/spec.css`, not `base.css`.** Spec pages inline `base.css` + `spec.css` in `@layer base`, and reports get `base.css` only, so every report golden stays byte-identical. `assets.mjs` exports `specCss`, and `scripts/bundle.mjs` inlines it.
- **R2 Group item `title` = frontmatter `title`, else the label.** `groups()` sees only frontmatter (the contract's `readFrontmatter`). There's no second callback for the `# ` heading. Missing `order`/`feature`/`status`/`edited` are `null`. A non-integer `order` counts as missing. Sorting uses code-point order, never locale order.
- **R3 Page title/h1.** `<title>` = frontmatter `title`, else the first `# ` heading's text, else the file name. The page adds an `<h1>` (no id) only when the body has no `# ` heading of its own. The body's own h1 keeps its slug id.
- **R4 The status pill comes from the page's own frontmatter**, not the group's, so a page shows what its file says. Lint flags drift across a group.
- **R5 Mermaid is transformed at the hast level:** `pre > code.language-mermaid` → `pre.mermaid`, with the source as a text node (escaped by rehype-stringify; Mermaid entity-decodes it). The script uses `await mermaid.run({querySelector:'pre.mermaid'})`, and the URL is JSON-quoted with `<` escaped as `<`. The code-box styling is removed only on `pre.mermaid[data-processed]`, so offline the source stays visible as a normal code block.
- **R6 `.spec-nav` wraps (flex-wrap) instead of scrolling like `.reports-nav`**, so every page of a group and the status pill (pushed right) stay visible on phones.
- **R7 Index:** title "Specs", no nav, no script. Columns: Directory, Feature, Status, Title (links to the first page), Edited (newest ISO string), Pages. Feature/status come from the first item that has them, else "—". Under 640 px each row stacks, with a `data-label` on each cell. Empty groups are skipped. With no groups the page says "No spec files yet."
- **R8 Links in spec pages rewrite `.md` → `.html` for targets matching `specs.sources` or `sources`.** Figures get `exists: () => false` (no `.mmd` source links), so `buildSpec` stays fs-free with the contract's signature.
- **C8 Dogfooding in this repo.** Root `reports.json` = `{ "specs": {} }` (committed), `.gitignore` gets `specs/**/*.html`, `/index.html` and `.playwright-mcp/` (the last one had been flagged earlier as untracked noise). The gitignore patterns are anchored, so committed spec test goldens under `plugins/md2html/test/fixtures/spec/` stay tracked (checked with `git check-ignore`).
- **C9 Data fixes found in the browser.** This change's own proposal/domain/architecture/plan lacked `order` (written before the key existed), so "Decisions" sorted first; added `order: 1–4`. Titles in add-md2html-plugin had Markdown backticks, shown literally in the index; removed (frontmatter titles are plain text).
- **C10 md2html 0.1.0 → 0.2.0** (plugin.json, package.json, lockfile, marketplace.json). The generator meta changes in every golden; the 23 goldens were updated by exact string replacement only.
- **C11 Accepted:** wide left-to-right Mermaid diagrams are scaled down to fit at phone width rather than scrolling.
- **DOC1 `/spec:view` .gitignore keeps report HTML tracked.** `specs/**/*.html` is followed by one `!` line per report `sources` glob (`.md` → `.html`, default `!specs/**/*-report.html`), then `/<INDEX>`. Checked with `git check-ignore`. Since reports now win over spec globs, `/spec:view` always adds `"specs": {}` (the narrower-glob advice is gone).
- **DOC2 `/spec:view` builds with `--specs` only** (`build --specs`, `build --specs --watch`), never mentions lint output from `build` (run `lint` separately), and reuses a watcher only if `pgrep -f "md2html.mjs build.*--watch"` finds one whose cwd (`lsof -a -d cwd -p <pid> -Fn`) equals `pwd -P` of the root. `--watch` added to the pgrep pattern so a one-shot build is not mistaken for a watcher; `pwd -P` because lsof reports the resolved path.
- **DOC3 overview status rule** = majority of the change's files, tie → lowest `order`, with a mismatch warning (replaces "proposal.md is authoritative", SK4), matching lint and index.
- **DOC4 md2html README** documents the `specs` key, a "Spec profile" section (differences table, lint rules, overwrite guards) and `build --specs`; the write/setup skills get one note that spec files are not reports. Root README mentions the spec profile in both plugin sections.
- **X1 Report wins over spec globs (flips the earlier "spec wins").** `profileOf` → `'report'` if the file matches `sources` (incl. the default `specs/**/*-report.md`), else `'spec'` if it matches `specs.sources`. With spec-wins, `"specs": {}` alone turned every `specs/**/*-report.md` into a gitignored spec page and dropped its committed report HTML. Stale spec-HTML removal only considers files whose `.md` is spec-profile. The overlap tests now assert report-wins; architecture.md's profile paragraph, key-decision table and risks were updated.
- **X2 The index is never a stale spec page.** An index under the spec glob (`specs/index.html`) was deleted and rewritten on every build; the stale sweep now skips `specs.index`.
- **X3 Index collisions are a config error (exit 2):** `specs.index` equal to the HTML path of any spec or report source (e.g. `specs/index.html` when `specs/index.md` exists). Checked when spec pages are built, i.e. after reports.
- **X4 `specs.index` validation:** must end in `.html`, no `..` segments (stored normalized); an existing directory at that path is a ConfigError from `loadConfig` (needs the root), never a stack trace.
- **X5 Watcher and directory renames.** A rename/move reports only the directory name, so with `specs` set a non-`.md` event triggers a spec rebuild. Narrowed from "any non-`.html` event" to "a path that is now a directory or gone": existing plain files (log files in `tmp/`, the http.server log) and dot/skipped dirs (`.git`, `node_modules`) are ignored, so logging never causes rebuilds. `.html` events stay ignored (our own writes).
- **X6 Hand-written HTML next to a spec `.md`** (no md2html generator meta) is skipped with `warning: <file>.html exists and was not generated by md2html; not overwriting` on stderr; the rest builds, exit 0.
- **X7 Build order: reports, then spec pages, then the index.** A hand-written index still fails with exit 2 (message unchanged) but no longer blocks reports or spec pages.
- **X8 Archived changes:** `changeDir('specs/changes/archive/<x>/…')` = `<x>`, so `feature` must equal `<x>`. Each archived change dir is its own group (grouping is per directory already; tested).
- **X9 Hrefs built from file names are percent-encoded per segment** (`a#b.md` → `a%23b.html`, `q?x` → `q%3Fx`, `100%` → `100%25`, spaces/quotes/non-ASCII), then HTML-escaped as before: nav items, the up link and index links. Author-written body links are untouched; display text stays readable.
- **X10 One rule for a group's status:** `groupStatus(items)` in `src/spec/groups.mjs` — majority, tie → lowest `order`, then first by name (same as `lintSpecGroup`). The index uses it (was: first item with a status). The page pill stays the page's own status (R4).
- **X11 `build --specs`** (also with `--watch`) builds only spec pages + index, so `/spec:view` never rebuilds committed report HTML. Errors (exit 2) with `--check`, or when reports.json has no `specs` key.
- **X12 Watcher start message:** `watching N report(s) and M spec file(s); Ctrl-C to stop` (N = 0 with `--specs`).
- **SK10 `/spec:view` picks the newest md2html ≥ 0.2.0** (supersedes the tool part of SK7). The dry run picked a stale marketplace checkout (0.1.0) that rejected the `specs` key. All candidates (project `tools/md2html.mjs`, `~/.claude/plugins/cache/**/md2html/**/dist/md2html.mjs`, `~/.claude/plugins/marketplaces/**/plugins/md2html/dist/md2html.mjs`) are checked with `node <c> --version`, filtered to ≥ 0.2.0 and ranked with `sort -V`. A vendored copy wins only if it qualifies itself. If none qualifies, the user is told to run `/plugin marketplace update` and install md2html, and the skill stops.
- **SK11 `/spec:view` root never goes above the git root.** Nearest `reports.json` up to `git rev-parse --show-toplevel`, else the git root (where `reports.json` gets created). The dry run had picked an outer repo's `reports.json`. This matches the CLI change to stop at the git root.
- **SK12 Spec files are edited with Edit/Write, not sed/python in Bash**, so the md2html PostToolUse lint hook sees every change. One guardrail line in propose, iterate, apply, explore, archive and document-system.
- **SK13 apply doesn't call the HTML stale.** If the `/spec:view` watcher is running, it rebuilds the HTML automatically.
- **SK14 plan.md has no step for updating `specs/system/*`** (that's `/spec:archive`). It may end with a plain note, not a checkbox, so apply never has to tick it (cf. C6).
- **SK15 overview counts checkboxes with grep** (`grep -c '^\s*- \[x\]'` / `grep -c '^\s*- \[[ x]\]'` on plan.md), not by eye.
- **SK16 propose/document-system hint `/spec:view`** in one line when md2html ≥ 0.2.0 is available and `reports.json` has no `specs` key. They never create the config themselves.
- **SK17 Unattended runs.** propose and apply make a sensible choice, note it and continue when no user can answer (headless runs).
- **C12 Root discovery stops at the git root** (`.git` dir or file): the CLI, the hook and `/spec:view` never pick up an outer repo's `reports.json` (the dry-run scratch repo inside this repo hit that).
- **C13 Hook group check is a warning**, not an error: skills update a change's files one at a time, so a transient mismatch must not block the next Edit. `lint`/`check` keep it an error.
- **C14 Watcher prints spec frontmatter errors** of the files that changed (stderr), since its log is the only feedback for edits made outside Claude.
- **C15 Index links** use a right margin (a left margin on `a + a` indented wrapped lines); plan checkboxes use the accent colour and done steps are muted — spec pages only, report goldens unchanged.
