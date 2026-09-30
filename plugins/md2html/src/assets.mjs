// Build-time assets (spec.css is appended to base.css on spec pages only, so report pages stay unchanged). scripts/bundle.mjs replaces this module with inlined strings.
import fs from 'node:fs';

export const baseCss = fs.readFileSync(new URL('./base.css', import.meta.url), 'utf8');
export const specCss = fs.readFileSync(new URL('./spec.css', import.meta.url), 'utf8');
export const version = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
