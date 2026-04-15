#!/usr/bin/env bash
# Convert a PDF file to GFM Markdown using Marker.
#
# Usage: pdf2md.sh <input.pdf> [output-dir]
#
# Output contract:
#   - <output-dir>/<basename>.md
#   - <output-dir>/media/<basename>/  (if images exist)
#   - Exit 0 on success, 1 on error (message on stderr)
#
# If output-dir is omitted, output goes next to the input file.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLUGIN_DIR="$(dirname "$SCRIPT_DIR")"
VENV_DIR="$PLUGIN_DIR/.venv"
MARKER="$VENV_DIR/bin/marker_single"

if [ $# -lt 1 ]; then
    echo "Usage: pdf2md.sh <input.pdf> [output-dir]" >&2
    exit 1
fi

input="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"

if [ ! -f "$input" ]; then
    echo "Error: file not found: $input" >&2
    exit 1
fi

# Determine output location
if [ $# -ge 2 ]; then
    output_dir="$(mkdir -p "$2" && cd "$2" && pwd)"
else
    output_dir="$(dirname "$input")"
fi

basename="$(basename "$input" .pdf)"
# Also handle .PDF extension
basename="${basename%.PDF}"
output_file="$output_dir/${basename}.md"
media_dir="$output_dir/media/${basename}"

# Create a temp directory for Marker output
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

# Run Marker
"$MARKER" "$input" --output_dir "$tmp_dir" 2>&1

# Marker creates a subdirectory with the output — find the .md file
md_file="$(find "$tmp_dir" -name "*.md" -type f | head -1)"

if [ -z "$md_file" ]; then
    echo "Error: Marker did not produce a Markdown file" >&2
    exit 1
fi

# Move the markdown file to the expected location
cp "$md_file" "$output_file"

# Move any images to media/<basename>/
marker_dir="$(dirname "$md_file")"
images_found=false

for img_dir in "$marker_dir"/images "$marker_dir"/figures; do
    if [ -d "$img_dir" ] && [ "$(ls -A "$img_dir" 2>/dev/null)" ]; then
        mkdir -p "$media_dir"
        cp -r "$img_dir"/* "$media_dir/"
        images_found=true
    fi
done

# Also check for loose image files in the marker output directory
for ext in png jpg jpeg gif svg webp; do
    for img in "$marker_dir"/*."$ext" "$marker_dir"/*."$(echo "$ext" | tr '[:lower:]' '[:upper:]')"; do
        if [ -f "$img" ]; then
            mkdir -p "$media_dir"
            cp "$img" "$media_dir/"
            images_found=true
        fi
    done
done

# Update image paths in the markdown to point to media/<basename>/
if [ "$images_found" = true ]; then
    # Replace image paths to use the new media location
    sed -i.bak -E "s|images/|media/${basename}/|g; s|figures/|media/${basename}/|g" "$output_file"
    rm -f "$output_file.bak"
fi

echo "Converted: $output_file"
