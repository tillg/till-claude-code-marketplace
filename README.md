# Till's Claude Code Marketplace

Personal marketplace for Claude Code plugins.

## Register Marketplace

Open Claude Code in any project directory:

- **Local** (from a clone of this repo): `/plugin marketplace add ./`
- **Remote**: `/plugin marketplace add tgartner/till-claude-code-marketplace`

## Install a Plugin

```
/plugin install spec@till-claude-code-marketplace
```

Select "Install for all collaborators on this repository (project scope)" or "Install for just me (user scope)" as needed. Restart Claude Code to load new plugins.

## Available Plugins

| Plugin | Description | Commands |
|--------|-------------|----------|
| **spec** | Spec-driven change management workflow | `/spec:explore`, `/spec:propose`, `/spec:apply`, `/spec:archive` |

## Plugin Development Workflow

During development, you can skip the commit/push/reinstall cycle entirely using `--plugin-dir` and `/reload-plugins`.

### Quick Start

```bash
# Start Claude Code with your local plugin loaded directly
claude --plugin-dir ./plugins/spec
```

### Iterative Development

1. **Start** Claude Code with `--plugin-dir ./plugins/spec`
2. **Edit** plugin files (commands, skills, agents, hooks)
3. **Reload** inside Claude Code with `/reload-plugins` — no restart needed
4. **Test** the command
5. **Repeat** from step 2

Commit and push only when the plugin is stable.

### Alternative Approaches

| Approach | How | Pros | Cons |
|----------|-----|------|------|
| `--plugin-dir` | `claude --plugin-dir ./plugins/x` | Fastest iteration, instant reload | Must specify at startup |
| Local marketplace | `/plugin marketplace add ./` then `/plugin install x` | One-time registration | Files are **copied**, not linked — reinstall after changes |
| Symlinks | `ln -s /path/to/repo/plugins/x ~/.claude/plugins/x` | Changes reflected immediately | Manual setup, fragile |

## Disable Plugins per Repo

Globally installed plugins can be disabled for a specific project via `.claude/settings.json` (git-committed, team-wide) or `.claude/settings.local.json` (local only, not committed):

```json
{
  "enabledPlugins": {
    "spec@till-claude-code-marketplace": false
  }
}
```

Alternatively, uninstall a plugin only for the current project:

```
/plugin uninstall spec@till-claude-code-marketplace --scope project
```
