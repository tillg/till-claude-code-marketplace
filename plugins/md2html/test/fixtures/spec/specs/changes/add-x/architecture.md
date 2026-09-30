---
feature: add-x
title: "Architecture: add X"
status: applying
order: 3
created: 2026-09-01
edited: 2026-09-22
---

# Architecture: add X

## Components

```mermaid
graph LR
  A["Client<br/>browser"] --> B{"X & Y?"}
  B -- "yes" --> C[X]
  B -- "no" --> D[Y]
```

## Flow

```mermaid
sequenceDiagram
  participant U as User
  participant X
  U->>X: request <id>
  X-->>U: "ok"
```

```js
const notMermaid = '<b>';
```
