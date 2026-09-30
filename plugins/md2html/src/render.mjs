// The fixed page template. Pure: every input is an argument.
import path from 'node:path';
import { relHref } from './util.mjs';

export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:|\/)/i;
/** A menu path → { path, rest }: a root-relative `.md` path becomes `.html`; `?query#fragment` is kept apart. */
function menuTarget(p) {
  if (EXTERNAL.test(p)) return { path: p, rest: '', external: true };
  const [, pathPart, rest] = /^([^?#]*)(.*)$/s.exec(p);
  return { path: path.posix.normalize(pathPart).replace(/\.md$/, '.html'), rest };
}
const capitalise = (s) => s.charAt(0).toUpperCase() + s.slice(1);
// A theme must not be able to end the <style> element early.
export const safeCss = (css) => css.replace(/<\/(style)/gi, '<\\/$1');

/** `<nav class="reports-nav">` for report `file` (root-relative). */
export function renderNav(config, file) {
  const here = menuTarget(file).path;
  const icon = config.brand.icon ? `<img src="${esc(relHref(file, config.brand.icon))}" alt="">` : '';
  const items = config.reports.map((r) => {
    const target = menuTarget(r.path);
    const current = !target.external && target.path === here ? ' aria-current="page"' : '';
    const href = target.external ? target.path : relHref(file, target.path) + target.rest;
    return `<a class="item" href="${esc(href)}"${current}>${esc(r.label)}</a>`;
  });
  return `<nav class="reports-nav" aria-label="Reports"><span class="brand">${icon}${esc(config.brand.name)}</span>${items.join('')}</nav>`;
}

/** `<dl class="report-meta">`; rows only for the keys that are present. */
export function renderMeta({ created, edited, status }) {
  const rows = [];
  if (created !== undefined) rows.push(`<div><dt>Created</dt><dd>${esc(created)}</dd></div>`);
  if (edited !== undefined) rows.push(`<div><dt>Last edited</dt><dd>${esc(edited)}</dd></div>`);
  if (status !== undefined) rows.push(`<div><dt>Status</dt><dd><span class="report-status ${esc(status)}">${esc(capitalise(status))}</span></dd></div>`);
  return rows.length ? `<dl class="report-meta">${rows.join('')}</dl>` : '';
}

export function renderToc(entries) {
  return `<nav class="toc" aria-label="Contents">\n${entries.map((e) => `<a href="#${esc(e.id)}">${esc(e.label)}</a>\n`).join('')}</nav>`;
}

/**
 * The whole page. `subtitleHtml`, `tldrHtml`, `bodyHtml` are serialized fragments ('' when absent);
 * `toc` is [{id, label}] (rendered from TOC_MIN_SECTIONS entries up by the caller's choice: pass [] to omit).
 */
export function renderPage({ file, config, title, description, created, edited, status, subtitleHtml, tldrHtml, toc, bodyHtml, baseCss, themeCss, version }) {
  const icon = config.brand.icon
    ? `<img class="appicon" src="${esc(relHref(file, config.brand.icon))}" alt="${esc(config.brand.name)}" width="48" height="48">`
    : '';
  const lines = [
    '<!doctype html>',
    `<html lang="${esc(config.lang)}">`,
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${esc(title)}</title>`,
    description ? `<meta name="description" content="${esc(description)}">` : null,
    `<meta name="generator" content="md2html ${esc(version)}">`,
    '<style>',
    '@layer base, theme;',
    '@layer base {',
    safeCss(baseCss).trimEnd(),
    '}',
    '@layer theme {',
    themeCss.trim() ? safeCss(themeCss).trimEnd() : null,
    '}',
    '</style>',
    '</head>',
    '<body>',
    renderNav(config, file),
    '<main>',
    `<header class="top"><h1>${esc(title)}</h1>${icon}</header>`,
    renderMeta({ created, edited, status }) || null,
    subtitleHtml ? `<p class="sub">${subtitleHtml}</p>` : null,
    tldrHtml || null,
    toc.length ? renderToc(toc) : null,
    bodyHtml.trim() || null,
    '</main>',
    '</body>',
    '</html>',
  ];
  return lines.filter((l) => l !== null).join('\n') + '\n';
}
