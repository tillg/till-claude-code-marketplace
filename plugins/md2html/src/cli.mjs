// md2html CLI: new | fmt | lint | build | check | syntax. Exit codes: 0 clean, 1 findings, 2 usage/config.
import fs from 'node:fs';
import path from 'node:path';
import { findRoot, loadConfig, ConfigError } from './config.mjs';
import { matchesAny } from './glob.mjs';
import { toPosix } from './util.mjs';
import { format } from './fmt.mjs';
import { lint, lintTheme, formatMessages } from './lint.mjs';
import { build } from './build.mjs';
import { syntaxMarkdown, syntaxJson } from './syntax.mjs';
import { version } from './assets.mjs';
import YAML from 'yaml';

const USAGE = `md2html ${version}
Usage:
  md2html new <path> [--title "…"]     write a report skeleton
  md2html fmt [--check] [paths…]       rewrite reports into canonical form
  md2html lint [--format json] [paths…]
  md2html build [--check] [--watch] [paths…]
  md2html check                        fmt --check + lint + build --check over all sources
  md2html syntax [--json]              the cheat sheet
Exit codes: 0 clean, 1 lint errors / stale / non-canonical, 2 usage or config error.`;

class UsageError extends Error {}

const SKIP_DIRS = new Set(['node_modules', '.git', '.worktrees']);

/** All root-relative files matching `sources`, sorted. */
export function listSources(root, config) {
  return listFiles(root, (rel) => rel.endsWith('.md') && matchesAny(rel, config.sources));
}

/** Root-relative files accepted by `keep`, skipping dot-dirs and SKIP_DIRS, sorted. */
function listFiles(root, keep) {
  const out = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
      if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;
      const rel = dir ? `${dir}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(rel);
      else if (entry.isFile() && keep(rel)) out.push(rel);
    }
  };
  walk('');
  return out.sort();
}

export const htmlPathFor = (file) => file.replace(/\.md$/, '.html');

function parseArgs(argv) {
  const flags = {}; const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--title' || a === '--format') {
      if (i + 1 >= argv.length) throw new UsageError(`${a} needs a value`);
      flags[a.slice(2)] = argv[++i];
    } else if (a.startsWith('--')) flags[a.slice(2)] = true;
    else positional.push(a);
  }
  return { flags, positional };
}

function allowFlags(flags, allowed, cmd) {
  for (const f of Object.keys(flags)) if (!allowed.includes(f)) throw new UsageError(`unknown option --${f} for "${cmd}"`);
}

function today() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function skeleton(title, date) {
  let plain;
  try { plain = YAML.parse(`title: ${title}\n`, { schema: 'core' })?.title; } catch { plain = undefined; }
  const t = plain === title && !title.includes('\n') ? title : JSON.stringify(title);
  return `---
title: ${t}
created: ${date}
edited: ${date}
status: research
---

:::tldr
**Short answer:** one or two sentences that answer the question this report asks.
:::

## Context {#context}

What prompted this report, and what question it answers.

## Findings {#findings}

What we found, with evidence.

## Recommendation {#recommendation}

What we should do next, and why.

## Sources {#sources}

- Where the evidence comes from.
`;
}

function titleFromPath(file) {
  const base = path.basename(file).replace(/-report\.md$/, '').replace(/\.md$/, '').replace(/[-_]+/g, ' ').trim();
  return base ? base[0].toUpperCase() + base.slice(1) : 'Report';
}

/** A project context: root, config, fs helpers, and resolution of user paths. */
function project(cwd) {
  const root = findRoot(cwd);
  if (!root) throw new ConfigError(`no reports.json found in ${cwd} or any parent directory (run /md2html:setup)`);
  const config = loadConfig(root);
  const abs = (rel) => path.join(root, rel);
  const readFile = (rel) => { try { return fs.readFileSync(abs(rel), 'utf8'); } catch { return null; } };
  const exists = (rel) => fs.existsSync(abs(rel));
  const display = (rel) => toPosix(path.relative(cwd, abs(rel))) || rel;
  const realRoot = fs.realpathSync(root);
  const files = (positional) => {
    if (!positional.length) return listSources(root, config);
    return positional.flatMap((p) => {
      const target = path.resolve(cwd, p);
      if (!fs.existsSync(target)) throw new UsageError(`${p}: no such file`);
      const rel = toPosix(path.relative(realRoot, fs.realpathSync(target)));
      if (rel.startsWith('..') || path.isAbsolute(rel)) throw new UsageError(`${p} is outside the project root ${root}`);
      if (fs.statSync(target).isDirectory()) {
        const prefix = rel ? `${rel}/` : '';
        return listSources(root, config).filter((f) => f.startsWith(prefix));
      }
      if (!rel.endsWith('.md')) throw new UsageError(`${p}: not a Markdown report (.md)`);
      return [rel];
    });
  };
  const themeCss = () => {
    if (!config.theme) return '';
    const css = readFile(config.theme);
    if (css === null) throw new ConfigError(`reports.json: theme file "${config.theme}" not found`);
    return css;
  };
  return { root, config, readFile, exists, display, files, themeCss };
}

function runFmt(ctx, files, { check }, out) {
  let dirty = 0;
  for (const f of files) {
    const src = ctx.readFile(f);
    const formatted = format(src);
    if (formatted === src) continue;
    dirty++;
    if (check) out.err(`${ctx.display(f)}: not in canonical form (run md2html fmt)`);
    else { fs.writeFileSync(path.join(ctx.root, f), formatted); out.log(`formatted ${ctx.display(f)}`); }
  }
  return check && dirty ? 1 : 0;
}

function runLint(ctx, files, { format: fmtName = 'text' }, out, { theme = true } = {}) {
  if (!['text', 'json'].includes(fmtName)) throw new UsageError(`--format must be text or json`);
  const all = [];
  let errors = 0;
  const report = (messages, displayPath) => {
    errors += messages.filter((m) => m.severity === 'error').length;
    if (fmtName === 'json') all.push(...JSON.parse(formatMessages(messages, displayPath, { format: 'json' })));
    else if (messages.length) out.log(formatMessages(messages, displayPath, { format: 'text' }));
  };
  const cache = new Map(); // heading ids of link targets, shared across the files of this run
  for (const f of files) {
    report(lint(ctx.readFile(f), { file: f, root: ctx.root, config: ctx.config, readFile: ctx.readFile, exists: ctx.exists, cache }), ctx.display(f));
  }
  if (theme && ctx.config.theme) {
    const css = ctx.readFile(ctx.config.theme);
    if (css !== null) report(lintTheme(css), ctx.display(ctx.config.theme));
  }
  if (theme) report(lintMenu(ctx), ctx.display('reports.json'));
  if (fmtName === 'json') out.log(JSON.stringify(all, null, 2));
  return errors ? 1 : 0;
}

const isUrl = (p) => /^[a-z][a-z0-9+.-]*:/i.test(p) || p.startsWith('//');

/** Menu entries in reports.json must point at existing files (an `.html` entry is fine if its `.md` exists). */
function lintMenu(ctx) {
  const text = ctx.readFile('reports.json') ?? '';
  const messages = [];
  for (const { path: p, label } of ctx.config.reports) {
    if (isUrl(p)) continue;
    const file = p.replace(/[#?].*$/, '');
    if (ctx.exists(file) || (file.endsWith('.html') && ctx.exists(file.replace(/\.html$/, '.md')))) continue;
    const at = Math.max(0, text.indexOf(JSON.stringify(p)));
    const before = text.slice(0, at).split('\n');
    messages.push({ line: before.length, column: before.at(-1).length + 1, severity: 'error', ruleId: 'menu',
      message: `menu entry "${label}" points at "${p}", which does not exist` });
  }
  return messages;
}

/** Generated HTML (md2html generator meta) whose `.md` source is gone. */
function orphans(ctx) {
  const candidates = listFiles(ctx.root, (rel) => rel.endsWith('.html') && matchesAny(rel.replace(/\.html$/, '.md'), ctx.config.sources));
  return candidates.filter((f) => !ctx.exists(f.replace(/\.html$/, '.md')) && /<meta name="generator" content="md2html /.test(ctx.readFile(f) ?? ''));
}

function buildOne(ctx, f, themeCss) {
  return build(ctx.readFile(f), { file: f, root: ctx.root, config: ctx.config, themeCss, exists: ctx.exists });
}

function runBuild(ctx, files, { check }, out, { orphanCheck = false } = {}) {
  const themeCss = ctx.themeCss();
  let stale = 0;
  if (check && orphanCheck) {
    for (const f of orphans(ctx)) {
      stale++;
      out.err(`${ctx.display(f)}: orphaned; its source ${ctx.display(f.replace(/\.html$/, '.md'))} is gone (delete the HTML)`);
    }
  }
  for (const f of files) {
    if (ctx.readFile(f) === null) continue; // deleted while watching
    const html = buildOne(ctx, f, themeCss);
    const target = htmlPathFor(f);
    if (ctx.readFile(target) === html) continue;
    stale++;
    if (check) out.err(`${ctx.display(target)}: stale (run md2html build)`);
    else { fs.writeFileSync(path.join(ctx.root, target), html); out.log(`wrote ${ctx.display(target)}`); }
  }
  return check && stale ? 1 : 0;
}

function watch(cwd, positional, out) {
  // Re-resolve config and the file list on every batch, so new reports and reports.json edits are picked up.
  let ctx = project(cwd);
  let timer = null; let all = false; const pending = new Set();
  out.log(`watching ${ctx.files(positional).length} report(s); Ctrl-C to stop`);
  fs.watch(ctx.root, { recursive: true }, (_event, name) => {
    if (!name) return;
    const rel = toPosix(name);
    if (rel === 'reports.json' || rel === ctx.config.theme) all = true;
    else if (rel.endsWith('.md')) pending.add(rel);
    else return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      try {
        ctx = project(cwd);
        const files = ctx.files(positional);
        const batch = all ? files : files.filter((f) => pending.has(f));
        pending.clear(); all = false;
        runBuild(ctx, batch, {}, out);
      } catch (e) { out.err(e.message); }
    }, 100);
  });
  return new Promise(() => {});
}

/** Run the CLI. Returns an exit code (or never resolves for --watch). */
export async function main(argv, { cwd = process.cwd(), out = { log: console.log, err: console.error } } = {}) {
  try {
    const [cmd, ...rest] = argv;
    const { flags, positional } = parseArgs(rest);
    switch (cmd) {
      case 'syntax':
        allowFlags(flags, ['json'], cmd);
        out.log(flags.json ? JSON.stringify(syntaxJson(), null, 2) : syntaxMarkdown().trimEnd());
        return 0;
      case 'new': {
        allowFlags(flags, ['title'], cmd);
        if (positional.length !== 1) throw new UsageError('new needs exactly one <path>');
        const target = path.resolve(cwd, positional[0]);
        if (!target.endsWith('.md')) throw new UsageError(`${positional[0]}: a report path must end in .md`);
        if (fs.existsSync(target)) throw new UsageError(`${positional[0]} already exists; not overwriting`);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, format(skeleton(flags.title ?? titleFromPath(target), today())));
        out.log(`created ${positional[0]}`);
        const root = findRoot(path.dirname(target));
        if (root) {
          const rel = toPosix(path.relative(root, target));
          if (!matchesAny(rel, loadConfig(root).sources)) out.err(`warning: ${positional[0]} is not matched by "sources" in reports.json, so build and check will skip it`);
        }
        return 0;
      }
      case 'fmt': allowFlags(flags, ['check'], cmd); { const ctx = project(cwd); return runFmt(ctx, ctx.files(positional), flags, out); }
      case 'lint': allowFlags(flags, ['format'], cmd); { const ctx = project(cwd); return runLint(ctx, ctx.files(positional), flags, out, { theme: !positional.length }); }
      case 'build': {
        allowFlags(flags, ['check', 'watch'], cmd);
        if (flags.check && flags.watch) throw new UsageError('--check and --watch cannot be combined');
        const ctx = project(cwd);
        const files = ctx.files(positional);
        const code = runBuild(ctx, files, flags, out, { orphanCheck: !positional.length });
        return flags.watch ? watch(cwd, positional, out) : code;
      }
      case 'check': {
        allowFlags(flags, [], cmd);
        if (positional.length) throw new UsageError('check takes no paths; it runs over all sources');
        const ctx = project(cwd);
        const files = ctx.files([]);
        const codes = [runFmt(ctx, files, { check: true }, out), runLint(ctx, files, {}, out), runBuild(ctx, files, { check: true }, out, { orphanCheck: true })];
        return Math.max(...codes);
      }
      case undefined: case '--help': case '-h': case 'help':
        out.log(USAGE); return cmd ? 0 : 2;
      case '--version': out.log(version); return 0;
      default: throw new UsageError(`unknown command "${cmd}"`);
    }
  } catch (e) {
    if (e instanceof UsageError) { out.err(`md2html: ${e.message}\n\n${USAGE}`); return 2; }
    if (e instanceof ConfigError) { out.err(`md2html: ${e.message}`); return 2; }
    throw e;
  }
}
