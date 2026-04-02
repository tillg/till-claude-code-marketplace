#!/usr/bin/env node

/**
 * md2pdf — Convert a Markdown file to a styled PDF.
 *
 * Usage: node convert.mjs <input.md> [output.pdf] [--no-mermaid]
 *
 * Features:
 *   - Syntax-highlighted code blocks (highlight.js)
 *   - Styled tables with striped rows
 *   - Mermaid diagram rendering (via CDN)
 *   - Image embedding (local & remote)
 *   - ASCII art preservation (monospace)
 *   - Footnotes
 *   - Print-optimised CSS
 */

import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { resolve, dirname, basename, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import markdownIt from "markdown-it";
import footnotePlugin from "markdown-it-footnote";
import hljs from "highlight.js";
import { chromium } from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES = resolve(__dirname, "..", "templates");

// ── CLI args ────────────────────────────────────────────

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const flags = new Set(process.argv.slice(2).filter((a) => a.startsWith("--")));

if (args.length === 0) {
  console.error("Usage: node convert.mjs <input.md> [output.pdf]");
  process.exit(1);
}

const inputPath = resolve(args[0]);
const outputPath = args[1]
  ? resolve(args[1])
  : resolve(
      dirname(inputPath),
      basename(inputPath, extname(inputPath)) + ".pdf"
    );
const enableMermaid = !flags.has("--no-mermaid");

// ── Markdown → HTML ─────────────────────────────────────

const md = markdownIt({
  html: true,
  linkify: true,
  typographer: true,
  highlight(str, lang) {
    // Detect mermaid fenced blocks and pass them through raw
    if (lang === "mermaid" && enableMermaid) {
      return `</code></pre><div class="mermaid">${escapeHtml(str)}</div><pre class="mermaid-placeholder"><code>`;
    }

    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(str, { language: lang }).value;
      } catch {
        /* fall through */
      }
    }
    // Auto-detect for unlabeled blocks
    try {
      return hljs.highlightAuto(str).value;
    } catch {
      return "";
    }
  },
});

md.use(footnotePlugin);

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Resolve local images to data URIs ───────────────────

async function inlineLocalImages(html, basePath) {
  const imgRegex = /<img\s+([^>]*?)src="([^"]+)"([^>]*?)>/g;
  const results = [];

  for (const match of html.matchAll(imgRegex)) {
    const [full, before, src, after] = match;
    // Skip remote URLs and data URIs
    if (/^https?:\/\/|^data:/.test(src)) continue;

    try {
      const imgPath = resolve(basePath, src);
      const buf = await readFile(imgPath);
      const ext = extname(src).toLowerCase().replace(".", "");
      const mime =
        { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", svg: "image/svg+xml", webp: "image/webp" }[ext] ||
        "application/octet-stream";
      const dataUri = `data:${mime};base64,${buf.toString("base64")}`;
      results.push({ full, replacement: `<img ${before}src="${dataUri}"${after}>` });
    } catch {
      // If image can't be read, leave the src as-is
    }
  }

  for (const { full, replacement } of results) {
    html = html.replace(full, replacement);
  }
  return html;
}

// ── Assemble full HTML ──────────────────────────────────

async function buildHtml(markdownSource) {
  let contentHtml = md.render(markdownSource);

  // Inline local images
  contentHtml = await inlineLocalImages(contentHtml, dirname(inputPath));

  // Clean up mermaid placeholder wrappers
  contentHtml = contentHtml.replace(
    /<pre class="mermaid-placeholder"><code><\/code><\/pre>/g,
    ""
  );

  const template = await readFile(join(TEMPLATES, "template.html"), "utf-8");
  const styleCSS = await readFile(join(TEMPLATES, "style.css"), "utf-8");
  const hljsCSS = await readFile(
    resolve(__dirname, "..", "node_modules", "highlight.js", "styles", "github.min.css"),
    "utf-8"
  );

  // Extract title from first heading
  const titleMatch = markdownSource.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1] : basename(inputPath, extname(inputPath));

  let html = template
    .replace("{{TITLE}}", escapeHtml(title))
    .replace("{{CONTENT}}", contentHtml)
    .replace(
      `<link rel="stylesheet" href="{{HIGHLIGHT_CSS}}">`,
      `<style>${hljsCSS}</style>`
    )
    .replace(
      `<link rel="stylesheet" href="{{STYLE_CSS}}">`,
      `<style>${styleCSS}</style>`
    );

  return html;
}

// ── Render PDF with Playwright ──────────────────────────

async function renderPdf(html, outPath) {
  // Write HTML to a temp file so Playwright can load it with file:// protocol
  const tmpDir = await mkdtemp(join(tmpdir(), "md2pdf-"));
  const tmpHtml = join(tmpDir, "input.html");
  await writeFile(tmpHtml, html, "utf-8");

  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto(`file://${tmpHtml}`, { waitUntil: "networkidle" });

  // Wait for mermaid rendering if enabled
  if (enableMermaid) {
    try {
      await page.waitForFunction(() => window.__PDF_READY === true, {
        timeout: 15000,
      });
    } catch {
      // Proceed anyway — mermaid may not be present
    }
  }

  // Small extra delay for any final paint
  await page.waitForTimeout(500);

  await page.pdf({
    path: outPath,
    format: "A4",
    printBackground: true,
    margin: { top: "20mm", right: "15mm", bottom: "20mm", left: "15mm" },
    displayHeaderFooter: true,
    headerTemplate: `<span></span>`,
    footerTemplate: `
      <div style="width:100%; text-align:center; font-size:9px; color:#999; padding:0 15mm;">
        <span class="pageNumber"></span> / <span class="totalPages"></span>
      </div>
    `,
  });

  await browser.close();
  await rm(tmpDir, { recursive: true, force: true });
}

// ── Main ────────────────────────────────────────────────

try {
  console.log(`Reading ${inputPath}...`);
  const markdownSource = await readFile(inputPath, "utf-8");

  console.log("Converting Markdown → HTML...");
  const html = await buildHtml(markdownSource);

  console.log("Rendering PDF with Playwright...");
  await renderPdf(html, outputPath);

  console.log(`Done! PDF saved to: ${outputPath}`);
} catch (err) {
  console.error("Error:", err.message);
  process.exit(1);
}
