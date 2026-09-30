---
description: Open a spec change (or all specs) as HTML in the browser — sets up md2html's spec profile, starts a watcher and a local server
disable-model-invocation: true
argument-hint: "[change-name]"
metadata:
  author: Till Gartner
---

Show the project's spec files as HTML in the browser. The `md2html` plugin
renders every spec `.md` to a `.html` next to it (inner nav per directory,
"up" link to a project index, Mermaid drawn in the browser); a watcher keeps
the HTML current while anyone edits the `.md`. The HTML is gitignored — a
local reading aid only.

**Input**: optionally a change name (e.g. `/spec:view add-auth`). With a name,
open that change; without one, open the project index.

**Steps**

1. **Locate md2html**

   ```bash
   TOP=$(git rev-parse --show-toplevel 2>/dev/null); ROOT=$(pwd -P)
   while [ ! -f "$ROOT/reports.json" ] && [ "$ROOT" != "${TOP:-/}" ] && [ "$ROOT" != / ]; do ROOT=$(dirname "$ROOT"); done
   [ -f "$ROOT/reports.json" ] || ROOT=${TOP:-$(pwd -P)}
   ok() { v=$(node "$1" --version 2>/dev/null) && case $v in [0-9]*.*) ;; *) false;; esac &&
     [ "$(printf '0.2.0\n%s\n' "$v" | sort -V | head -1)" = 0.2.0 ] && echo "$v $1"; }
   MD2HTML=$( [ -f "$ROOT/tools/md2html.mjs" ] && ok "$ROOT/tools/md2html.mjs" | cut -d' ' -f2- )
   [ -n "$MD2HTML" ] || MD2HTML=$(find ~/.claude/plugins/cache ~/.claude/plugins/marketplaces \
     -path '*/md2html/*dist/md2html.mjs' 2>/dev/null | while read -r c; do ok "$c"; done | sort -V | tail -1 | cut -d' ' -f2-)
   echo "ROOT=$ROOT MD2HTML=$MD2HTML"
   ```

   The project root is the nearest directory with `reports.json`, but never
   above the git root (`git rev-parse --show-toplevel`). If there is no
   `reports.json` up to the git root, the root is the git root and
   `reports.json` is created there (outside git: the cwd). Never use an outer
   repo's `reports.json`.

   The tool is the **highest version ≥ 0.2.0** among all candidates: the
   project's `tools/md2html.mjs`, the plugin cache
   (`~/.claude/plugins/cache/**/md2html/**/dist/md2html.mjs`) and marketplace
   checkouts (`~/.claude/plugins/marketplaces/**/plugins/md2html/dist/md2html.mjs`),
   each checked with `node <c> --version`. A vendored `tools/md2html.mjs`
   wins only if it is ≥ 0.2.0 itself. Older copies don't know the `specs` key.

   **If `MD2HTML` is empty:** tell the user the viewer needs md2html ≥ 0.2.0
   — run `/plugin marketplace update till-claude-code-marketplace`, then
   `/plugin install md2html@till-claude-code-marketplace` — and stop.
   Everything else in the spec plugin works without it.

2. **Ensure `reports.json` has a `specs` key** (in `$ROOT`)

   - No `reports.json`: create it as `{"specs": {}}` (defaults: sources
     `specs/**/*.md`, index `index.html`).
   - `reports.json` without `specs`: add `"specs": {}`, keep everything else
     as is. Files matching the report `sources` (default
     `specs/**/*-report.md`) stay reports even under `specs/`, so no narrower
     spec glob is needed.
   - `specs` already present: leave it.

   **Index path:** if `$ROOT/index.html` exists and does **not** contain
   `<meta name="generator" content="md2html` (a hand-written page, e.g. a web
   project's), set `"index": "specs/index.html"` inside `specs` — the CLI
   refuses to overwrite a hand-written index. `INDEX` below is
   `specs.index` (default `index.html`).

   Edit the JSON with a small script (`node -e` / `python3 -c`), not by hand,
   and keep 2-space indentation.

3. **Ensure `.gitignore` covers the HTML** (in `$ROOT`)

   Append whichever lines are missing, in this order (create `.gitignore` if
   absent):

   ```
   specs/**/*.html
   !specs/**/*-report.html
   /index.html
   ```

   Why the negation: report HTML under `specs/` is committed, and
   `specs/**/*.html` alone would hide it. Write one `!` line per report
   `sources` glob ending in `.md`, with `.md` → `.html` (the default glob
   gives the line above); it must come after `specs/**/*.html`. The last line
   is `/<INDEX>` (default `/index.html`; `/specs/index.html` when moved).

4. **Build once** (spec files and the index only; committed report HTML is
   never rebuilt here)

   ```bash
   cd "$ROOT" && node "$MD2HTML" build --specs
   ```

   Exit `2` is a config or usage error (the index path is outside the root,
   doesn't end in `.html`, collides with a page, or is a hand-written file):
   show the message as-is and stop. A warning that a hand-written `.html` next
   to a spec `.md` was left alone doesn't block viewing; pass it on. `build`
   prints no lint messages; to check the frontmatter, run
   `node "$MD2HTML" lint` separately and offer to fix what it reports.

5. **Start the watcher and the server** in the background

   Logs go to `$ROOT/tmp/` if that directory exists (and is gitignored),
   else `/tmp/`.

   First look for a watcher already running **in this root** (a watcher of
   another project must not be reused):

   ```bash
   LOG=$( [ -d "$ROOT/tmp" ] && echo "$ROOT/tmp" || echo /tmp )
   REAL=$(cd "$ROOT" && pwd -P)
   for p in $(pgrep -f "md2html.mjs build.*--watch"); do
     [ "$(lsof -a -d cwd -p "$p" -Fn 2>/dev/null | sed -n 's/^n//p')" = "$REAL" ] && echo "WATCH_PID=$p (reused)"
   done
   ```

   If none, start one with the absolute tool path from step 1:

   ```bash
   cd "$ROOT" && nohup node "$MD2HTML" build --specs --watch > "$LOG/spec-view-watch.log" 2>&1 &
   echo "WATCH_PID=$!"
   ```

   Then the server:

   ```bash
   PORT=$(python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1", 0)); print(s.getsockname()[1])')
   nohup python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$ROOT" > "$LOG/spec-view-server.log" 2>&1 &
   echo "SERVER_PID=$! PORT=$PORT"
   ```

6. **Wait, then open**

   Target page:
   - With a change name: `specs/changes/<change>/<first file>.html`, where the
     first file is the one with the lowest `order` in its frontmatter
     (usually `proposal`), else the first `.md` by name.
     If `specs/changes/<change>/` doesn't exist, list the available changes
     and open the index instead.
   - Without: `<INDEX>` (default `index.html`).

   ```bash
   URL="http://localhost:$PORT/<target>"
   for i in $(seq 50); do curl -sfo /dev/null "$URL" && break; sleep 0.1; done
   curl -sfo /dev/null "$URL" && open "$URL"
   ```

   If it still doesn't answer, show the tail of both logs instead of opening.
   Always open an `http://localhost` URL, never `file://` (an open tab would
   keep showing the old version).

7. **Report**

   ```
   ## Spec viewer running

   URL: http://localhost:<port>/<target>
   Index: http://localhost:<port>/<INDEX>
   Watcher: PID <watch-pid> (log: <LOG>/spec-view-watch.log)
   Server:  PID <server-pid> (log: <LOG>/spec-view-server.log)

   Edits to any spec .md (by Claude or any editor) rebuild the HTML within a
   second; reload the tab to see them.
   Stop: kill <watch-pid> <server-pid>
   ```

   Also list what was set up this run (`reports.json` created/changed,
   `.gitignore` lines added), if anything.

**Guardrails**

- Never edit the generated `.html`; fix the `.md` instead
- Never overwrite a hand-written `index.html` — move the index to
  `specs/index.html` via `specs.index`
- Don't touch other keys in an existing `reports.json`
- Always pass `--specs` to `build`: committed report HTML is rebuilt only on
  purpose (`/md2html:build`), never by the viewer
- Don't commit anything; the spec HTML stays gitignored
- Always print the PIDs and the stop command — the processes keep running
