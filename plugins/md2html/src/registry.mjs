// The directive table: the single source for render, lint, fmt, syntax and editor menus.
// `render(node, h, ctx)` returns hast; `h(tag, props, children)` builds an element.
// `children` is 'flow' (any Markdown), 'phrasing' (inline label) or a list of allowed directive names.
export const directives = [
  {
    type: 'containerDirective', form: 'container', name: 'tldr', attrs: {}, children: 'flow',
    summary: 'The short answer. The first one is moved to the top of the page, under the subtitle.',
    render: (node, h, ctx) => h('div', { className: ['tldr'] }, ctx.children(node)),
    menu: { label: 'TL;DR', keywords: ['summary', 'short', 'answer'], snippet: ':::tldr\n${1:**Short answer:** …}\n:::' },
  },
  {
    type: 'containerDirective', form: 'container', name: 'cards', attrs: {}, children: ['card'],
    summary: 'A responsive grid of cards. Holds only `:::card` blocks, so it needs four colons.',
    render: (node, h, ctx) => h('div', { className: ['cards'] }, ctx.children(node)),
    menu: { label: 'Cards', keywords: ['pros', 'cons', 'compare', 'grid'], snippet: '::::cards\n:::card{title="${1:Pros}"}\n${2:Fast to set up.}\n:::\n\n:::card{title="${3:Cons}"}\n${4:One more tool.}\n:::\n::::' },
  },
  {
    type: 'containerDirective', form: 'container', name: 'card', attrs: { title: { type: 'string' } },
    children: 'flow', parent: 'cards',
    summary: 'One card inside `::::cards`. `title` becomes its heading.',
    render: (node, h, ctx) => h('div', { className: ['card'] }, [
      ...(node.attributes?.title ? [h('h4', {}, [{ type: 'text', value: node.attributes.title }])] : []),
      ...ctx.children(node),
    ]),
    menu: { label: 'Card', keywords: ['card', 'box'], snippet: ':::card{title="${1:Title}"}\n${2:Card text.}\n:::' },
  },
  {
    type: 'textDirective', form: 'inline', name: 'verdict',
    attrs: { tone: { enum: ['go', 'partial', 'no'], required: true } }, children: 'phrasing',
    summary: 'A coloured pill: green `go`, amber `partial`, red `no`.',
    render: (node, h, ctx) => h('span', { className: ['v', node.attributes.tone] }, ctx.children(node)),
    menu: { label: 'Verdict pill', keywords: ['pill', 'status', 'badge'], snippet: ':verdict[${1:works}]{tone="${2|go,partial,no|}"}' },
  },
];

export const byName = new Map(directives.map((d) => [d.name, d]));

export const FORM_OF_TYPE = { containerDirective: 'container', leafDirective: 'leaf', textDirective: 'inline' };
export const PREFIX = { container: ':::', leaf: '::', inline: ':' };

/** The registry entry for a node, or undefined when the name or form is unknown. */
export function entryFor(node) {
  const d = byName.get(node.name);
  return d && d.type === node.type ? d : undefined;
}

/** Why a directive node is invalid (attrs, required), or null. Nesting is checked by lint. */
export function attrProblems(node, d = entryFor(node)) {
  if (!d) return ['unknown'];
  const problems = [];
  const attrs = node.attributes || {};
  for (const [key, value] of Object.entries(attrs)) {
    const spec = d.attrs[key];
    if (!spec) problems.push({ kind: 'unknown-attr', key, value });
    else if (spec.enum && !spec.enum.includes(value)) problems.push({ kind: 'bad-value', key, value, allowed: spec.enum });
  }
  for (const [key, spec] of Object.entries(d.attrs)) {
    if (spec.required && !(key in attrs)) problems.push({ kind: 'missing-attr', key, allowed: spec.enum });
  }
  return problems;
}
