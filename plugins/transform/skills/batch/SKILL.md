---
description: Batch convert a directory of documents (DOCX, PDF, MSG) to Markdown
argument-hint: "<directory> [output-dir]"
---

Batch convert all supported documents in a directory to GFM Markdown.

Supported formats: DOCX (Word), PDF, MSG (Outlook email).

**Input**: A path to a directory containing documents, and optionally an output
directory. If no output directory is given, Markdown files are saved next to
each input file.

**Steps**

1. **Resolve the input directory**

   If the user provides a directory path, use it. If not provided or ambiguous:
   - Check if the conversation context mentions a specific directory
   - Use **AskUserQuestion** to ask for the directory path

   Verify the directory exists before proceeding.

2. **Scan for supported files**

   List the supported files in the directory:

   ```bash
   find "<directory>" -maxdepth 1 \( -iname "*.docx" -o -iname "*.pdf" -o -iname "*.msg" \) -type f | sort
   ```

   Report what was found:
   > Found: 45 DOCX, 30 PDF, 12 MSG (87 total)

   If no supported files are found, report that and stop.

3. **Ensure the Python environment is set up**

   Find the transform plugin directory:

   ```bash
   TRANSFORM_DIR=$(find ~/.claude/plugins -path "*/transform/scripts/convert.sh" -exec dirname {} \; 2>/dev/null | head -1)
   TRANSFORM_DIR=$(dirname "$TRANSFORM_DIR")  # go up from scripts/ to plugin root
   ```

   Check if `$TRANSFORM_DIR/.venv` exists. If not, run setup:

   ```bash
   bash "$TRANSFORM_DIR/scripts/setup.sh"
   ```

   If setup fails, diagnose the error and give the user a concrete fix (same
   as the doc2md skill).

4. **Ask about LLM cleanup**

   Ask the user once whether to apply LLM cleanup to all converted files.
   Explain the tradeoff: better output quality vs. more time and tokens.

   This choice applies to all files in the batch.

5. **Run the batch conversion**

   ```bash
   bash "$TRANSFORM_DIR/scripts/batch.sh" "<directory>" "<output-dir>"
   ```

   The batch script processes each file, reports progress, and prints a
   summary.

6. **Apply LLM cleanup (if opted in)**

   If the user opted for LLM cleanup, read each output Markdown file and
   rewrite it:
   - Fix broken headings, tables, line breaks
   - Remove conversion artifacts
   - Preserve all content

   Report progress as each file is cleaned.

7. **Show summary**

   Report:
   - Total files processed
   - Successes and failures
   - Output location
   - Any files that failed with their error messages

   If there were failures, suggest re-running individual files with
   `/transform:doc2md` for better error diagnosis.
