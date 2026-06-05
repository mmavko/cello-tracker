# Platform foundations

The mic, audio, and screen-wake patterns that keep this app running reliably
on iOS Safari. Extracted from the original PoC spec — these patterns remain
authoritative. Don't change them without testing on a real iPhone first,
because most of them exist because something silently broke on iPhone first.

**Where they live now.** The audio pipeline, wake lock, background recovery,
and session teardown are encapsulated in the `CelloDetector` class
(`app/detector.js`); it surfaces state to the page through an `onStatus`
callback (`{kind:'wakelock', state}`, `{kind:'reconnecting'}`,
`{kind:'error', error}`, …) instead of touching the DOM directly. The HTTPS
guard and canvas hi-DPI sizing live in the consuming pages (`index.html`,
`settings.html`). The code samples below show the underlying patterns; the
sequence is unchanged, only relocated into the class and its callbacks.

---

## HTTPS guard

Wake Lock API and `getUserMedia` both require HTTPS. Local `file://` won't
work; plain `http://` on mobile won't work either. Show a visible warning if
the page is loaded over HTTP and `hostname !== 'localhost'`.

---

## Mic permission flow

### When to request
Request mic only on user tap, never on page load. Requesting on load is
hostile UX and browsers may auto-block.

### What can go wrong
| Error | Cause | User-facing message |
|---|---|---|
| `NotAllowedError` | User denied, or previously denied | "Microphone access denied. Check Safari settings." |
| `NotFoundError` | No mic hardware | "No microphone detected on this device." |

### Denied permission — recovery UX
If denied, there's no programmatic way to re-prompt — the user must change
the setting. Show specific instructions on the page (not just console):
> *"Microphone access was denied. On iOS: Settings → Safari → Microphone → Allow."*

### Permission persistence
iOS Safari remembers permission **per site for the browser session**.
Navigating away and returning may re-prompt — Safari is conservative.

---

## Audio pipeline

```
getUserMedia (mic)
    └─→ MediaStreamAudioSourceNode
            └─→ AnalyserNode  (fftSize: 4096, light smoothing 0.35)
                    └─→ NOT connected to AudioContext.destination
                        (analysis only, no playback → no feedback)
```

Key settings:
```js
const analyser = audioCtx.createAnalyser();
analyser.fftSize = 4096;            // bumped from 2048 for better low-freq
                                    // resolution (~10.8 Hz/bin at 48 kHz)
analyser.smoothingTimeConstant = 0.35; // light smoothing — denoises the
                                       // spectrum without masking short-note
                                       // attacks. Higher values (e.g. 0.75)
                                       // impose a ~130ms amplitude rise time
                                       // that makes staccato notes undetectable.
```

**Do NOT connect to `destination`.** That would feed mic audio through the
speaker and cause feedback. The analyser is a read-only tap on the signal.

---

## Wake Lock

Acquire **after** mic permission is granted (no point locking the screen
before the session is confirmed running).

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

document.addEventListener('visibilitychange', async () => {
  if (isSessionActive && document.visibilityState === 'visible') {
    await requestWakeLock();
  }
});
```

Wake lock is auto-released when the tab goes hidden — re-acquire on return.

---

## Background recovery

When iOS suspends the browser (phone call, other apps, long backgrounding),
three things may be broken on return. Each needs independent recovery.

### What iOS does during suspension
- `AudioContext.state` → `"suspended"`
- Mic `MediaStreamTrack.readyState` may become `"ended"` (a phone call always
  kills it; a short app switch may not)
- Wake Lock is released
- `requestAnimationFrame` is paused — resumes automatically, nothing to do

There's no way to detect *how long* the app was suspended. Treat every return
from background as a potential full-interruption.

### Recovery flow

```
visibilitychange → 'visible'
        │
        ├─ session not active? → exit
        │
        ├─ 1. set status: "Reconnecting…"
        ├─ 2. audioCtx.state === 'suspended' → audioCtx.resume()
        ├─ 3. track.readyState === 'ended'   → restart mic stream
        │         └─ getUserMedia denied? → unrecoverable
        ├─ 4. re-acquire wake lock
        └─ 5. restore "Recording — MM:SS" status (timer was never paused)
```

### Implementation pattern

```js
let isRecovering = false;

document.addEventListener('visibilitychange', async () => {
  if (!isSessionActive || document.visibilityState !== 'visible') return;
  if (isRecovering) return; // prevent overlapping recovery
  await recoverSession();
});

async function recoverSession() {
  isRecovering = true;
  setStatus('Reconnecting…');
  try {
    if (audioCtx.state === 'suspended') await audioCtx.resume();

    const track = stream.getAudioTracks()[0];
    if (!track || track.readyState === 'ended') {
      await restartMicStream();  // may throw if denied
    }

    await requestWakeLock();
    setStatus(`Recording — ${formatElapsed(Date.now() - sessionStart)}`);
  } catch (err) {
    handleUnrecoverableError(err);
  } finally {
    isRecovering = false;
  }
}
```

### Restarting the mic stream
Tear down just the source node, don't rebuild the AudioContext — the analyser
and rAF loop stay intact:

```js
async function restartMicStream() {
  if (stream) stream.getTracks().forEach(t => t.stop());
  stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  if (sourceNode) sourceNode.disconnect();
  sourceNode = audioCtx.createMediaStreamSource(stream);
  sourceNode.connect(analyser);
}
```

### Unrecoverable error
If `getUserMedia` throws during recovery, the session ends. Stop the rAF
loop, release the wake lock, show a clear message ("Microphone access lost —
session ended. Tap Start to try again."), reset button to idle, draw a
flatline so the stopped state is obvious.

### Elapsed timer during recovery
**Do not pause or reset.** The session was logically running the whole time —
the interruption was technical, not user-initiated. Continue from where it
left off.

### Edge case: rapid app switches
If the user switches in and out quickly, `visibilitychange` can fire multiple
times before recovery completes. The `isRecovering` flag prevents overlapping
attempts.

---

## Session teardown

Always call `stream.getTracks().forEach(t => t.stop())` on Stop. This kills
the red recording indicator dot in the iOS status bar.

---

## Canvas hi-DPI rendering

Canvases must be sized to actual pixel width on start and on `window.resize`
to avoid blurry rendering on Retina displays:

```js
canvas.width  = canvas.offsetWidth  * window.devicePixelRatio;
canvas.height = canvas.offsetHeight * window.devicePixelRatio;
ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
```

---

## Browser compatibility

| Browser | Status | Notes |
|---|---|---|
| Safari iOS 18.4+ | ✅ Full | Wake lock + mic both work |
| Safari iOS 16.4–18.3 | ⚠️ Partial | Mic works; wake lock absent in PWA mode, fine in browser |
| Safari iOS < 16.4 | ⚠️ Mic only | No wake lock; screen may dim after ~30s |
| Chrome Android | ✅ Full | Wake lock since Chrome 84 |
| Desktop Safari/Chrome | ✅ Full | |
| Firefox | ✅ Full | Wake lock since Firefox 126 |
