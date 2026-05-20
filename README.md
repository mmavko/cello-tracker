# Cello Tracker

A personal tool for tracking cello practice time automatically — no manual timer, no discipline required.

## Vision

Open the web app on your phone, tap Start. The app listens to the microphone and analyzes audio in real time. Whenever it detects cello sound, the session timer runs. Whenever you take a break, the timer pauses. At the end, you know exactly how many minutes of actual playing happened — not how long the app was open.

The screen stays on the whole time (Wake Lock API), so you can glance at the timer mid-session without touching anything.

## Status

**HPS-based detection running on iPhone, threshold tuning in progress.** Band-average detection was tested and rejected — no usable threshold existed across all cello registers. Rebuilt with Harmonic Product Spectrum (HPS), which detects the presence of a harmonic series rather than raw energy level.

## Repo Structure

```
sound-analysis/     — the app (single HTML file, no build step)
  index.html        — mic → HPS detection → cello presence signal
  spec.md           — original PoC spec (platform validation)
chronicles.md       — session-by-session log of findings and decisions
```

## The App (`sound-analysis/index.html`)

A single `index.html` with no dependencies or build step. It:

- Requests mic access only on user tap
- Pipes audio through `getUserMedia` → `MediaStreamAudioSourceNode` → `AnalyserNode` (not connected to speaker — no feedback)
- Computes **Harmonic Product Spectrum (HPS)**: multiplies the FFT against downsampled copies of itself at 2×, 3×, 4× — energy survives only where a full harmonic series is present. A cello note produces a sharp spike at the fundamental; voice formants and broadband noise collapse.
- Displays the HPS output as **80 bars on a logarithmic scale (30 Hz – 4 kHz)**. The bar at the detected fundamental lights up white; note name and frequency (e.g. `G2  98 Hz`) shown in the canvas corner.
- Cello-band bars (65–1200 Hz) highlighted; threshold line across the canvas moves with the slider
- Detects cello when the HPS peak in the cello range sustains above threshold for 300ms; stops after 1500ms of silence
- Detection badge flips between "Not detecting" and "Cello detected"; threshold line turns green when active
- Holds a Wake Lock so the screen stays on
- Handles background recovery: if iOS suspends the tab, on return it resumes the `AudioContext` and restarts the mic track if it died

Deployed at **https://cello.mavko.consulting** (Cloudflare Pages, project: `cello-tracker`).

To redeploy after changes:
```
wrangler pages deploy sound-analysis/ --project-name cello-tracker --branch main
```

Note: when adding a custom domain, use the CF dashboard (Pages → project → Custom domains) — the API registers the domain but does not auto-create the CNAME record.

## What's Next

1. **Finish tuning HPS detection** — find the threshold that cleanly separates cello from ambient noise across all registers. Confirm over/under-detection is acceptable.
2. **Practice timer** — wire the timer to the detection signal: timer only increments while cello is detected. Display active practice time prominently.
3. **Session summary** — at stop, show total session time vs. actual practice time.
