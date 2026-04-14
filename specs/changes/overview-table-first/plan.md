# Plan: Overview Table-First Layout

## Implementation Steps

- [x] **Reorder steps in SKILL.md** — Move "Assess the current change" (currently step 4) up to step 2. Move "Show the workflow reference" (currently step 2) down to step 4. Renumber all steps accordingly. Keep step content intact during the move.

- [x] **Add summary table to the change assessment step** — In the new step 2 (assess active changes), add instructions to build a summary table with columns: Change, Description, Phase, Next Step. The table is built from the same data already gathered (directory listing, artifact reading, phase detection). Place it before the per-change detail blocks.

- [x] **Update the output format template** — Rewrite step 5 ("Format the output") to reflect the new section order: version → active changes table + details → system description → workflow reference. Include the table format and the "no active changes" fallback message.

- [x] **Bump version in plugin.json and marketplace.json** — Increment the minor version (e.g., 6.0.0 → 6.1.0) in both `plugins/spec/.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json` to reflect the new feature.
