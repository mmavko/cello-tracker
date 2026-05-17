# Cello Tracker

A personal tool for tracking cello practice time automatically — no manual timer, no discipline required.

## Vision

Open the web app on your phone, tap Start. The app listens to the microphone and analyzes audio in real time. Whenever it detects cello sound, the session timer runs. Whenever you take a break, the timer pauses. At the end, you know exactly how many minutes of actual playing happened — not how long the app was open.

The screen stays on the whole time (Wake Lock API), so you can glance at the timer mid-session without touching anything.

## Status

**PoC validated.** The two technical unknowns — Wake Lock and continuous mic access on iOS Safari — are both confirmed working. A 3-minute live test on iPhone showed the waveform responding to sound and the screen staying on throughout, then locking normally after Stop.

The cello detection logic (frequency filtering, amplitude thresholding) has not been built yet. That is the next step.

## Repo Structure

```
sound-analysis/     — technical PoC (single HTML file)
  spec.md           — detailed spec for the PoC
  index.html        — the built app: mic → waveform → wake lock
chronicles.md       — session-by-session log of findings and decisions
```

## The PoC (`sound-analysis/`)

A single `index.html` with no dependencies or build step. It:

- Requests mic access only on user tap (not on load — browsers block that)
- Pipes audio through `getUserMedia` → `MediaStreamAudioSourceNode` → `AnalyserNode`, deliberately **not** connected to the speaker (no feedback)
- Draws a live oscilloscope waveform on a canvas
- Holds a Wake Lock so the screen stays on
- Handles background recovery: if iOS suspends the tab (phone call, app switch), on return it resumes the `AudioContext` and restarts the mic track if it died
- Shows the iOS-specific mic denial recovery instructions if permission is blocked

Deployed at **https://cello.mavko.consulting** (Cloudflare Pages, project: `cello-tracker`).

To redeploy after changes:
```
wrangler pages deploy sound-analysis/ --project-name cello-tracker --branch main
```

Note: when adding a custom domain, use the CF dashboard (Pages → project → Custom domains) — the API registers the domain but does not auto-create the CNAME record.

## What's Next

1. **Cello detection** — filter the audio signal by cello's frequency range (~65–1000 Hz fundamental + overtones), apply an amplitude threshold to distinguish playing from ambient noise, and drive the session timer from that signal rather than from simple elapsed time.
2. **Real tracker app** — once detection is reliable, build the actual UI: a clean timer display, session history, maybe a simple chart. The deployment setup will change at that point.
