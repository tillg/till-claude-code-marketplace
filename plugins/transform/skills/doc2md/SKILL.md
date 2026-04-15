---
description: Convert a document (DOCX, PDF, or MSG) to clean Markdown
argument-hint: "<file> [output-dir]"
---

Convert a document file to GFM Markdown with media extraction.

Supported formats: DOCX (Word), PDF, MSG (Outlook email).

**Input**: A path to a document file, and optionally an output directory. If no
output directory is given, the Markdown file is saved next to the input file.

**Steps**

1. **Resolve the input file**

   If the user provides a file path, use it. If not provided or ambiguous:
   - Check if the conversation context mentions a specific document file
   - Look for `.docx`, `.pdf`, or `.msg` files in the current directory
   - If multiple candidates exist, use **AskUserQuestion** to let the user pick

   Verify the file exists before proceeding.

2. **Ensure the Python environment is set up**

   The conversion scripts live in the transform plugin directory. Find it:

   ```bash
   TRANSFORM_DIR=$(find ~/.claude/plugins -path "*/transform/scripts/convert.sh" -exec dirname {} \; 2>/dev/null | head -1)
   TRANSFORM_DIR=$(dirname "$TRANSFORM_DIR")  # go up from scripts/ to plugin root
   ```

   Check if `$TRANSFORM_DIR/.venv` exists. If not, run setup:

   ```bash
   bash "$TRANSFORM_DIR/scripts/setup.sh"
   ```

   **Note on first run:** PDF conversion uses Marker, which downloads ML models
   (~2GB) on first use. These are cached in `~/Library/Caches/datalab/models/`
   (macOS) and only downloaded once. Warn the user if this is their first PDF
   conversion — it will take a few minutes.

   **If setup fails**, read the error output and diagnose:
   - `python3: command not found` → tell user to install Python 3
   - `ConnectionError` or `SSL` → check internet connection
   - `No space left on device` → free disk space
   - `Permission denied` → check directory permissions
   - Compiler/wheel errors → may need `xcode-select --install` (macOS)

   Stop and give the user a concrete fix. Re-running the skill after the fix
   will retry setup automatically.

3. **Run the conversion**

   ```bash
   bash "$TRANSFORM_DIR/scripts/convert.sh" "<input-file>" "<output-dir>"
   ```

   The dispatcher auto-detects the format by extension and routes to the right
   converter script.

4. **Optionally apply LLM cleanup**

   After conversion, ask the user if they want LLM cleanup:
   - DOCX files usually convert cleanly — suggest skipping
   - PDF files often have artifacts — suggest cleanup
   - MSG files are usually fine — suggest skipping

   If the user wants cleanup, read the output Markdown file and rewrite it:
   - Fix broken headings (wrong level, missing space after #)
   - Normalize tables (alignment, missing cells)
   - Remove conversion artifacts (stray backslashes, empty links)
   - Fix line breaks (merge lines that were split mid-sentence)
   - Preserve all content — don't remove anything intentionally

   Write the cleaned version back to the same file.

5. **Report the result**

   Tell the user:
   - Where the Markdown file was saved
   - Whether media/attachments were extracted (and where)
   - File size of the output

   If the conversion failed, show the error output and suggest fixes.
