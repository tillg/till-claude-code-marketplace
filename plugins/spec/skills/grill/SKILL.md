---
description: Grill the user relentlessly on a spec change (using Matt Pocock's grilling + domain-modeling skills), then fold every answer back into the change's proposal, domain, architecture and plan
disable-model-invocation: true
argument-hint: "[change-name]"
metadata:
  author: Till Gartner
---

Stress-test a spec change before implementing it. The interview itself comes from Matt Pocock's
skills (the `mattpocock-skills` plugin, a dependency of this plugin): `grilling` asks the
questions, `domain-modeling` sharpens the terms and decisions. This skill points them at the
change and writes the results into **our** spec files, not into Matt's own doc layout.

Use it between `/spec:propose` and `/spec:apply`, as often as you like.

---

**Input**: Optionally a change name (e.g. `/spec:grill add-auth`). If omitted, infer it from
the conversation, auto-select if only one active change exists in `specs/changes/`, or use the **AskUserQuestion tool** to let the user pick.

Always announce: "Grilling change: <name>".

**Steps**

1. **Read the change and its context**

   Read every `.md` in `specs/changes/<name>/` (proposal, domain, architecture, plan and any
   others) plus `specs/system/domain.md` and `specs/system/architecture.md` if present. This
   is the plan being grilled and the glossary terms are checked against.

2. **Run the two skills** with the Skill tool, in this order (installed as
   `mattpocock-skills:grilling` and `mattpocock-skills:domain-modeling`):

   - `grilling` — the plan to grill is the change: its proposal, scope, architecture and plan.
     Work its design tree in rounds as it describes; start with what the artifacts leave
     open, hedge on, or contradict.
   - `domain-modeling` — at the same time, keep the change's terms and decisions sharp.

   **Redirect its outputs into the spec files** (this overrides domain-modeling's file
   structure; do not create `GLOSSARY.md`, `GLOSSARY-MAP.md` or `docs/adr/`):

   | domain-modeling would… | Instead, write it to… |
   |---|---|
   | add or change a term in `GLOSSARY.md` | the change's `domain.md` (concept section and the Vocabulary table); a term already defined in `specs/system/domain.md` is challenged against that definition, and a change to it is noted in `domain.md` as "changes system term X" |
   | write an ADR | a row in the "Key decisions" table of the change's `architecture.md` (decision · alternatives considered · why), with any consequences in the prose |

   Capture each resolved term or decision right away, as domain-modeling says — don't batch.

   **If the Skill tool can't find `grilling` or `domain-modeling`:** tell the user this step
   needs the `mattpocock-skills` plugin — `/plugin marketplace add mattpocock/skills`, then
   `/plugin install mattpocock-skills@mattpocock` (installing or updating `spec` normally pulls
   it in as a dependency) — and stop. Don't imitate the skills from memory.

3. **Fold the answers into the artifacts**

   When the grilling ends (the design tree is settled, or the user stops it):
   - `proposal.md`: scope, non-goals and outcomes the user settled
   - `domain.md`, `architecture.md`: already updated in step 2; reread them for consistency
   - `plan.md`: add, remove or reorder steps the decisions imply; every new decision has a
     step that implements or verifies it, written test-first (`Test first:` and `Verify:`
     lines, format in `../../reference/plan.md` relative to this skill's directory)

   Keep the frontmatter (schema in `../../reference/frontmatter.md`): bump `edited` to today on every
   file whose content changed; leave `status` as it is (grilling doesn't change the phase).
   Edit spec files with the Edit/Write tools, not sed/python in Bash, so the md2html lint hook
   sees every change. If the `/spec:view` watcher is running, the HTML updates by itself.

4. **Summarize** (last output)

   ```
   ## Grilling complete: <name>

   Rounds: N · Decisions settled: N · Terms defined/changed: N

   ### Changed
   - proposal.md: …
   - domain.md: …
   - architecture.md: …
   - plan.md: …

   ### Still open
   - <questions the user deferred>

   Run `/spec:apply` to start implementing (or `/spec:grill` again).
   ```

**Guardrails**

- The interview is `grilling`'s: follow its rules (rounds, recommended answers, wait for the
  user). This skill only chooses the subject and where the results go.
- Never write `GLOSSARY.md`, `GLOSSARY-MAP.md` or ADR files; the spec files are the record.
- Don't implement anything — that's `/spec:apply`.
- If running unattended (no user to answer), say that grilling needs a user, and stop.
