// Library entry and bundle entry. `node dist/md2html.mjs …` runs the CLI; importing it does not.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { main } from './cli.mjs';

export { format } from './fmt.mjs';
export { lint, lintTheme, formatMessages } from './lint.mjs';
export { build } from './build.mjs';
export { preset } from './preset.mjs';
export { findRoot, loadConfig, validateConfig, ConfigError } from './config.mjs';
export { matchesAny } from './glob.mjs';
export { syntaxMarkdown, syntaxJson } from './syntax.mjs';
export { version } from './assets.mjs';
export { main };

const isMain = (() => {
  try { return fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url)); } catch { return false; }
})();

if (isMain) {
  const code = await main(process.argv.slice(2));
  process.exitCode = code;
}
