# 2026-10-09 1746 — Chronicles moved to the v2 procedure: digest rewritten, no index, checker added
kind: event
changes: .chronicles/

The project's chronicles now follow the v2 procedure in `.chronicles/README.md`, checked by `.chronicles/check`. Entries before this one are legacy and keep their old format. The generated `index.md` is gone; `.chronicles/check --list` replaces it. The digest was rewritten into the v2 template with no binding-docs map (`authority: none`), so all current decisions sit in its Rules section.

**Why:** the agent is the user of chronicles; a checker and a fixed digest shape keep it small and its pointers true.
**Rejected:** editing legacy entries to fit the new format — entries are immutable.

superseded: entries/2026-05-17-0906-cello-detection-layer-designed-and-built-band-aver.md by entries/2026-05-20-0906-band-average-detection-failed-rebuilt-with-hps.md
