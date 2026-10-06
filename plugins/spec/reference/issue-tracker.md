# Issue tracker

How spec skills use the project's issue tracker. They use the **same tracker config as Matt
Pocock's skills**, so his skills and ours always agree on where issues live. The tracker is
optional: without it, every spec skill works as before.

## 1. Find the config

The config is `docs/agents/issue-tracker.md` at the project root. Pocock's
`/setup-matt-pocock-skills` writes it after looking at `git remote`: GitHub (the default, `gh`
CLI) for a GitHub remote, GitLab (`glab` CLI) for a GitLab one, otherwise local Markdown under
`.scratch/` or "Other" (Jira, Linear, … described in prose). spec never picks a tracker itself.

**No config file → tracker features are off.** Say once, in the skill's summary: "No issue
tracker configured — run `/setup-matt-pocock-skills` to connect one." Then carry on. Never
block on it, and never guess a tracker from `git remote`.

## 2. Operations come from the config

Use the commands the config spells out — never hard-code `gh` or `glab`:

| Operation | Config section to follow |
|---|---|
| **fetch** an issue (body + comments) | "When a skill says 'fetch the relevant ticket'" / its read command |
| **publish** a new issue | "When a skill says 'publish to the issue tracker'" / its create command |
| **comment** on an issue | "Comment on an issue" (local: append under `## Comments`) |
| **close** an issue | "Close" (local: see section 6) |

For an "Other" tracker, follow the user's prose; if it doesn't say how to do an operation,
skip it and say so.

**Labels:** apply a triage label only if `docs/agents/triage-labels.md` exists, using the
string it maps the role to. Without that file, publish without a label — a label the repo
doesn't have makes `gh issue create --label` fail.

## 3. Issue references

What a user can pass to name an issue: `#42`, an issue URL, or a `.scratch/…` path (local
tracker). An argument counts as an issue reference only when the **whole argument** is one —
`fix #42 login` is a description, and a bare `42` is a change name. GitHub shares numbers
between issues and PRs: resolve as the config says.

## 4. Linking a change to its issue

A change's **linked issue** is one line directly under the `# Proposal: …` heading of its
`proposal.md`:

```markdown
**Issue:** [#42](https://github.com/owner/repo/issues/42)
```

A local tracker links the file instead: `**Issue:** [.scratch/feature/issues/01-x.md](…)`. The
line is in the body, not the frontmatter: md2html's spec frontmatter is a closed schema. A
tweak has no proposal: its linked issue lives only in its commit message.

## 5. Writes need consent

Publishing, commenting and closing are outward-facing: other people see them.

- **Interactive:** ask before each write (**AskUserQuestion tool**). Fold it into a question
  the skill asks anyway where there is one (e.g. archive's commit approval).
- **Unattended:** never write to a remote tracker — except inside an `/autonomous` run, whose
  standing permission covers tracker writes (with the AI disclaimer). Details, including
  skipped writes and the disclaimer text: `unattended.md`.

## 6. Closing a linked issue

Used by `/spec:archive` and `/spec:tweak` when the work has a linked issue:

1. **Trailer** (GitHub/GitLab only): the commit message that finishes the work ends with a
   `Closes #42` line, so the tracker closes the issue when the commit reaches the default
   branch. A message derived from it later (archive's "… - cleaned from change") changes the
   subject line only and leaves the trailer out.
2. **Close now**, in the same question that approves the commit: offer to comment the commit
   hash on the issue and close it right away (useful when the commit isn't on the default
   branch yet). Do it after the commit:
   - GitHub/GitLab: the config's "Comment on an issue" and "Close" commands.
   - Local: append the commit under `## Comments` and set `Status: resolved` (Pocock's
     wayfinder term; triage roles don't include "closed").
   - Other: as the user's prose says, else skip and say so.
3. **Escalation:** a tweak that escalates passes its issue reference on to `/spec:propose`,
   which then links it instead of offering a tracking issue.
