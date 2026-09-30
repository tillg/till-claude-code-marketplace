// Report frontmatter: find the YAML node, parse it, remove it from the tree.
import YAML from 'yaml';

/** Parse frontmatter YAML. Core schema: ISO dates stay strings. Never throws. */
export function parseFrontmatter(value) {
  try {
    const data = YAML.parse(value, { schema: 'core', logLevel: 'error' });
    if (data && typeof data === 'object' && !Array.isArray(data)) return { data, error: null };
    return { data: {}, error: data == null ? null : new Error('frontmatter must be a mapping') };
  } catch (error) {
    return { data: {}, error };
  }
}

/** Remove the leading `yaml` node from `tree` and return its parsed data ({} when absent or invalid). */
export function extractFrontmatter(tree) {
  const i = tree.children.findIndex((n) => n.type === 'yaml');
  if (i === -1) return { data: {}, error: null };
  const [node] = tree.children.splice(i, 1);
  return parseFrontmatter(node.value);
}

/** A scalar frontmatter value as a string, or undefined (objects, arrays, null). */
export function fmString(data, key) {
  const v = data[key];
  return ['string', 'number', 'boolean'].includes(typeof v) ? String(v) : undefined;
}
