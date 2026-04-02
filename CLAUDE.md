# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A Claude Code plugin marketplace — a registry of plugins that can be installed into Claude Code. The marketplace itself is defined in `.claude-plugin/marketplace.json`, and individual plugins live under `plugins/`.

## Repository Structure

- `.claude-plugin/marketplace.json` — marketplace manifest listing all available plugins with name, source path, and version
- `plugins/<name>/.claude-plugin/plugin.json` — per-plugin metadata (name, description, author, keywords)
- `plugins/<name>/commands/<name>/*.md` — slash command definitions as Markdown files with YAML frontmatter (`name`, `description`, `category`, `tags`) followed by the prompt template

## Current Plugins

- **spec** (`plugins/spec/`) — spec workflow plugin for spec-driven change management. Provides commands like `/spec:explore` for thinking through ideas without implementing.

## Plugin Authoring

Slash commands are plain Markdown files. The frontmatter defines how the command appears in Claude Code, and the body is the prompt that Claude receives when the command is invoked. Commands can reference the spec artifact system (`spec/changes/<name>/`) and use bash tool calls.
