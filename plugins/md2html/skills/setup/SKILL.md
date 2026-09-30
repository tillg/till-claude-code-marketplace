---
description: Set up md2html reports in a project — reports.json, optional theme, editor integration, just recipes, vendored tool for CI, CLAUDE.md pointer
disable-model-invocation: true
argument-hint: "[project-dir]"
---

Set up a project so its `*-report.md` files build into HTML with `md2html`.

**Input**: optionally the project directory. Default: the git root of the cwd,
else the cwd. Call it `$ROOT`; every file below is relative to it.

**Rule: idempotent.** Never overwrite or rewrite an existing file without
asking. For each step, if the file already exists, show what you would change
and ask first (or skip if it already matches). Running setup twice must be
safe.

**Steps**

1. **Locate the tool**

   ```bash
   MD2HTML=$(find ~/.claude/plugins/cache -path '*/md2html/*/dist/md2html.mjs' 2>/dev/null | sort -V | tail -1)
   [ -n "$MD2HTML" ] || MD2HTML=$(find ~/.claude/plugins -path '*/md2html/dist/md2html.mjs' 2>/dev/null | head -1)
   ```

   If `$ROOT/tools/md2html.mjs` already exists, it is the vendored copy: use it
   instead. Replace it only if the user asks.

2. **Survey existing reports**

   Find existing reports, ignoring `node_modules`, `.git`, `dist`, `build`:
   - `*-report.md` → derive `sources` globs from their directories (for
     example all under `specs/` → `specs/**/*-report.md`, the default).
   - `*-report.html` or other hand-written HTML reports without a `.md` next to
     them → candidates for menu entries only. Converting them to Markdown is a
     separate task; mention it, don't do it.

3. **Ask the user** (**AskUserQuestion**, batching questions into as few calls as possible)

   - Brand name for the menu bar (propose the repo name).
   - Brand icon: path to an image in the repo, or none.
   - `sources` globs: the proposal from step 2 (or the default
     `specs/**/*-report.md`).
   - Menu bar entries: the found reports, in path order, labelled by their
     `title` (or none).
   - Create a theme stub `reports/theme.css`? (default no)
   - Vendor the tool into `tools/md2html.mjs` for CI? (default yes when the
     repo has CI config such as `.github/workflows/`)

4. **Write `reports.json`**

   Closed schema; unknown keys are a config error. Omit keys that equal their
   defaults (`sources` = `["specs/**/*-report.md"]`, `lang` = `"en"`).

   ```json
   {
     "sources": ["specs/**/*-report.md"],
     "reports": [
       { "path": "specs/03_browser_only/browser-only-report.md", "label": "Browser only" }
     ],
     "brand": { "name": "karpathy.app", "icon": "public/icon.svg" },
     "theme": "reports/theme.css"
   }
   ```

   Keys: `sources` (globs with `**`, `*`, `?`), `reports` (`{path, label}[]`,
   `.md` paths are rewritten to `.html`), `brand` (`{name, icon?}`), `lang`,
   `theme`. Paths are relative to `$ROOT` (absolute paths are a config error);
   `reports[].path` and `brand.icon` may also be URLs. Set `theme` only if the
   file exists or is created in step 5.

5. **Theme stub** (only if asked): `reports/theme.css`. It holds **only
   token overrides**, all commented out, so the page still uses the house
   style until someone edits it:

   ```css
   /* Project theme for md2html reports. Layered after base.css.
    * Contract (renaming one is a MAJOR md2html version):
    *   Tokens:   --bg --fg --muted --line --card --accent --go --go-bg
    *             --partial --partial-bg --no --no-bg --code --figure-bg
    *   Classes:  reports-nav brand item top appicon report-meta
    *             report-status (+ research ongoing implemented) sub tldr toc
    *             tbl v go partial no cards card mmd-src
    *   Elements: main figure figcaption h1-h4 table
    * Custom properties outside this list trigger a theme-tokens warning.
    */
   :root {
     /* --accent: #0071e3; */
   }

   @media (prefers-color-scheme: dark) {
     :root {
       /* --accent: #2997ff; */
     }
   }
   ```

6. **Vendor the tool** (only if asked): copy `"$MD2HTML"` to
   `tools/md2html.mjs`. It is a single self-contained file; commit it. CI then
   runs `node tools/md2html.mjs check`, and all later steps use this path.
   Updating it later is a deliberate copy, which shows up as a diff (the tool
   version is in every report's `<meta name="generator">`).

7. **Editor integration: `.remarkrc.mjs`**

   Import from the vendored tool if it exists, else from the plugin path
   found in step 1 (absolute; it changes when the plugin updates, so say so
   and recommend vendoring):

   ```js
   import { preset } from './tools/md2html.mjs';

   export default preset;
   ```

   With the `vscode-remark` extension this gives lint squiggles and
   format-on-save in VS Code, using the same rules as the CLI.

8. **`just` recipes**

   Append to an existing `justfile` (or `Justfile`), else create `justfile`.
   Skip recipes that already exist. Use `tools/md2html.mjs` if vendored,
   else the plugin path:

   ```just
   # Build report HTML from *-report.md
   reports:
       node tools/md2html.mjs build

   # CI gate: fails on lint errors, stale HTML or non-canonical Markdown
   reports-check:
       node tools/md2html.mjs check
   ```

9. **CLAUDE.md pointer**

   Append one line to the project's `CLAUDE.md` (ask before creating one if
   it doesn't exist; skip if a pointer is already there):

   ```markdown
   - Reports (`*-report.md`): write and edit them with `/md2html:write`; the `.html` next to each is generated, never edit it.
   ```

10. **Verify and report**

    Run `node <tool> check` from `$ROOT`. Exit `2` means `reports.json` is
    invalid: fix it. Exit `1` on existing reports is expected (not yet
    built or not canonical): list the files and suggest
    `node <tool> fmt && node <tool> build`, or `/md2html:build`.

    Summarise which files were created, changed or skipped, and the next
    step: `/md2html:write` to write a report.
