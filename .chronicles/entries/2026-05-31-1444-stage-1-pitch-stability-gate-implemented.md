# 2026-05-31 — Stage 1 (pitch stability gate) implemented

**Question:** Does adding a pitch-stability gate on top of HPS eliminate the conversational-speech false positives that made HPS-only detection unusable?

**Implementation** (`app/index.html`):
- `computeStability(peak, dt)` — rolling 500ms buffer of `{timeMs, freq}` samples; median center frequency (robust to octave-error frames); cents-based tolerance check; accumulating progress timer. Appended each frame where `peak.val > 0`; oldest entries dropped beyond the window.
- Detection condition changed from `hpsPass` alone to `hpsPass && (!stabilityEnabled || stabilityGate)`. Gate toggle checkbox lets user revert to HPS-only to compare.
- Three new controls, all persisted to `localStorage`: Stability gate checkbox (default on), Tolerance slider 20–100 cents (default 30), Duration slider 100–500ms (default 200).

**New visualizations added:**
- **f0 history strip** — 60px canvas below the spectrum. Log-scale y-axis (65–1200 Hz), plots last 500ms of detected f0 as a line. Translucent green band tracks running median ± tolerance. Line color: green (in-band) / gray (out-of-band). Makes the tolerance parameter directly legible.
- **Stability progress bar** — 4px bar that fills as `stabilityProgressMs` accumulates toward `stabilityDurationMs`. Dim→`#00cc7a`→`#00ff9f` at gate-open. Shows exactly how long a pitch must hold before detection fires.
- **Gate status strip** — `HPS: ● Stability: ○` live readout between detection badge and spectrum. Stability entry omitted when gate disabled. Tells the user which gate is blocking a missed detection.

**Design choices:**
- Tolerance in cents (not Hz) so one value works across the full cello range (±30¢ = ±1.1 Hz at C2, ±9 Hz at C5).
- Median (not mean) for center frequency — robust to single-frame HPS octave errors.
- `stabilityProgressMs` resets to 0 on any out-of-band frame — no partial credit across gaps.

**Next resolved to:** field-test on iPhone; evaluate whether the gate eliminates speech false positives without requiring an impractical hold time on real played notes.
