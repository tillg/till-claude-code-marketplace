---
description: Check if a spec change is ready for implementation. Audits artifacts for clarity, completeness, coherence, and consistency. Returns a readiness verdict with findings to address before /spec:apply.
disable-model-invocation: true
argument-hint: "[change-name]"
metadata:
  author: Till Gartner
---

# Ready Or Not

Audit a spec change to see whether it's actually ready to implement, or whether
holes, hedges, and contradictions are still hiding in the artifacts.

Use this **before** `/spec:apply`. Findings first, verdict last. Be hostile
toward the spec, not toward the user — assume something is unclear and try to
find it.

---

**Input**: Optionally specify a change name (e.g., `/spec:ready-or-not add-auth`).
If omitted, infer from conversation, auto-select if only one active change
exists, or use **AskUserQuestion tool** to let the user pick.

Always announce: "Auditing change: <name>".

## Steps

1. **Read all artifacts**

   From `specs/changes/<name>/`:
   - `proposal.md`
   - `domain.md`
   - `architecture.md`
   - `plan.md`

   Also read system-level context if present:
   - `specs/system/domain.md`
   - `specs/system/architecture.md`

   Missing required artifacts (proposal, architecture, plan) is itself a
   `CRITICAL` finding — record it and continue auditing what exists.

2. **Run the audit**

   Walk through every section below. Be specific: cite file and line/section,
   not vague impressions.

3. **Emit findings + verdict**

   Use the output format at the bottom. Findings ordered by severity. End with
   one of: `READY`, `READY WITH CAVEATS`, `NOT READY`.

---

## What to Look For

### Term & Domain Hygiene

- New terms in `domain.md` (or used in other artifacts) that **duplicate**
  concepts already defined in `specs/system/domain.md` — possibly under
  different names
- Terms used in `proposal.md` / `architecture.md` / `plan.md` that are **not defined anywhere** (neither change `domain.md` nor system `domain.md`)
- Same concept referred to by **different names** across artifacts (e.g.,
  "user" vs "account" vs "principal")
- Terms defined in `domain.md` but **never used** elsewhere (dead concept, or
  signal that the change isn't actually grounded in the domain)
- Definitions that are **circular, vague, or example-only** ("a Thing is a
  thing that does things")

### Architecture Completeness & Coherence

- Every component named in `architecture.md` has a **clear role** — single
  responsibility statable in one sentence
- No component is a **kitchen sink**: watch for components accumulating
  unrelated responsibilities, or roles described with "also handles X, and Y,
  and Z…"
- **Interfaces / boundaries** between components are explicit (who calls whom,
  what data crosses the line)
- **Integration with existing system** is acknowledged — does the change wire
  into components from `specs/system/architecture.md`, or does it ignore them?
- Key **architectural decisions are justified**, not merely stated ("we use X"
  without "because Y, instead of Z")
- **Alternatives considered** are at least mentioned where the choice is
  non-obvious
- Diagrams (if present) match the prose — components and arrows in the diagram
  exist in the text and vice versa

### Cross-Artifact Consistency

- `proposal.md` scope ↔ `architecture.md` coverage: every feature/outcome in
  the proposal has corresponding architectural treatment
- `architecture.md` ↔ `plan.md`: every component/decision has at least one
  plan step; every plan step traces back to something in the architecture
- `domain.md` ↔ everything else: terms used elsewhere are defined here (or in
  system domain)
- Same names used everywhere for the same concept
- No contradictions (e.g., proposal says "synchronous", architecture says
  "queue-based async")

### Plan Quality

- Steps are **concrete and ordered**, not aspirational ("design the system" is
  not a step)
- Each step is **small enough** to implement and verify in one pass
- Each step has an implicit or explicit **verification** — how do we know it's
  done?
- No step relies on unresolved decisions still open in `architecture.md`
- Dependencies between steps are respected (no "use the X" before "build the X")

### Open Questions, Hedges, TODOs

Scan every artifact for residual uncertainty:
- `TODO`, `TBD`, `FIXME`, `???`
- Hedge words in load-bearing positions: "maybe", "probably", "we could",
  "consider", "investigate" — fine in alternatives, **not fine** in the final
  description of what we're doing
- Placeholder text that looks templated
- Open questions that were raised but never resolved

### Assumptions & Risks

- Are **assumptions made explicit**? (e.g., "we assume the upstream API
  returns sorted results")
- Assumptions that are actually **unknowns disguised as facts** — would
  benefit from a spike before implementation
- **Failure modes** considered: what happens on network failure, missing data,
  concurrent edits, partial writes
- **Risks called out** with at least a mitigation or "accepted"

### Scope & Non-Goals

- **What's in scope** is unambiguous
- **What's explicitly out of scope** is stated — otherwise scope creep is
  pre-baked
- Scope in `proposal.md` matches scope implied by `plan.md` (plan doesn't
  silently expand scope)

### Acceptance & Verification

- How will we **mechanically know** the change is done and correct?
- Test strategy or verification approach is at least sketched (unit?
  integration? manual? in browser?)
- For UI changes: how is the user-visible behavior described concretely
  enough to test?

### Migration & Compatibility

- If existing data/users/APIs are affected, **migration is addressed** (or
  explicitly N/A)
- **Breaking changes** are called out
- Backward compatibility expectations are stated

**When data is modified or migrated, additionally check:**

- **Migration procedure is concrete** — what runs, in what order, against
  which data store(s); not just "we'll migrate the data"
- **Idempotency / re-runnability** — can the migration be run twice without
  corrupting data, or is it a one-shot? If one-shot, is that protected against?
- **Safety net on failure** — backup, snapshot, transaction boundary, or
  rollback procedure if the migration fails partway through. "What do we do
  at 3am when this dies on row 47,000?" should have an answer.
- **Verification after migration** — how do we confirm the migrated data is
  correct? (row counts, checksums, spot checks, dual-read window)
- **Lifecycle of the migration code** — explicit plan for what happens to
  the migration code after it runs:
  - **Delete after run**: is there a step in `plan.md` to remove it?
  - **Keep**: is the reason stated? (more data stores to migrate later, used
    repeatedly per tenant, kept as historical migration record)
  - Ambiguity here is itself a finding — silent migration code that lingers
    becomes a footgun
- **Coexistence window** — if old and new schemas/formats must coexist
  temporarily (during rollout, across services), is that window described?
- **Reversibility** — can we roll back to the pre-migration state if the
  release is yanked, or is the migration one-way? One-way is fine if stated;
  unstated one-way is a `HIGH` finding.

---

## Output

Findings first, ordered by severity. Cite specific files and sections.

```text
[CRITICAL] Short description
Artifact: specs/changes/<name>/<file>.md (section or line)
Issue: What is wrong, missing, or contradictory
Fix: What needs to change before /spec:apply
```

Severity guide:
- **CRITICAL** — blocks implementation: missing artifact, contradictory
  artifacts, undefined load-bearing term, unresolved decision the plan
  depends on
- **HIGH** — will cause rework or scope confusion mid-implementation:
  overloaded component, missing acceptance criteria, hidden assumption
- **MEDIUM** — fixable cheaply now, painful later: name drift, unjustified
  decisions, vague plan steps
- **LOW** — nits and polish: dead domain terms, undocumented alternatives

Group findings by category (Term & Domain, Architecture, Consistency, Plan,
Open Questions, Assumptions & Risks, Scope, Acceptance, Migration) when there
are more than a handful.

### Verdict

End with exactly one of:

```text
Verdict: READY — proceed with /spec:apply
```

```text
Verdict: READY WITH CAVEATS — N low/medium findings; safe to start but
address during implementation
```

```text
Verdict: NOT READY — N critical/high findings; resolve before /spec:apply.
Recommended next step: /spec:iterate (or /spec:explore for open questions).
```

If no findings:

```text
No findings — spec is ready for implementation.
Verdict: READY — proceed with /spec:apply
```

---

## Guardrails

- **Audit, don't fix** — Report findings. Do not edit artifacts. If the user
  wants edits, they'll follow up with `/spec:iterate`.
- **Be specific** — Every finding must cite an artifact and a location. "The
  architecture is unclear" is not a finding; "architecture.md §3 names the
  `Dispatcher` component but never says what calls it" is.
- **Be hostile to the spec, not the user** — Assume something is unclear and
  find it. Don't sugarcoat findings to be nice.
- **Don't invent problems** — If the spec is good, say so and emit `READY`.
  False positives erode trust in the audit.
- **Cross-reference `specs/system/`** — Term duplication and architectural
  integration checks require reading the system-level docs, not just the
  change folder.
- **No implementation work** — This skill never writes code, never runs the
  plan, never modifies spec artifacts.
