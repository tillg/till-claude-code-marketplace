# md2html — deterministic Markdown → HTML reports

`md2html` turns report Markdown (`*-report.md`) into styled, self-contained
HTML pages. It has two parts:

- **A deterministic CLI** (Node, unified/remark) with `new`, `fmt`, `lint`,
  `build`, `check` and `syntax`. The same input bytes, theme and tool version
  always produce the same output bytes, so the HTML can be committed and
  checked in CI.
- **Skills and a hook** that teach Claude the format and feed lint messages
  back after every edit, so it fixes its own mistakes in the same turn.

The `.md` is the source of truth. The `.html` next to it is generated,
committed, and never edited by hand. Each project can bring its own
`theme.css` on top of a fixed template and a versioned class/token contract.

With a `specs` key in `reports.json` it also renders spec files (the spec
plugin's changes) as local, gitignored pages: see [Spec profile](#spec-profile).

## Install

```
/plugin marketplace add tillg/till-claude-code-marketplace
/plugin install md2html@till-claude-code-marketplace
```

Then run `/md2html:setup` once in each project that has reports. The plugin
ships a committed bundle (`dist/md2html.mjs`), so it needs only `node`: no
`npm install` on first use.

## Skills

| Skill | Invocation | Purpose |
|---|---|---|
| `/md2html:write` | Model-invocable (triggers on "write a report", "update the report", `*-report.md`) | Workflow and house layout rules for writing and editing reports |
| `/md2html:build` | User only, `[--check] [paths…]` | Build (or check) reports, list stale or failed files, open the result over `http://localhost` |
| `/md2html:setup` | User only | Create `reports.json`, an optional theme stub, `.remarkrc.mjs`, `just` recipes, a vendored tool for CI, and a CLAUDE.md pointer |

The cheat sheet [`skills/write/syntax.md`](skills/write/syntax.md) is
generated from the directive registry by `md2html syntax`; a test keeps it in
sync.

## CLI

```
node md2html.mjs <command> [options] [paths]
```

| Command | What it does | Writes |
|---|---|---|
| `new <path> [--title "…"]` | Skeleton report in canonical form: frontmatter (`created` = `edited` = today, `status: research`), a `:::tldr`, and sections Context, Findings, Recommendation, Sources. Title defaults to the file name minus `-report.md`, with `-`/`_` → spaces and the first letter capitalised (`browser-only-report.md` → `Browser only`). Refuses to overwrite. Warns (exit 0) when the path is not matched by `sources`. | the new `.md` |
| `fmt [--check] [paths]` | Rewrite into canonical form. `--check` writes nothing and fails on any diff. | the `.md`, only if bytes changed |
| `lint [--format json] [paths]` | Messages as `path:line:col  severity  message  [rule-id]`, or JSON. Without paths it also lints the theme and the `reports.json` menu entries; `lint <paths>` checks only those reports. | nothing |
| `build [--check] [--watch] [--specs] [paths]` | Render `.md` → `.html`. `--check` fails on stale or missing HTML and, without paths, on orphaned generated HTML whose `.md` was deleted. `--watch` rebuilds on change, reloads `reports.json` and the theme, and picks up new reports (and spec files); it prints `watching N report(s) and M spec file(s)`. `--specs` builds only spec files and the index, never report HTML (also with `--watch`). | the `.html`, only if bytes changed |
| `check` | CI gate: `fmt --check` + `lint` + `build --check` over all sources (theme, menu entries and orphaned HTML included). Runs all three and exits with the worst code. | nothing |
| `syntax [--json]` | Cheat sheet (Markdown) or registry data for editor insert menus. | stdout |
| `serve [--port N]` | Serve the generated pages on `127.0.0.1` (random port by default; `/` → the index). Only `.html`, images and `.css` are served — never `.md`, sources, configs, dot-dirs, `node_modules` or anything outside the root. Used by `/spec:view`. | nothing |

Without paths, `fmt`, `lint`, `build` and `check` run over every file matching
`sources`, sorted (dot-dirs, `node_modules` and `.worktrees` are skipped).
Explicit paths outside `sources` are still processed. A directory argument
expands to the sources inside it. A path that is not a `.md` file is rejected
(exit 2).

**Exit codes:** `0` clean · `1` lint errors, stale HTML or non-canonical
Markdown · `2` usage or config error.

The tool location used by the skills: a project-local `tools/md2html.mjs`
first, else the newest `~/.claude/plugins/cache/**/md2html/<version>/dist/md2html.mjs`.

`dist/md2html.mjs` is also a library. It exports `format`, `lint`, `build`,
`preset` (for `.remarkrc.mjs`), `loadConfig` and `findRoot`, and runs the CLI
only when executed directly.

## `reports.json`

One file per repo, found by walking up from the cwd (CLI) or from the edited
file (hook). Its directory is the **project root**; every path in it is
relative to that root. Without a `reports.json`, the hook does nothing.

```json
{
  "sources": ["specs/**/*-report.md"],
  "reports": [
    { "path": "specs/03_browser_only/browser-only-report.md", "label": "Browser only" },
    { "path": "specs/v1-plan.html", "label": "v1 plan" }
  ],
  "brand": { "name": "karpathy.app", "icon": "public/icon.svg" },
  "lang": "en",
  "theme": "reports/theme.css"
}
```

Closed schema: unknown keys are a config error (exit 2), and so are absolute
paths. URLs (`https://…`, `//host`) are allowed only for `reports[].path` and
`brand.icon`.

| Key | Type | Required | Default | Meaning |
|---|---|---|---|---|
| `sources` | string[] (globs) | no | `["specs/**/*-report.md"]` | Which `.md` files are reports. Globs support `**`, `*`, `?`. |
| `reports` | `{path, label}[]` | no | `[]` | Menu bar entries, in order. `path` may name a `.md` (rewritten to `.html`) or any other file. |
| `brand` | `{name, icon?}` | no | `{name: "Reports"}` | Menu bar brand and the header app icon (`icon` is an image path). |
| `lang` | string | no | `"en"` | `<html lang>` |
| `theme` | string | no | none | Path to the theme CSS, e.g. `reports/theme.css` |
| `specs` | object | no | none | Turns on the [spec profile](#spec-profile). `{}` uses the defaults below. |

`specs` has its own closed schema; all keys are optional:

| Key | Default | Meaning |
|---|---|---|
| `sources` | `["specs/**/*.md"]` | Which `.md` files are spec files |
| `index` | `"index.html"` | Path of the generated project index. Must end in `.html`, stay inside the root, and not collide with a report or spec page (config error otherwise). |
| `mermaid` | pinned jsDelivr URL of `mermaid.esm.min.mjs` | Mermaid ES module loaded by spec pages that have a diagram |

**Reports win over spec globs:** a file matching `sources` (report globs,
default `specs/**/*-report.md` included) is a report, even when
`specs.sources` matches it too. Only the rest of `specs.sources` is spec.

## Spec profile

With a `specs` key, spec files (e.g. `specs/changes/<feature>/proposal.md`
from the spec plugin) render as a second kind of page. `/spec:view` sets
this up and starts a watcher. What differs from reports:

| | Reports | Spec files |
|---|---|---|
| Frontmatter | report schema | spec schema: `feature`, `title`, `status` (`exploring` · `proposed` · `applying` · `applied`), `order`, `created`, `edited` |
| `fmt` | canonical rewrite | never applied |
| Section numbers, hoisted TL;DR, TOC | yes | no |
| Navigation | `reports` menu bar | per directory: an up link to the index, one link per file of the directory (sorted by `order`, then name), the page's status pill |
| Index | none | `specs.index`: one row per directory (feature, linked to the first page; status, title, newest `edited`, pages) |
| Mermaid fences | stay code | drawn in the browser by the `specs.mermaid` module script (offline: shown as code) |
| Output | committed, `check`ed | gitignored; `check` / `build --check` skip it |
| Hook | lint → fmt → lint | lint only, never builds |
| Who builds | `build` | the watcher (`build --specs --watch`) or `build --specs` |

**Lint rules:** `spec-frontmatter` (errors: missing or unknown key, bad
`status`, non-integer `order`, non-ISO date, `edited` < `created`, `feature`
≠ change directory; warnings: no frontmatter, key order) and
`spec-consistency` (only when linting all sources: files of one directory
disagreeing on `feature` or `status`). A directory's status is the value most
of its files carry; on a tie, the one of the tied file with the lowest
`order`. The index shows that value.

**Nothing hand-written is overwritten.** The index is written only if the
target is missing or was generated by md2html; otherwise `build` exits 2 and
asks to set `specs.index` (e.g. `specs/index.html`). A hand-written `.html`
next to a spec `.md` is left alone with a warning. Generated spec HTML whose
`.md` was deleted is removed on the next spec build.

## Source format

GFM plus a closed frontmatter schema and a small set of directives.

### Frontmatter

Unknown keys are a lint error. `fmt` writes keys in this order:

| Key | Required | Meaning |
|---|---|---|
| `title` | yes | The `<h1>` and the `<title>` |
| `created` | yes | ISO date, written by `new` |
| `edited` | yes | ISO date, set by the author when the content changes; never read from the clock by `build`. Must be ≥ `created`. |
| `status` | yes | `research` · `ongoing` · `implemented` |
| `subtitle` | no | Inline Markdown; the muted line under the header |
| `description` | no | `<meta name="description">`; defaults to the plain-text subtitle |

### Directives

`remark-directive` syntax. Only directives in the registry
(`src/registry.mjs`) are valid. An unknown or invalid directive renders as its
literal source text (content is never dropped) and `lint` reports it, with a
suggestion (`unknown directive ":::tdlr". Did you mean ":::tldr"?`).

| Directive | Form | Attributes | Renders |
|---|---|---|---|
| `tldr` | container `:::tldr` | none | `<div class="tldr">`; the first one is moved under the subtitle |
| `cards` | container `::::cards` | none; children must be `card` | `<div class="cards">` |
| `card` | container `:::card{title="…"}` | `title` (plain text, optional) | `<div class="card"><h4>…` (no `<h4>` without title) |
| `verdict` | inline `:verdict[label]{tone="go"}` | `tone`: `go` · `partial` · `no` (required) | `<span class="v go">label</span>` |

`> [!tldr]` (any case) is accepted as an alias: `build` renders it exactly
like `:::tldr`, `fmt` rewrites it to `:::tldr`, and `lint` warns
(`callout-alias`). Fold markers (`> [!tldr]-`) and other callouts stay
blockquotes. Raw HTML renders escaped and gets a
`no-raw-html` warning.

### Derived layout

Computed from plain Markdown with no extra syntax:

- **Section numbers** on `##`: `1. Title`, counting every `##` in order.
  Don't type numbers.
- **Ids**: explicit `## Title {#id}`, otherwise a slug (lowercase, NFKD, drop
  combining marks, keep `[\p{L}\p{N}_-]`, whitespace → `-`). Duplicates get
  `-1`, `-2`, … in document order.
- **TOC** when there are 4 or more `##` sections.
- **Header block** (title, app icon, Created / Last edited / Status,
  subtitle) from frontmatter.
- **Table frames** around every table.
- **Figures**: an image alone in a paragraph becomes a `<figure>`, with its
  alt text as the `<figcaption>`. A sibling `.mmd` (same path, extension
  swapped) is linked as its source when it exists. Mermaid is **not**
  rendered by the build: the `.svg` is a committed input.
- **Menu bar** from `reports.json` → `reports`, with `aria-current` on the
  current page.
- **Links between reports** are rewritten from `.md` to `.html`.

Page order: menu bar · header · meta · subtitle · TL;DR · TOC · body. No
footer, no scripts. CSS is inlined, so each report is one file that works
over `file://`, as an attachment, or published anywhere.

### Canonical form (`fmt`)

- Container fences have `3 + d` colons, where `d` is the depth of the deepest
  container nested inside (`:::card` alone = 3, `::::cards` holding cards = 4).
- Attributes in registry key order, values always double-quoted.
- Frontmatter keys in schema order, dates unquoted ISO.
- `-` bullets, `*` emphasis, `**` strong, backtick fences, `---` rules,
  unaligned table pipes.
- LF line endings, NFC, one final newline.
- Prose is **never** re-wrapped.

`fmt` is idempotent (`fmt(fmt(x)) === fmt(x)`) and `build(fmt(x)) === build(x)`.
It keeps the Markdown tree the same, with one deliberate exception: `> [!tldr]`
becomes `:::tldr`, which `build` renders identically. Prose text, escapes and
autolinks are normally written as in the source. A block `fmt` cannot
reproduce exactly is kept verbatim, and frontmatter it cannot safely rewrite
(invalid YAML, multi-line scalars) is left byte-for-byte. Broken directives
(unknown, unclosed, duplicate attributes, `:::cards` with 3-colon cards
inside) are left as written for `lint` to report.

## Lint rules

| Rule | Severity | Catches |
|---|---|---|
| `directive-known` | error | Unknown directive, with a suggestion; a time or ratio read as a directive (`10:30[^1]` → write `10\:30[^1]`). Bare prose colons (`16:00`, `a:b`) are not flagged. |
| `directive-closed` | error | Container never closed |
| `directive-attrs` | error | Unknown, missing, invalid or duplicate attribute; a `[label]` on a container |
| `directive-nesting` | error | `:::card` outside `::::cards`, non-card inside `cards`, `:::cards` with fewer than four colons around cards |
| `frontmatter` | error | Missing or invalid YAML, unknown or missing key, non-ISO or impossible date, `edited` < `created`, bad `status`, empty strings |
| `links` | error | Missing relative target, `#fragment` not in the target report, unsafe URL scheme (`javascript:` …); also checks images, link definitions and the subtitle |
| `figure` | error / warning | Image without alt text (error); `.svg` without a sibling `.mmd` (warning) |
| `no-raw-html` | warning | Raw HTML (renders escaped) |
| `callout-alias` | warning | `> [!tldr]`; use `:::tldr` (`fmt` converts it) |
| `theme-tokens` | warning | Custom property in the theme that is not in the token contract |
| `heading-number` | warning | Typed section number on a `##` (`## 2. Findings`) |
| `heading-id` | error | Duplicate explicit `{#id}` in one file |
| `menu` | error | `reports.json` menu entry pointing at a missing file (CLI `lint` over all sources and `check` only) |

## Theming

A project's theme (`reports.json` → `theme`) is plain CSS, layered after the
tool's `base.css` with `@layer base, theme`. It may override **tokens**
(including in `@media (prefers-color-scheme: dark)` blocks) and **restyle the
contract classes**. It cannot change the HTML structure. Without a theme, the
page uses the default house style (Apple-like, light and dark, phone width).
Status pills and the current menu item derive from the tokens (`--accent`,
`--partial`/`--partial-bg`, `--go`/`--go-bg`, `--bg`), so overriding tokens
restyles them too.

```css
:root { --accent: #0b7a53; }
@media (prefers-color-scheme: dark) { :root { --accent: #3fcf8e; } }
```

### Class and token contract

The stable, versioned list of names a theme may target. **Renaming or
removing one is a MAJOR version bump** of this plugin.

- **Classes:** `reports-nav`, `brand`, `item`, `top`, `appicon`, `report-meta`,
  `report-status` (+ `research`/`ongoing`/`implemented`), `sub`, `tldr`, `toc`,
  `tbl`, `v`, `go`/`partial`/`no`, `cards`, `card`, `mmd-src`
- **Elements with fixed roles:** `main`, `figure`, `figcaption`, `h1`–`h4`,
  `table`
- **Tokens:** `--bg`, `--fg`, `--muted`, `--line`, `--card`, `--accent`,
  `--go`, `--go-bg`, `--partial`, `--partial-bg`, `--no`, `--no-bg`, `--code`,
  `--figure-bg`

A custom property in `theme.css` that is not in this list gets a
`theme-tokens` lint warning.

## Hook

`hooks/hooks.json` registers a `PostToolUse` hook on `Write|Edit|MultiEdit`.
For a file that matches `sources` in the nearest `reports.json` (skipping
dot-dirs and `node_modules`, like `check`), it lints the file as Claude wrote
it, then formats it:

- **Not a report, or no `reports.json`:** exit 0, silent. Installing the
  plugin never touches unrelated Markdown.
- **Lint errors:** exit 2 with the messages on stderr, and the file is **not**
  rewritten (`fmt` could otherwise hide an error, e.g. close an unclosed
  container at EOF). Claude sees them and fixes them in the same turn.
- **Lint-clean:** `fmt` runs. If it rewrote the file, the hook tells Claude
  through `additionalContext` (`md2html fmt rewrote <file> into canonical form; Read it again before the next Edit.`),
  so the next Edit doesn't fail on a stale copy.
- **Lint warnings only:** exit 0, warnings in `additionalContext`.

For a spec file (see [Spec profile](#spec-profile)) the hook only lints:
errors → exit 2, warnings → `additionalContext`, never `fmt`.

The hook never runs `build`, so edits stay fast and HTML is regenerated on
purpose.

## Determinism

`build` is a pure function of the source bytes, the registry, the template,
`base.css`, the theme, `reports.json`, the tool version, and which sibling
`.mmd` files exist.

| Source of drift | Rule |
|---|---|
| Clock | Never read. Dates come only from frontmatter; only `new` reads today's date. |
| File mtimes, git | Never read. |
| Paths | Output contains only paths relative to the report. |
| Locale / TZ | No `toLocale*`. Dates stay the ISO strings as written. |
| Ordering | Globs and directory listings sorted; config order kept for the menu. |
| Input | CRLF → LF, NFC. Output is LF with one final newline. |
| Dependencies | Exact pins plus a lockfile. The tool version is in `<meta name="generator">`, so a version bump shows as a diff. |
| Mermaid | Not rendered; `.svg` files are committed inputs. |
| Network | None. |

`build` and `fmt` write a file only when its bytes change. Tests build every
fixture twice under different `TZ`/`LANG` and compare hashes, and check
`fmt(fmt(x)) === fmt(x)` and `build(x) === build(fmt(x))`.

## CI

The plugin cache isn't visible to CI, so vendor the bundle (`/md2html:setup`
offers this):

```bash
cp ~/.claude/plugins/cache/till-claude-code-marketplace/md2html/<version>/dist/md2html.mjs tools/md2html.mjs
```

Commit `tools/md2html.mjs`, then run in CI:

```bash
node tools/md2html.mjs check
```

It fails on lint errors, stale or missing HTML, and non-canonical Markdown.
Updating the vendored copy is a deliberate change that shows up in review.

## Editor integration

`.remarkrc.mjs` in the project root gives any remark-aware editor the same
lint and format rules as the CLI:

```js
import { preset } from './tools/md2html.mjs';

export default preset;
```

With the [vscode-remark](https://marketplace.visualstudio.com/items?itemName=unifiedjs.vscode-remark)
extension, VS Code shows lint squiggles and formats on save. Without a
vendored copy, import from the plugin's absolute `dist/md2html.mjs` path
(it changes when the plugin updates). `md2html syntax --json` provides the
data for editor insert menus.

## Development

```bash
cd plugins/md2html
npm install      # dev dependencies, exact pins
npm test         # node:test: golden fixtures, fmt, lint, CLI, hook, determinism
npm run bundle   # esbuild → dist/md2html.mjs (base.css inlined)
```

`dist/md2html.mjs` is committed. A test fails when it differs from a fresh
bundle, so run `npm run bundle` after changing `src/`. Adding a directive
means one registry entry in `src/registry.mjs` plus its golden fixtures;
regenerate the cheat sheet with
`node dist/md2html.mjs syntax > skills/write/syntax.md`.

Every commit that touches the plugin bumps its version in both
`.claude-plugin/plugin.json` and the root `.claude-plugin/marketplace.json`.
