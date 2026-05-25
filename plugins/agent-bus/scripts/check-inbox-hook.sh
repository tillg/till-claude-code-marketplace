#!/usr/bin/env bash
# agent-bus: UserPromptSubmit hook
#
# Prepends a notice to every Claude prompt when the current project has
# unread inbox messages. Drop into .claude/settings.json under
# hooks.UserPromptSubmit:
#
#   {
#     "hooks": {
#       "UserPromptSubmit": [
#         {
#           "matcher": "",
#           "hooks": [
#             { "type": "command", "command": "/abs/path/to/check-inbox-hook.sh" }
#           ]
#         }
#       ]
#     }
#   }
#
# Resolves AGENT_ID from $AGENT_ID env var, falling back to the normalized
# basename of $PWD. Walks up from $PWD to find the nearest .agent-bus/.
# Prints nothing (exits 0) when there is no bus or no new messages.

set -euo pipefail

if [ -n "${AGENT_ID:-}" ]; then
  agent_id="$AGENT_ID"
else
  agent_id=$(basename "$PWD" \
    | tr '[:upper:]' '[:lower:]' \
    | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//')
fi

dir="$PWD"
bus_root=""
while [ "$dir" != "/" ]; do
  if [ -d "$dir/.agent-bus" ]; then
    bus_root="$dir/.agent-bus"
    break
  fi
  dir=$(dirname "$dir")
done

[ -n "$bus_root" ] || exit 0

inbox="$bus_root/agents/$agent_id/inbox"
[ -d "$inbox" ] || exit 0

shopt -s nullglob
new_messages=()
for f in "$inbox"/*.json; do
  base=$(basename "$f")
  [[ "$base" == .tmp_* ]] && continue
  new_messages+=("$base")
done

[ "${#new_messages[@]}" -gt 0 ] || exit 0

echo "[agent-bus] ${#new_messages[@]} new inbox message(s) for agent '$agent_id':"
for m in "${new_messages[@]}"; do
  echo "  - $m"
done
echo "Run /agent-bus:coordinate to process them before continuing."
