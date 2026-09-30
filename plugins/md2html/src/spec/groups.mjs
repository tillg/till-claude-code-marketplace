// Spec groups: every spec `.md` in one directory, discovered from the file list. No file name is special.
import path from 'node:path';
import { fmString } from '../transforms/frontmatter.mjs';

/** `risks.md` → "Risks", `open-questions.md` → "Open questions". */
export function labelOf(file) {
  const name = path.posix.basename(file).replace(/\.md$/, '').replace(/[-_]+/g, ' ').trim();
  return name.charAt(0).toUpperCase() + name.slice(1);
}

// Code-point order, so the result never depends on LANG.
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
// Items: by `order` (missing after all numbered ones), then file name.
const byOrder = (a, b) => (a.order ?? Infinity) - (b.order ?? Infinity) || cmp(path.posix.basename(a.file), path.posix.basename(b.file));

function item(file, data) {
  const label = labelOf(file);
  const order = Number.isInteger(data.order) ? data.order : null;
  const str = (key) => fmString(data, key) ?? null;
  return { file, label, order, title: str('title') ?? label, feature: str('feature'), status: str('status'), edited: str('edited') };
}

/**
 * `files`: root-relative spec paths; `readFrontmatter(file)` → parsed data ({} when none or invalid).
 * Groups sort by dir; items by `order` (missing after all numbered ones), then file name.
 */
export function groups(files, readFrontmatter) {
  const byDir = new Map();
  for (const file of [...new Set(files)]) {
    const dir = path.posix.dirname(file);
    if (!byDir.has(dir)) byDir.set(dir, []);
    byDir.get(dir).push(item(file, readFrontmatter(file) ?? {}));
  }
  return [...byDir.keys()].sort(cmp).map((dir) => ({ dir, items: byDir.get(dir).sort(byOrder) }));
}

/** The group holding `file`, or undefined. */
export function groupOf(file, allGroups) {
  const dir = path.posix.dirname(file);
  return allGroups.find((g) => g.dir === dir);
}

/** A group's status: the most common one; ties go to the item with the lowest `order`, then first by name. Null when none has one. */
export function groupStatus(items) {
  const withStatus = items.filter((it) => it.status != null);
  if (!withStatus.length) return null;
  const counts = new Map();
  for (const it of withStatus) counts.set(it.status, (counts.get(it.status) ?? 0) + 1);
  const top = Math.max(...counts.values());
  return [...withStatus].sort(byOrder).find((it) => counts.get(it.status) === top).status;
}
