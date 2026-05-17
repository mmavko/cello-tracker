# Chronicles
Last updated: 2026-05-17

## Current State
Detection layer built, pending real-device validation. `sound-analysis/index.html` now runs FFT-based cello detection with a spectrum analyzer UI. Next: test on iPhone — tune threshold slider during real practice, check for over/under-detection, then wire the practice timer to the detection signal.

## Chronicle

### 2026-05-17 — Cello detection layer designed and built

**Question:** How to detect cello sound reliably using only a phone mic, and what should the detection UI look like for tuning on the device?

**Detection approach settled:** Use `getByteFrequencyData()` (FFT) instead of time-domain data. Cello fundamentals live in 65–1200 Hz; average FFT magnitude across that band each frame. Compare average to a threshold. Time-based debounce: 300ms attack (sustained above threshold before detection fires), 1500ms release (sustained silence before detection stops) — frame-rate independent via `performance.now()` deltas.

**Key decisions:**
- *Average across band, not any/all bars* — single noise spikes dilute against silent bars; genuine cello playing lights up multiple bars (fundamental + harmonics). Known weakness: soft passages may under-detect if only a few bars respond.
- *No adaptive noise floor for now* — the visualization serves as the calibration tool; user watches bars in silence, drags threshold above noise floor. Explicit calibration phase would add friction without clear benefit at this stage.
- *Live vs. recorded cello not distinguished* — acoustically indistinguishable from phone mic alone (would need harmonic structure analysis). Acceptable for personal use: if you stop and talk, timer pauses after 1.5s release. Not a product problem.
- *Human voice overlaps the cello band* — fundamentals 80–1000 Hz. Accepted limitation; solo practice room assumption means voice isn't a practical trigger.

**UI:** Oscilloscope replaced with 80-bar log-scale spectrum analyzer (30 Hz – 8 kHz). Cello-band bars highlighted. Dashed threshold line across canvas — gray normally, turns green when detection is active. Threshold slider moves the line live. Detection badge ("Not detecting" / "Cello detected") below the button.

**Next resolved to:** iPhone validation — tune threshold in a real session, assess over/under-detection, then build practice timer on top of the detection signal.

### 2026-05-17 — PoC built, deployed, and validated on iPhone

**Question:** Would Wake Lock API and Web Audio API actually work on iOS Safari — worth building the full tracker at all?

Built `sound-analysis/index.html` — single-file, no dependencies. Pipeline: `getUserMedia` → `MediaStreamAudioSourceNode` → `AnalyserNode` (not connected to destination — analysis only, no feedback). Features: mic request on tap only, oscilloscope canvas, Wake Lock with visibility-change re-acquisition, full background recovery (AudioContext resume + dead mic track restart on return from suspension), HTTPS guard. Deployed to `https://cello.mavko.consulting` via Cloudflare Pages (`wrangler pages deploy`). CF custom domain: API registers domain but does not auto-create CNAME — dashboard does both; use dashboard.

**Result:** 3-min live iPhone session — waveform active, screen on throughout, locked normally after stop. Both APIs confirmed. No blockers. Cleared to build real tracker.

**Next resolved to:** cello detection layer.
