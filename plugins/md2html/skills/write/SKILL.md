---
description: Write, update or edit a report (`*-report.md`) that md2html renders into a styled HTML page. Use when the user asks to "write a report", "write a research report", "update the report", "add a section to the report", or when editing any `*-report.md` file in a project with a `reports.json`.
argument-hint: "[path/to/x-report.md] [what to write]"
---

# Write a report

A report is a Markdown file (`*-report.md`) that `md2html` turns into one
self-contained HTML page next to it. The `.md` is the source of truth. The
`.html` is generated and committed, and nobody edits it by hand.

The full syntax (frontmatter keys, directives, attributes) is in
[syntax.md](syntax.md). Read it before your first edit in a session.

## Locate the tool

Run from the project root (the directory holding `reports.json`):

```bash
MD2HTML=tools/md2html.mjs
[ -f "$MD2HTML" ] || MD2HTML=$(find ~/.claude/plugins/cache -path '*/md2html/*/dist/md2html.mjs' 2>/dev/null | sort -V | tail -1)
[ -n "$MD2HTML" ] || MD2HTML=$(find ~/.claude/plugins -path '*/md2html/dist/md2html.mjs' 2>/dev/null | head -1)
```

If there is no `reports.json` anywhere above the cwd, the project is not set
up: tell the user to run `/md2html:setup` and stop.

## Workflow

1. **New report → `new`, never from memory.**
   `node "$MD2HTML" new specs/07_x/x-report.md --title "X"` writes valid
   frontmatter, a `:::tldr` and the four standard sections, in canonical
   form. Without `--title`, the title comes from the file name (`x-report.md`
   → `X`). Do not type frontmatter yourself. `new` refuses to overwrite an
   existing file, and warns if the path is not matched by `sources` (then
   build and check skip it: pick a matching path).
2. **Edit the `.md`, never the `.html`.** Hand edits to the HTML are lost on
   the next build and fail `check`.
3. **Set `edited` to today** (`YYYY-MM-DD`) whenever the content changes.
   Leave `created` alone. `build` never reads the clock, so nothing else will
   update the date.
4. **Let the hook lint and format.** After every Write/Edit on a report, the
   plugin hook lints the file as you wrote it, and formats it only if it has
   no lint errors:
   - Lint errors come back as `file:line:col  error  message  [rule]`, and the
     file is left as you wrote it. Fix **every** message in the same turn,
     before doing anything else.
   - Warnings come back as context. Fix them unless there is a reason not to.
   - If the hook says *"md2html fmt rewrote <file> into canonical form"*,
     **Read the file again** before the next Edit. Otherwise the Edit fails
     because the file changed on disk.
5. **Build and look at it.**
   `node "$MD2HTML" build <file>`, then serve the project root and open the
   page over `http://localhost` (a fresh load, not `file://`), as
   `/md2html:build` does. Report the URL.

## House layout

The layout comes from plain Markdown. Write only the content:

- **TL;DR first.** One `:::tldr` right after the frontmatter with the short
  answer. The build moves it to the top of the page.
- **Numbered `##` sections.** Numbering is automatic: write `## Findings`,
  never `## 2. Findings` (lint warns: `heading-number`). A TOC appears with
  4 or more sections.
- **Stable ids.** Give every `##` an explicit id, `## Findings {#findings}`,
  and keep it when you rename the heading. Other reports link to it.
- **Figures** are an image alone in its own paragraph. The alt text is the
  caption, so it must be a real sentence:
  `![Request flow from browser to API](diagrams/request-flow.svg)`.
  Commit the `.svg` **and** its source `.mmd` next to it (same name). The
  build links the `.mmd` but does **not** render Mermaid, so render the SVG
  yourself (for example `npx -y @mermaid-js/mermaid-cli -i x.mmd -o x.svg`)
  and re-render it when the `.mmd` changes.
- **Links between reports** point at the `.md` (`../03_x/x-report.md#findings`).
  The build rewrites them to `.html`, and lint checks that the file and the
  `#id` exist.
- **Sources last.** The final section is `## Sources {#sources}`.
- **No raw HTML.** It renders escaped. Use a directive from
  [syntax.md](syntax.md) (`:::tldr`, `::::cards` / `:::card{title="…"}`,
  `:verdict[label]{tone="go"}`) or plain Markdown.
- **Directives only from the registry.** Unknown ones render as literal text
  and fail lint.
- **Frontmatter values:** quote a value that contains ` #` or `: `, or
  starts with `*` or `&` (`subtitle: "Why #3 wins: cost"`); unquoted, YAML
  reads it as a comment, a nested key or an alias.
- **Times and ratios before `[`:** `10:30[^1]` parses as a directive `:30[…]`.
  Escape the colon: `10\:30[^1]`. A bare `16:00` or `3:1` is fine.
