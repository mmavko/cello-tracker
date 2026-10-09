<!-- chronicles-version: 0.1.0 -->
# Chronicles — the procedure

This folder is the project's memory, written and used by the agent. It holds **why** and
**why-not**: what was decided, what was rejected and why, what is still open. Git holds the
what and the when. Nothing here needs a plugin: follow this file and run `.chronicles/check`.

```
.chronicles/
  README.md     this file (replaced on upgrade; do not edit)
  config        format, budget_words, authority, since
  digest.md     the view: current state, under the word budget
  entries/      YYYY-MM-DD-HHMM-slug.md, one immutable decision each
  check         the checker (Python 3, standard library only; replaced on upgrade)
```

## Principle

The agent is the user of chronicles. It is your tool for answering the human correctly, for
not reopening settled questions, for not re-asking what was decided, and for working at low
cost. The human does not run it or curate it. Writing an entry is part of the work, like
committing code.

A chronicle holds facts about the project, not about the person working on it. Test: would
it still be true if someone else worked on the project? If not, it is your own memory, not
a chronicle.

## 1. Orient (main session only)

When the session-start signal says chronicles exist, read `digest.md`. Do not read entries
to orient. **A subagent or worker does not read the digest.** The main session briefs it
with the digest lines and entry paths its task needs. (A project's CLAUDE.md pointer must say
"main session" in so many words, because subagents load CLAUDE.md too.)

## 2. Before relying on an entry, or asking the human

- Run `.chronicles/check --who <entry>` (or `grep -l <filename> .chronicles/entries/*`) to
  find later entries that supersede or refine it. The live answer is the last one.
- Before asking the human anything, grep entry titles (`.chronicles/check --list | grep -i
  <words>`) and the digest's Open list. If it is answered, use the answer and cite the entry.

## 3. When to write an entry

Write one when any of these lands:

- a ruling by the human;
- a change to a binding doc;
- a hypothesis confirmed or killed, with evidence;
- a correction of something already recorded;
- a hazard that cost time and will recur.

Write it in the same commit as the change, unless the project's convention says otherwise. A
ruling with no code gets its own commit. **No entry** for routine work, steps with no
outcome, or anything git, the code or a doc already says cheaply.

Only the session that lands work writes entries and changes the digest. A worker reports its
candidate entry text, or writes the entry file in its own branch, and never touches the digest.

### Entry format

The fields sit directly under the H1, not in YAML. Each is greppable as `^field:`.

```
# 2026-10-09 1327 — Sessions expire after 30 days of inactivity, not 7 (reverses the 7-day rule)
kind: decision              # decision | finding | correction | event      (required)
changes: docs/architecture.md §4.2; src/auth/session.ts   # files or things this changed; or "chronicles only"   (required)
supersedes: entries/2026-09-10-2230-session-lifetime.md   # required when an answer is replaced; repeatable
refines: …                  # optional; the earlier answer still stands
closes: session-lifetime   # open-item ids this answers
opens: new-id — the question — decides: legal   # new open item, with the line to add
missed: …                   # kind: correction only: the entry the agent overlooked

The answer in one or two sentences, stated as the current fact.

**Why:** the question and what made it uncertain.
**Rejected:** <alternative> — <reason>. One line each. This is what nothing else records.
**Evidence:** commit, command or measurement (for findings).
```

Rules:

- **Name and time.** The file is `entries/YYYY-MM-DD-HHMM-slug.md`; the H1 repeats the same
  date and time. Use the time of the event (take it from `date` or the landing commit, never
  estimate), not of the writing, when they differ.
- **The title answers the question.** Use the nouns someone would grep for, 6 to 20 words. A
  bare label ("Review notes") fails.
- **One question per entry.** A batch of rulings can share an entry only if each item has its
  own `closes:` or `supersedes:` line.
- **State the answer as the current fact,** then the motivation. Protect the rejected
  alternative above everything else: "we chose X" is cheap to re-derive, "we chose X and
  rejected Y because Z" is what stops a session from reopening a settled question.
- **Target 300 words or fewer.** The detail belongs in the artefact `changes:` names.
- **Entries are immutable.** A correction is a new entry. When an answer is replaced, name
  the old entry in `supersedes:`; do not leave a reader to chase `refines` chains.
- `kind: correction` needs `supersedes:` or `missed:` (the entry an agent overlooked).

## 4. Apply to the digest (the landing session)

1. Read `digest.md`, then every entry newer than its `applied-through`.
2. For each: process `closes:` (remove that Open item), `opens:` (add the item), new rules
   and gotchas (one line each, with a pointer), and any digest pointer that now aims at a
   superseded entry (re-point it to the successor).
3. Rewrite `## Now` (at most 300 words, nothing older than the last landing). Drop a line
   that has graduated to a binding doc, a test or a CLAUDE.md rule.
4. Set `applied-through` to the newest entry applied.
5. Run `.chronicles/check`. Commit only on exit code 0.

### Digest format

```
# Chronicles — Digest
applied-through: <newest entry applied, file name without .md>
last-reconciled: YYYY-MM-DD
authority: <the binding docs' map, a path; or none>

## Now        (at most 300 words; rewritten on every update)
## Open       (each item has an id; an entry's `closes: <id>` removes it)
- [cache-ttl] How long may the CDN cache the app bundle? Decides: engineering. → [[2026-09-10-1409-…]]
## Rules      (present-tense law with no binding home; with no binding docs, all current decisions)
- <statement>. → [[entry-slug]]
## Gotchas    (hazards that still bite; one line, one pointer)
- <hazard>. → [[entry-slug]]
```

The digest **points to** binding docs and never restates them. It holds state only where no
binding doc exists. Each Open item names who decides, by role, so you ask the right party once
and do not ask again. Pointers are `[[entry-slug]]` (file name without `.md`).

## 5. Reconcile when a rule fires

Not on a feeling. Reconcile when: the check exits 1 with **E1** (digest over budget);
`.chronicles/check --metrics` shows 50 entries since `last-reconciled`; or the signal reports
errors that section 4 cannot fix.

Reconciliation **never reads all entries**: they do not fit in one context. Start from the
current digest. For each line, confirm its pointer is still the live answer with `--who`. Read
the entries since `last-reconciled`. Remove closed, retired and graduated lines until the
digest is under 85% of the budget. Set `last-reconciled`. A subagent may do this; the landing
session reviews the diff and runs the check.

## 6. The check

`.chronicles/check` (run from the project root; exit 0 clean or warnings only, 1 errors, 2
cannot run). `--strict` makes warnings fail. `--list` prints every entry, newest first.
`--who <entry>` lists later entries that supersede or refine it. `--metrics` prints the
orientation cost and missed-question counts. `--signal` is the short form for the hook.

Errors: E1 digest over budget; E2 a pointer (`[[slug]]`, `entries/` path, `changes:` or
`authority:` file) does not resolve; E3 a v2 entry is malformed; E4 a `supersedes:` or
`refines:` target is missing or is the entry itself; E5 an Open item has no id or a
duplicate id, or an already-applied entry closes an id still listed; E6 the digest points to a
superseded entry and not also to its successor.

Warnings: W1 digest over 85% of budget; W2 entry over 500 words; W3 the text says it reverses
something but has no `supersedes:`/`refines:`; W4 entries newer than `applied-through`; W5 an
Open item over 30 days old; W6 a title under 6 words or over 160 characters.

Entries before `since` in `config` are legacy: they are history that cannot be fixed, so the check raises nothing on them and they need no
fields. A cutover entry may hold lines `superseded: entries/A by entries/B`; the check reads
each as `supersedes: A` on B.

## 7. Several writers

- Anyone writes entries. They are new files, so they never collide.
- Only the session that lands on the trunk changes the digest, by applying the entries newer
  than `applied-through` (section 4). Workers and branches leave it alone.
- When two landings race and `digest.md` conflicts, **do not resolve the hunks.** Take the
  trunk's digest, then re-apply your own entries newer than its `applied-through`. The input
  is in the entries, so the result does not depend on who landed first. W4 catches entries
  nobody applied.
- So an entry must carry enough (`closes:`, `opens:`, the rule line) for someone who did not
  write it to apply it. A branch's digest lags until it lands.
