// PostToolUse hook: fmt + lint the edited report. Silent for anything that is not a report.
// Exit 0 = fine (maybe with additionalContext on stdout), exit 2 = lint errors on stderr for Claude.
import fs from 'node:fs';
import path from 'node:path';
import { format, lint, lintSpec, lintSpecGroup, specData, formatMessages, findRoot, loadConfig, profileOf } from '../dist/md2html.mjs';

const toPosix = (p) => p.split(path.sep).join('/');

function readStdin() {
  try { return JSON.parse(fs.readFileSync(0, 'utf8')); } catch { return null; }
}

function run() {
  const input = readStdin();
  const filePath = input?.tool_input?.file_path;
  if (typeof filePath !== 'string' || !filePath.endsWith('.md')) return 0;
  const abs = path.resolve(input.cwd || process.cwd(), filePath);
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) return 0;
  const root = findRoot(path.dirname(abs));
  if (!root) return 0;
  let config;
  try { config = loadConfig(root); } catch (e) { process.stderr.write(`md2html: ${e.message}\n`); return 2; }
  const rel = toPosix(path.relative(root, abs));
  // Same scope as `md2html check`: skip dot-dirs, node_modules and paths outside the root.
  const segments = rel.split('/');
  if (rel.startsWith('..') || segments.some((s) => s.startsWith('.') || s === 'node_modules')) return 0;
  const profile = profileOf(rel, config);
  if (!profile) return 0;

  const notes = [];
  const readFile = (p) => { try { return fs.readFileSync(path.join(root, p), 'utf8'); } catch { return null; } };
  const exists = (p) => fs.existsSync(path.join(root, p));
  const lintText = (text) => lint(text, { file: rel, root, config, readFile, exists });
  const source = fs.readFileSync(abs, 'utf8');
  if (profile === 'spec') {
    // Group consistency is a warning here: skills update a change's files one at a time.
    const dir = path.posix.dirname(rel);
    const siblings = fs.readdirSync(path.join(root, dir)).filter((n) => n.endsWith('.md')).map((n) => `${dir}/${n}`)
      .filter((f) => profileOf(f, config) === 'spec').sort();
    const group = lintSpecGroup(siblings.map((f) => ({ file: f, ...specData(readFile(f) ?? '') })))
      .filter((m) => m.file === rel).map(({ file, ...m }) => ({ ...m, severity: 'warning' }));
    return specFeedback([...lintSpec(source, { file: rel, root, config, readFile, exists }), ...group], rel);
  }
  // Lint what Claude wrote first: fmt must not paper over an error (e.g. close an unclosed container at EOF).
  const before = lintText(source);
  if (before.some((m) => m.severity === 'error')) {
    process.stderr.write(`md2html lint found problems; fix them now:\n${formatMessages(before, rel, { format: 'text' })}\n`);
    return 2;
  }
  const formatted = format(source);
  let messages = before;
  if (formatted !== source) {
    fs.writeFileSync(abs, formatted);
    notes.push(`md2html fmt rewrote ${rel} into canonical form; Read it again before the next Edit.`);
    messages = lintText(formatted);
  }
  const text = messages.length ? formatMessages(messages, rel, { format: 'text' }) : '';
  if (messages.some((m) => m.severity === 'error')) {
    process.stderr.write(`${[...notes, 'md2html lint found problems; fix them now:', text].join('\n')}\n`);
    return 2;
  }
  if (text) notes.push(`md2html lint warnings:\n${text}`);
  if (notes.length) {
    process.stdout.write(`${JSON.stringify({ hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: notes.join('\n') } })}\n`);
  }
  return 0;
}

/** Spec files: lint only (the watcher builds them, and they are never reformatted). */
function specFeedback(messages, rel) {
  const text = formatMessages(messages, rel, { format: 'text' });
  if (messages.some((m) => m.severity === 'error')) {
    process.stderr.write(`md2html lint found problems in this spec file; fix them now:\n${text}\n`);
    return 2;
  }
  if (text) process.stdout.write(`${JSON.stringify({ hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: `md2html lint warnings:\n${text}` } })}\n`);
  return 0;
}

process.exitCode = run();
