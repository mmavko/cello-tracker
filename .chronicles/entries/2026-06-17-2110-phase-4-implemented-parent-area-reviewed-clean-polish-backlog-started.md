# 2026-06-17 2110 — Phase 4 implemented (parent area + store mutators), reviewed clean; polish-backlog doc started

The Sonnet coding agent implemented Phase 4 to spec (`303747d`); Opus reviewed it (`57f0218` follow-ups). Pure shell as designed — `parent.html` + `parent.js` (PIN-gated, separate module entry), store mutators (`logLesson`/`addHoliday`/`setConfig`/PIN helpers, `addDaysStr` exported), Home's footer ⚙ replaced by a 🔑 parent-area link. `motivation.js` untouched; `npm test` stays 38/38. The freeze→Holiday reframe and the other load-bearing choices were already logged in the spec entry below; nothing about them changed in implementation.

**Review outcome:** no correctness bugs. Cache-bust verified safe (module entry, no inline imports — `deploy.sh` stamps both `parent.js` and its `from "./*.js"` imports). PIN-in-separate-key, `effectiveToday()` usage, date caps, and the falsy-zero-safe rest-weekday handling all correct. Four non-blocking UI nits found (dead CSS — fixed; PIN sub-4-digit no-op; confirm-mismatch has no message; readout omits the test-offset indicator).

**New convention — `docs/polish-backlog.md`:** a living checklist for non-blocking UI/UX polish surfaced in review. The three remaining nits above were parked there.

**Why a separate doc, not chronicles or inline `TODO`s:** chronicles is immutable history + decisions, not a mutable task list — tracking open work there would fight its grain. Inline code `TODO`s scatter and stay invisible until you happen to open the file. A single living doc, pruned as items ship, is greppable in one place and keeps review chat from accreting nags. Findings get triaged: correctness → fix now; polish → backlog.

[refines: entries/2026-06-17-2047-phase-4-spec-written-freeze-grant-reframed-as-one-day-holiday.md]
