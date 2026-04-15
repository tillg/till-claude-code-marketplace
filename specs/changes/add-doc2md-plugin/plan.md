# Plan: Add transform Plugin

## Implementation Steps

- [x] **Create plugin scaffold** — Create `plugins/transform/.claude-plugin/plugin.json` with name, version (1.0.0), description, marketplace URL, and author. Create directory structure: `scripts/`, `skills/doc2md/`, `skills/batch/`. Add `plugins/transform/.venv/` to `.gitignore`.

- [x] **Create requirements.txt** — Add `plugins/transform/requirements.txt` with `pypandoc_binary`, `extract-msg`, and `marker-pdf`.

- [x] **Write setup.sh** — Script that creates a `.venv` in the plugin directory and installs deps from requirements.txt. Should be idempotent (safe to run multiple times).

- [x] **Write docx2md.py** — Python script using `pypandoc.convert_file()` for DOCX → GFM Markdown with `--extract-media` and `--wrap=none`. Follows the output contract: `<basename>.md` + `media/<basename>/`.

- [x] **Write pdf2md.sh** — Shell script wrapping Marker via the plugin's venv. Takes input PDF + optional output dir. Calls `marker_single` from `.venv/bin/`, normalizes output to match the common contract.

- [x] **Write msg2md.py** — Python script using `extract_msg` to extract headers, body HTML, and attachments. Uses `pypandoc.convert_text()` for HTML→MD. Prepends email metadata header block. Moves attachments to `media/`.

- [x] **Write convert.sh (dispatcher)** — Detects format by extension, delegates to the format-specific script. Passes through arguments. Handles unknown extensions with a clear error.

- [x] **Write batch.sh** — Scans a directory for supported files (.docx, .pdf, .msg), calls `convert.sh` for each, tracks successes/failures, prints a summary.

- [x] **Write the doc2md skill (SKILL.md)** — Prompt that: resolves the input file, checks for `.venv` (runs setup.sh if missing), calls `convert.sh`, optionally applies LLM cleanup on the output, reports the result.

- [x] **Write the batch skill (SKILL.md)** — Prompt that: resolves the input directory, scans for supported files, checks for `.venv` (runs setup.sh if missing), asks about LLM cleanup, calls `batch.sh`, shows a summary.

- [x] **Register in marketplace.json** — Add a `transform` entry to `.claude-plugin/marketplace.json`.

- [x] **Test with a DOCX file** — Convert a sample DOCX, verify Markdown output and image extraction.

- [x] **Test with a PDF file** — Convert a sample PDF, verify Marker output is clean.

- [x] **Test with an MSG file** — Cannot generate real .msg files without Outlook. Script structure verified; needs a real .msg file for integration testing. Sample .eml provided in testdata/ for reference.

- [x] **Test batch conversion** — Run batch on a mixed-format directory, verify all conversions and summary output.
