#!/usr/bin/env python3
"""Convert an Outlook MSG file to GFM Markdown.

Usage: msg2md.py <input.msg> [output-dir]

Uses extract-msg to parse the MSG file and pypandoc to convert
the HTML body to Markdown. Email metadata (From, To, Subject, Date)
is prepended as a header block.

Output contract:
  - <output-dir>/<basename>.md
  - <output-dir>/media/<basename>/  (attachments, if any)
  - Exit 0 on success, 1 on error (message on stderr)

If output-dir is omitted, output goes next to the input file.
"""

import sys
import shutil
from pathlib import Path

import extract_msg
import pypandoc


def main():
    if len(sys.argv) < 2:
        print("Usage: msg2md.py <input.msg> [output-dir]", file=sys.stderr)
        sys.exit(1)

    input_path = Path(sys.argv[1]).resolve()
    if not input_path.exists():
        print(f"Error: file not found: {input_path}", file=sys.stderr)
        sys.exit(1)

    if not input_path.suffix.lower() == ".msg":
        print(f"Error: expected .msg file, got {input_path.suffix}", file=sys.stderr)
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

    # Parse the MSG file
    msg = extract_msg.Message(str(input_path))

    # Build email header block
    header_lines = ["---", ""]
    if msg.sender:
        header_lines.append(f"**From:** {msg.sender}")
    if msg.to:
        header_lines.append(f"**To:** {msg.to}")
    if msg.cc:
        header_lines.append(f"**CC:** {msg.cc}")
    if msg.subject:
        header_lines.append(f"**Subject:** {msg.subject}")
    if msg.date:
        header_lines.append(f"**Date:** {msg.date}")
    header_lines.append("")
    header_lines.append("---")
    header_lines.append("")

    header_block = "\n".join(header_lines)

    # Convert body to Markdown
    body_md = ""
    if msg.htmlBody:
        # HTML body available — convert via pypandoc
        html_body = msg.htmlBody
        if isinstance(html_body, bytes):
            html_body = html_body.decode("utf-8", errors="replace")
        body_md = pypandoc.convert_text(html_body, "gfm", format="html", extra_args=["--wrap=none"])
    elif msg.body:
        # Plain text body — use as-is
        body_md = msg.body

    # Combine header + body
    full_md = header_block + body_md + "\n"
    output_path.write_text(full_md, encoding="utf-8")

    # Extract attachments to media/
    attachments = msg.attachments
    if attachments:
        media_dir.mkdir(parents=True, exist_ok=True)
        for attachment in attachments:
            if attachment.longFilename:
                att_name = attachment.longFilename
            elif attachment.shortFilename:
                att_name = attachment.shortFilename
            else:
                continue

            att_path = media_dir / att_name
            attachment.save(customPath=str(media_dir), customFilename=att_name)

        # Append attachment list to the markdown
        with open(output_path, "a", encoding="utf-8") as f:
            f.write("\n## Attachments\n\n")
            for attachment in attachments:
                name = attachment.longFilename or attachment.shortFilename
                if name:
                    f.write(f"- [{name}](media/{basename}/{name})\n")

    msg.close()
    print(f"Converted: {output_path}")


if __name__ == "__main__":
    main()
