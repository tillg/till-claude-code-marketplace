# Functional: Claude Code Plugin Marketplace

## Marketplace Functions

### Register marketplace
```
/plugin marketplace add tillg/till-claude-code-marketplace
```
Registers the marketplace with Claude Code. Fetches `marketplace.json` from
the GitHub repository.

### Install a plugin
```
/plugin install <name>@till-claude-code-marketplace
```
Downloads the plugin files to the user's local Claude Code plugin cache.
Skills become available after restart.

### Auto-update
When enabled, Claude Code checks for new plugin versions at startup and
prompts the user to update.

## Plugin: spec (v6.1.0)

### User Journey: Spec-driven change

```mermaid
graph LR
    A[/spec:overview] --> B{Need to document system?}
    B -->|yes| C[/spec:document-system]
    B -->|no| D[/spec:explore]
    C --> D
    D --> E[/spec:propose]
    E --> F[/spec:iterate]
    F --> E
    F --> G[/spec:apply]
    G --> H[/spec:archive]
    H -->|next change| E
```

### Skills

| Skill | Input | Output | Side effects |
|-------|-------|--------|-------------|
| `/spec:overview` | None | Status display | None (read-only) |
| `/spec:document-system` | Codebase | `specs/system/*.md` | Creates system description files |
| `/spec:explore` | Idea/question | Conversation | None (thinking only) |
| `/spec:propose` | Change description | `specs/changes/<name>/*.md` | Creates 4 artifact files |
| `/spec:iterate` | User annotations | Updated artifacts | Rewrites artifact files |
| `/spec:apply` | Change name | Code changes | Modifies codebase, updates plan.md checkboxes |
| `/spec:archive` | Change name | Commits | Updates system desc, commits, deletes change dir |

### Artifacts
- `specs/system/` — persistent system description (domain, architecture, functional)
- `specs/changes/<name>/` — temporary change artifacts (proposal, domain, architecture, plan)

## Plugin: md2pdf (v1.0.0)

### User Journey: Convert Markdown to PDF

```
/md2pdf:convert <file.md> [output.pdf]
```

1. Resolve input file
2. Install Node.js dependencies if missing (`npm install`)
3. Run `scripts/convert.mjs` — renders Markdown → HTML → PDF via Playwright
4. Open the resulting PDF

### Features
- Syntax-highlighted code blocks
- Styled tables with striped rows
- Mermaid diagram rendering (via CDN)
- Local image embedding as data URIs
- Footnotes
- Print-optimized CSS with page numbers

## Plugin: transform (v1.0.0)

### User Journey: Convert document to Markdown

```
/transform:doc2md <file> [output-dir]
```

1. Resolve input file
2. Create `.venv` and install Python deps if missing (`setup.sh`)
3. Detect format by extension, dispatch to converter script
4. Optionally apply LLM cleanup on output
5. Report result

### User Journey: Batch convert

```
/transform:batch <directory> [output-dir]
```

1. Scan directory for .docx, .pdf, .msg files
2. Create `.venv` if missing
3. Ask about LLM cleanup
4. Convert each file sequentially via `batch.sh`
5. Show summary (success/failure counts)

### Supported Formats

| Format | Converter | Tool | Notes |
|--------|-----------|------|-------|
| DOCX | `docx2md.py` | pypandoc (bundled Pandoc) | High fidelity, clean output |
| PDF | `pdf2md.sh` | Marker (ML-based) | Downloads ~2GB models on first use |
| MSG | `msg2md.py` | extract-msg + pypandoc | Extracts headers, body, attachments |

### Output Contract
All converters produce:
- `<basename>.md` — the Markdown file
- `media/<basename>/` — extracted images/attachments (if any)

### Dependencies
All installed via pip into `.venv/`:
- `pypandoc_binary` — Pandoc binary + Python API
- `extract-msg` — Outlook MSG parser
- `marker-pdf` — PDF → Markdown with ML layout understanding
