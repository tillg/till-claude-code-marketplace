#!/usr/bin/env bash
# Batch convert all supported documents in a directory.
#
# Usage: batch.sh <input-dir> [output-dir]
#
# Scans for .docx, .pdf, .msg files (non-recursive by default).
# Calls convert.sh for each file. Tracks successes/failures and prints a summary.
#
# If output-dir is omitted, output goes next to each input file.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONVERT="$SCRIPT_DIR/convert.sh"

if [ $# -lt 1 ]; then
    echo "Usage: batch.sh <input-dir> [output-dir]" >&2
    exit 1
fi

input_dir="$1"
output_dir="${2:-}"

if [ ! -d "$input_dir" ]; then
    echo "Error: directory not found: $input_dir" >&2
    exit 1
fi

# Count files by type
docx_count=$(find "$input_dir" -maxdepth 1 -iname "*.docx" -type f | wc -l | tr -d ' ')
pdf_count=$(find "$input_dir" -maxdepth 1 -iname "*.pdf" -type f | wc -l | tr -d ' ')
msg_count=$(find "$input_dir" -maxdepth 1 -iname "*.msg" -type f | wc -l | tr -d ' ')
total=$((docx_count + pdf_count + msg_count))

if [ "$total" -eq 0 ]; then
    echo "No supported files found in $input_dir (looking for .docx, .pdf, .msg)"
    exit 0
fi

echo "Found: $docx_count DOCX, $pdf_count PDF, $msg_count MSG ($total total)"
echo ""

# Process files
success=0
failed=0
errors=""
current=0

find "$input_dir" -maxdepth 1 \( -iname "*.docx" -o -iname "*.pdf" -o -iname "*.msg" \) -type f | sort |
while read -r file; do
    current=$((current + 1))
    filename="$(basename "$file")"
    echo "[$current/$total] Converting: $filename"

    if "$CONVERT" "$file" $output_dir 2>&1; then
        success=$((success + 1))
    else
        failed=$((failed + 1))
        errors="${errors}\n  - $filename"
        echo "  FAILED: $filename"
    fi
done

# The while loop runs in a subshell due to the pipe, so we recount
success=$(find "$input_dir" -maxdepth 1 \( -iname "*.docx" -o -iname "*.pdf" -o -iname "*.msg" \) -type f -exec sh -c '
    convert="$1"; shift; output_dir="$1"; shift
    count=0
    for f in "$@"; do
        base="$(basename "$f")"
        stem="${base%.*}"
        if [ -n "$output_dir" ]; then
            target="$output_dir/${stem}.md"
        else
            target="$(dirname "$f")/${stem}.md"
        fi
        [ -f "$target" ] && count=$((count + 1))
    done
    echo $count
' _ "$CONVERT" "$output_dir" {} +)

failed=$((total - success))

echo ""
echo "=== Batch Summary ==="
echo "Total:     $total"
echo "Converted: $success"
if [ "$failed" -gt 0 ]; then
    echo "Failed:    $failed"
fi
echo "====================="
