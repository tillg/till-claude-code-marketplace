// buildIndex: the project index (config.specs.index), one row per spec group. Pure: no fs, clock or env.
import { esc } from '../render.mjs';
import { relHref, encodePath } from '../util.mjs';
import { groupStatus } from './groups.mjs';
import { specPage } from './build.mjs';

const DASH = '—';
const capitalise = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const first = (items, key) => items.find((it) => it[key] != null)?.[key] ?? null;

function row(group, at) {
  const { items } = group;
  const href = (it) => esc(encodePath(relHref(at, it.file.replace(/\.md$/, '.html'))));
  const feature = first(items, 'feature');
  const status = groupStatus(items);
  const edited = items.map((it) => it.edited).filter((e) => e != null).sort().at(-1) ?? null;
  const cells = [
    `<td class="dir" data-label="Directory"><code>${esc(group.dir)}/</code></td>`,
    `<td data-label="Feature">${feature == null ? DASH : esc(feature)}</td>`,
    `<td data-label="Status">${status == null ? DASH : `<span class="spec-status ${esc(status)}">${esc(capitalise(status))}</span>`}</td>`,
    `<td data-label="Title"><a href="${href(items[0])}">${esc(items[0].title)}</a></td>`,
    `<td class="num" data-label="Edited">${edited == null ? DASH : esc(edited)}</td>`,
    `<td class="pages" data-label="Pages">${items.map((it) => `<a href="${href(it)}">${esc(it.label)}</a>`).join(' ')}</td>`,
  ];
  return `<tr>${cells.join('')}</tr>`;
}

/** `allGroups` from groups.mjs (already sorted by dir); hrefs are relative to config.specs.index. */
export function buildIndex(allGroups, { config, themeCss = '' }) {
  const at = config.specs.index;
  const nonEmpty = allGroups.filter((g) => g.items.length);
  const table = nonEmpty.length
    ? [
      '<div class="tbl"><table class="spec-index">',
      '<thead><tr><th>Directory</th><th>Feature</th><th>Status</th><th>Title</th><th>Edited</th><th>Pages</th></tr></thead>',
      `<tbody>\n${nonEmpty.map((g) => row(g, at)).join('\n')}\n</tbody>`,
      '</table></div>',
    ].join('\n')
    : '<p>No spec files yet.</p>';
  return specPage({ config, title: 'Specs', themeCss, nav: '', body: `<h1>Specs</h1>\n${table}` });
}
