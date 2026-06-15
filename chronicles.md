# Chronicles
Last updated: 2026-06-15

## Current State
**Phases 0–3 built. Phase 2 (the real app) is LIVE at https://cello.mavko.consulting; Phase 3 (engine: day-types & protection) is built + green but NOT yet wired to any UI — pure-engine + tests only. The remaining roadmap was re-planned + renumbered 2026-06-15 (see top chronicle entry): `3a` ephemeral-maintenance (per-lesson minutes + `settings`→`Detector` rename) → `4` parent area + store mutators → `5` status chips + gradual recolour → `6` calendar + detailed stats (deferrable) → `7` bonuses + your-usual anchor → `8` super-admin/engineer view. NEXT = Phase 3a (spec'd in `main-app-phase-3a.md`, no code yet — must precede 4). Phase-2 iPhone field-test still deferred.** Phase 2 = the impure shell over the pure engine: `store.js` (localStorage `cello.progress` ⇄ inputs; facts only), `main.js` (load→project→render loop; **in-memory router, no URL hash** so the iOS back-swipe can't kill a live session, and leaving practice always tears down the detector), `views/{home,practice,summary,collection}.js`, rebuilt `index.html` in a warm **"musician's-passport" aesthetic** (Fraunces/Hanken Grotesk, parchment/gold/flame; Collection = emoji-stamp grid). Detector consumed only by the practice view; `localISO()` dates sessions on the LOCAL date (engine keys on `start.slice(0,10)`, so never `toISOString`/UTC — a latent midnight bug in the placeholder). `npm test` **37/37** (16 core-loop, 20 protection P1–P20 + D1, smoke). Phase 3 engine ships in `motivation.js` but no view reads its new `freeze`/`recovery`/day-type outputs yet — that's Phases 4–5.

Plus a hidden **test panel** (5-tap the 🔥 streak) that drives the whole date-driven loop without the mic — essential for testing Phase 3+. Deploy via **`./deploy.sh`** (cache-busts every module URL; see the caching entry below). Build stamp shows in the Home footer + panel (`app/version.js`).

Design captured in: `main-app-ux.md` (*what*), `main-app-architecture.md` (*how*; now also documents the deploy-time cache-bust), `main-app-implementation.md` (canonical roadmap, renumbered 3a→8), `main-app-phase-1.md`/`-2.md`/`-3.md` (built specs) + `main-app-phase-3a.md` (next, spec'd). Still-governing locked decisions: pure-projection engine with injected clock+RNG; persist only facts, recompute the rest; storage = in-memory live session flushed to always-valid `{start,end,playedSec}` records on a throttle (no "running" flag); "your usual" = median of recent **daily** totals (anchor UI now Phase 7); Momentum look-ahead `dayMomentum(D)=tier(streakEntering(D)+played)`; Collection costs = cumulative thresholds, capped gap-growth. `detector.js`/`settings.js` stay classic globals (`CelloDetector`/`SettingsStore` lexical globals reachable from the module). Parent area + `parent.html` = Phase 4; lesson logging is **parent-gated only, any past date** (the one-day grace was removed); stats are **child-visible, not gated**.

Detection side unchanged; open questions stand (staccato latency fix, speech rejection at the operating point, Stage 2 in reserve).

Repo structure: `app/` (real app now — `index.html` shell, `views/`, `store.js`/`main.js`, **`motivation.js`** engine, **`theme.js`** Collection data, `version.js`, `_headers`, `settings.html`/`detector.js`/`settings.js`), `deploy.sh` (cache-busting deploy), **`test/`** (node --test) + **`package.json`**, `docs/`, `chronicles.md` (history), `README.md` (door). App source stays build-free; `deploy.sh` is the only transform (a cp+sed).

## Chronicle

### 2026-06-15 — Phase 4/5 re-planned + renumbered (3a→8); docs-only, no code

**Motivation:** Phase 3 engine done; before building any protection UI, think Phase 4/5 through properly. User's read: Phase 4 (as specced: parent area + calendar + chips + mutators) was overstuffed, and some "Phase 5" work was misfiled. Worked it as a pure design conversation, then rewrote the roadmap. **No code touched** — docs only.

**Decisions (each changed the plan):**
- **Per-lesson minutes.** A logged lesson should carry its own length (a long masterclass ≠ the weekly lesson). `lessonDays[]` `["date"]` → `[{date, lenMin}]`; the global `config.lessonLenMin` is **removed** (no remaining engine role). **No migration** — `lessonDays` has always been `[]` in the wild (reserved, never written). UI prefill is **derived, not stored**: hardcoded 45 when empty, else the last lesson's `lenMin` — so **no `cello.prefs` key** (keeps "persist facts only"). This is a retrofit of the *built* Phases 1–3, so it becomes its own **ephemeral maintenance phase 3a** that edits the prior docs in place + collapses to a tombstone once done (history → chronicles+git). New convention added to the implementation doc.
- **Lesson logging = parent-gated only, ANY past date.** Killed the **one-day (today/yesterday) grace** — a date window adds friction without safety; entering the right date is the parent's job; mistakes are fixable from the future super-admin view. Parent-gating is now the *sole* anti-gaming guard. (Engine already replayed any date — the grace was always a shell constraint.) This **contradicted UX §5.3/§5.6/§7.6/§9/§10/§11** — all patched.
- **Stats are child-visible, NOT gated.** The PIN guards *controls* (self-crediting, moving the floor), never *visibility*. Headline stats → Home; detail → beside the calendar. (UX §7.6 had implied gating.)
- **Gradual recolour pulled forward** (now Phase 5, was 5-of-old): Phase 3 already made `dim` continuous + computes the your-usual median, so only the CSS transition remains — order-independent, no longer a Phase-5 tentpole.
- **`settings` → `Detector` rename** (page is detector-tuning only; "settings" overscoped). `SettingsStore` keys untouched; its Home entry relocates under the parent area in Phase 4 but stays **unprotected** (child may visit). Folded into 3a.
- **Clear/test-panel semantics confirmed, no change needed.** Under "we never mix real use + testing; the panel exercises the *motivation engine* only," the existing `testClear()` is already correct: wipes `cello.progress` + `cello.test`, leaves `SettingsStore`/detector tuning intact.
- **PIN:** first-time set only (enter twice); **no reset path** — parked. Super-admin can't own reset (it sits *behind* the PIN — circular); left undecided.
- **Super-admin / engineer view** = its own **Phase 8**: direct edit/remove of any fact (sessions/lessonDays/holidays/config) → all re-derived by `project()`. Retroactively justifies skipping defensive guards elsewhere.

**New roadmap:** `3a` maintenance (ephemeral) → `4` parent area + mutators → `5` chips + recolour + longest-streak → `6` calendar + detailed stats (deferrable) → `7` bonuses + your-usual anchor → `8` super-admin. Clean integers for features; 3a can vanish without renumbering.

**Docs written:** rewrote `main-app-implementation.md` (table, maintenance-phase convention, Phases 3a–8, Next action); fixed the contradictions in `main-app-ux.md` (grace + stats) and the date-window note in `main-app-phase-3.md`; created **`main-app-phase-3a.md`** (the 3a deep spec — names the exact engine touchpoints to change, and **owns the few 3a edits that landed early** while fixing §7.6: it flags that the §7.6 "lesson length"/"Detector" lines + the Phase 4–8 overviews already assume 3a's outcome, and lists what's still to do at execution).

### 2026-06-14 — Phase 3 spec'd + built (engine: day-types & protection); holiday-precedence flip

**Motivation:** Phase 2 shipped; advance the engine to the full streak-protection lifecycle (UX §5 + the §9 precedence machine) — pure + test-first, before any Phase-4 UI. Spec written just-in-time as `docs/main-app-phase-3.md` (mirrors the phase-1/2 pattern), then implemented.

**Three design decisions resolved up front** (each genuinely changed the spec): (1) **"your usual" pulled into Phase 3** — the recovery target is `2 × your-usual`, the median is pure/cheap, so compute it now via an exported `yourUsualMin()`; Phase 5 shrinks to just the practice-screen marker UI + the recolour animation. (2) **New user starts with 1 banked freeze** (forgiving onboarding; matches the §8 sketch) rather than earning the first after 7 days. (3) **`dim` is continuous now** (`1 − progress`), not binary — the math is free once recovery accounting exists; Phase 5 adds only the CSS transition.

**Mid-spec precedence flip (user-driven).** While explaining what "holiday pauses the streak" meant, surfaced an ambiguity: under §9's original `holiday`-first ordering, *practicing during a declared holiday* left the streak paused (didn't count). User chose **playing overrides holiday** — so **played-equivalent is now checked BEFORE holiday**: a holiday day she plays (≥floor or a logged lesson) resolves as Played/Lesson and grows the streak; only the *unplayed* holiday days stay paused. Holiday became a **safety net for days off, not a ceiling on days practiced**. This refined the canonical doc — **patched UX §9 pseudocode + prose + invariants AND §5.4** so the spec and the source-of-truth agree (no lingering "sync back" debt; those hedge-notes were later cleaned out of docs + `motivation.js` on request).

**Engine (`app/motivation.js`, extended, pure):** the full §9 first-match machine `played-or-lesson(STACK) → holiday → rest → frozen → missed`; honors `lessonDays[]`/`holidays[]`/`config.restWeekday`/`lessonLenMin`; `from` extends to the earliest dated input. Freeze lifecycle (cap 1, auto-consume on a slip, regen at 7 played-equiv days, never two in a row via a `prevStatus` guard). Continuous recovery (`recovery.{active,minutesDone,minutesTarget,progress}`, target captured at the break from the rolling played-totals median, `DEFAULT_USUAL_MIN=35` fallback; floor-OFF, lessons credit too, live today). Refined `streak.atRisk` = true only if an empty today would *actually* break (false on a rest day / with a freeze banked / on holiday). New output blocks `freeze`/`recovery`; new exports `yourUsualMin`, `FREEZE_REGEN_DAYS`, `DEFAULT_USUAL_MIN`. Points stay **ungated** by the day-type machine (every detected minute + any lesson earns, even on held/missed/holiday days).

**Tests — 37/37.** New `test/protection.test.js` (P1–P20 + D1): every day-type, precedence (rest-before-freeze, played-beats-holiday + sub-floor-stays-paused), freeze consume/regen-at-exactly-7/no-two-in-a-row, **mid-week-holiday-no-rest-desync** (the §10 bug guarded), lesson backfill un-break + freeze-refund, holiday pause + regen-exclusion, continuous recovery (partial→full, re-break resets), atRisk under each protection, all-inputs determinism. **Unexpected ripple:** the initial-banked-freeze decision meant "a single empty day breaks" is no longer true (it's frozen) — so more Phase-1 tests changed than the spec foresaw (5/6/7 plus the planned 9/13); all updated in place to the new semantics, each keeping its discriminating purpose, none deleted. Caught one self-inflicted fixture bug (a stray played day advancing regen in the holiday-excluded-from-regen test) — engine was right.

**Not done:** no UI/store changes (Phase 4); no deploy (engine-only); `shouldOfferBonus` still the Phase-5 stub.

### 2026-06-12 — Phase 2 built + deployed (the real app); Opus-direct decision; detector zombie-session fix

**Motivation:** design locked, engine proven — build the UI and ship the first real deploy. User re-posed the cost question from the Phase-0/1 experiment: Opus-direct vs Sonnet-delegate-then-review? **Decision: Opus-direct this time** — and the *reason refines the earlier principle*. Phase 2 is **correctness-dense** (local-date wiring, detector flush/teardown, the live-second double-count math) **and** its headline is **design taste** (a distinctive kid-facing aesthetic) — the two things a cheaper model regresses on *and* that review can't cheaply catch; meanwhile the token delta to delegate is small once cold-start + Opus review + a likely fix-cycle are counted. So: delegate **bulky/low-reasoning/oracle-checkable**; keep **correctness-dense OR taste-driven** work on Opus.

**Built (Opus):** `store.js` (facts-only `cello.progress`), `main.js` (the unidirectional loop + **in-memory router, no URL hash** — chosen so the iOS back-swipe can't exit a live practice session, and so leaving practice always runs the detector teardown), `views/{home,practice,summary,collection}.js`, rebuilt `index.html` with the warm passport aesthetic (used the `frontend-design` skill). Practice view is the only detector consumer: accumulates detected seconds in memory, flushes into the live `sessions[]` record on a ~5s throttle, quiet "Today counts ✓" at the floor, no countdown. **`localISO()`** added because the engine keys a session's day on `start.slice(0,10)` vs a local `today` — so timestamps must be local, never `toISOString()` (UTC), which mis-dated near midnight (a latent placeholder bug). Browser-smoke-tested all four views + routing locally; deployed, replacing the placeholder.

**Detector fix (the one change to `detector.js`):** `start()` awaits `getUserMedia` + the wake lock; a `stop()` landing mid-await used to leave a **zombie session** — live mic + RAF loop + wake lock owned by no view, with a later `start()` clobbering `this.stream`. Fix: a `_runToken` epoch bumped by `stop()`/`_fail()`, re-checked after each await → a superseded start self-aborts, releasing exactly what it acquired and swallowing a stale mic-grant. The field-tested background-recovery path was left untouched (its analogous window noted, deferred).

### 2026-06-12 — Test panel: a non-destructive clock offset to drive the date-driven loop

**Motivation:** a streak/Momentum/collection app is *entirely* date-driven — without fast-forwarding days you can only ever see "day 1," and the upcoming Phase 3 protection day-types need multi-day scenarios on the deployed phone. (Reinforced by a field finding: iOS Safari opens an **undismissable modal if you reload mid-mic-permission-grant** — so testing must not depend on the mic.)

**Key design — "+1 day" is a clock offset, not a data rewrite.** Store a shell-only `cello.test = { dayOffset, tainted }` (the engine never sees it) and feed the engine `effectiveToday = realToday + dayOffset` through its existing `today` *parameter* — the exact seam the pure-engine split created. Real session timestamps are never mutated, the offset is reversible, and **`motivation.js` stays untouched**. Synthetic practice (`+5 min`, `+played day` = 30 min then advance) appends sessions dated at effective-today. Any control except **Clear** sets `tainted` → the controller renders an app-wide **🧪 test data** chip (child-safety + a backstop signal). Verified end-to-end: 7×played → streak 7 / ×1.5 / 257 pts / 5-of-76; +1 day → break (streak→0, ×1, points+tiles preserved, world greyscales); Clear → clean app.

**Access gesture — long-press died on iOS.** Long-press the streak worked on desktop but **never on iPhone**: Safari claims the touch-hold for its own selection/callout gesture and fires `pointercancel`, cancelling the timer — and `touch-action:none` + `preventDefault()` didn't save it. Switched to **5 quick taps** (a `click` always fires; nothing for the OS to intercept). Lesson: prefer taps over holds for hidden gestures on iOS.

### 2026-06-12 — Cloudflare Pages caches JS for 4h; page-URL queries can't bust it → `deploy.sh`

**Motivation:** after each deploy the user kept seeing the **stale** app in a normal tab (a private tab showed the new one); even adding `?v2` to the page URL didn't help. Why?

**Finding (reusable):** CF Pages defaults static JS to `Cache-Control: max-age=14400` (4h). The HTML revalidates (`max-age=0`), but the JS **modules** it imports keep their own fixed URLs (`views/home.js`, no query) → the browser serves them stale from disk cache. **A query string on the *page* URL cannot bust sub-resources — only each module's OWN url can change.** Private tab worked only because it ignores the persistent cache; iOS Safari has no hard-reload. (Edge nuance: `?cb=` curl checks *bypass* the edge cache, so they masked the problem during verification — check the plain URL.)

**Fix — `deploy.sh` cache-busts module URLs.** It copies `app/` → a temp dir and `sed`s `?v=<build>` onto every `<script src>` and relative `.js` import, then `wrangler pages deploy`s that. Because the HTML is always-revalidated (added **`app/_headers`**, `max-age=0`), a *normal* page reload pulls the new versioned module URLs automatically — no private tab, no clearing site data, and the old cached files just become orphans. **`app/version.js`** (`VERSION`, `"dev"` in source, stamped by the script) shows in the Home footer + test panel so a stale page is obvious at a glance. App source stays build-free — the stamp is a deploy-time `cp` + `sed` only.

### 2026-06-06 — Built Phase 0+1 (engine + harness); delegate-and-review experiment

**Motivation:** design fully locked — start building, beginning with the test-first engine. The user also posed a genuine workflow question first: is it cheaper to have the expensive model (Opus) write code, or delegate to a cheaper model (Sonnet) and have Opus review? Decision: reason it through, then **test it empirically** — Opus writes the small reasoning-dense engine; delegate the bulky low-reasoning data (the Collection tile list) to a Sonnet subagent.

**Workflow principle established (the reusable finding):** delegation pays off for **bulky, low-reasoning, oracle-checkable** work; keep **small, reasoning-dense, or ambiguous** work on Opus. Why: review *output* is far smaller than generation output, but for correctness-critical code verifying ≈ deriving (so writing it yourself is as cheap and tighter) — *unless* a cheap correctness oracle exists (tests, or a visible artifact), which collapses the review to "is the oracle right + skim for what it can't catch." So: give any delegated task a **precise spec + an automatable self-check**, and always do the content review (it's load-bearing but cheap).

**Engine built (Opus), Phases 0+1:** root `package.json` (`type:module`, `node --test`, zero deps). `app/motivation.js` — pure `project(inputs,{today})`: Played + Missed→break, streak/longest, Momentum tiers with the locked look-ahead rule, points (`round(min×mom)` half-up, every minute counts even sub-floor), Collection unlock by cumulative threshold, binary recovery `dim`. No browser APIs / no ambient clock or RNG (parsing a *given* date string is fine) → fully deterministic. `app/theme.js` starter tiles. `test/` = the spec's 13-case matrix + smoke = **15/15 green**. Browser shell (`index.html`/`main.js`) deferred to Phase 2 to avoid gutting the working placeholder. Built on a feature branch, fast-forward merged to `master`.

**Delegation result (Sonnet wrote, Opus reviewed):** the 76-tile world-tour Collection. Sonnet (~23k tokens, ~2 min) produced it against a precise spec + a `node` self-check oracle (asserts ascending costPoints / unique ids / first-9 intact); it **passed the oracle first try**, so structure needed no checking. Opus review caught **4 content errors the oracle couldn't** — a Lisbon tile with a *Porto* fact, a duplicate Edinburgh tile (→ swapped to Dresden), and two false "only…in Africa / only…in NZ" claims. Fixes were quick. Confirms the principle: oracle handles structure for free; human-grade review remains necessary for content but is cheap. Collection economics: cumulative-threshold tiles, gap-growth capped (~≤2,500), 0→100,000 pts over 76 tiles ≈ 3 years.

### 2026-06-06 — Engineering plan & build roadmap for the main app

**Motivation:** UX was designed but the build is sizable; needed an architecture and a phased plan before writing code. User's explicit asks: extract the motivation logic as a separately-testable "brain" (like `detector.js`); keep the setup simple (reluctant about a build step) yet maintainable now that one HTML file won't cut it; figure out how to split the app, especially for staged delivery.

**Keystone decision — the brain is a *pure projection*, not a stateful object.** `project(inputs,{today}) → derivedState` (a `liveSessionSec` ctx param was initially included, then removed — see the next entry). Persist only recorded facts; recompute streak/Momentum/points/collection/freeze/recovery every call. Inputs shrink to a few small arrays (`config`, `sessions[]`, `lessonDays[]`, `holidays[]`, `bonuses[]`). Two purity rules make it testable: (1) inject clock + RNG — engine never calls `Date.now()`/`Math.random()`; (2) randomness in the shell (roll a bonus, append the realized result to `bonuses[]`), determinism in the engine. Falls-out-for-free benefit: the designed "lesson backfill un-breaks a break" is just a replay over amended inputs. Collection unlocks and points.total are *derived*, not stored — persistence surface is tiny.

**No-build maintainability — native ES modules + `node --test`** (both confirmed with user against alternatives). ESM runs in browser (`<script type=module>`, Safari 11+) and Node 23 alike with no bundler/transpile; tests are `node --test` (zero deps; minimal root `package.json` = test script only, framed explicitly as "running tests, not a build"). Pure/impure boundary made physical: `motivation.js` + `theme.js` pure (browser *and* Node); `store.js`/`main.js`/`views/*` impure shell. `detector.js`/`settings.js` left as untouched classic globals (field-tested iOS recovery code — isolate it), read as `window.CelloDetector` by the module code.

**App structure (confirmed): single-page main app + separate gated `parent.html`.** Main loop (Home→Practice→Summary→Collection→Calendar) is one page with in-page view modules (show/hide or tiny hash router) so live session state survives navigation; parent area separate, mirroring the `/settings` precedent. Data flow = tiny unidirectional loop `store → project → render`, action mutates an input → reproject → render. No framework.

**Roadmap — split the UX doc's 3 conceptual phases into 6 implementable, alternating engine→UI increments** (engine-before-UI honors test-first): 0 scaffolding/harness · 1 engine core loop (Played + Missed→break + Momentum + points + collection, pure, tested) · 2 UI core loop (first real app, first deploy, iPhone field-test) · 3 engine day-types & protection (Lesson/Rest/Frozen/Holiday + recovery, tested) · 4 UI protection + parent area + calendar · 5 polish (bonuses, your-usual anchor, gradual recolour). Each phase has scope/out-of-scope/done-criteria; Phase ≥2 ends in a field-test. Per-phase deep specs (`main-app-phase-N.md`, mirroring the `stage-1/stage-2` pattern) written just-in-time before building. Roadmap doc is canonical; phase lists trimmed out of `ux.md §12` and `arch.md §7` to pointers (one source of truth).

(An open alignment note about "your usual" per-session vs per-day was raised here and resolved in the next entry → per-day.)

### 2026-06-06 — Phase 1 spec; always-valid storage; "your usual" → per-day

**Motivation:** deepen Phase 0+1 into a build-ready spec (`main-app-phase-1.md`) before coding. Writing it forced exact contracts, and the user pushed on two points that reshaped the data model.

**Phase-1 spec written:** exact input schema, `project()` output contract, Momentum/points/collection math, recovery dim, `theme.js`, 13-row `node --test` matrix, Phase 0 scaffolding steps. **Momentum look-ahead rule LOCKED:** `dayMomentum(D) = tier(streakEntering(D) + (played(D)?1:0))` — the one genuinely ambiguous call; chosen because it reproduces the UX §3.2 worked week *and* avoids retroactively devaluing minutes when a day later breaks. Verified row-by-row against the example (total 257, streak 7) — now a golden-path test fixture.

**Storage model reshaped (user-driven) — always-valid state, no `liveSessionSec`.** User's insight: a "session" is not a user concept, just mic listening on/off; what matters is *total played minutes today*, which must survive an (accidental or iOS-background) reload. Decision: the live session is **in-memory only** (detector, timer, wake lock); its detected seconds **flush into the current `sessions[]` record on a throttle**; localStorage holds only always-valid records — **no "running" flag**, atomic whole-object `setItem`. A reload keeps today's total intact (summed from records); only the mic stops (tap Start to re-arm), losing at most seconds since the last flush, never the session. Consequence: **`project()` drops `liveSessionSec`** → pure `project(inputs,{today})`; the engine reads the throttled-updated record like any other. Session record shape is `{start, end, playedSec}`, kept this way deliberately so the raw signals (start times, wall-clock duration, played time) survive **for later analysis**.

**"Your usual" flipped per-session → per-DAY median** (resolves the prior entry's open note). Rationale follows directly from the storage reframe: if a "session" is just an on/off toggle, session *length* is noise (an artifact of how often she taps), so the truer anchor is the median of recent **daily played totals**. Raw per-session data still kept; only the anchor/recovery-target uses daily totals. Phase 5.

**Collection sizing decided.** Tile `costPoints` are cumulative point thresholds; prices keep rising but **gap growth is capped** so late-game unlocks still land ~every couple weeks (a cadence that stretches to months demotivates). Banded plan: A (wk 1–2, ~900) · B (mo 1–3, ~6k) · C (yr 1, ~30k) · D (yr 2–3, capped gaps, ~100k) ≈ **76 tiles ≈ 3 years** at ~70–110 pts/day settled. Engine is count-agnostic; Phase 1 ships ~9 to test, full list authored before Phase 2; a second "famous pieces/composers" band added when she nears the end.

**Doc hygiene:** UX §8 data sketch now defers to architecture §1 as the authoritative persisted shape (one source of truth); phase lists already pointer-ized.

### 2026-06-06 — Designed the main-app motivation UX (streak + Momentum + Collection)

**Motivation:** time to design the *real* main app — a daily motivator for the user's 11–13-year-old to practice cello, replacing the placeholder counter. Design only this session (no code); output is `docs/main-app-ux.md`.

**Central tension (the whole problem):** a Duolingo streak needs a daily qualifying threshold (15 min of detected sound), but the moment that threshold is shown as a goal it becomes the *ceiling* — Goodhart's law. The child's real sessions are much longer; 15 min must never read as "done." Requirement: keep the consistency benefit of streaks without surfacing the floor as a target.

**Resolution — split one number into two currencies, re-link with a multiplier:**
- **Streak** (fragile, resettable) drives daily consistency; its 15-min qualifier is a *quiet turnstile* — no countdown, no bar-to-15, only a small "Today counts ✓" mid-session, numbers always count *up*.
- **Collection** (permanent, never lost; world-tour theme — emoji-tile CSS grid, near-zero art budget) drives depth, fed by total minutes, no ceiling.
- **Momentum** (×1.0→×3.0 by streak length) is the link: longer streak → each practiced minute worth more. Breaking the streak drops Momentum to ×1 (the felt loss) but **never destroys the Collection** — humane loss aversion. Points = `minutes × Momentum`; the floor is never headlined.
- Supporting moves: anchor on her *own* trailing-median session length (not the floor); probabilistic surprise bonuses gated to *overtime* (post-floor) so they reward depth and never gamify the floor.

**Recurring design principle that drove every later decision — "one mechanism, two jobs is a smell."** Surfaced first as the played-vs-qualifying split, then forced a rework of day-handling.

**Day-handling settled into five non-overloaded primitives** (each real-life situation → exactly one):
- **Played** (detected ≥ floor), **Lesson** (parent-credited, no mic), **Rest day** (scheduled weekly day off), **Frozen** (emergency freeze), **Holiday** (pre-declared multi-day pause), else **Missed→break**.
- **Break is "medium":** treasure persists but the world greyscales (one CSS filter) and recolours *gradually* over `2 × your-usual` minutes of return practice (earned comeback, rewards depth).

**Two bugs the user caught, and their fixes (this is why the model has five types, not three):**
1. *Mid-week Holiday silently desynced the weekly rest cadence* — because an earlier design overloaded the emergency **Freeze** to also power the weekly rest, and its 7-day regen counter (which excludes Holiday days) would fall one short. Fix: give the weekly rest its **own primitive** (parent-set **Rest weekday**), independent of the freeze. This let us *delete* the fragile "frozen counts toward regen" rule; Freeze reverts to a rare backstop (regen after 7 played-equivalent days).
2. *The lesson day* — real practice (often the week's most valuable) but she won't run the app in front of the teacher; must count as **played**, which Holiday (a pause) can't do. New **Lesson credit** primitive: parent-gated (anti-gaming — a no-mic played-day+points credit would be trivially faked if child could self-tap), **one tap, today-or-yesterday grace** (covers "forgot to log yesterday"). Implemented as a date added to a `lessonDays` set that the date-driven state machine *replays* over → backfilling yesterday auto-undoes whatever it became (refunds a freeze, even un-breaks a break). Earns `lessonLen × Momentum`.

**Final refinement — Played + Lesson stack.** User flagged that making `played` suppress `lesson` meant a stray short home session could block the parent from logging the lesson. Decoupled points entirely from the day-type machine: a day's points = `detectedMin × Momentum` + (`lessonLen × Momentum` if logged) + bonuses; the **streak still increments once** per played-equivalent day. Stacking is also just *more correct* — a home-practice-plus-lesson day is genuinely more practice.

**Locked parameters/choices with the user:** audience 11–13; theme = world concert tour (locked); break intensity = medium with gradual recolour; Holiday = pre-declared pause; lesson = one-tap-confirm with one-day grace, points = lesson-length × Momentum. Spec includes data-model sketch (`cello.progress`, replay-derived state), the precedence state machine, parameters table, phasing (core loop → day-types/protection → polish), and out-of-scope (practice *quality*, accounts, social, notifications). `docs/README.md` index updated to link it.

### 2026-06-05 — Decoupled monolith into reusable detector + two UI apps

**Motivation:** `app/index.html` had become a single 905-line file conflating three concerns — the detection DSP, the parameter-tuning UI, and (implicitly) the "app" itself. To start building a *real* tracking app while keeping the tuning rig available, these needed to separate so the detection engine could be reused by both a config tool and a product UI.

**Diagnosis of the seam:** the old `draw()` function was doing three unrelated jobs in one RAF tick — pull FFT + run detection, render canvases, update status text. That mapped cleanly onto the desired split. Key framing correction made up front: persistence is a *third* concern belonging to neither the detector nor the rendering — the detector must stay storage-agnostic.

**Architecture shipped (4 files, still no build step):**
- `app/detector.js` — `CelloDetector` class owns mic + Web Audio graph + all DSP (HPS, cello-peak, stability gate) + the analysis loop + iOS background recovery + wake lock. No DOM, no localStorage. Takes a plain params object (`setParams` for live tuning); emits via three callbacks: `onFrame` (per-tick viz+resolution data), `onDetectionChange` (detected ⇄ not transitions), `onStatus` (mic/wake-lock/error lifecycle).
- `app/settings.js` — `SettingsStore`: param defaults + typed localStorage load/save, single source of truth for params. Keys reuse the prior names → tuned values carry over with no migration.
- `app/settings.html` — the *former* index.html, now the tuning app at `/settings`. Reads/writes params via `SettingsStore`, runs a full live detector, renders spectrum / f0 strip / gate visualizations from the frame object.
- `app/index.html` — *new* trivial main app at `/`. Seeds the detector from `SettingsStore`, start/stop a session, counts detected playing time, logs sessions to `localStorage['cello.sessions']` with a lifetime summary.

**Decisions (locked with user before building):**
- **Playing time = summed *detected* time** as the headline (the whole premise of the tracker — timer pauses when bowing stops), with wall-clock session time as a secondary readout.
- **Wake lock lives in the detector** (lifecycle-bound to the audio session), surfaced via `onStatus` so each page decides how to display it — rather than a shared helper.
- **Settings page runs a full live detector**, not a separate "preview" path — no second code path to drift.

**Executed as a 5-step plan**, detector extraction first (the high-risk step — RAF ownership, recovery, AudioContext singleton) with the old UI as its first consumer to de-risk before the rest became plumbing. One deliberate timing change: the detector schedules its first analysis frame on the *next* rAF (so consumers can size canvases after `start()` resolves) rather than running it synchronously.

**Fixed en route:** the Threshold slider was never persisted (silently reset to 15 every load) — now stored like the other params. This was the only behavioral change in an otherwise pure extraction.

**Platform note confirmed:** Cloudflare Pages serves `settings.html` at the clean `/settings` URL automatically (clean-URL behavior), and `detector.js` / `settings.js` as plain static assets — two HTML files at the deploy root give `/` and `/settings` with zero config, no `_redirects`, no framework.

**Result:** field-tested working on iPhone (tuning UI behaves identically; main app counts playing time, persists sessions; cross-navigation works). Two commits: `05df215` (extract detector), `e6f2763` (split apps). Docs updated to point platform/detection patterns at `detector.js`.

### 2026-05-31 — Staccato false negatives traced to stacked detection latency

**Question:** First iPhone field test of Stage 1 — staccato notes missed entirely. Lowering the stability Duration slider toward its 100ms floor didn't help. Is it safe to go shorter, or is something else the bottleneck?

**Diagnosis — the Duration slider was a red herring.** Four latencies stack between note onset and the detection badge firing; Duration is the smallest:
1. **FFT window** — `FFT_SIZE 4096` ≈ 85ms of audio integrated per spectrum at 48kHz. Notes shorter than this smear across a mostly-silent window → low HPS peak.
2. **`smoothingTimeConstant`** — exponential frame blending imposes a *rise time*. At the code's actual 0.75, a fresh note needs ~8 frames (~130ms) to reach ~90% amplitude — a 100ms staccato note dies before its energy ever crosses threshold. **Highest-leverage culprit, and free to fix** (doesn't touch frequency resolution).
3. **`stabilityDurationMs`** — the slider (was floored at 100ms).
4. **`ATTACK_MS = 300`** (hardcoded debounce) — even after the gate opens, `aboveMs` must reach 300ms continuously. Effective time-to-detect ≈ Duration + Attack ≈ 400ms min; both counters reset on any failing frame.

**Key insight on safety:** going shorter is safer than it sounds — the *cents tolerance* (pitch steadiness) does the real speech rejection, not Duration. Speech pitch glides; a 60ms staccato note's pitch is rock-steady. Duration was belt-and-suspenders. Attack is the actual gate standing between us and staccato.

**Changes** (`app/index.html`):
- `smoothingTimeConstant` 0.75 → **0.35** (highest leverage; fresh notes ramp in ~3 frames).
- `ATTACK_MS` const → **`attackMs` slider**, default 60ms, range 30–400, persisted `localStorage['detection.attackMs']`. Placed as its own row after Threshold, *above* the stability toggle — grouped with the always-on knobs (Threshold, Attack), separate from the optional gate method (Tolerance, Duration). Rejected putting it under the detection badge: orphans a control above the canvas and pushes visualizations down on iPhone.
- Stability Duration slider floor 100 → **50ms**.

**Discovered en route:** `docs/platform-foundations.md` claimed `smoothingTimeConstant = 0 // no smoothing` — but the code had smoothed at 0.75 the whole time. A documented platform foundation had silently diverged from the implementation, and likely *masked* this problem (a reader would assume instant, raw spectra). Docs corrected to match (now 0.35, attack tunable, duration range 50–500).

**Next resolved to:** re-test staccato on iPhone at Attack ≈ 60ms; if still dropping, push Attack toward 30–40, then consider `FFT_SIZE 2048`.

### 2026-05-31 — Stage 1 (pitch stability gate) implemented

**Question:** Does adding a pitch-stability gate on top of HPS eliminate the conversational-speech false positives that made HPS-only detection unusable?

**Implementation** (`app/index.html`):
- `computeStability(peak, dt)` — rolling 500ms buffer of `{timeMs, freq}` samples; median center frequency (robust to octave-error frames); cents-based tolerance check; accumulating progress timer. Appended each frame where `peak.val > 0`; oldest entries dropped beyond the window.
- Detection condition changed from `hpsPass` alone to `hpsPass && (!stabilityEnabled || stabilityGate)`. Gate toggle checkbox lets user revert to HPS-only to compare.
- Three new controls, all persisted to `localStorage`: Stability gate checkbox (default on), Tolerance slider 20–100 cents (default 30), Duration slider 100–500ms (default 200).

**New visualizations added:**
- **f0 history strip** — 60px canvas below the spectrum. Log-scale y-axis (65–1200 Hz), plots last 500ms of detected f0 as a line. Translucent green band tracks running median ± tolerance. Line color: green (in-band) / gray (out-of-band). Makes the tolerance parameter directly legible.
- **Stability progress bar** — 4px bar that fills as `stabilityProgressMs` accumulates toward `stabilityDurationMs`. Dim→`#00cc7a`→`#00ff9f` at gate-open. Shows exactly how long a pitch must hold before detection fires.
- **Gate status strip** — `HPS: ● Stability: ○` live readout between detection badge and spectrum. Stability entry omitted when gate disabled. Tells the user which gate is blocking a missed detection.

**Design choices:**
- Tolerance in cents (not Hz) so one value works across the full cello range (±30¢ = ±1.1 Hz at C2, ±9 Hz at C5).
- Median (not mean) for center frequency — robust to single-frame HPS octave errors.
- `stabilityProgressMs` resets to 0 on any out-of-band frame — no partial credit across gaps.

**Next resolved to:** field-test on iPhone; evaluate whether the gate eliminates speech false positives without requiring an impractical hold time on real played notes.

### 2026-05-30 — Repo reorganized; established doc conventions

**Question:** Docs were accumulating in inconsistent places (`sound-analysis/spec.md` from the PoC era, new `docs/`, status info duplicated across README and chronicles). Where does each kind of content belong, going forward?

**Decision — one source of truth per concern:**
- `README.md` → vision + deploy + repo map only. No status, no design re-explanation, no "what's next" — all of those drift. Vision kept high-level enough that updates are rare.
- `chronicles.md` → all history, status, motivations, killed ideas. The canonical place to learn *why*.
- `docs/` → current technical design. Includes `docs/platform-foundations.md` (mic flow, audio pipeline, wake lock, iOS background recovery — extracted from the obsolete PoC spec) and the detection pipeline specs.
- `app/` → the implementation. Renamed from `sound-analysis/` because that name was an artifact of the PoC era — it's the whole app now, not a side experiment. Deploy command updated to `wrangler pages deploy app/ ...`.

**Deleted:** `app/spec.md` (PoC-era "Audio Wave Monitor" spec — superseded; still-useful patterns extracted into `docs/platform-foundations.md`, the obsolete framing dropped).

**Convention for future agents:** new design docs go in `docs/`. Status and rationale go in chronicles. README stays a door.

### 2026-05-30 — HPS alone insufficient; designed layered pipeline

**Question:** HPS was supposed to discriminate harmonic sources from non-harmonic ones, but field testing showed it still triggers on conversational voice. What's next?

**Root cause of HPS failure:** Earlier reasoning was wrong. Voiced speech (vowels) is itself harmonic — vocal folds produce a clean f, 2f, 3f, 4f series, exactly what HPS rewards. HPS is a *pitch detector*, not a voice-vs-cello classifier. The formant-gap argument only kills unvoiced sounds (fricatives, whispers, broadband noise), not normal speech.

**What actually separates cello from voice** (in order of cheapness to exploit):
1. **Pitch stability over time** — cello holds f0 within a few cents for hundreds of ms (vibrato is slow wobble around stable center). Speech pitch slides continuously within every syllable.
2. **Harmonic extent** — cello carries 8–12+ harmonics to 6–10 kHz; voiced speech dies after 3–5. Cheaper and more selective than the spectral-flatness ratio considered earlier, because it samples FFT *at expected harmonic positions* tied to the already-detected f0.
3. **Spectral envelope** (MFCC) — most principled, much higher complexity. Deferred.

**Decision:** Layer cheap targeted gates on top of HPS, each exploiting a different real difference, ANDed at detection time with per-gate toggles. Build in stages, not all at once. Stage 1 = pitch stability (handles dominant failure mode, conversational speech). Stage 2 = harmonic extent (only if Stage 1 still lets sustained voiced sounds through — humming, singing, TV voiceover). Explicit non-goal: singing rejection — sung vowels look essentially identical to bowed notes on every cheap dimension we measure; would need MFCC.

**UI design principle established:** Every gate needs a live visualization that makes its parameters legible during tuning. Without it, threshold tuning is guessing. For Stage 1: f0 history strip (last ~1.5s plotted as a line, with translucent tolerance band centered on running median) + stability progress bar (fills as f0 stays inside band). For Stage 2: harmonic tick overlay on the existing spectrum analyzer (green/gray ticks at expected harmonic positions) + count readout. Cross-cutting: a gate status strip showing live pass/fail of each enabled gate, so a missed detection is debuggable at a glance. All slider values persist to localStorage.

**Specs written** in `docs/README.md`, `docs/stage-1-pitch-stability.md`, `docs/stage-2-harmonic-extent.md` — each self-contained for a coding agent (algorithm, parameter ranges, UI controls, visualizations, integration points into existing `app/index.html`).

**Next resolved to:** implement Stage 1, field-test, evaluate whether Stage 2 is needed.

### 2026-05-20 — Band-average detection failed; rebuilt with HPS

**Question:** The band-average approach was tested on iPhone and was unacceptable — couldn't find a threshold that worked across all registers. Is there a fundamentally better detection signal?

**Failure mode of band-average:** High cello notes produce lower absolute energy in the band than low notes. Any threshold high enough to reject voice also missed soft high-register playing. Threshold low enough to catch high notes triggered on talking. No usable operating point existed.

**Root cause:** Band average measures *how much energy* is in the cello range, not *what kind* of energy. Voice and cello overlap heavily in frequency. The algorithm had no way to distinguish them.

**Switched to HPS (Harmonic Product Spectrum).** Cello produces a clean harmonic series (f, 2f, 3f, 4f...). HPS multiplies the spectrum against downsampled copies of itself — energy survives only where all harmonics are simultaneously present. Voice formants create gaps at some harmonics, collapsing the product. Result: a sharp spike at the fundamental for pitched instruments, low flat noise for voice and ambience.

**Implementation:** Geometric mean of 4 harmonics (normalized to 0–255 scale). FFT size increased to 4096 for better low-frequency resolution (~10.8 Hz/bin). Detection: peak HPS value in 65–1200 Hz range vs. threshold, same 300ms attack / 1500ms release debounce.

**UI change:** Spectrum analyzer bars now show HPS values instead of raw FFT. The display shows a single spike at the detected fundamental rather than a forest of harmonic bars — much cleaner signal for threshold tuning. Peak bar highlighted white; note name + frequency shown in canvas corner when a peak is visible. Threshold slider range extended to 200 after first on-device test revealed values run higher than predicted.

**Next resolved to:** tune threshold during real practice; assess whether HPS cleanly separates cello from ambient noise at a consistent operating point.

### 2026-05-17 — Cello detection layer designed and built (band-average approach — superseded)

**Question:** How to detect cello sound reliably using only a phone mic, and what should the detection UI look like for tuning on the device?

Built spectrum analyzer UI (80-bar log scale, 30 Hz – 8 kHz). Detection: average FFT magnitude across cello band (65–1200 Hz) vs. threshold. Time-based debounce (300ms attack, 1500ms release). Threshold slider moves a visible line on the canvas.

**Killed by:** iPhone testing — no usable threshold. See 2026-05-20 entry.

### 2026-05-17 — PoC built, deployed, and validated on iPhone

**Question:** Would Wake Lock API and Web Audio API actually work on iOS Safari — worth building the full tracker at all?

Built `sound-analysis/index.html` — single-file, no dependencies. Pipeline: `getUserMedia` → `MediaStreamAudioSourceNode` → `AnalyserNode` (not connected to destination — analysis only, no feedback). Features: mic request on tap only, oscilloscope canvas, Wake Lock with visibility-change re-acquisition, full background recovery (AudioContext resume + dead mic track restart on return from suspension), HTTPS guard. Deployed to `https://cello.mavko.consulting` via Cloudflare Pages (`wrangler pages deploy`). CF custom domain: API registers domain but does not auto-create CNAME — dashboard does both; use dashboard.

**Result:** 3-min live iPhone session — waveform active, screen on throughout, locked normally after stop. Both APIs confirmed. No blockers. Cleared to build real tracker.

**Next resolved to:** cello detection layer.
