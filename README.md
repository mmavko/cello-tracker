# Cello Tracker

A personal tool for tracking cello practice time automatically — no manual timer, no discipline required. Open the web app on your phone, tap Start, play. The app listens via the mic and runs a timer only while it detects cello sound. The screen stays on (Wake Lock API) so the elapsed time is always glanceable.

## Repo map

```
app/                     — the app (static files, no build step)
  index.html             — main app at "/" — start/stop a session, count playing time
  settings.html          — tuning UI at "/settings" — detection params + live visualizations
  detector.js            — CelloDetector: mic + DSP + detection loop, shared by both pages
  settings.js            — SettingsStore: detection-param defaults + localStorage load/save
docs/                    — current technical design (detection, platform patterns)
chronicles.md            — history: decisions, what was tried, what was killed
```

Architecture: `detector.js` is a DOM/storage-agnostic detection module emitting results
via `onFrame` / `onDetectionChange` / `onStatus`. `settings.html` writes detection params
through `SettingsStore`; `index.html` reads them to seed the detector and stores its own
play-session log under `cello.sessions`.

For current status, what's being worked on next, and the reasoning behind any design choice, read `chronicles.md` — it's the project's memory.

For implementation reference (detection pipeline algorithms, UI specs, mic / wake-lock / background-recovery patterns), see `docs/`.

## Deploy

Live at **https://cello.mavko.consulting** (Cloudflare Pages, project `cello-tracker`).

```
wrangler pages deploy app/ --project-name cello-tracker --branch main
```

When adding a custom domain to a Cloudflare Pages project, use the dashboard (Pages → project → Custom domains) — the API registers the domain but does not auto-create the CNAME record.
