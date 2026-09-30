# Plan: add the `md2html` plugin

Each step is `do → verify`. Test first where there is a runtime surface. "Golden" means a
committed expected-output file compared byte-for-byte.

## 1. Scaffold

- [ ] Create `plugins/md2html/` with `.claude-plugin/plugin.json` (version `0.1.0`),
      `package.json` (`"type": "module"`, exact-pinned devDependencies: `unified`,
      `remark-parse`, `remark-gfm`, `remark-frontmatter`, `yaml`, `remark-directive`,
      `remark-stringify`, `remark-rehype`, `rehype-stringify`, `unified-lint-rule`,
      `unist-util-visit`, `esbuild`), and scripts `test` (`node --test`) and `bundle`.
      → `npm install && npm test` runs (0 tests) and the lockfile is committed.
- [ ] Add the plugin to `.claude-plugin/marketplace.json` with the same version.
      → The versions in both files match.

## 2. Registry + processor

- [ ] Write `test/processor.test.mjs`: parse a fixture that has all three directive forms,
      and assert the mdast node types and names. → The test fails.
- [ ] Implement `src/registry.mjs` (`tldr`, `cards`, `card`, `verdict`) and
      `src/processor.mjs` (the shared unified chain). → The test passes.

## 3. build (render)

- [ ] Add golden fixtures `test/fixtures/{minimal,tldr,cards,verdict,figure,table,toc,heading-ids,links,unknown-directive,prose-colons,nested-list-in-container}.md`
      with the expected `.html`. Start from karpathy.app's `browser-only-report.html` markup
      and class names. → `test/build.test.mjs` fails.
- [ ] Implement `transforms/*` (frontmatter, headings + `{#id}`, section numbering, TOC,
      directives via registry, figures + `.mmd` link, table frame, `.md`→`.html` report links,
      literal fallback for unknown/invalid directives) and `render.mjs` (fixed template, menu
      bar from config, inlined `@layer base, theme` CSS). → The golden tests pass.
- [ ] Move `base.css` out of karpathy.app's reference report into `src/base.css` (tokens, light
      + dark, phone width, `reports-nav` + `report-meta` styles). → The golden HTML renders in
      Playwright at 1100 px and 390 px, light and dark, with no horizontal scroll (screenshots
      in `tmp/`).
- [ ] Add `test/determinism.test.mjs`: build all fixtures twice in fresh processes, with a
      different `TZ` and `LANG` per run, and compare SHA-256. → Pass.

## 4. fmt

- [ ] Add golden pairs `test/fixtures/fmt/*.in.md → *.out.md`: wrong colon counts, attribute
      order and defaults, frontmatter key order, `*` bullets, CRLF, a callout
      `> [!tldr]` → `:::tldr`, and long prose lines (must stay unwrapped). → Fail.
- [ ] Implement `src/fmt.mjs`. → Pass. Also assert `fmt(fmt(x)) === fmt(x)` and
      `build(x) === build(fmt(x))` for every build fixture.

## 5. lint

- [ ] Add a fixture per rule, with the expected messages (`path:line:col severity message [rule]`).
      → Fail.
- [ ] Implement `lint/{directives,frontmatter,links,figures,theme}.mjs` plus `no-raw-html` and
      `callout-alias`. Suggestions use Levenshtein ≤ 2. → Pass.
- [ ] Implement `--format json`. → A snapshot test passes.

## 6. CLI

- [ ] Implement `src/cli.mjs` with `new <path>`, `fmt [--check] [paths]`, `lint [paths]`,
      `build [--check] [--watch] [paths]`, `check`, `syntax [--json]`; `reports.json` discovery
      (walking up from cwd) plus closed-schema validation; exit codes 0/1/2.
      → `test/cli.test.mjs` runs each subcommand against a temp project.
- [ ] `new` writes a skeleton that passes `lint` and `build` unchanged. → Test.
- [ ] `syntax` output is generated from the registry. `skills/write/syntax.md` is committed and
      checked. → A test fails if they differ.
- [ ] `npm run bundle` (esbuild) writes `dist/md2html.mjs`, including `base.css` and a
      `preset` export for `.remarkrc.mjs`. → A test runs the fixtures through `dist/` and
      checks that `dist/` matches a fresh bundle.

## 7. Hook

- [ ] Write `hooks/post-edit.mjs` and `hooks/hooks.json` (matcher `Write|Edit|MultiEdit`).
      Tests feed it stdin JSON for (a) a non-report `.md`, which exits 0 silently; (b) a
      clean report, which exits 0; (c) a report with `:::tdlr`, which exits 2 with a suggestion
      on stderr; and (d) a file outside any `reports.json` project, which exits 0. → Pass.
- [ ] Manual: install the plugin locally, edit a report in Claude Code with a typo, and see the
      message returned in the same turn.

## 8. Skills

- [ ] `skills/write/SKILL.md` (model-invocable): workflow `new → edit .md → edited date → (hook
      fmt+lint) → build → open`, the layout rules (TL;DR first, numbered sections, sources
      last), "never edit the .html", and a link to `syntax.md`. No `name` field in the
      frontmatter.
- [ ] `skills/build/SKILL.md` (`disable-model-invocation: true`): locate the tool (project
      `tools/md2html.mjs` first, then the plugin `dist/`), run `build` / `check`, report the
      results, and open the result via a `http://localhost` URL.
- [ ] `skills/setup/SKILL.md` (`disable-model-invocation: true`): create `reports.json`,
      an optional `reports/theme.css`, `.remarkrc.mjs` and `just` recipes; optionally vendor
      `dist/md2html.mjs` into `tools/`; add a CLAUDE.md pointer.
- [ ] Dry run: in a scratch repo run `/md2html:setup`, then have Claude write a 5-section report
      via `/md2html:write`. → `md2html check` exits 0 and the HTML looks right in the browser.

## 9. Pilot on karpathy.app (verification only, no commit here)

- [ ] Convert `specs/03_browser_only/browser-only-report.html` to `browser-only-report.md`
      in a scratch copy, then build. → A side-by-side screenshot comparison with the
      hand-written page, light, dark and phone, shows no layout differences beyond whitespace.
- [ ] Write a second `theme.css` with only token overrides. → The same report renders in a
      different look, and there are no `theme-tokens` warnings for contract tokens.

## 10. Docs + release

- [ ] Update `README.md` (plugin section: what it does, the skills, the hook, `reports.json`
      example, theming) and the root `CLAUDE.md` "Current Plugins" list.
- [ ] Document the class/token contract in `plugins/md2html/README.md` (versioned; renaming =
      MAJOR).
- [ ] Final check: `npm test` in `plugins/md2html`, bundle up to date, and the versions in
      `plugin.json` and `marketplace.json` both `0.1.0`.
- [ ] System description (`specs/system/*.md`) updates happen at `/spec:archive`.
