#!/usr/bin/env bash
# Dispatcher: detect format by extension and delegate to the right converter.
#
# Usage: convert.sh <input-file> [output-dir]
#
# Supported formats: .docx, .pdf, .msg
# Exit 0 on success, 1 on error.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLUGIN_DIR="$(dirname "$SCRIPT_DIR")"
VENV_PYTHON="$PLUGIN_DIR/.venv/bin/python3"

if [ $# -lt 1 ]; then
    echo "Usage: convert.sh <input-file> [output-dir]" >&2
    exit 1
fi

input="$1"
output_dir="${2:-}"

if [ ! -f "$input" ]; then
    echo "Error: file not found: $input" >&2
    exit 1
fi

# Extract extension (lowercase)
ext="${input##*.}"
ext="$(echo "$ext" | tr '[:upper:]' '[:lower:]')"

case "$ext" in
    docx)
        exec "$VENV_PYTHON" "$SCRIPT_DIR/docx2md.py" "$input" $output_dir
        ;;
    pdf)
        exec "$SCRIPT_DIR/pdf2md.sh" "$input" $output_dir
        ;;
    msg)
        exec "$VENV_PYTHON" "$SCRIPT_DIR/msg2md.py" "$input" $output_dir
        ;;
    *)
        echo "Error: unsupported format '.$ext'. Supported: .docx, .pdf, .msg" >&2
        exit 1
        ;;
esac
