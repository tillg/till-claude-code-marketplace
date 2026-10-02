---
title: "Functional: Claude Code Plugin Marketplace"
created: 2026-04-15
edited: 2026-10-02
---

# Functional: Claude Code Plugin Marketplace

## Marketplace Functions

### Register marketplace
```
/plugin marketplace add tillg/till-claude-code-marketplace
```
Registers the marketplace with Claude Code. Fetches `marketplace.json` from
the GitHub repository.

### Install a plugin
```
/plugin install <name>@till-claude-code-marketplace
```
Downloads the plugin directory to the local plugin cache. Installing `spec`
also installs its dependency `mattpocock-skills` from the `mattpocock`
marketplace.

### Link the skills into a project (teammates)
A project commits `.claude/settings.json` with `extraKnownMarketplaces` (this
marketplace and `mattpocock/skills`, `autoUpdate: true`), `enabledPlugins`
(spec, md2html, mattpocock-skills) and a `SessionStart` hook that installs
missing plugins with project scope. A teammate clones, runs `claude`, trusts
the folder; plugins are installed in the first session and load after a
restart or `/reload-plugins`. Details: README, "Link the skills into a
project".

### Auto-update
When enabled, Claude Code checks for new plugin versions at startup.
`/spec:overview` also compares its version with the remote
`marketplace.json`.

## Plugin: spec (v9.0.0)

### User Journey: Spec-driven change

```
document-system → explore → propose → [grill | iterate] → apply → adversarial-code-review → archive
```

```mermaid
graph LR
    O[/spec:overview/] --> B{System documented?}
    B -->|no| DS[/spec:document-system/]
    B -->|yes| E[/spec:explore/]
    DS --> E
    E --> P[/spec:propose/]
    P --> G[/spec:grill/]
    P --> I[/spec:iterate/]
    G -.-> I
    I -.-> G
    P --> A[/spec:apply/]
    G --> A
    I --> A
    A --> R[/spec:adversarial-code-review/]
    R --> AR[/spec:archive/]
    AR -->|next change| E
```

`/spec:explore` fits anywhere; grill and iterate are optional and
repeatable; `/spec:view` opens the specs as HTML at any time.

### Skills

| Skill | Input | Output | Side effects |
|-------|-------|--------|-------------|
| `/spec:overview` | None | Status table, phase, maturity, workflow reference, version/update check | None (read-only); warns on status mismatches and unarchived `applied` changes |
| `/spec:document-system` | Codebase | `specs/system/*.md` | Creates/updates system description files |
| `/spec:explore` | Idea/question | Conversation | None, or `exploring` notes in a change dir on request |
| `/spec:propose` | Change name or description | `specs/changes/<name>/` with proposal, domain, architecture, test-first plan; HTML view opened | First checks open changes and recommends archiving them; may run archive |
| `/spec:grill` | Change name | Settled decisions written into the artifacts | Needs `mattpocock-skills` and a user to answer; stops otherwise |
| `/spec:iterate` | Annotated artifacts | Clean consolidated artifacts | Rewrites artifact files; asks before finalizing |
| `/spec:apply` | Change name | Code + tests | Per step: test first (red), code (green), Verify + full suite, tick; sets `applying` / `applied` |
| `/spec:adversarial-code-review` | `[fixed-point] [change]` | Findings in three axes: Defects, Standards, Spec | Read-only; three parallel sub-agents |
| `/spec:archive` | Change name | Two commits | Runs tests, updates `specs/system/`, commits (after approval), deletes the change dir, commits again |
| `/spec:view` | `[change]` | Browser page on `http://localhost:<port>` | Adds `specs` to `reports.json`, `.gitignore` lines; starts one md2html watcher + server per project |

### States and transitions
A change's `status` runs `exploring → proposed → applying → applied`, then
archive deletes the directory. Full meanings in
`plugins/spec/reference/frontmatter.md`. Legacy changes without frontmatter
still work: `/spec:overview` infers the phase from the files and checkboxes
and marks it "(inferred)"; md2html lint warns.

### Artifacts
- `specs/system/` — persistent system description (domain, architecture, functional)
- `specs/changes/<name>/` — temporary change artifacts (proposal, domain,
  architecture, plan; optional extras such as `decisions.md`)
- Spec HTML next to each `.md` and `index.html` — gitignored, local only

### Unattended runs
Skills that would ask make a sensible choice and note it — except grill
(stops), archive selection (always asks) and propose's archive offer (never
archives unattended). apply never ticks a step whose Verify fails.

## Plugin: md2html (v0.5.0)

### Skills

| Skill | Invocation | What it does |
|---|---|---|
| `/md2html:write` | Model or user, `[path] [what to write]` | Guides writing a `*-report.md`: layout rules, directive syntax (`syntax.md`) |
| `/md2html:build` | User only, `[--check] [paths…]` | Builds or checks reports, lists stale/failed files, opens the result over localhost |
| `/md2html:setup` | User only, `[project-dir]` | Writes `reports.json`, optional theme stub, optional vendored `tools/md2html.mjs`, editor and `just` config, CLAUDE.md pointer |

### CLI (`node dist/md2html.mjs <cmd>`)

| Command | Effect |
|---|---|
| `new <path> [--title]` | Canonical report skeleton; never overwrites |
| `fmt [--check] [paths]` | Canonical rewrite of reports |
| `lint [--format json] [paths]` | `path:line:col severity message [rule]` |
| `build [--check] [--watch] [--specs] [paths]` | `.md` → `.html`; `--specs` = spec pages + index only |
| `check` | fmt --check + lint + build --check over all sources |
| `syntax [--json]` | Directive cheat sheet |
| `serve [--port N]` | Local page server (127.0.0.1, pages only) |

Exit codes: `0` clean, `1` findings (lint errors, stale HTML, non-canonical
Markdown), `2` usage/config error.

### Hook
After every Write/Edit/MultiEdit of a `.md` under a `reports.json` root:
report files are linted, then formatted if clean (Claude is told to re-read);
spec files are linted only. Errors are fed back to Claude.

### Inputs and outputs
- Report: `*-report.md` with `title`, `created`, `edited`, `status`
  (`research | ongoing | implemented`), optional `subtitle`, `description` →
  committed single-file HTML, numbered sections, TOC at ≥ 4 sections, menu.
- Spec: spec `.md` → gitignored HTML with per-directory nav, status pill,
  project index, Mermaid via CDN.

## Plugin: agent-bus (v0.4.0)

### User Journey: Coordinate agents across sibling repos

```
/agent-bus:coordinate
```

1. Find `.agent-bus/` in the shared parent directory; derive the agent ID.
2. Process own inbox by priority, then age: move each message to
   `processing`, act, move to `done` (or `failed` + `blocker` to the sender).
3. Send requests/replies/status/handoffs as atomic JSON files into the
   recipient's inbox; append a prose line to `chat.md`.

Wake-up options: `UserPromptSubmit` hook script, `watch.mjs` (starts
`claude -p` on new mail), or `/loop 2m /agent-bus:coordinate`. Humans follow
along with `tail -f .agent-bus/chat.md`.

## Plugin: md2pdf (v1.0.0)

### User Journey: Convert Markdown to PDF

```
/md2pdf:convert <file.md> [output.pdf]
```

1. Resolve input file
2. Install Node.js dependencies if missing (`npm install`)
3. Run `scripts/convert.mjs` — renders Markdown → HTML → PDF via Playwright
4. Open the resulting PDF

### Features
- Syntax-highlighted code blocks
- Styled tables with striped rows
- Mermaid diagram rendering (via CDN)
- Local image embedding as data URIs
- Footnotes
- Print-optimized CSS with page numbers

## Plugin: transform (v1.0.0)

### User Journey: Convert document to Markdown

```
/transform:doc2md <file> [output-dir]
```

1. Resolve input file
2. Create `.venv` and install Python deps if missing (`setup.sh`)
3. Detect format by extension, dispatch to converter script
4. Optionally apply LLM cleanup on output
5. Report result

### User Journey: Batch convert

```
/transform:batch <directory> [output-dir]
```

1. Scan directory (top level only) for .docx, .pdf, .msg files
2. Create `.venv` if missing
3. Ask about LLM cleanup
4. Convert each file sequentially via `batch.sh`
5. Show summary (success/failure counts)

### Supported Formats

| Format | Converter | Tool | Notes |
|--------|-----------|------|-------|
| DOCX | `docx2md.py` | pypandoc (bundled Pandoc) | High fidelity, clean output |
| PDF | `pdf2md.sh` | Marker (ML-based) | Downloads ~2GB models on first use |
| MSG | `msg2md.py` | extract-msg + pypandoc | Extracts headers, body, attachments |

### Output Contract
All converters produce:
- `<basename>.md` — the Markdown file
- `media/<basename>/` — extracted images/attachments (if any)

## Edge cases and known limitations

- Spec pages need network for Mermaid (CDN); offline they show the source.
- `/spec:view` needs md2html ≥ 0.3.0; `/spec:grill` needs mattpocock-skills.
- agent-bus hooks must be registered by the consuming project.
- Only md2html has automated tests; the prompt-only plugins are unverified
  by tooling.
