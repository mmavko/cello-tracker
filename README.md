# Cello Tracker

A personal tool for tracking cello practice time automatically — no manual timer, no discipline required.

## Vision

Open the web app on your phone, tap Start. The app listens to the microphone and analyzes audio in real time. Whenever it detects cello sound, the session timer runs. Whenever you take a break, the timer pauses. At the end, you know exactly how many minutes of actual playing happened — not how long the app was open.

The screen stays on the whole time (Wake Lock API), so you can glance at the timer mid-session without touching anything.

## Status

**Detection layer built, pending real-device testing.** The oscilloscope PoC has been replaced with a spectrum analyzer and cello detection logic. Next: validate detection quality on iPhone, then build the practice timer on top.

## Repo Structure

```
sound-analysis/     — the app (single HTML file, no build step)
  index.html        — mic → FFT spectrum → cello detection
  spec.md           — original PoC spec (platform validation)
chronicles.md       — session-by-session log of findings and decisions
```

## The App (`sound-analysis/index.html`)

A single `index.html` with no dependencies or build step. It:

- Requests mic access only on user tap
- Pipes audio through `getUserMedia` → `MediaStreamAudioSourceNode` → `AnalyserNode` (not connected to speaker — no feedback)
- Runs FFT analysis and displays a **spectrum analyzer**: 80 bars on a logarithmic frequency scale (30 Hz – 8 kHz)
- Highlights the **cello band** (65–1200 Hz) in a distinct color — only those bars feed the detection signal
- Draws a **threshold line** across the canvas; a slider moves it in real time
- Detects cello when the average energy across cello-band bars sustains above the threshold for 300ms; stops detecting after 1500ms of sustained silence
- Detection badge flips between "Not detecting" and "Cello detected"; threshold line turns green when detection is active
- Holds a Wake Lock so the screen stays on
- Handles background recovery: if iOS suspends the tab, on return it resumes the `AudioContext` and restarts the mic track if it died

Deployed at **https://cello.mavko.consulting** (Cloudflare Pages, project: `cello-tracker`).

To redeploy after changes:
```
wrangler pages deploy sound-analysis/ --project-name cello-tracker --branch main
```

Note: when adding a custom domain, use the CF dashboard (Pages → project → Custom domains) — the API registers the domain but does not auto-create the CNAME record.

## What's Next

1. **Validate detection on iPhone** — tune the threshold slider during a real practice session; check for over-detection (ambient noise triggering) and under-detection (soft passages not triggering). Adjust attack/release timing or switch from average to a different aggregation if needed.
2. **Practice timer** — once detection is reliable, wire the timer to the detection signal: timer only increments while cello is detected. Display active practice time prominently.
3. **Session summary** — at stop, show total session time vs. actual practice time.
