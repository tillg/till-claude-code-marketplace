---
name: spec:iterate
description: Review spec artifacts, apply user annotations, and produce a clean consolidated version
disable-model-invocation: true
argument-hint: "[document-path]"
metadata:
  author: Till Gartner
---

Review spec artifacts, apply user annotations, and produce a clean consolidated
version.

The user marks up spec documents with annotations — arrows, acceptances,
rejections, inline comments. This command digests those annotations into a
coherent, clean document.

---

**Input**: Optionally specify a document path (e.g., `/spec:iterate proposal.md`).
If omitted, iterate across all artifacts of the current change.

**Steps**

1. **Identify the target documents**

   If the user specified a document, use that. Otherwise, find the active change
   in `spec/changes/` and read all its artifacts:
   - `proposal.md`
   - `domain.md`
   - `design.md`
   - `tasks.md`

   If multiple changes exist and none is obvious from context, use the
   **AskUserQuestion tool** to let the user select.

2. **Scan for annotations**

   CAREFULLY scan every line for user annotations. These include:

   | Annotation        | Meaning                                      |
   | ----------------- | -------------------------------------------- |
   | `->` arrows       | User's preferred direction or chosen option  |
   | `xxx`             | Marked for removal                           |
   | `[ACCEPTED]`      | Option or section is confirmed               |
   | `[REJECTED]`      | Option or section should be removed          |
   | `[DECISION]`      | A decision has been made — read the context  |
   | Inline comments   | Freeform feedback, corrections, or additions |

   **IMPORTANT**: Do not skip any annotations. Read thoroughly — users may
   annotate anywhere, including inside code blocks, lists, or table cells.

3. **Apply each annotation**

   For each annotation found:
   - **Rejected / `xxx`**: Remove the content entirely. Don't leave stubs or
     "removed" placeholders.
   - **Accepted / `->` chosen**: Promote to a definitive statement. Remove the
     other options and any "Option A / Option B" framing.
   - **Decisions**: Resolve the open question with the user's indicated choice.
     Rewrite surrounding text so it reads as settled, not tentative.
   - **Inline comments**: Incorporate the feedback into the document. If the
     comment is a correction, apply it. If it's a question, flag it for
     clarification.

4. **Consolidate the document**

   Produce a clean version:
   - No option blocks, no annotation markers remaining
   - Reads as a coherent, settled document — not a draft with markup
   - Preserve the original structure and sections
   - Keep Mermaid diagrams up to date with any changes
   - Where decisions remove or add complexity, update or add Mermaid diagrams
     to reflect the new state

5. **Propagate changes across artifacts**

   Changes in one artifact often affect others. Check for consistency:
   - A rejected design approach → remove related tasks from `tasks.md`
   - A scope change in `proposal.md` → update `design.md` accordingly
   - New domain concepts → reflect in `domain.md`

   Make these updates, but keep them minimal and traceable.

6. **Present for review**

   Show the user what changed:
   - List of annotations found and how each was applied
   - Any ambiguous annotations that need clarification
   - Summary of cross-artifact updates

   Use the **AskUserQuestion tool** to ask the user to review before finalizing.

**Output**

```
## Iteration Complete

**Change:** <change-name>
**Documents reviewed:** proposal.md, domain.md, design.md, tasks.md

### Annotations Applied
- proposal.md: 3 annotations (2 accepted, 1 rejected)
- design.md: 1 annotation (decision applied)
- tasks.md: 2 tasks removed (from rejected design option)

### Needs Clarification
- design.md line 42: comment unclear — "maybe Redis?" — should this replace
  the current caching approach?

Please review the updated documents.
```

**Guardrails**

- Never skip annotations — scan every line
- Remove rejected content cleanly, don't leave traces
- Preserve document structure and formatting
- Always propagate changes to related artifacts
- Ask before finalizing — the user gets the last word
- If an annotation is ambiguous, flag it rather than guessing
- Use Mermaid as the preferred format for all diagrams
