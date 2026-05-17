# Audio Wave Monitor — Project Spec

## Overview

A single-page web app that requests microphone access, keeps the screen awake, and
displays live raw audio waveform data as visual proof that the pipeline is working.
Intended as a technical test/demo, not a consumer product.

---

## Deployment

**Recommendation: Cloudflare Pages (free tier)**

- Wake Lock API and `getUserMedia` both require **HTTPS** — local `file://` won't work,
  plain `http://` won't work on mobile.
- Cloudflare Pages gives instant HTTPS on a `*.pages.dev` subdomain with zero config.
- Deploy by pushing a folder to a GitHub repo and connecting it in the Cloudflare dashboard.
- No build step needed — the project is a single `index.html` file.

Alternatives that also work: GitHub Pages, Netlify, Vercel (all free, all HTTPS).

---

## Tech Stack

| Concern | Choice | Reason |
|---|---|---|
| Language | Vanilla JS (ES2020+) | No build step, no dependencies, easiest to audit |
| Styling | Plain CSS with CSS variables | Same reasoning |
| Hosting | Cloudflare Pages | Free, instant HTTPS, drag-and-drop deploy option |
| File count | **1 file** (`index.html`) | Trivially deployable, shareable as a gist |

No frameworks, no bundlers, no `npm install`. The entire project is one HTML file.

---

## Page Layout

```
┌─────────────────────────────────┐
│         Audio Wave Monitor      │  ← page title (h1)
│                                 │
│  [  ▶  START SESSION  ]         │  ← primary button (toggle)
│                                 │
│  Status: Idle                   │  ← status label
│                                 │
│ ┌─────────────────────────────┐ │
│ │                             │ │
│ │     waveform canvas         │ │  ← 100% width, ~200px tall
│ │                             │ │
│ └─────────────────────────────┘ │
│                                 │
│  Wake lock: —                   │  ← secondary status line
└─────────────────────────────────┘
```

Mobile-first, single column, no navigation.

---

## UI Components

### Button
- Single toggle button. Two states:
  - **Idle**: "▶ Start Session" — green/positive color
  - **Active**: "■ Stop Session" — red/stop color
- Disabled briefly during async initialization (prevents double-tap)
- Large tap target (min 48×48px) per mobile UX guidelines

### Status Label
Reflects current app state. Plain text, updated in real time:

| State | Text |
|---|---|
| Initial | `Status: Idle` |
| Requesting mic | `Status: Requesting microphone…` |
| Running | `Status: Recording — 0:00:12` — elapsed timer |
| Wake lock denied | `Status: Recording (screen may dim)` |
| Error | `Status: Error — [message]` |
| Stopped | `Status: Idle` |

### Waveform Canvas
- HTML `<canvas>` element, width = 100% of container, height = 200px
- Redrawn every animation frame via `requestAnimationFrame`
- Displays raw **time-domain** data from `AnalyserNode.getByteTimeDomainData()`
- When idle: flat line at vertical center, muted color
- When active: live oscilloscope-style wave, accent color
- Rendering:
  - Background: dark (e.g. `#0f1117`)
  - Waveform line: single-pixel stroke, bright accent (e.g. `#00ff9f`)
  - `lineWidth: 1.5`, `strokeStyle`, no fill

### Wake Lock Status Line
Secondary line below canvas:
- `Wake lock: active 🟢` — lock held
- `Wake lock: released (tab hidden) 🟡` — auto-released, will re-acquire
- `Wake lock: unavailable 🔴` — API not supported or denied
- `Wake lock: —` — session not started

---

## Mic Permission — Full Flow

This is the most UX-sensitive part. Here's how it should work:

### When to request
Permission is requested **only when the user taps Start**, not on page load.
Requesting on load is considered hostile UX and browsers may auto-block it.

### What the browser does (iOS Safari)
1. User taps Start → JS calls `navigator.mediaDevices.getUserMedia({ audio: true })`
2. Safari shows its native permission prompt: *"[Site] Would Like to Access the Microphone"* — Allow / Don't Allow
3. **If Allow**: promise resolves with a `MediaStream`, session starts normally
4. **If Don't Allow**: promise rejects with `NotAllowedError`
5. **If previously denied**: prompt does not appear — promise rejects immediately with `NotAllowedError`

### Handling each case in code

```js
async function startSession() {
  setStatus('Requesting microphone…');
  disableButton();

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  } catch (err) {
    if (err.name === 'NotAllowedError') {
      setStatus('Error — Microphone access denied. Check browser settings.');
    } else if (err.name === 'NotFoundError') {
      setStatus('Error — No microphone found on this device.');
    } else {
      setStatus(`Error — ${err.message}`);
    }
    enableButton();
    return;
  }

  // continue to AudioContext setup...
}
```

### Denied permission — recovery UX
If the user denies and tries again, show a specific message:
> *"Microphone access was denied. On iOS: Settings → Safari → Microphone → Allow."*

There is no programmatic way to re-prompt — the user must go to Settings.
This message should be visible text on the page, not just a console warning.

### Permission persistence
- iOS Safari: permission is remembered **per site** for the browser session.
  If the user navigates away and returns, they may be re-prompted (Safari is conservative).
- HTTPS is required — on HTTP the `getUserMedia` call will throw immediately.

---

## Audio Pipeline

```
getUserMedia (mic)
    └─→ MediaStreamAudioSourceNode
            └─→ AnalyserNode  (fftSize: 2048, no smoothing)
                    └─→ NOT connected to AudioContext.destination
                        (we're analyzing only, not playing back — avoids feedback)
```

### Key settings
```js
const analyser = audioCtx.createAnalyser();
analyser.fftSize = 2048;           // 1024 time-domain samples
analyser.smoothingTimeConstant = 0; // raw data, no smoothing
```

`fftSize: 2048` gives `frequencyBinCount = 1024` samples — enough resolution to draw
a clear wave across a mobile screen width without being heavy.

**Do NOT connect to `destination`** — this would feed mic audio back through the
speaker and cause echo/feedback. The analyser is a read-only tap on the signal.

---

## Wake Lock Integration

```js
let wakeLock = null;

async function requestWakeLock() {
  if (!('wakeLock' in navigator)) {
    updateWakeLockStatus('unavailable');
    return;
  }
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    updateWakeLockStatus('active');
    wakeLock.addEventListener('release', () => updateWakeLockStatus('released'));
  } catch (err) {
    updateWakeLockStatus('unavailable'); // low battery, user prefs, etc.
  }
}

// Re-acquire when user returns to the tab
document.addEventListener('visibilitychange', async () => {
  if (isSessionActive && document.visibilityState === 'visible') {
    await requestWakeLock();
  }
});
```

Acquire wake lock **after** mic permission is granted (not before — no point locking
the screen before the session is confirmed running).

---

## Session Lifecycle

```
IDLE
  │
  ├─ tap Start
  │     │
  │     ├─ request mic → denied → IDLE (show error)
  │     │
  │     └─ mic granted
  │           ├─ create AudioContext
  │           ├─ connect analyser
  │           ├─ request wake lock
  │           ├─ start rAF loop
  │           └─ RECORDING
  │
RECORDING
  │
  ├─ tab hidden → wake lock auto-released (rAF loop pauses automatically)
  ├─ tab visible → re-acquire wake lock, rAF resumes
  │
  └─ tap Stop
        ├─ cancel rAF loop
        ├─ release wake lock
        ├─ stop all mic tracks: stream.getTracks().forEach(t => t.stop())
        ├─ close AudioContext
        └─ IDLE
```

Always call `stream.getTracks().forEach(t => t.stop())` on stop — this kills the
red recording indicator dot in the iOS status bar.

---

## Background Recovery

When the user leaves Safari for an extended period (phone call, other apps), iOS
suspends the browser process. On return, three things may be in a broken state:
the `AudioContext`, the mic `MediaStream` track, and the Wake Lock. Each needs
independent recovery.

### What iOS Does During Suspension

- `AudioContext` is suspended — its `state` becomes `"suspended"`
- The mic `MediaStreamTrack` may be `"live"` or `"ended"` depending on duration
  and what iOS prioritized (a phone call always kills it; a short app switch may not)
- Wake Lock is released
- `requestAnimationFrame` is paused — resumes automatically, nothing to handle

There is no way to detect *how long* the app was suspended. Treat every return
from background as a potential full-interruption.

### Recovery Flow

```
visibilitychange → 'visible'
        │
        ├─ session not active? → exit (nothing to recover)
        │
        ├─ 1. set status: "Reconnecting…"
        │
        ├─ 2. resume AudioContext if suspended
        │         audioCtx.state === 'suspended' → audioCtx.resume()
        │
        ├─ 3. check mic track
        │         track.readyState === 'live'   → ok, continue
        │         track.readyState === 'ended'  → restart mic stream
        │                 │
        │                 ├─ getUserMedia() → granted → swap source node
        │                 └─ getUserMedia() → denied  → FAILED state
        │
        ├─ 4. re-acquire wake lock
        │
        └─ 5. set status back to "Recording — MM:SS"
```

### Implementation

```js
let isRecovering = false;

document.addEventListener('visibilitychange', async () => {
  if (!isSessionActive || document.visibilityState !== 'visible') return;
  if (isRecovering) return; // prevent overlapping recovery attempts
  await recoverSession();
});

async function recoverSession() {
  isRecovering = true;
  setStatus('Reconnecting…');

  try {
    // Step 1 — resume AudioContext
    if (audioCtx.state === 'suspended') {
      await audioCtx.resume();
    }

    // Step 2 — check mic track
    const track = stream.getAudioTracks()[0];
    if (!track || track.readyState === 'ended') {
      await restartMicStream();  // may throw if denied
    }

    // Step 3 — re-acquire wake lock
    await requestWakeLock();

    setStatus(`Recording — ${formatElapsed(Date.now() - sessionStart)}`);

  } catch (err) {
    // Unrecoverable — mic permission denied after interruption,
    // or AudioContext failed to resume
    handleUnrecoverableError(err);
  } finally {
    isRecovering = false;
  }
}
```

### Restarting the Mic Stream

When the track is dead, tear down just the source node and reconnect —
don't rebuild the entire AudioContext. This preserves the analyser and
the rAF loop without interruption.

```js
async function restartMicStream() {
  // Stop dead tracks cleanly
  if (stream) stream.getTracks().forEach(t => t.stop());

  // Re-request mic — may show iOS permission prompt
  stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

  // Disconnect old source, connect new one — analyser stays intact
  if (sourceNode) sourceNode.disconnect();
  sourceNode = audioCtx.createMediaStreamSource(stream);
  sourceNode.connect(analyser);
}
```

### Unrecoverable Error State

If `getUserMedia` throws `NotAllowedError` during recovery (user denied the
re-prompt, or iOS auto-denied), the session cannot continue silently.

```js
function handleUnrecoverableError(err) {
  isSessionActive = false;
  stopRafLoop();
  releaseWakeLock();

  if (err.name === 'NotAllowedError') {
    setStatus('Microphone access lost — session ended. Tap Start to try again.');
  } else {
    setStatus(`Session interrupted — ${err.message}. Tap Start to try again.`);
  }

  resetButtonToIdle();
  drawFlatline(); // show flatline on canvas to make the stopped state obvious
}
```

### Elapsed Timer During Recovery

Do **not** pause or reset the elapsed timer during recovery. The session was
logically running the whole time — the interruption was a technical event, not
a user action. The timer should continue from where it left off as soon as
recovery completes.

```js
// sessionStart was set at session begin and never touched during recovery
setStatus(`Recording — ${formatElapsed(Date.now() - sessionStart)}`);
```

### Status Labels During Recovery

| Moment | Status text |
|---|---|
| `visibilitychange` fires | `Reconnecting…` |
| Mic track dead, re-requesting | `Reconnecting — requesting microphone…` |
| Recovery succeeded | `Recording — MM:SS` (timer continues) |
| Mic denied on re-prompt | `Microphone access lost — session ended. Tap Start to try again.` |
| Other failure | `Session interrupted — [reason]. Tap Start to try again.` |

### Edge Case: Multiple Rapid Switches

If the user switches in and out of the app quickly, `visibilitychange` can fire
multiple times before recovery completes. The `isRecovering` flag prevents
overlapping recovery attempts. A second `visible` event while recovering is
ignored — the in-progress recovery handles it.

---

## Elapsed Timer

A simple elapsed time counter shown in the status label during recording.

```js
let sessionStart = null;

function formatElapsed(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

// Inside rAF loop:
setStatus(`Recording — ${formatElapsed(Date.now() - sessionStart)}`);
```

---

## Canvas Rendering Loop

```js
const bufferLength = analyser.frequencyBinCount; // 1024
const dataArray = new Uint8Array(bufferLength);
let rafId = null;

function draw() {
  rafId = requestAnimationFrame(draw);
  analyser.getByteTimeDomainData(dataArray);

  const W = canvas.width;
  const H = canvas.height;
  ctx.fillStyle = '#0f1117';
  ctx.fillRect(0, 0, W, H);

  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#00ff9f';
  ctx.beginPath();

  const sliceWidth = W / bufferLength;
  let x = 0;
  for (let i = 0; i < bufferLength; i++) {
    const v = dataArray[i] / 128.0; // normalize to 0.0–2.0
    const y = (v / 2) * H;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    x += sliceWidth;
  }
  ctx.lineTo(W, H / 2);
  ctx.stroke();
}
```

Canvas must be resized to its actual pixel width on start and on `window.resize`
to avoid blurry rendering:
```js
canvas.width = canvas.offsetWidth * window.devicePixelRatio;
canvas.height = canvas.offsetHeight * window.devicePixelRatio;
ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
```

---

## Error States to Handle

| Error | Cause | User-facing message |
|---|---|---|
| `NotAllowedError` | Mic denied | "Microphone access denied. Check Safari settings." |
| `NotFoundError` | No mic hardware | "No microphone detected on this device." |
| `AudioContext` fails | Old browser | "Web Audio not supported in this browser." |
| HTTPS missing | Served over HTTP | Both APIs silently fail — show "HTTPS required" on load if `location.protocol !== 'https:'` |
| Wake lock denied | Low battery etc. | Non-fatal — log to wake lock status label only |

---

## Browser Compatibility Target

| Browser | Works? | Notes |
|---|---|---|
| Safari iOS 18.4+ | ✅ Full | Wake lock + mic both work |
| Safari iOS 16.4–18.3 | ⚠️ Partial | Mic works, wake lock absent in PWA mode; fine in browser |
| Safari iOS < 16.4 | ⚠️ Mic only | No wake lock; screen may dim after ~30s |
| Chrome Android | ✅ Full | Has worked since Chrome 84 |
| Desktop Safari/Chrome | ✅ Full | |
| Firefox | ✅ Full | Wake lock since Firefox 126 |

---

## File Structure

```
index.html        ← entire project
```

Suggested internal structure of `index.html`:
```
<head>
  <meta> tags (viewport, charset, theme-color)
  <style> ... all CSS ... </style>
</head>
<body>
  ... markup ...
  <script> ... all JS ... </script>
</body>
```

`theme-color` meta tag sets the iOS Safari toolbar color — a small but polished touch.

---

## Deployment Steps (Cloudflare Pages)

1. Create a free account at cloudflare.com
2. Go to **Pages → Create a project → Upload assets**
3. Drag and drop the `index.html` file
4. Cloudflare assigns a URL: `https://your-project.pages.dev`
5. Open that URL on iPhone → tap Start → done

No Git, no CLI, no build step required for the drag-and-drop path.

---

## What "Success" Looks Like

- Page loads on iPhone Safari over HTTPS
- Tap Start → mic permission prompt appears
- Allow → status changes to "Recording — 00:00:01…"
- Wake lock status shows "active 🟢"
- Canvas shows a live oscilloscope wave that reacts to sound
- Phone screen stays on indefinitely
- Tap Stop → mic dot disappears from status bar, canvas flatlines, screen lock resumes
