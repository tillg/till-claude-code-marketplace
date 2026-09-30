// reports.json discovery and closed-schema validation.
import fs from 'node:fs';
import path from 'node:path';

export const CONFIG_NAME = 'reports.json';
export const DEFAULT_SOURCES = ['specs/**/*-report.md'];

export class ConfigError extends Error {}

/** Walk up from `fromDir` to the first directory containing reports.json, or null. */
export function findRoot(fromDir) {
  let dir = path.resolve(fromDir);
  for (;;) {
    if (fs.existsSync(path.join(dir, CONFIG_NAME))) return dir;
    const up = path.dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
}

const isStr = (v) => typeof v === 'string' && v.length > 0;
const isUrl = (v) => /^[a-z][a-z0-9+.-]*:/i.test(v) || v.startsWith('//');
const isAbsolute = (v) => v.startsWith('/') || /^[a-z]:[\\/]/i.test(v);

/** Validate a parsed config object and fill defaults. Throws ConfigError. */
export function validateConfig(raw) {
  const fail = (msg) => { throw new ConfigError(`${CONFIG_NAME}: ${msg}`); };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('must be a JSON object');
  const known = ['sources', 'reports', 'brand', 'lang', 'theme'];
  for (const key of Object.keys(raw)) if (!known.includes(key)) fail(`unknown key "${key}". Allowed: ${known.join(', ')}`);
  const sources = raw.sources ?? DEFAULT_SOURCES;
  if (!Array.isArray(sources) || !sources.every(isStr)) fail('"sources" must be an array of glob strings');
  const reports = raw.reports ?? [];
  if (!Array.isArray(reports)) fail('"reports" must be an array of {path, label}');
  reports.forEach((r, i) => {
    if (!r || typeof r !== 'object' || !isStr(r.path) || !isStr(r.label)) fail(`"reports[${i}]" needs string "path" and "label"`);
    for (const key of Object.keys(r)) if (!['path', 'label'].includes(key)) fail(`"reports[${i}]" has unknown key "${key}"`);
  });
  const brand = raw.brand ?? { name: 'Reports' };
  if (!brand || typeof brand !== 'object' || !isStr(brand.name)) fail('"brand" needs a string "name"');
  for (const key of Object.keys(brand)) if (!['name', 'icon'].includes(key)) fail(`"brand" has unknown key "${key}"`);
  if ('icon' in brand && !isStr(brand.icon)) fail('"brand.icon" must be a path string');
  const lang = raw.lang ?? 'en';
  if (!isStr(lang)) fail('"lang" must be a string');
  if ('theme' in raw && !isStr(raw.theme)) fail('"theme" must be a path string');
  const relative = (v, where, { url = false } = {}) => {
    if (url && isUrl(v)) return;
    if (isAbsolute(v) || isUrl(v)) fail(`${where} "${v}" must be a path relative to the project root${url ? ' (or a URL)' : ''}`);
  };
  sources.forEach((g, i) => relative(g, `"sources[${i}]"`));
  reports.forEach((r, i) => relative(r.path, `"reports[${i}].path"`, { url: true }));
  if (brand.icon) relative(brand.icon, '"brand.icon"', { url: true });
  if (raw.theme) relative(raw.theme, '"theme"');
  return { sources, reports, brand, lang, theme: raw.theme ?? null };
}

/** Read and validate `<root>/reports.json`. */
export function loadConfig(root) {
  const file = path.join(root, CONFIG_NAME);
  let raw;
  try { raw = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { throw new ConfigError(`${CONFIG_NAME}: ${e.message}`); }
  return validateConfig(raw);
}
