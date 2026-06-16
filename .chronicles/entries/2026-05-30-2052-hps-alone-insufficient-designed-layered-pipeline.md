# 2026-05-30 — HPS alone insufficient; designed layered pipeline

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
