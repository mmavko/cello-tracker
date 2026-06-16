# 2026-06-05 — Decoupled monolith into reusable detector + two UI apps

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
