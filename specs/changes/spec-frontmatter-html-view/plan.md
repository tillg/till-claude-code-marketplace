---
feature: spec-frontmatter-html-view
title: "Plan: spec frontmatter and HTML view"
status: proposed
created: 2026-09-30
edited: 2026-09-30
---

# Plan: spec frontmatter and HTML view

Each step is `do → verify`, test first where there is code.

## 1. md2html: config + profile

- [ ] Tests: `specs` key validation (defaults, unknown sub-key → exit 2, absolute paths
      rejected); `profileOf` for spec-only, report-only, overlapping globs, neither. → fail
- [ ] Implement `config.mjs` `specs` key and `src/profile.mjs`. → pass

## 2. md2html: spec frontmatter lint

- [ ] Fixtures for each error (missing key, unknown key, bad status, non-integer `order`,
      feature ≠ dir, edited < created), the no-frontmatter warning, and cross-file
      status/feature mismatch within a group. → fail
- [ ] Implement `lint/spec-frontmatter.mjs`; route spec files to spec rules (other rules as
      warnings). → pass

## 3. md2html: groups, spec page, project index

- [ ] `groups.mjs` tests: files discovered per directory; `order` then file-name sort; labels
      from file names (`risks.md` → "Risks"); no special-cased names. → fail → implement → pass
- [ ] Golden fixtures: a change dir with 5 files (one with 2 Mermaid blocks, one with a
      `:::tldr`, one without frontmatter, one without `order`), a system doc dir; expected
      `.html` for each + `/index.html`. → fail
- [ ] Implement `spec/build.mjs` (up link + group nav, no numbering, `<pre class="mermaid">`,
      conditional module script) and `spec/index.mjs`; CSS for `spec-nav`, `spec-status`,
      `mermaid`. → pass
- [ ] Overwrite guard: a hand-written `index.html` in the root → `build` exit 2 with the
      `specs.index` hint, file untouched. → test
- [ ] Determinism test extended to spec pages (TZ/LANG/cwd). → pass

## 4. md2html: CLI, watcher, hook

- [ ] CLI tests: `fmt` and `build --check` skip spec files; `build` writes spec pages + index;
      `lint` reports spec errors and cross-file mismatch; `check` passes with gitignored,
      missing spec HTML. → fail → implement → pass
- [ ] Watch test: editing `plan.md` rebuilds `plan.html` and the index; a new `risks.md`
      appears in every sibling's nav; deleting it removes it again. → pass
- [ ] Hook tests: spec file with bad frontmatter → exit 2; clean spec file → exit 0, no HTML
      written, file not reformatted. → pass
- [ ] `npm run bundle`; bundle test passes.

## 5. spec plugin skills

- [ ] Update `propose`, `iterate`, `apply`, `explore`, `document-system`, `overview`,
      `ready-or-not`, `archive` per the architecture table (frontmatter template in one place:
      referenced from `propose`, copied minimal elsewhere).
- [ ] New `skills/view/SKILL.md` (`disable-model-invocation: true`, `argument-hint:
      "[change-name]"`).
- [ ] Dry run in a scratch repo with headless Claude Code (`--plugin-dir` both plugins):
      `/spec:propose` → all artifacts carry frontmatter with `status: proposed`; `/spec:view` →
      server answers, `proposal.html` shows up link + group nav + rendered Mermaid (Playwright
      screenshot, light/dark, 390 px); `/index.html` lists the group; edit `plan.md` by hand →
      `plan.html` updates; `git status` shows no `.html`.

## 6. Existing specs in this repo

- [ ] Add frontmatter to `specs/changes/add-md2html-plugin/*.md` and `specs/system/*.md` so this
      repo dogfoods it. → `md2html lint` clean for spec files.

## 7. Docs + versions

- [ ] README (root + md2html + spec sections), CLAUDE.md plugin line for spec (`/spec:view`).
- [ ] spec 6.3.0 → 6.4.0, md2html 0.1.0 → 0.2.0, in `plugin.json` and `marketplace.json`.
- [ ] `npm test` green; bundle current.
