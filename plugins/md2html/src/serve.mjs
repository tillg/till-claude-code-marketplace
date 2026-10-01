// `md2html serve`: a 127.0.0.1-only static server for the generated pages. It hands out page
// files only (HTML, images, CSS) — never sources, configs, dot-dirs or anything outside the root.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

export const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
  '.avif': 'image/avif', '.ico': 'image/x-icon',
};

/** The absolute file a URL path may serve, or null. `realRoot` is the realpath of the project root. */
export function resolveServable(realRoot, urlPath) {
  let rel;
  try { rel = decodeURIComponent(urlPath.split(/[?#]/)[0]); } catch { return null; }
  const segments = rel.split('/').filter(Boolean);
  if (!segments.length || segments.some((s) => s.startsWith('.') || s === 'node_modules' || s.includes('\\') || s.includes('\0'))) return null;
  if (!TYPES[path.extname(segments.at(-1)).toLowerCase()]) return null;
  let real;
  try { real = fs.realpathSync(path.join(realRoot, ...segments)); } catch { return null; }
  if (real !== realRoot && !real.startsWith(realRoot + path.sep)) return null; // symlink escape
  try { if (!fs.statSync(real).isFile()) return null; } catch { return null; }
  return real;
}

/** Start serving `root`; resolves with the server once it listens. `/` redirects to `index`. */
export function serve(root, { port = 0, index = 'index.html' } = {}) {
  const realRoot = fs.realpathSync(root);
  const server = http.createServer((req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return; }
    const urlPath = new URL(req.url, 'http://localhost').pathname;
    if (urlPath === '/') { res.writeHead(302, { Location: `/${index}` }); res.end(); return; }
    const file = resolveServable(realRoot, urlPath);
    if (!file) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()], 'Cache-Control': 'no-store' });
    if (req.method === 'HEAD') { res.end(); return; }
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}
