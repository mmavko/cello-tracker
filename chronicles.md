# Chronicles
Last updated: 2026-06-05

## Current State
App split into three decoupled modules (see 2026-06-05 entry) and deployed: main app at `/`, tuning UI at `/settings`, sharing `detector.js` + `settings.js`. Field-tested working on iPhone. The main app is intentionally **trivial** — start/stop + a playing-time counter + a localStorage session log — a placeholder while the detection module gets its real home. Detection quality itself is unchanged by the refactor (pure extraction); the open detection questions from before still stand: confirm the staccato latency fix holds and that the `(threshold, tolerance, duration)` operating point rejects conversational speech, with Stage 2 (harmonic extent) held in reserve for sustained voiced sounds. Next build work is on the real main app (session history, daily totals, goals) now that the detector is reusable.

Repo structure: `app/` (4 static files — `index.html` main app, `settings.html` tuning UI, `detector.js` detection module, `settings.js` param store; no build step), `docs/` (current technical design — detection pipeline + platform foundations), `chronicles.md` (history), `README.md` (router only — vision, deploy command, repo map).

## Chronicle

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
