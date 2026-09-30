// Section numbers on every `##` ("1. Title") and the table of contents.
export const TOC_MIN_SECTIONS = 4;

/** Prefix every depth-2 heading with its number. Returns TOC entries [{id, label}]. */
export function numberSections(headings) {
  return headings.filter((h) => h.depth === 2).map((h, i) => {
    const n = `${i + 1}. `;
    h.node.children.unshift({ type: 'text', value: n });
    return { id: h.id, label: n + h.text };
  });
}

/** Hoist the first top-level `:::tldr` to the front of the body. Returns whether one was found. */
export function hoistTldr(tree) {
  const i = tree.children.findIndex((n) => n.type === 'containerDirective' && n.name === 'tldr');
  if (i === -1) return false;
  tree.children.unshift(...tree.children.splice(i, 1));
  return true;
}
