// Which rendering profile a root-relative path belongs to. Report wins when both globs match.
import { matchesAny } from './glob.mjs';

/** 'spec' | 'report' | null. Only `.md` files have a profile. */
export function profileOf(relPath, config) {
  if (!relPath.endsWith('.md')) return null;
  if (matchesAny(relPath, config.sources)) return 'report';
  if (config.specs && matchesAny(relPath, config.specs.sources)) return 'spec';
  return null;
}
