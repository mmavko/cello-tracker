# Chronicles
Last updated: 2026-06-06

## Current State
**Main app: fully designed (UX + architecture + roadmap), implementation about to start.** Three docs drive it: `main-app-ux.md` (the *what* — streak/Momentum/Collection motivation, five day-types), `main-app-architecture.md` (the *how* — pure-projection engine, no-build ESM, `node --test`), `main-app-implementation.md` (the canonical 6-phase build roadmap). **Immediate next step: write `docs/main-app-phase-1.md`** (build-ready spec for the engine core loop — exact input schema, `project()` output shape, test matrix), then implement Phase 0 (scaffolding) + Phase 1 (engine, test-first).

Key architecture decision locked: the motivation brain (`app/motivation.js`) is a **pure projection** `project(inputs,{today}) → derivedState` — persist only facts (`sessions[]`, `lessonDays[]`, `holidays[]`, `bonuses[]`, `config`), recompute everything else (streak, Momentum, points, collection, freeze, recovery). Clock and RNG are injected (never `Date.now()`/`Math.random()` inside the engine); randomness lives in the impure shell, determinism in the engine. This is what makes the whole thing unit-testable and makes "log a lesson un-breaks yesterday" a free consequence of replay. Setup: native ES modules (no bundler/transpile) + `node --test` (zero deps; a minimal root `package.json` holds only the test script — running tests, not a build). Main app = single-page `index.html` + in-page view modules; gated `parent.html` separate. `detector.js`/`settings.js` stay **untouched classic globals**, read as `window.CelloDetector` by the new module code, isolating the field-tested iOS code from the refactor.

Detection side unchanged; open questions stand (staccato latency fix, speech rejection at the operating point, Stage 2 in reserve). The placeholder trivial main app still ships at `/` until Phase 2 (first deploy of the real app); deploys are manual so building Phases 0–1 doesn't touch the live site.

Repo structure: `app/` (4 static files — `index.html` placeholder main app, `settings.html` tuning UI, `detector.js`, `settings.js`; no build step), `docs/` (detection pipeline, platform foundations, **main-app-ux / -architecture / -implementation**), `chronicles.md` (history), `README.md` (router only).

## Chronicle

### 2026-06-06 — Engineering plan & build roadmap for the main app

**Motivation:** UX was designed but the build is sizable; needed an architecture and a phased plan before writing code. User's explicit asks: extract the motivation logic as a separately-testable "brain" (like `detector.js`); keep the setup simple (reluctant about a build step) yet maintainable now that one HTML file won't cut it; figure out how to split the app, especially for staged delivery.

**Keystone decision — the brain is a *pure projection*, not a stateful object.** `project(inputs,{today,liveSessionSec}) → derivedState`. Persist only recorded facts; recompute streak/Momentum/points/collection/freeze/recovery every call. Inputs shrink to a few small arrays (`config`, `sessions[]`, `lessonDays[]`, `holidays[]`, `bonuses[]`). Two purity rules make it testable: (1) inject clock + RNG — engine never calls `Date.now()`/`Math.random()`; (2) randomness in the shell (roll a bonus, append the realized result to `bonuses[]`), determinism in the engine. Falls-out-for-free benefit: the designed "lesson backfill un-breaks a break" is just a replay over amended inputs. Collection unlocks and points.total are *derived*, not stored — persistence surface is tiny.

**No-build maintainability — native ES modules + `node --test`** (both confirmed with user against alternatives). ESM runs in browser (`<script type=module>`, Safari 11+) and Node 23 alike with no bundler/transpile; tests are `node --test` (zero deps; minimal root `package.json` = test script only, framed explicitly as "running tests, not a build"). Pure/impure boundary made physical: `motivation.js` + `theme.js` pure (browser *and* Node); `store.js`/`main.js`/`views/*` impure shell. `detector.js`/`settings.js` left as untouched classic globals (field-tested iOS recovery code — isolate it), read as `window.CelloDetector` by the module code.

**App structure (confirmed): single-page main app + separate gated `parent.html`.** Main loop (Home→Practice→Summary→Collection→Calendar) is one page with in-page view modules (show/hide or tiny hash router) so live session state survives navigation; parent area separate, mirroring the `/settings` precedent. Data flow = tiny unidirectional loop `store → project → render`, action mutates an input → reproject → render. No framework.

**Roadmap — split the UX doc's 3 conceptual phases into 6 implementable, alternating engine→UI increments** (engine-before-UI honors test-first): 0 scaffolding/harness · 1 engine core loop (Played + Missed→break + Momentum + points + collection, pure, tested) · 2 UI core loop (first real app, first deploy, iPhone field-test) · 3 engine day-types & protection (Lesson/Rest/Frozen/Holiday + recovery, tested) · 4 UI protection + parent area + calendar · 5 polish (bonuses, your-usual anchor, gradual recolour). Each phase has scope/out-of-scope/done-criteria; Phase ≥2 ends in a field-test. Per-phase deep specs (`main-app-phase-N.md`, mirroring the `stage-1/stage-2` pattern) written just-in-time before building. Roadmap doc is canonical; phase lists trimmed out of `ux.md §12` and `arch.md §7` to pointers (one source of truth).

**Open alignment note (flagged):** UX §6 defines "your usual" as median of last ~10 *sessions*; architecture supports both per-session (`sessions[]`) and simpler per-day-total medians — going per-session to match UX unless per-day proves steadier. Logged so the docs don't silently diverge.

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
