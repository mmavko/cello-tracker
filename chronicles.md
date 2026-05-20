# Chronicles
Last updated: 2026-05-20

## Current State
HPS-based detection built and running on iPhone. Initial test shows threshold needs to be higher than originally expected — slider range extended to 200. Tuning in progress. Next: finish tuning threshold in a real practice session; if detection quality is acceptable, wire the practice timer.

## Chronicle

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
