// Heading ids: an explicit `{#id}` suffix, else a slug; duplicates get -1, -2, … in document order.
import { toString } from 'mdast-util-to-string';
import { visit } from 'unist-util-visit';
import { parse, normalizeInput } from '../processor.mjs';
import { slug, slugger } from '../util.mjs';
import { literalizeInvalid } from './directives.mjs';

const ID_SUFFIX = /[ \t]*\{#([^\s{}]+)\}[ \t]*$/;

/** Strip `{#id}` suffixes, assign `data.hProperties.id` to every heading. Returns [{node, depth, id, text}]. */
export function assignHeadingIds(tree) {
  const list = [];
  visit(tree, 'heading', (node) => {
    let explicit;
    const last = node.children[node.children.length - 1];
    if (last?.type === 'text') {
      const m = ID_SUFFIX.exec(last.value);
      if (m) {
        explicit = m[1];
        last.value = last.value.slice(0, m.index);
        if (last.value === '') node.children.pop();
      }
    }
    list.push({ node, depth: node.depth, explicit, text: toString(node).trim() });
  });
  // Explicit ids are reserved first, so a slug never steals an id the author wrote.
  const unique = slugger();
  for (const h of list) if (h.explicit) h.id = unique(h.explicit);
  for (const h of list) if (!h.explicit) h.id = unique(slug(h.text) || 'section');
  for (const h of list) {
    h.node.data = { ...h.node.data, hProperties: { ...h.node.data?.hProperties, id: h.id } };
    delete h.explicit;
  }
  return list;
}

/** The set of heading ids a report's HTML will contain (for lint's `#fragment` check). */
export function headingIds(source) {
  const src = normalizeInput(source);
  const tree = literalizeInvalid(parse(src), src);
  return new Set(assignHeadingIds(tree).map((h) => h.id));
}
