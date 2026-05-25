#!/usr/bin/env node
// agent-bus: external inbox watcher
//
// Watches every .agent-bus/agents/<agent-id>/inbox/ dir under the given
// workspace root. When a new message file appears, spawns
//   claude -p "<wake-prompt>"
// in the matching project directory (assumed to be <workspace-root>/<agent-id>/).
//
// Usage:
//   node watch.mjs [workspace-root]
// Defaults workspace-root to the current working directory.
//
// Requires `claude` CLI on PATH. One process per workspace; run as a
// background daemon (e.g. `nohup node watch.mjs ~/workspace &` or a
// launchd/systemd unit).

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const root = path.resolve(process.argv[2] || process.cwd());
const busDir = path.join(root, ".agent-bus", "agents");

if (!fs.existsSync(busDir)) {
  console.error(`agent-bus: no .agent-bus/agents/ under ${root}`);
  process.exit(1);
}

const agents = fs.readdirSync(busDir).filter((name) => {
  const agentDir = path.join(busDir, name);
  if (!fs.statSync(agentDir).isDirectory()) return false;
  return fs.existsSync(path.join(agentDir, "inbox"));
});

if (agents.length === 0) {
  console.error(`agent-bus: no agents with inbox/ under ${busDir}`);
  process.exit(1);
}

console.log(`agent-bus: watching ${agents.length} inbox(es) under ${busDir}`);

for (const agentId of agents) {
  const inbox = path.join(busDir, agentId, "inbox");
  const projectDir = path.join(root, agentId);

  if (!fs.existsSync(projectDir)) {
    console.warn(`agent-bus: no project dir at ${projectDir}; skipping ${agentId}`);
    continue;
  }

  // Pre-populate "seen" with anything already in the inbox so we don't
  // dispatch a backlog on startup.
  const seen = new Set(fs.readdirSync(inbox));

  fs.watch(inbox, (eventType, filename) => {
    if (!filename) return;
    if (filename.startsWith(".tmp_")) return;
    if (!filename.endsWith(".json")) return;
    if (eventType !== "rename") return;
    if (seen.has(filename)) return;

    const full = path.join(inbox, filename);
    if (!fs.existsSync(full)) return; // deletion event

    seen.add(filename);

    console.log(`[${agentId}] new message: ${filename}`);
    const wake = `Agent-bus inbox message arrived (${filename}). Run /agent-bus:coordinate to process your inbox.`;

    const child = spawn("claude", ["-p", wake], {
      cwd: projectDir,
      stdio: "inherit",
    });
    child.on("error", (err) => {
      console.error(`[${agentId}] failed to spawn claude:`, err.message);
    });
  });

  console.log(`  - ${agentId} -> ${inbox}`);
}

console.log("agent-bus: watcher running. Ctrl-C to stop.");
