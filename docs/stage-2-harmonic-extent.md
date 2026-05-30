# Stage 2 — Harmonic extent gate

> **Build this only if Stage 1 (pitch stability) proves insufficient in field
> testing.** Stage 1 should handle the dominant failure mode (conversational
> speech). Stage 2 targets the harder case: *sustained* voiced sounds that
> hold pitch steady enough to pass the stability gate — humming, singing in the
> next room, a TV voiceover.

## Why this gate

Voice and cello differ in how *many* harmonics carry meaningful energy. A
bowed cello note typically has 8–12+ harmonics extending cleanly to 6–10 kHz —
the bridge resonance and string overtones light up a wide spectrum. Voiced
speech rolls off much faster: typically 3–5 harmonics, with energy dying past
3–4 kHz.

This gate counts how many harmonics of the detected f0 are actually present
above a per-harmonic threshold. A high count means cello-like; a low count
means voice-like.

This is **more selective than spectral flatness** because it only counts
energy at *expected harmonic positions* tied to the detected pitch. Broadband
noise in the high frequencies (sibilance, fan hum, plate clatter) doesn't fool
it the way it would a generic flatness ratio.

## Algorithm

### Inputs (already computed each frame)
- `freqData` — raw FFT magnitudes (Uint8Array, 0–255)
- `peak.freq` — detected fundamental from HPS
- `binWidth` — `audioCtx.sampleRate / analyser.fftSize`

### Parameters
| Param | Range | Default | Notes |
|---|---|---|---|
| `harmonicMinCount` | 2 – 12 | 6 | How many harmonics must be present to pass the gate. |
| `harmonicAmpThresholdPct` | 5 – 50 | 15 | Per-harmonic amplitude threshold as % of the fundamental's amplitude. Relative so it works across registers. |
| `harmonicMaxFreqHz` | (fixed) 8000 | — | Don't count harmonics beyond this — phone mic response and ambient noise dominate. Not user-tunable. |

### Per-frame logic (pseudocode)
```
on each frame (after computeHPS, after findCelloPeak):
  if peak.val == 0:
    harmonicCount = 0
    extentGate = false
    return

  f0       = peak.freq
  f0Bin    = round(f0 / binWidth)
  f0Amp    = freqData[f0Bin]
  ampFloor = f0Amp * (harmonicAmpThresholdPct / 100)
  maxN     = floor(harmonicMaxFreqHz / f0)

  count = 1                            // count the fundamental itself
  presentHarmonics = [1]               // for UI tick coloring
  for n in 2..maxN:
    binN = round(n * f0 / binWidth)
    if binN >= freqData.length:
      break
    if freqData[binN] >= ampFloor:
      count++
      presentHarmonics.push(n)

  harmonicCount     = count
  extentGate        = count >= harmonicMinCount
```

### Why amplitude-relative threshold
Absolute thresholds break across registers: a quiet high cello note has a
quiet fundamental and quiet harmonics, but their *ratio* is preserved. Using
a % of f0's amplitude makes the gate amplitude-invariant.

### Why a bin lookup, not bin averaging
We want a tight test: is there a peak *at this exact harmonic position*?
Averaging neighboring bins would smear in noise. A single-bin lookup is
sharper. FFT bin width at 4096 / 48 kHz is ~11.7 Hz — narrow enough that the
harmonic should fall in or adjacent to one bin. If field testing shows we're
missing harmonics due to bin alignment, expand to "max of binN-1, binN,
binN+1."

### Integration point
Layers on top of Stage 1, ANDed with the other gates:
```js
const hpsPass        = peak.val > threshold;
const stabilityPass  = !stabilityEnabled || stabilityGate;
const extentPass     = !extentEnabled    || extentGate;
if (hpsPass && stabilityPass && extentPass) { ... }
```

## UI

### New controls (added below the Stage 1 controls)

```
┌──────────────────────────────────────────────────┐
│ ☑ Harmonic extent gate                           │
│   Min harmonics:    [───●──]  6                  │
│   Per-harmonic amp: [──●───]  15 %               │
└──────────────────────────────────────────────────┘
```

- **Stage toggle** — checkbox, label "Harmonic extent gate." When off, gate
  always passes.
- **Min harmonic count slider** — range 2–12, step 1.
- **Per-harmonic amplitude slider** — range 5–50, step 1, label suffix " %".

Persist to `localStorage` as `extent.enabled`, `extent.minCount`,
`extent.ampThresholdPct`.

### New visualization 1: harmonic tick overlay on spectrum

On the **existing** spectrum analyzer canvas, draw vertical tick marks at the
positions of each expected harmonic of the current `peak.freq`:

- Tick at `2·f0`, `3·f0`, …, up to `harmonicMaxFreqHz` or Nyquist.
- Tick that crosses the amplitude floor: green (`#00ff9f`), 2px wide.
- Tick that does NOT cross: dim gray (`#444`), 1px wide.
- Each tick spans the full height of the canvas (or a short stub at the top
  if a full-height line would clutter the bars — designer call).

This is the critical visualization: the user can immediately see "I expect
harmonics here, here, here, and here — but only the first three are above the
floor, so the gate fails."

### New visualization 2: count readout

A small text readout in the spectrum canvas corner (opposite corner from the
existing note/freq label):

```
harmonics: 7 / 12        ← present / total expected up to 8 kHz
```

Color the text:
- Green if `count >= harmonicMinCount`
- Gray otherwise

### Extend the gate status strip

Add a third dot to the existing status strip:

```
HPS: ●  Stability: ●  Extent: ○        ← speech that holds pitch briefly
HPS: ●  Stability: ●  Extent: ●        ← cello → detection fires
```

### Updated layout (Stage 2 additions in **bold**)

```
┌─────────────────────────────────────┐
│            Cello Tracker            │
│                                     │
│      [ ▶ Start Session ]            │
│                                     │
│ Status: Recording — 00:01:23        │
│                                     │
│ ● Cello detected                    │
│                                     │
│ HPS: ●  Stability: ●  Extent: ●     │  ← UPDATED: 3-gate strip
│                                     │
│ ┌─────────────────────────────────┐ │
│ │   spectrum + harmonic ticks     │ │  ← UPDATED: ticks overlay
│ │   "harmonics: 7 / 12"           │ │  ← NEW: count readout
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │   f0 history strip              │ │
│ └─────────────────────────────────┘ │
│ ▰▰▰▰▰▰▰▰▱▱▱▱▱▱▱▱                    │
│                                     │
│ HPS threshold: [────●──]  15        │
│ ☑ Stability gate                    │
│   Tolerance:  [───●───]  30 cents   │
│   Duration:   [──●────]  200 ms     │
│ ☑ Harmonic extent gate              │  ← NEW
│   Min harmonics:    [───●──]  6     │  ← NEW
│   Per-harmonic amp: [──●───]  15 %  │  ← NEW
│                                     │
│ Wake lock: active 🟢                │
└─────────────────────────────────────┘
```

## Acceptance criteria

Stage 2 is "good enough" if, in a real practice session:
- Held cello notes (all registers) maintain a harmonic count comfortably above
  the `harmonicMinCount` threshold.
- A sustained humming or sung "ahh" — at the same loudness as a cello note —
  produces a visibly lower harmonic count and fails the gate.
- Tuning is achievable: a `(minCount, ampThresholdPct)` combo exists where
  cello passes and held voiced sounds don't.
- The harmonic tick overlay makes the count tunable visually — the user can
  see which harmonics are missing for a given source and adjust accordingly.

## Open questions to revisit during tuning

- **Harmonic count vs. cello register.** High-register cello notes (above ~700
  Hz f0) may not actually have 8+ harmonics under 8 kHz simply because there
  isn't room: at f0 = 800 Hz, the 10th harmonic is already 8 kHz. The
  `harmonicMaxFreqHz` cap may need to become register-aware, or `minCount` may
  need to depend on f0. Decide based on testing.
- **Single-bin vs. 3-bin lookup.** If the tick overlay shows ticks falling
  consistently between FFT bins for high registers (due to f0 estimation
  noise), expand to a 3-bin max lookup.
- **Octave errors from HPS.** If HPS occasionally reports f0/2 or 2·f0, the
  harmonic positions are wrong and the gate misfires for one frame. Stability
  already smooths f0 over time — verify whether this is actually a problem in
  practice before adding a fix.

## Out of scope for Stage 2

- Adaptive `harmonicMinCount` based on detected f0.
- Weighting higher harmonics differently than lower ones.
- Using harmonic *amplitude profile* (not just count) as a richer signal —
  that's drifting toward MFCC territory and should wait until we have evidence
  that simple count is insufficient.
