# Chronicles
Last updated: 2026-05-30

## Current State
HPS alone is insufficient — voiced speech is harmonic and passes HPS. Designed a two-stage layered detection pipeline (pitch stability + harmonic extent) and documented both stages in `docs/`. Next: hand `docs/stage-1-pitch-stability.md` to a coding agent to implement Stage 1; field-test on iPhone; only build Stage 2 if Stage 1 proves insufficient.

Repo structure: `app/` (the implementation, single HTML file), `docs/` (current technical design — detection pipeline + platform foundations), `chronicles.md` (history), `README.md` (router only — vision, deploy command, repo map).

## Chronicle

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
