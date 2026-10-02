---
description: Build report HTML from `*-report.md` with md2html (or check that it is up to date) and open the result in the browser
disable-model-invocation: false
argument-hint: "[--check] [paths…]"
---

Build the project's reports with `md2html`, report what changed or failed,
and open the result over `http://localhost`.

**Input**: optional report paths, and optionally `--check`. Without paths,
every file matching `reports.json` → `sources` is processed.

**Steps**

1. **Find the project root and the tool**

   The project root is the nearest directory above the cwd that holds
   `reports.json`. If there is none, tell the user to run `/md2html:setup` and
   stop.

   ```bash
   ROOT=$PWD; while [ "$ROOT" != / ] && [ ! -f "$ROOT/reports.json" ]; do ROOT=$(dirname "$ROOT"); done
   MD2HTML="$ROOT/tools/md2html.mjs"
   [ -f "$MD2HTML" ] || MD2HTML=$(find ~/.claude/plugins/cache -path '*/md2html/*/dist/md2html.mjs' 2>/dev/null | sort -V | tail -1)
   [ -n "$MD2HTML" ] || MD2HTML=$(find ~/.claude/plugins -path '*/md2html/dist/md2html.mjs' 2>/dev/null | head -1)
   ```

   A vendored `tools/md2html.mjs` wins over the plugin copy, so local builds
   match CI.

2. **Run it** from `$ROOT`

   - Default: `node "$MD2HTML" build [paths]`. It writes each `.html` only
     when its bytes changed.
   - With `--check`: `node "$MD2HTML" check` (no paths), or
     `node "$MD2HTML" build --check [paths]`. `check` runs `fmt --check`,
     `lint` and `build --check` and writes nothing. `check` (and `build --check`
     without paths) also reports orphaned generated `.html` whose `.md` was
     deleted (fix: delete the HTML); `check` also flags `reports.json` menu
     entries that point at missing files.

   Exit codes: `0` clean · `1` lint errors, stale HTML or non-canonical `.md` ·
   `2` usage or config error (for example an unknown key in `reports.json`).

3. **Report the result**

   List the files that were written, stale or failed, each with its messages
   (`path:line:col  severity  message  [rule]`). For stale or non-canonical
   files, name the fix: `node "$MD2HTML" fmt` / `build`. For lint errors,
   offer to fix them in the `.md` (never in the `.html`). On exit 2, show the
   config error as-is.

   Stop here for `--check`, or if the build failed.

4. **Serve and open**

   Open the page over `http://localhost`, never the `file://` path (an
   already open tab would show the old version). Serve with `md2html serve`:
   it binds 127.0.0.1 and hands out page files only (`.html`, `.css`,
   images) — never `.env`, `.md`, source code, dot-dirs or anything outside
   the root. **Never** use `python3 -m http.server`: it would expose the
   whole project.

   `serve` needs md2html ≥ 0.3.0. If `$MD2HTML` is older (an old vendored
   `tools/md2html.mjs`), serve with the newest plugin copy instead:

   ```bash
   ok() { v=$(node "$1" --version 2>/dev/null) && [ "$(printf '0.3.0\n%s\n' "$v" | sort -V | head -1)" = 0.3.0 ]; }
   SERVE=$MD2HTML; ok "$SERVE" || SERVE=$(find ~/.claude/plugins/cache ~/.claude/plugins/marketplaces \
     -path '*/md2html/*dist/md2html.mjs' 2>/dev/null | while read -r c; do ok "$c" && echo "$(node "$c" --version) $c"; done | sort -V | tail -1 | cut -d' ' -f2-)
   ```

   **Reuse a running server** of this project (one per project, however often
   reports are built — `/spec:view` uses the same one):

   ```bash
   REAL=$(cd "$ROOT" && pwd -P)
   inroot() { [ "$(lsof -a -d cwd -p "$1" -Fn 2>/dev/null | sed -n 's/^n//p')" = "$REAL" ]; }
   for p in $(pgrep -f "md2html.mjs serve"); do
     inroot "$p" && echo "SERVER_PID=$p PORT=$(lsof -a -p "$p" -iTCP -sTCP:LISTEN -P -n -Fn | sed -n 's/^n.*://p' | head -1) (reused)"
   done
   ```

   If none is running, start one in the background. Logs go to `$ROOT/tmp/`
   if that directory exists, else `/tmp/`:

   ```bash
   LOG=$( [ -d "$ROOT/tmp" ] && echo "$ROOT/tmp" || echo /tmp )
   cd "$ROOT"
   nohup node "$SERVE" serve > "$LOG/md2html-serve.log" 2>&1 &
   SERVER_PID=$!
   for i in $(seq 50); do PORT=$(sed -n 's|.*http://localhost:\([0-9]*\)/.*|\1|p' "$LOG/md2html-serve.log"); [ -n "$PORT" ] && break; sleep 0.1; done
   echo "SERVER_PID=$SERVER_PID PORT=$PORT"
   ```

   Then open each built report once it answers:

   ```bash
   URL="http://localhost:$PORT/<path>.html"
   for i in $(seq 50); do curl -sfo /dev/null "$URL" && break; sleep 0.1; done
   curl -sfo /dev/null "$URL" && open "$URL"
   ```

   If it still doesn't answer, show the tail of the server log instead of
   opening. `<path>` is relative to `$ROOT`.

5. **Tell the user** the URL(s), the server PID (marked "reused" if it was)
   and how to stop it: `kill <pid>`.

**Guardrails**

- Never serve with `python3 -m http.server` or any server that exposes the
  whole project — only `md2html serve`
- At most one server per project: reuse, never start a second
- Never edit the generated `.html`; fix the `.md`
- Always print the server PID and the stop command — it keeps running
