---
title: "Kitchen sink: every feature at once"
created: 2026-09-27
edited: 2026-09-30
status: ongoing
subtitle: Uses **every** construct, links to [the minimal report](minimal-report.md) and shows :verdict[a pill]{tone=go} in the subtitle.
description: A report that exercises every md2html feature.
---

:::tldr
**Short answer: it all renders.** Directives, figures, tables and a TOC work together, and prose colons like 16:00 stay as written.

1. Deterministic output.
2. No scripts.
:::

## Context {#context}

Paragraph with a footnote[^1], ~~strikethrough~~, `inline code` and a very long word: Donaudampfschifffahrtsgesellschaftskapitänswitwenrentenversicherungsanstalt, plus https://example.com/a/very/long/url/that/must/wrap/on/phones/without/scrolling/the/page/horizontally.

> A blockquote with *emphasis*.

- [x] done task
- [ ] open task

### Detail

```js
// A code block that is wider than a phone screen and must scroll inside its own box, not the page.
export function build(source, { file, root, config, themeCss = '', exists = () => false }) { return source; }
```

## Findings {#findings}

![Source to HTML](diagrams/flow.svg)

| Option | Cost | Verdict |
|---|---:|---|
| A: pure browser | 0 € | :verdict[no-go]{tone=no} |
| B: edge function | 5 € | :verdict[partial]{tone=partial} |
| C: hybrid | 20 € | :verdict[go]{tone=go} |

::::cards
:::card{title="Pros"}
Fast, **deterministic**, and themeable.

- one file
- no scripts
:::

:::card{title="Cons"}
One more tool to learn. See [findings](#findings).
:::
::::

## Recommendation {#recommendation}

Go with option C. :unknown[this stays literal] and :::tdlr typos too.

---

## Sources {#sources}

- [TOC report](toc-report.md#findings)
- [External](https://example.com)

[^1]: The footnote text.
