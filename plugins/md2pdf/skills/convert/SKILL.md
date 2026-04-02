---
description: Convert a Markdown file to a beautifully formatted PDF
argument-hint: "<file.md> [output.pdf]"
---

Convert a Markdown file to a styled PDF with support for syntax-highlighted code blocks, tables, mermaid diagrams, images, and ASCII art.

**Input**: A path to a Markdown file, and optionally an output PDF path. If no output path is given, the PDF is saved next to the input file with the same name and `.pdf` extension.

**Steps**

1. **Resolve the input file**

   If the user provides a file path, use it. If not provided or ambiguous:
   - Check if the conversation context mentions a specific Markdown file
   - Look for `.md` files in the current directory
   - If multiple candidates exist, use **AskUserQuestion** to let the user pick

   Verify the file exists before proceeding.

2. **Ensure dependencies are installed**

   The conversion script lives in the md2pdf plugin directory. Check if `node_modules` exists there:

   ```
   PLUGIN_DIR="$(dirname "$(dirname "$(dirname "$(readlink -f "$0")")")")"
   ```

   In practice, find the plugin directory by looking for the `md2pdf` plugin root (the directory containing `package.json` and `scripts/convert.mjs`). A reliable way:

   ```bash
   # Find the plugin directory — it's wherever this plugin is installed
   MD2PDF_DIR=$(find ~/.claude/plugins -path "*/md2pdf/scripts/convert.mjs" -exec dirname {} \; 2>/dev/null | head -1)
   MD2PDF_DIR=$(dirname "$MD2PDF_DIR")  # go up from scripts/ to plugin root
   ```

   If `$MD2PDF_DIR/node_modules` does not exist, install dependencies:

   ```bash
   cd "$MD2PDF_DIR" && npm install
   ```

   Also ensure Playwright browsers are available:

   ```bash
   npx playwright install chromium
   ```

3. **Run the conversion**

   ```bash
   node "$MD2PDF_DIR/scripts/convert.mjs" "<input.md>" "<output.pdf>"
   ```

   Pass `--no-mermaid` if the user asks to skip mermaid rendering (faster).

4. **Report the result**

   Tell the user where the PDF was saved. If the conversion failed, show the error output and suggest fixes:
   - Missing images → check relative paths
   - Mermaid timeout → try `--no-mermaid` flag
   - Playwright error → run `npx playwright install chromium`

5. **Open the PDF**

   On macOS, open the PDF for the user:

   ```bash
   open "<output.pdf>"
   ```
