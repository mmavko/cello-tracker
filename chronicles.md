# Chronicles
Last updated: 2026-05-17

## Current State
PoC validated on real iPhone. Both critical unknowns confirmed working: Wake Lock API keeps screen on, Web Audio pipeline delivers live waveform. Next step: design and implement cello detection logic (frequency filtering + volume thresholding) as the foundation for the real tracker app.

## Chronicle

### 2026-05-17 — PoC built, deployed, and validated on iPhone

**Goal:** Verify that Wake Lock API and Web Audio API work on iOS Safari before investing in the full tracker.

**Built:** `sound-analysis/index.html` — a single-file vanilla JS app with no dependencies. Implements: mic permission request on tap, `getUserMedia` → `AnalyserNode` pipeline (no playback, analysis only), oscilloscope canvas, Wake Lock with visibility-change re-acquisition, full background recovery (AudioContext resume + dead mic track restart), elapsed timer, and HTTPS guard.

**Deployed to:** `https://cello.mavko.consulting` via Cloudflare Pages (project: `cello-tracker`). Deployed with `wrangler pages deploy`. Custom domain added via CF dashboard — API approach (`POST /accounts/.../domains`) registered the domain but did not auto-create the CNAME; dashboard did both atomically.

**Validation result:** 3-minute live session on iPhone — waveform active, screen stayed on throughout, dimmed and locked normally after stop. Both Wake Lock and Web Audio confirmed working on iOS Safari.

**Open question going in:** Whether iOS Safari would honor Wake Lock and allow persistent mic access. Both confirmed — no surprises.

**Next:** Cello detection layer — frequency range filtering, amplitude thresholding, timer that only runs when cello sound is detected.
