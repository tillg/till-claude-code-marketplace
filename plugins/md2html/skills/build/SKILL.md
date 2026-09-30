---
description: Build report HTML from `*-report.md` with md2html (or check that it is up to date) and open the result in the browser
disable-model-invocation: true
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

   Serve the project root on a free port in the background (use
   `run_in_background`), then open the page over `http://localhost`. Never
   `open` the `file://` path: an already open tab would show the old version.

   ```bash
   PORT=$(python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1", 0)); print(s.getsockname()[1])')
   python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$ROOT"   # background
   ```

   The server needs a moment to start. Poll until it answers (up to ~5 s),
   then open each built report:

   ```bash
   for i in $(seq 50); do curl -sfo /dev/null "http://localhost:$PORT/<path>.html" && break; sleep 0.1; done
   curl -sfo /dev/null "http://localhost:$PORT/<path>.html" && open "http://localhost:$PORT/<path>.html"
   ```

   If it still doesn't answer, check the server's output instead of opening.

   `<path>` is relative to `$ROOT`. Tell the user the URL and that the server
   keeps running in the background.
