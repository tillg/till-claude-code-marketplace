# Till's Claude Code Marketplace

Personal marketplace for Claude Code plugins.

## Register Marketplace

Open Claude Code in any project directory:

- **Remote**: `/plugin marketplace add tillg/till-claude-code-marketplace`
  (Recommended)
- **Local** (from a clone of this repo): `/plugin marketplace add ./`

## Install a Plugin

```
/plugin install spec@till-claude-code-marketplace
```

Select "Install for all collaborators on this repository (project scope)" or
"Install for just me (user scope)" as needed. Restart Claude Code to load new
plugins.

## Available Plugins

| Plugin   | Description                            | Commands                                                                                                                     |
| -------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **spec** | Spec-driven change management workflow | `/spec:overview`, `/spec:document-system`, `/spec:explore`, `/spec:propose`, `/spec:iterate`, `/spec:apply`, `/spec:archive` |

## Plugin Development Workflow

Normally, installing a plugin **copies** its files into Claude Code's internal
storage. That means every edit requires a reinstall — slow for active
development.

Use `--plugin-dir` to bypass this: it loads the plugin straight from your local
files so changes take effect immediately.

```bash
# Launch Claude Code with the plugin loaded from source
claude --plugin-dir ./plugins/spec
```

Then iterate without restarting:

1. **Edit** any plugin file (commands, skills, agents, hooks)
2. **Reload** inside Claude Code with `/reload-plugins`
3. **Test** the command
4. Go back to step 1

Commit and push only when the plugin is stable, then install it from the
marketplace as usual.

### Alternative Approaches

| Approach          | How                                                   | Tradeoff                                                                  |
| ----------------- | ----------------------------------------------------- | ------------------------------------------------------------------------- |
| `--plugin-dir`    | `claude --plugin-dir ./plugins/x`                     | **Recommended.** Live reload, but you must pass the flag at every startup |
| Local marketplace | `/plugin marketplace add ./` then `/plugin install x` | One-time setup, but files are **copied** — must reinstall after changes   |
| Symlinks          | `ln -s /path/to/repo/plugins/x ~/.claude/plugins/x`   | Changes reflected live, but manual setup and fragile                      |

## Disable Plugins per Repo

Globally installed plugins can be disabled for a specific project via
`.claude/settings.json` (git-committed, team-wide) or
`.claude/settings.local.json` (local only, not committed):

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
