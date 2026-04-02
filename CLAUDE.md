# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A Claude Code plugin marketplace — a registry of plugins that can be installed into Claude Code. The marketplace itself is defined in `.claude-plugin/marketplace.json`, and individual plugins live under `plugins/`.

## Repository Structure

- `.claude-plugin/marketplace.json` — marketplace manifest listing all available plugins with name, source path, and version
- `plugins/<name>/.claude-plugin/plugin.json` — per-plugin metadata (name, description, author, keywords)
- `plugins/<name>/skills/<skill-name>/SKILL.md` — skill definitions as Markdown files with YAML frontmatter followed by the prompt

## Current Plugins

- **spec** (`plugins/spec/`) — spec workflow plugin for spec-driven change management. Provides skills like `/spec:explore`, `/spec:propose`, `/spec:apply`, `/spec:archive`.

## Plugin Authoring

Skills are directories containing a `SKILL.md` file. The frontmatter defines behavior (name, description, `disable-model-invocation`, `argument-hint`, etc.) and the body is the prompt Claude receives when the skill is invoked. Skills can include supporting files (templates, scripts) alongside `SKILL.md`.
