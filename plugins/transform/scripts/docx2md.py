#!/usr/bin/env python3
"""Convert a DOCX file to GFM Markdown using pypandoc.

Usage: docx2md.py <input.docx> [output-dir]

Output contract:
  - <output-dir>/<basename>.md
  - <output-dir>/media/<basename>/  (if images exist)
  - Exit 0 on success, 1 on error (message on stderr)

If output-dir is omitted, output goes next to the input file.
"""

import sys
import os
from pathlib import Path

import pypandoc


def main():
    if len(sys.argv) < 2:
        print("Usage: docx2md.py <input.docx> [output-dir]", file=sys.stderr)
        sys.exit(1)

    input_path = Path(sys.argv[1]).resolve()
    if not input_path.exists():
        print(f"Error: file not found: {input_path}", file=sys.stderr)
        sys.exit(1)

    if not input_path.suffix.lower() == ".docx":
        print(f"Error: expected .docx file, got {input_path.suffix}", file=sys.stderr)
        sys.exit(1)

    # Determine output location
    if len(sys.argv) >= 3:
        output_dir = Path(sys.argv[2]).resolve()
    else:
        output_dir = input_path.parent

    output_dir.mkdir(parents=True, exist_ok=True)

    basename = input_path.stem
    output_path = output_dir / f"{basename}.md"
    media_dir = output_dir / "media" / basename

    # Convert DOCX → GFM Markdown
    output = pypandoc.convert_file(
        str(input_path),
        "gfm",
        extra_args=[
            "--extract-media", str(media_dir),
            "--wrap=none",
        ],
    )

    output_path.write_text(output, encoding="utf-8")

    # Clean up empty media directory if no images were extracted
    if media_dir.exists() and not any(media_dir.iterdir()):
        media_dir.rmdir()
        # Also remove media/ parent if now empty
        media_parent = media_dir.parent
        if media_parent.exists() and not any(media_parent.iterdir()):
            media_parent.rmdir()

    print(f"Converted: {output_path}")


if __name__ == "__main__":
    main()
