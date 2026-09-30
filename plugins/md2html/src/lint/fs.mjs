// Default file access for rules used without options (the editor preset): paths are
// resolved against the cwd, which also works for the absolute `file.path` editors pass.
import fs from 'node:fs';
import path from 'node:path';

export function fsAccess(root = '.') {
  return {
    exists: (rel) => fs.existsSync(path.resolve(root, rel)),
    readFile: (rel) => { try { return fs.readFileSync(path.resolve(root, rel), 'utf8'); } catch { return null; } },
  };
}

/** The current report's path, directory-relative targets resolve against it. */
export const reportPath = (options, file) => options?.file ?? file.path ?? '';

/** A relative file reference split into path and fragment, or null for URLs, absolute paths etc. */
export function relativeTarget(url) {
  if (!url || /^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith('//') || url.startsWith('/')) return null;
  const hash = url.indexOf('#');
  const rawPath = (hash < 0 ? url : url.slice(0, hash)).replace(/\?.*$/, '');
  const fragment = hash < 0 ? null : url.slice(hash + 1);
  const decode = (s) => { try { return decodeURIComponent(s); } catch { return s; } };
  return { path: decode(rawPath), fragment: fragment === null ? null : decode(fragment) };
}
