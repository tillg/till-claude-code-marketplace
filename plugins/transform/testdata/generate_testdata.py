#!/usr/bin/env python3
"""Generate test data files for the transform plugin.

Creates sample DOCX, PDF, and MSG files in the testdata directory.
Run from the plugin root: .venv/bin/python3 testdata/generate_testdata.py
"""

import os
import sys
from pathlib import Path

# Add the plugin's venv to find dependencies
SCRIPT_DIR = Path(__file__).parent
PLUGIN_DIR = SCRIPT_DIR.parent


def generate_docx():
    """Generate a sample DOCX file using pypandoc (Markdown → DOCX)."""
    import pypandoc

    md_content = """# Sample Document

## Introduction

This is a **test document** for the transform plugin. It contains various
Markdown elements to verify conversion fidelity.

## Features

- Bullet point one
- Bullet point two
- Bullet point three

### Numbered List

1. First item
2. Second item
3. Third item

## Table

| Name    | Role      | Department |
|---------|-----------|------------|
| Alice   | Engineer  | Platform   |
| Bob     | Designer  | Product    |
| Charlie | Manager   | Operations |

## Code Block

```python
def hello():
    print("Hello from the test document!")
```

## Conclusion

This document tests headings, lists, tables, and code blocks.
"""

    output_path = SCRIPT_DIR / "sample.docx"
    pypandoc.convert_text(
        md_content,
        "docx",
        format="gfm",
        outputfile=str(output_path),
    )
    print(f"Created: {output_path}")


def generate_pdf():
    """Generate a sample PDF using reportlab (if available) or pypandoc."""
    import pypandoc

    md_content = """# Quarterly Report

## Executive Summary

This report covers Q1 2025 performance metrics across all departments.
Revenue grew **12% year-over-year** while maintaining operational efficiency.

## Key Metrics

| Metric          | Q1 2025  | Q4 2024  | Change |
|-----------------|----------|----------|--------|
| Revenue         | $2.4M    | $2.1M    | +14%   |
| Active Users    | 45,000   | 38,000   | +18%   |
| Churn Rate      | 2.1%     | 2.8%     | -0.7%  |
| NPS Score       | 72       | 68       | +4     |

## Department Updates

### Engineering

- Shipped v3.2 with performance improvements
- Reduced API latency by 30%
- Migrated 80% of services to new infrastructure

### Product

- Launched 3 new features based on user feedback
- Completed redesign of onboarding flow
- User satisfaction score improved to 4.2/5

## Next Steps

1. Continue infrastructure migration
2. Launch mobile app beta
3. Expand to European markets
"""

    output_path = SCRIPT_DIR / "sample.pdf"

    # Use pypandoc to create PDF (requires a PDF engine)
    try:
        pypandoc.convert_text(
            md_content,
            "pdf",
            format="gfm",
            outputfile=str(output_path),
            extra_args=["--pdf-engine=pdflatex"],
        )
        print(f"Created: {output_path}")
    except Exception:
        # If LaTeX is not available, create a minimal PDF manually
        # PDF 1.4 minimal structure
        content = md_content.replace("#", "").strip()
        # Truncate for simple PDF
        lines = content.split("\n")[:20]
        text_block = "\n".join(lines)

        pdf_bytes = _create_minimal_pdf("Quarterly Report", text_block)
        output_path.write_bytes(pdf_bytes)
        print(f"Created (minimal): {output_path}")


def _create_minimal_pdf(title, body_text):
    """Create a minimal valid PDF file."""
    lines = body_text.replace("(", "\\(").replace(")", "\\)").split("\n")
    text_ops = []
    y = 750
    for line in lines:
        if line.strip():
            text_ops.append(f"BT /F1 10 Tf {72} {y} Td ({line.strip()}) Tj ET")
            y -= 14
        else:
            y -= 10

    # Title
    title_op = f"BT /F1 16 Tf 72 780 Td ({title}) Tj ET"
    stream_content = title_op + "\n" + "\n".join(text_ops)

    objects = []
    # Obj 1: Catalog
    objects.append("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj")
    # Obj 2: Pages
    objects.append("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj")
    # Obj 3: Page
    objects.append(
        "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
        "/Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj"
    )
    # Obj 4: Content stream
    objects.append(
        f"4 0 obj\n<< /Length {len(stream_content)} >>\n"
        f"stream\n{stream_content}\nendstream\nendobj"
    )
    # Obj 5: Font
    objects.append(
        "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj"
    )

    body = ""
    offsets = []
    header = "%PDF-1.4\n"
    body_start = len(header)

    for obj in objects:
        offsets.append(body_start + len(body))
        body += obj + "\n"

    xref_offset = body_start + len(body)
    xref = f"xref\n0 {len(objects) + 1}\n"
    xref += "0000000000 65535 f \n"
    for off in offsets:
        xref += f"{off:010d} 00000 n \n"

    trailer = (
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\n"
        f"startxref\n{xref_offset}\n%%EOF\n"
    )

    return (header + body + xref + trailer).encode("latin-1")


def generate_msg():
    """Generate a sample MSG-like file.

    Since creating real MSG files requires Windows COM or complex binary
    format knowledge, we create a simplified test. For real testing,
    use an actual .msg file from Outlook.

    Instead, we create a .eml file and rename it — extract-msg can't
    read .eml files, so we'll also create a note about this limitation.
    """
    # Create a simple EML as a fallback test file
    eml_content = """From: alice@example.com
To: bob@example.com
Subject: Q1 Planning Meeting Notes
Date: Mon, 15 Jan 2025 10:30:00 +0000
MIME-Version: 1.0
Content-Type: text/html; charset="utf-8"

<html>
<body>
<h1>Q1 Planning Meeting Notes</h1>
<p>Hi team,</p>
<p>Here are the <strong>key takeaways</strong> from today's planning meeting:</p>
<ul>
<li>Budget approved for new infrastructure</li>
<li>Hiring plan: 3 engineers, 1 designer</li>
<li>Launch target: March 15</li>
</ul>
<h2>Action Items</h2>
<table border="1">
<tr><th>Owner</th><th>Task</th><th>Due Date</th></tr>
<tr><td>Alice</td><td>Draft technical spec</td><td>Jan 22</td></tr>
<tr><td>Bob</td><td>Create design mockups</td><td>Jan 29</td></tr>
<tr><td>Charlie</td><td>Set up CI/CD pipeline</td><td>Feb 5</td></tr>
</table>
<p>Best regards,<br>Alice</p>
</body>
</html>
"""

    output_path = SCRIPT_DIR / "sample.eml"
    output_path.write_text(eml_content, encoding="utf-8")
    print(f"Created: {output_path}")
    print(
        "  Note: Real .msg files require Outlook. Use this .eml for basic testing."
    )
    print(
        "  For MSG testing, copy a real .msg file to this directory as 'sample.msg'."
    )


if __name__ == "__main__":
    print("Generating test data...\n")
    generate_docx()
    generate_pdf()
    generate_msg()
    print("\nDone!")
