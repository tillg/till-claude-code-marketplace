// Small shared helpers: slugs, Levenshtein, relative paths.
import path from 'node:path';

export function slug(text) {
  return text.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().trim()
    .replace(/\s+/g, '-').replace(/[^\p{L}\p{N}_-]/gu, '');
}

/** A slugger that de-duplicates in document order: x, x-1, x-2, … */
export function slugger() {
  const seen = new Map();
  return (id) => {
    if (!seen.has(id)) { seen.set(id, 0); return id; }
    let n = seen.get(id);
    let candidate;
    do { n++; candidate = `${id}-${n}`; } while (seen.has(candidate));
    seen.set(id, n); seen.set(candidate, 0);
    return candidate;
  };
}

export function levenshtein(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]; row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}

/** Closest candidate within distance 2, or undefined. Ties: first in list order. */
export function suggest(word, candidates) {
  let best; let bestD = 3;
  for (const c of candidates) { const d = levenshtein(word, c); if (d < bestD) { best = c; bestD = d; } }
  return best;
}

// A URL with a scheme (`https:`, `mailto:` …), `//host` or a root-absolute `/x` path.
const NOT_ROOT_RELATIVE = /^(?:[a-z][a-z0-9+.-]*:|\/)/i;

/**
 * Relative URL from the directory of report `fromFile` to `toFile` (both root-relative, `/`).
 * Pure string arithmetic (never resolves against process.cwd()); URLs, `//host` and `/x` pass through unchanged.
 */
export function relHref(fromFile, toFile) {
  if (NOT_ROOT_RELATIVE.test(toFile)) return toFile;
  const segments = (p) => path.posix.normalize(p).split('/').filter((s) => s !== '' && s !== '.');
  const from = segments(path.posix.dirname(fromFile));
  const to = segments(toFile);
  let i = 0;
  while (i < from.length && i < to.length && from[i] === to[i] && from[i] !== '..') i++;
  const rel = [...from.slice(i).map(() => '..'), ...to.slice(i)].join('/');
  return rel === '' ? path.posix.basename(toFile) : rel;
}

/** Percent-encode each segment of a relative path (`a#b.html` → `a%23b.html`); `..` and `/` stay. */
export const encodePath = (p) => p.split('/').map((s) => (s === '..' ? s : encodeURIComponent(s))).join('/');

export const toPosix = (p) => p.split(path.sep).join('/');
