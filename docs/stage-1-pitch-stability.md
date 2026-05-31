# Stage 1 — Pitch stability gate

## Why this gate

The dominant failure mode of HPS-only detection is conversational speech.
Voiced speech is harmonic (it passes HPS), but its f0 **never sits still** —
within every syllable the pitch slides by hundreds of cents. A bowed cello note,
by contrast, holds its center pitch within a few cents for hundreds of
milliseconds (vibrato is a slow ~5 Hz wobble around a stable center, not a
slide).

A stability test on f0 over time is the smallest possible change that exploits
this. It also rejects short transients (door slams, plate clinks that briefly
look harmonic) for free, because they don't last long enough to register as
"stable."

## Algorithm

### Inputs (already computed each frame)
- `peak.freq` — fundamental detected by HPS (`findCelloPeak()` in `index.html`)
- `peak.val` — HPS amplitude at that fundamental
- `dt` — milliseconds since last frame

### Parameters
| Param | Range | Default | Notes |
|---|---|---|---|
| `stabilityToleranceCents` | 20 – 100 | 30 | How far f0 may wander from its running center and still count as "stable." Must accommodate cello vibrato (~±50 cents on heavy vibrato). |
| `stabilityDurationMs` | 50 – 500 | 200 | How long f0 must remain inside the tolerance band before the gate opens. Trade-off: latency vs. transient rejection. Floor lowered to 50 to help catch staccato; the cents tolerance, not duration, does the real speech rejection. |
| `stabilityWindowMs` | (fixed) 500 | — | Lookback window for computing the running center frequency (median of recent f0 samples). Not user-tunable. |

### Data structures
A rolling buffer of `{ timeMs, freq }` samples. Append every frame where
`peak.val > 0`. Drop entries older than `stabilityWindowMs`.

### Per-frame logic (pseudocode)
```
on each frame:
  append { now, peak.freq } to f0History
  drop entries from f0History older than (now - stabilityWindowMs)

  if f0History has fewer than 3 samples:
    stabilityGate = false
    stabilityProgressMs = 0
    return

  centerFreq = median(f0History[*].freq)
  centsFromCenter = 1200 * log2(peak.freq / centerFreq)

  if |centsFromCenter| <= stabilityToleranceCents:
    stabilityProgressMs += dt
    if stabilityProgressMs >= stabilityDurationMs:
      stabilityGate = true
  else:
    stabilityProgressMs = 0
    stabilityGate = false
```

### Why median (not mean) for centerFreq
Median is robust to single-frame f0 estimation errors (HPS occasionally jumps
to a half- or double-octave for one frame). With a 500ms window at 60fps that's
~30 samples — median is cheap.

### Cents, not Hz
Tolerance is expressed in cents (logarithmic) so a single value works across
the whole cello range. ±30 cents at C2 (65 Hz) is ±1.1 Hz; at C5 (523 Hz) it's
±9 Hz. A linear Hz tolerance would be far too tight low and too loose high.

### Integration point
This gate runs after `findCelloPeak()` and before the existing
`peak.val > threshold` debounce check. The current condition:
```js
if (peak.val > threshold) { ... }
```
becomes:
```js
const hpsPass        = peak.val > threshold;
const stabilityPass  = !stabilityEnabled || stabilityGate;
if (hpsPass && stabilityPass) { ... }
```

## UI

### New controls (added to the existing slider row)

```
┌───────────────────────────────────────────────┐
│ ☑ Stability gate                              │
│   Tolerance:   [────●─────]  30 cents         │
│   Duration:    [──●───────]  200 ms           │
└───────────────────────────────────────────────┘
```

- **Stage toggle** — checkbox, label "Stability gate." When off, the gate
  always passes (equivalent to HPS-only behavior).
- **Tolerance slider** — range 20–100, step 5, label suffix " cents."
- **Duration slider** — range 100–500, step 25, label suffix " ms."

All three values persist to `localStorage` (key: `stability.enabled`,
`stability.toleranceCents`, `stability.durationMs`) and are restored on page
load.

### New visualization 1: f0 history strip

A second canvas, ~60px tall, placed directly below the existing spectrum
canvas. Plots the last `stabilityWindowMs` of detected f0 as a connected line.

- **X-axis**: time, oldest-left to newest-right. No labels needed.
- **Y-axis**: log frequency, scoped to the full cello range (65 Hz – 1200 Hz)
  so the line position is meaningful across registers.
- **Tolerance band**: translucent horizontal band centered on the current
  running median, height = ±`stabilityToleranceCents`. Updates each frame.
- **Line color**: green (`#00ff9f`) when current f0 is inside the band, gray
  (`#666`) when outside. This makes it immediately visible whether the gate
  would currently pass.
- **Idle state**: empty strip with the cello-range bounds visible (matches the
  spectrum analyzer's idle style).

### New visualization 2: stability progress bar

A thin horizontal bar (~4px tall) below the f0 strip. Fills left-to-right as
`stabilityProgressMs` accumulates toward `stabilityDurationMs`. Resets to
empty the instant f0 drops outside the tolerance band.

- Empty: `#1a3a28` (dim green)
- Filling: `#00cc7a`
- Full (gate open): `#00ff9f` (bright accent)

This makes the duration parameter legible — the user sees exactly how long they
need to hold a pitch before detection fires.

### New visualization 3: gate status strip

A single text row showing the live pass/fail state of each enabled gate. Sits
between the detection badge and the spectrum canvas.

```
HPS: ●  Stability: ○        ← speech: HPS passes, stability fails
HPS: ●  Stability: ●        ← cello held note: both pass → detection fires
```

- `●` (green) = pass
- `○` (gray) = fail
- Disabled gates are omitted from the row entirely

Without this, debugging a missed detection means staring at three sliders
guessing which one is wrong. With it, the cause is obvious at a glance.

### Layout (full updated screen)

```
┌─────────────────────────────────────┐
│            Cello Tracker            │
│                                     │
│      [ ▶ Start Session ]            │
│                                     │
│ Status: Recording — 00:00:42        │
│                                     │
│ ● Cello detected                    │  ← existing detection badge
│                                     │
│ HPS: ●  Stability: ●                │  ← NEW: gate status strip
│                                     │
│ ┌─────────────────────────────────┐ │
│ │   spectrum analyzer (existing)  │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │   f0 history strip (NEW)        │ │  ← ~60px
│ └─────────────────────────────────┘ │
│ ▰▰▰▰▰▰▰▰▱▱▱▱▱▱▱▱▱▱▱▱   (NEW)        │  ← stability progress bar
│                                     │
│ HPS threshold: [────●──]  15        │  ← existing
│ ☑ Stability gate                    │  ← NEW
│   Tolerance:  [───●───]  30 cents   │  ← NEW
│   Duration:   [──●────]  200 ms     │  ← NEW
│                                     │
│ Wake lock: active 🟢                │
└─────────────────────────────────────┘
```

## Acceptance criteria

Stage 1 is "good enough" if, in a real practice session:
- A held bowed note triggers detection within ~`stabilityDurationMs` of attack.
- Conversational speech in the same room does NOT trigger detection at any
  HPS-passing operating point.
- Vibrato on long notes does not cause stability to drop out (false negatives
  mid-note).
- Tuning is achievable: there exists a `(threshold, tolerance, duration)` combo
  that the user can find within a few minutes of slider experimentation.

If sustained voiced sounds (humming, singing) still slip through after Stage 1,
proceed to Stage 2.

## Out of scope for Stage 1

- Persisting the f0 history across page reloads (the buffer is ephemeral).
- Showing the running median as a separate line — the tolerance band centered
  on it already conveys the same information.
- Adaptive tolerance (widening during clear vibrato) — premature; revisit if
  vibrato false-negatives become an issue in testing.
