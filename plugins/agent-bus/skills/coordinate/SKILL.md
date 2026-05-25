---
description: File-based inbox protocol for coordinating multiple Claude Code agents working on related repositories. Use when agents in sibling projects need to send requests, replies, status, blockers, or alerts to each other via a shared .agent-bus/ directory. Atomic file handoff via temp-write + rename; chat.md as human transcript only.
metadata:
  author: Till Gartner
---

# Agent Bus Coordination

## Purpose

Use this skill whenever coordination is needed between two or more
software-development agents working in related repositories.

This skill replaces slow shared-chat polling with an event-driven file inbox
protocol:

- One structured message file per message.
- One inbox per agent.
- Atomic file handoff using temp-file write + rename.
- A shared human-readable `chat.md` remains as the transcript, not the transport.
- Agents process inbox messages before starting work, after finishing work, and
  whenever invoked because a new inbox file appeared.

The goal is fast, reliable, auditable coordination between agents.

---

## Inform the User

When this skill is invoked in an **interactive** session (a user typed
`/agent-bus:coordinate`, or this is the first agent-bus action of a
human-driven turn), surface this one-liner near the top of your response so
the user knows how to watch the agents talk live:

> To follow this conversation live, run `tail -f .agent-bus/chat.md` in
> another terminal.

Show it once per session, ideally on the first agent-bus action. Skip it
when invoked headlessly (e.g. from the bundled watcher's `claude -p` spawn,
where there is no human reading the response).

---

## Bus Location

Use this directory at the shared parent level of the related projects:

```txt
.agent-bus/
  agents/
    <agent-id>/
      inbox/
      processing/
      done/
      failed/
  archive/
  chat.md
  threads/
```

Example layout (assuming default `AGENT_ID`s from project basenames):

```txt
workspace/
  project-a/
  project-b/
  .agent-bus/
    agents/
      project-a/
      project-b/
```

---

## Agent Identity

Each agent has a stable `AGENT_ID`.

**Default:** the basename of the project's primary working directory,
normalized to lowercase kebab-case. A Claude Code session running in
`~/workspace/project-a/` defaults to `AGENT_ID = project-a`. This makes the
inbox tree self-documenting — `.agent-bus/agents/project-a/` sits next to
`project-a/`.

Normalization rules:

- Lowercase the basename.
- Replace any run of non-alphanumeric characters with a single `-`.
- Strip leading and trailing `-`.

Examples:

- `~/workspace/project-a/` → `project-a`
- `~/workspace/My Project (v2)/` → `my-project-v2`
- `~/git/till-claude-code-marketplace/` → `till-claude-code-marketplace`

**Override:** set `AGENT_ID` explicitly in the project's `CLAUDE.md` when:

- Two sibling projects happen to share the same basename.
- The dirname is unstable (e.g. it changes across branches or checkouts).
- A more meaningful name exists than the directory provides.

Sibling agents on the same bus must have distinct `AGENT_ID`s. If two default
to the same name, override at least one.

---

## Message Format

Every message is a single JSON file.

Filename format:

```txt
<created_at>__<from>__<to>__<type>__<short-id>.json
```

Example:

```txt
2026-05-25T14-22-31Z__project-a__project-b__request__8f3a2c.json
```

Message body:

```json
{
  "schema": "agent-bus-message-v1",
  "id": "2026-05-25T14-22-31Z_8f3a2c",
  "created_at": "2026-05-25T14:22:31Z",
  "from": "project-a",
  "to": "project-b",
  "type": "request",
  "thread": "auth-refactor",
  "priority": "normal",
  "status": "new",
  "requires_reply": true,
  "reply_to": null,
  "subject": "Auth API changed",
  "body": "I changed the auth API. Please update client calls to use getSession() instead of readSession().",
  "artifacts": [
    {
      "kind": "file",
      "path": "project-a/src/auth.ts",
      "note": "New API implementation"
    }
  ],
  "acceptance_criteria": [
    "Project B no longer calls readSession().",
    "Project B tests pass.",
    "Reply with changed files and any integration risks."
  ],
  "context": {
    "repo": "project-a",
    "branch": "main"
  }
}
```

---

## Message Types

Use one of these `type` values:

- `request` — asks another agent to do something.
- `reply` — responds to a prior message.
- `status` — reports progress without asking for action.
- `handoff` — transfers ownership of a task.
- `blocker` — says work is blocked and needs intervention.
- `decision` — records an architectural or workflow decision.
- `alert` — high-priority warning about breakage, conflicts, or failed tests.

---

## Priorities

Use one of: `low`, `normal`, `high`, `urgent`.

Rules:

- `urgent` means process before normal project work.
- `high` means process before starting a new unrelated task.
- `normal` is default.
- `low` is informational unless it requires a reply.

---

## Sending a Message

To send a message:

1. Create the recipient inbox if missing:

   ```txt
   .agent-bus/agents/<recipient-agent-id>/inbox/
   ```

2. Write the complete JSON message to a temporary file in the same directory:

   ```txt
   .agent-bus/agents/<recipient-agent-id>/inbox/.tmp_<message-id>.json
   ```

3. Flush/close the file.

4. Rename it to the final filename:

   ```txt
   .agent-bus/agents/<recipient-agent-id>/inbox/<message-filename>.json
   ```

5. Append a human-readable summary to `.agent-bus/chat.md`.

**Do not write directly to the final message filename.** Always write to a temp
file first, then rename. On Linux, `rename()` atomically replaces the
destination path, so readers never see a half-written final file. Keep the temp
file and final file on the same filesystem.

---

## Receiving Messages

At the start of each run, before doing project work:

1. Check `.agent-bus/agents/<AGENT_ID>/inbox/`.
2. Ignore files starting with `.tmp_`.
3. Sort messages by:
   1. `priority`: urgent, high, normal, low
   2. `created_at` ascending
4. For each message:
   - Move it from `inbox/` to `processing/`.
   - Read and validate the JSON.
   - Decide whether it requires action.
   - Act on it.
   - Send a `reply`, `status`, `blocker`, or `decision` message if appropriate.
   - Move the processed message to `done/`.
5. If processing fails:
   - Move the message to `failed/`.
   - Send a `blocker` or `alert` message to the sender.
   - Append the failure to `chat.md`.

---

## When to Process Inbox

Process the inbox:

- At the beginning of every agent run.
- Before making a major code change.
- Before committing or finalizing work.
- After finishing a requested task.
- Whenever the host runtime invokes the agent because a new inbox file
  appeared.

The plugin ships three mechanisms to keep an agent informed, in decreasing
order of latency win.

### A. Prompt-submit hook (recommended baseline)

A small shell hook checks the inbox before every prompt and prepends a
notice if anything new is waiting. Doesn't wake an idle session, but makes
"process inbox before continuing" automatic the moment the user types.

The hook lives at `scripts/check-inbox-hook.sh` next to this skill. Wire it
into `.claude/settings.json`:

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "matcher": "",
        "hooks": [
          { "type": "command", "command": "/abs/path/to/plugins/agent-bus/scripts/check-inbox-hook.sh" }
        ]
      }
    ]
  }
}
```

The hook resolves `AGENT_ID` from the `AGENT_ID` env var, falling back to
the normalized basename of `$PWD`. Walks up from `$PWD` to find the nearest
`.agent-bus/` and exits silently if there's no bus or no new messages.

### C. External filesystem watcher (true event-driven)

For sub-second wake-up when a new message arrives, run the bundled Node
watcher as a background daemon. It uses `fs.watch()` to monitor every
`agents/<id>/inbox/` under the workspace, and on new file invokes
`claude -p` in the matching project directory.

```bash
node plugins/agent-bus/scripts/watch.mjs ~/workspace
```

One process per workspace. Backgrounded with `nohup`, a launchd plist, or a
systemd unit. Requires the `claude` CLI on `PATH`.

The watcher spawns a fresh Claude session per event — there is no
session-continuity, but the inbox is the source of truth so this is fine.

### D. Polling fallback (no host runtime)

If neither hook nor watcher is available, an agent can self-pace by polling
its own inbox every two minutes:

```
/loop 2m /agent-bus:coordinate
```

The loop survives only the current Claude Code session. For longer cadence
across sessions, register a cloud cron via the `/schedule` skill.

---

## Human Transcript

The shared markdown file is only for human-readable history:

```txt
.agent-bus/chat.md
```

Every sent or processed message appends a **minimal two-part entry**: a
header line with the local date, time, and sender's `AGENT_ID`, then the
message body in natural prose. Address the recipient by name in the body.
Separate entries with one blank line.

```markdown
2026-05-25 20:46 steg_v0
I did this and that, dear steg_deploy, could u pls do that now?

2026-05-25 20:51 steg_deploy
Done. Deployed to steg-poc; healthz green. Over to you for the next round.
```

**Format rules:**

- Header: `YYYY-MM-DD HH:MM <agent_id>` — local time, no timezone suffix,
  24-hour clock, exactly one space between fields.
- No `##`/`#` heading prefix — keep the line plain so the file scans
  cleanly as a chat.
- No metadata in the transcript (no priority, type, message ID, thread,
  acceptance criteria). All of that lives in the inbox JSON for machine
  consumption.
- Body: prose, conversational, addressed to the recipient by `AGENT_ID`.
- One blank line between entries.

If a body needs structure (bullet lists, code blocks, file paths), write it
naturally — markdown is fine. Just keep the header line clean.

**Do not use `chat.md` as the source of truth for pending work.** The inbox
JSON files are the source of truth; `chat.md` is human scrollback.

---

## Reply Rules

When replying to a message:

- Set `type` to `reply`, `status`, `blocker`, or `decision`.
- Set `reply_to` to the original message ID.
- Use the same `thread`.
- Address the reply to the original sender.
- Include what changed, what was verified, and what remains risky.

Example reply body:

```json
{
  "schema": "agent-bus-message-v1",
  "id": "2026-05-25T14-35-10Z_d91b7a",
  "created_at": "2026-05-25T14:35:10Z",
  "from": "project-b",
  "to": "project-a",
  "type": "reply",
  "thread": "auth-refactor",
  "priority": "normal",
  "status": "done",
  "requires_reply": false,
  "reply_to": "2026-05-25T14-22-31Z_8f3a2c",
  "subject": "Client auth calls updated",
  "body": "Updated Project B to use getSession(). Tests pass.",
  "artifacts": [
    {
      "kind": "file",
      "path": "project-b/src/api/sessionClient.ts",
      "note": "Replaced readSession() with getSession()."
    }
  ],
  "verification": [
    "Ran npm test in project-b.",
    "Searched for remaining readSession() calls; none found."
  ],
  "risks": [
    "Manual browser smoke test still recommended."
  ]
}
```

---

## Conflict Avoidance

Before editing files likely touched by another agent:

1. Check your inbox.
2. Search recent `chat.md` entries for the relevant thread.
3. If unsure, send a `status` or `request` message before editing.
4. If you detect overlapping work, send a `blocker` message and wait for
   clarification unless the safe next step is obvious.

---

## Thread Naming

Use stable, short thread names:

- `auth-refactor`
- `frontend-api-sync`
- `schema-migration`
- `test-failures`
- `release-prep`

Use the same thread name across all related messages.

---

## Message Validation

Before acting on a message, ensure required fields exist:

- `schema`
- `id`
- `created_at`
- `from`
- `to`
- `type`
- `thread`
- `priority`
- `subject`
- `body`

If a required field is missing:

1. Move message to `failed/`.
2. Send `blocker` to sender.
3. Append failure summary to `chat.md`.

---

## Idempotency

Messages may be seen more than once if the runtime crashes.

Therefore:

- Before doing work, check whether the requested change is already done.
- Replies should mention whether work was newly performed or already complete.
- Do not duplicate code changes just because a message is reprocessed.
- Use `reply_to` and `thread` to avoid repeated loops.

---

## Loop Prevention

Do not create infinite agent-to-agent loops.

Rules:

- A `reply` should not require another reply unless there is a clear
  unresolved question.
- A `status` should usually have `requires_reply: false`.
- A `blocker` may require a reply.
- A `decision` should only require a reply if explicit approval is needed.
- Never respond to every message with a generic acknowledgement.

---

## Escalation

Send a `blocker` when:

- Required context is missing.
- A requested change is unsafe.
- Tests fail and the cause is not obvious.
- The request conflicts with another active thread.
- The message is malformed.
- The target files do not exist.
- Human decision is needed.

Send an `alert` when:

- Main branch/build is broken.
- A migration or API change breaks the other project.
- There is a security-sensitive issue.
- You detect data loss risk.

---

## Recommended Agent Behavior

When this skill is active, follow this order:

1. Process urgent/high inbox messages.
2. Process normal inbox messages relevant to current work.
3. Perform assigned project task.
4. Send messages for cross-project impacts.
5. Append concise summary to `chat.md`.
6. Re-check inbox before finalizing.
7. Reply to any message whose acceptance criteria you completed.

---

## Minimal Decision Policy

If you make a change that affects the other project, send a message.

Examples:

- API changed.
- Shared schema changed.
- Environment variable changed.
- Package version changed.
- Build command changed.
- Test fixture changed.
- Database migration changed.
- Generated types changed.
- Contract between services changed.

---

## Example: Request to Other Agent

```json
{
  "schema": "agent-bus-message-v1",
  "id": "2026-05-25T15-01-22Z_4c10aa",
  "created_at": "2026-05-25T15:01:22Z",
  "from": "project-a",
  "to": "project-b",
  "type": "request",
  "thread": "schema-migration",
  "priority": "high",
  "status": "new",
  "requires_reply": true,
  "reply_to": null,
  "subject": "User schema now requires displayName",
  "body": "Project A now requires user.displayName. Please update Project B payload creation and tests.",
  "artifacts": [
    {
      "kind": "file",
      "path": "project-a/db/migrations/20260525_add_display_name.sql",
      "note": "Schema migration"
    }
  ],
  "acceptance_criteria": [
    "Project B includes displayName when creating users.",
    "Project B tests pass.",
    "Reply with changed files."
  ],
  "context": {
    "repo": "project-a",
    "branch": "main"
  }
}
```

---

## Example: Blocker

```json
{
  "schema": "agent-bus-message-v1",
  "id": "2026-05-25T15-09-44Z_f813bd",
  "created_at": "2026-05-25T15:09:44Z",
  "from": "project-b",
  "to": "project-a",
  "type": "blocker",
  "thread": "schema-migration",
  "priority": "high",
  "status": "blocked",
  "requires_reply": true,
  "reply_to": "2026-05-25T15-01-22Z_4c10aa",
  "subject": "displayName source unclear",
  "body": "Project B does not currently collect displayName. Should it use email prefix as fallback, require a UI field, or defer user creation?",
  "artifacts": [],
  "options": [
    "Use email prefix as temporary fallback.",
    "Add displayName field to signup UI.",
    "Block user creation until displayName is available."
  ]
}
```

---

## Non-Goals

This skill is filesystem-first and intentionally has no Redis, database, HTTP
service, or central orchestrator. If coordination grows beyond two or three
agents, or messages need durable acknowledgements across machines, port the
same message schema to Redis Streams, NATS, or another real message bus.

---

## Host Runtime Requirement

The skill defines the protocol, but **something still has to invoke each agent
when a new inbox file appears.** See "When to Process Inbox" above — the
plugin bundles a prompt-submit hook (A), an external watcher (C), and a
polling-loop recipe (D). Pick the one that fits the deployment; otherwise
agents fall back to manual `/agent-bus:coordinate` invocations, which the
protocol tries to avoid.

---

## One-Sentence Rule

Use structured inbox files for machine coordination and `chat.md` only for
human-readable history.
