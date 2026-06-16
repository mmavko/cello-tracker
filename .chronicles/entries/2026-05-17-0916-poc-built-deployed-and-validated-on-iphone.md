# 2026-05-17 — PoC built, deployed, and validated on iPhone

**Question:** Would Wake Lock API and Web Audio API actually work on iOS Safari — worth building the full tracker at all?

Built `sound-analysis/index.html` — single-file, no dependencies. Pipeline: `getUserMedia` → `MediaStreamAudioSourceNode` → `AnalyserNode` (not connected to destination — analysis only, no feedback). Features: mic request on tap only, oscilloscope canvas, Wake Lock with visibility-change re-acquisition, full background recovery (AudioContext resume + dead mic track restart on return from suspension), HTTPS guard. Deployed to `https://cello.mavko.consulting` via Cloudflare Pages (`wrangler pages deploy`). CF custom domain: API registers domain but does not auto-create CNAME — dashboard does both; use dashboard.

**Result:** 3-min live iPhone session — waveform active, screen on throughout, locked normally after stop. Both APIs confirmed. No blockers. Cleared to build real tracker.

**Next resolved to:** cello detection layer.
