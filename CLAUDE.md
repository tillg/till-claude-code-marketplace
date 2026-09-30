# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A Claude Code plugin marketplace — a registry of plugins that can be installed into Claude Code. The marketplace itself is defined in `.claude-plugin/marketplace.json`, and individual plugins live under `plugins/`.

## Repository Structure

- `.claude-plugin/marketplace.json` — marketplace manifest listing all available plugins with name, source path, and version
- `plugins/<name>/.claude-plugin/plugin.json` — per-plugin metadata (name, description, author, keywords)
- `plugins/<name>/skills/<skill-name>/SKILL.md` — skill definitions as Markdown files with YAML frontmatter followed by the prompt

## Current Plugins

- **spec** (`plugins/spec/`) — spec workflow plugin for spec-driven change management. Provides skills like `/spec:explore`, `/spec:propose`, `/spec:apply`, `/spec:archive`, and `/spec:view` (HTML view of specs via md2html). Spec files carry YAML frontmatter (`feature`, `title`, `status`, `order`, `created`, `edited`).
- **md2pdf** (`plugins/md2pdf/`) — Markdown to PDF converter with code highlighting, tables, mermaid diagrams, and images.
- **transform** (`plugins/transform/`) — document to Markdown converter for DOCX, PDF, and MSG files. Skills: `/transform:doc2md`, `/transform:batch`.
- **md2html** (`plugins/md2html/`) — deterministic Markdown → HTML reports (`new`, `fmt`, `lint`, `build`, `check`, `syntax`), a `PostToolUse` fmt+lint hook, and per-project CSS themes. Skills: `/md2html:write`, `/md2html:build`, `/md2html:setup`. Source in `src/`, committed bundle in `dist/` (`npm test`, `npm run bundle`).
- **agent-bus** (`plugins/agent-bus/`) — file-based inbox protocol for coordinating multiple Claude Code agents across sibling repos. Skill: `/agent-bus:coordinate`.

## Plugin Authoring

Skills are directories containing a `SKILL.md` file. The frontmatter defines behavior (`description`, `disable-model-invocation`, `argument-hint`, etc.) and the body is the prompt Claude receives when the skill is invoked. Skills can include supporting files (templates, scripts) alongside `SKILL.md`.

**Important: Do NOT use the `name` field in SKILL.md frontmatter.** It overrides auto-namespacing and skills will appear without the plugin prefix (e.g. `/propose` instead of `/spec:propose`). The skill name comes from the directory name, and the namespace prefix comes from `plugin.json`.

## Versioning

Each plugin has a `version` field in both `plugin.json` and `marketplace.json`. These two numbers must stay in sync.

**Rule: every commit that touches a plugin must bump that plugin's version in both files.** Do this as part of the same commit as the change — not in a follow-up. If a commit touches multiple plugins, bump each of them.

Use [semantic versioning](https://semver.org/) (`MAJOR.MINOR.PATCH`) and let the nature of the change pick the level. When in doubt, bump higher rather than lower — users installing a plugin should never be surprised by a breaking change hidden behind a patch bump.

### How to pick the level

**PATCH** (`x.y.Z`) — fixes and refinements that don't change what the plugin does or how it's invoked. Existing users see no behavioral difference beyond "it works better now."
- Typo or wording fix in a `SKILL.md` body
- Bugfix in a script bundled with a skill
- Clarifying a description or `argument-hint` without changing the trigger
- Internal refactor of a skill's prompt that preserves behavior
- Tightening guardrails without removing capability

**MINOR** (`x.Y.0`) — new capability added in a backward-compatible way. Existing invocations still work; users get something new.
- New skill added to a plugin (e.g. adding `/spec:ready-or-not`)
- New optional argument or flag on an existing skill
- New optional frontmatter field on a skill
- Materially expanded behavior in an existing skill (new checks, new output sections) where prior invocations still produce sensible output
- New supporting file (template, helper script) that augments an existing skill

**MAJOR** (`X.0.0`) — breaking change. Anything an existing user could have a script, a memory, or muscle memory pointing at that no longer works the same way.
- Renaming a skill (`/spec:propose` → `/spec:create-proposal`)
- Removing a skill entirely
- Renaming the plugin itself or changing its namespace prefix
- Changing the required arguments of a skill (positional → flag, renaming, removing)
- Restructuring artifact layout in a way that changes paths users reference (e.g. moving `specs/changes/<name>/proposal.md` to a new location)
- Changing default behavior in a way that contradicts what prior versions did
- Dropping a previously supported input format

### Both files, same number

- `plugins/<name>/.claude-plugin/plugin.json` — the plugin's own `version`
- `.claude-plugin/marketplace.json` — the matching entry's `version`

Mismatch is a bug. If you notice the two are out of sync (as happened when `marketplace.json` lagged at `6.1.0` while `plugin.json` was at `6.2.1`), resolve to the higher of the two and bump from there.
