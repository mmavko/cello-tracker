# Chronicles — Digest
applied-through: 2026-10-09-1746-chronicles-v2-cutover
last-reconciled: 2026-10-09
authority: none

## Now
Phases 0–5 are built and live at https://cello.mavko.consulting. Phase 4 (parent area) lets the parent create protection states; Phase 5 (status surfacing) shows them: Home chips (Freeze, Holiday, Rest day), a promoted "best N" streak headline, a protection-aware status line, and continuous recolour of the cooled world from `collection.dim`. Both were reviewed clean. Phase 3a is a tombstone. `npm test` is 39/39.

Next is Phase 6: history and stats (a calendar month-grid coloured by day type, plus detailed child-visible stats). It is deferrable, since the streak works without it, and Phase 7 (bonuses, "your usual" anchor) could jump ahead. The Phase 6 spec is not written. Roadmap: 6 calendar and stats, 7 bonuses and anchor, 8 super-admin/engineer view.

Phase 2 is the impure shell over the pure engine (`store.js`, `main.js`, `views/*`, `index.html`, warm "musician's-passport" look). A hidden test panel (5 taps on the flame) drives the date-driven loop without the mic. Non-blocking polish found in review lives in `docs/polish-backlog.md`, not here. Design docs are in `docs/` (`main-app-ux.md` what, `main-app-architecture.md` how, `main-app-implementation.md` roadmap, `main-app-phase-*.md` per phase); `README.md` is the door.

## Open
- [staccato-latency] Four latencies stack before detection fires; re-test staccato on iPhone at Attack about 60 ms, then 30–40, then consider FFT_SIZE 2048. Decides: owner. → [[2026-05-31-1747-staccato-false-negatives-traced-to-stacked-detecti]]
- [speech-rejection] Does the Stage 1 pitch-stability gate alone keep conversational speech out without an impractical hold time on real notes? Decides: owner. → [[2026-05-31-1444-stage-1-pitch-stability-gate-implemented]]
- [stage-2-harmonic-extent] Held in reserve: build only if Stage 1 still lets sustained voiced sounds through (humming, singing, TV). Singing rejection is an explicit non-goal (needs MFCC). Decides: owner. → [[2026-05-30-2052-hps-alone-insufficient-designed-layered-pipeline]]
- [pin-reset] PIN is first-time-set only with no reset; super-admin cannot own reset because it sits behind the PIN. Parked. Decides: owner. → [[2026-06-15-2323-phase-4-5-re-planned-renumbered-3a-8-docs-only-no]]
- [phase-2-field-test] The Phase 2 iPhone field test is still deferred. Decides: owner. → [[2026-06-12-1744-phase-2-built-deployed-the-real-app-opus-direct-de]]

## Rules
- The engine is a pure projection: `project(inputs,{today}) → derivedState` recomputes streak, Momentum, points, Collection and freeze every call. Persist facts only (`config`, `sessions[]`, `lessonDays[]`, `holidays[]`, `bonuses[]`), never a derived value. Clock and RNG are injected. This makes the brain testable and makes a lesson backfill that un-breaks a break a free replay. → [[2026-06-06-1733-engineering-plan-build-roadmap-for-the-main-app]]
- Storage is always-valid records with no "running" flag. The live session is in memory and flushes detected seconds into the current `{start,end,playedSec}` record on a throttle; a reload keeps today's total and only the mic stops. Hence `project()` has no `liveSessionSec` param. Records stay raw for later analysis. → [[2026-06-06-1833-phase-1-spec-always-valid-storage-your-usual-per-d]]
- No build step: native ES modules and `node --test`, zero deps. `motivation.js` and `theme.js` are pure; `store.js`, `main.js` and `views/*` are the impure shell; `detector.js` and `settings.js` stay classic globals (field-tested iOS recovery code, read as `window.CelloDetector` / `SettingsStore`). `deploy.sh` (a `cp` and `sed`) is the only transform. → [[2026-06-06-1733-engineering-plan-build-roadmap-for-the-main-app]]
- One mechanism, two jobs is a smell. Day handling is five non-overloaded primitives: Played, Lesson, Rest day, Frozen, Holiday; otherwise Missed breaks the streak. Rejected: reusing the emergency Freeze to power the weekly rest, which desynced the rest cadence (its 7-day regen excludes Holiday days). → [[2026-06-06-1618-designed-the-main-app-motivation-ux-streak-momentu]]
- Played overrides Holiday. Played-or-lesson is checked before holiday in the §9 precedence machine, so practising on a declared holiday grows the streak; only unplayed holiday days stay paused. → [[2026-06-14-0833-phase-3-spec-d-built-engine-day-types-protection-h]]
- A parent-declared protected day is a one-day Holiday (`{start:D,end:D}` in `holidays[]`); there is no separate "grant a freeze" or `frozenDays` input. The auto-freeze stays the automatic emergency buffer. Rejected: a second mechanism reaching the held/Frozen outcome. → [[2026-06-17-2047-phase-4-spec-written-freeze-grant-reframed-as-one-day-holiday]]
- Docs in `docs/` describe the current design as a snapshot, with no "old X → new Y" or "replaces" history; that lives in chronicles and git. When a decision supersedes an earlier one, overwrite the doc cleanly. → [[2026-06-17-2047-phase-4-spec-written-freeze-grant-reframed-as-one-day-holiday]]
- Three currencies: Streak (fragile, drives consistency; its 15-minute floor is a quiet turnstile, never headlined), Collection (permanent, never lost), Momentum (×1 to ×3 by streak length; `points = minutes × Momentum`). Breaking drops Momentum to ×1 but never destroys the Collection. → [[2026-06-06-1618-designed-the-main-app-motivation-ux-streak-momentu]]
- "Your usual" is the median of recent daily totals, not per-session. Recovery target is 2 × your-usual. Momentum look-ahead is locked: `dayMomentum(D) = tier(streakEntering(D) + played(D))`. → [[2026-06-06-1833-phase-1-spec-always-valid-storage-your-usual-per-d]]
- Lesson logging is parent-gated only, for any past date (the one-day grace was removed: a date window adds friction without safety). Stats are child-visible and not gated; the PIN guards controls, never visibility. → [[2026-06-15-2323-phase-4-5-re-planned-renumbered-3a-8-docs-only-no]]
- In-memory router, no URL hash, so the iOS back-swipe cannot exit a live practice session and leaving practice always runs detector teardown. → [[2026-06-12-1744-phase-2-built-deployed-the-real-app-opus-direct-de]]
- Session timestamps use `localISO()` (local date), never `toISOString()` (UTC): the engine keys a day on `start.slice(0,10)`. → [[2026-06-12-1744-phase-2-built-deployed-the-real-app-opus-direct-de]]
- Lesson length is per-lesson: `lessonDays[]` entries are `{date, lenMin}` and `config.lessonLenMin` is gone. → [[2026-06-17-2017-phase-3a-executed-per-lesson-minutes-detector-ren]]
- The detector-tuning page is `/detector` (`app/detector.html`), not `/settings`; `app/settings.js` (`SettingsStore`) keeps its filename and localStorage keys. → [[2026-06-17-2017-phase-3a-executed-per-lesson-minutes-detector-ren]]
- Detection is HPS plus layered gates (pitch stability first), not band-average, which had no usable threshold. HPS alone still passes voiced speech because speech is harmonic. → [[2026-05-30-2052-hps-alone-insufficient-designed-layered-pipeline]]

## Gotchas
- Cloudflare Pages caches JS about 4 h. Deploy with `./deploy.sh`, never raw `wrangler`; it stamps `?v=<build>` on every module URL. After deploy, confirm the footer version stamp matches, and curl the plain URL (`?cb=` bypasses the edge cache and masks staleness). → [[2026-06-12-1742-cloudflare-pages-caches-js-for-4h-page-url-queries]]
- The test panel writes synthetic, tainted data to `localStorage` per origin and ships to production. QA against localhost, or `Clear` before and after; the test chip marks tainted state. → [[2026-06-12-1743-test-panel-a-non-destructive-clock-offset-to-drive]]
- iOS Safari opens an undismissable modal if you reload mid mic-permission grant, so testing must not depend on the mic. → [[2026-06-12-1743-test-panel-a-non-destructive-clock-offset-to-drive]]
- Hidden gestures on iOS use taps, not holds: long-press dies (Safari fires `pointercancel`), so it is 5 quick taps. → [[2026-06-12-1743-test-panel-a-non-destructive-clock-offset-to-drive]]
