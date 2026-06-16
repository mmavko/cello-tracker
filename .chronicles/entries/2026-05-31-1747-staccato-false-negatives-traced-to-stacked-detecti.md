# 2026-05-31 — Staccato false negatives traced to stacked detection latency

**Question:** First iPhone field test of Stage 1 — staccato notes missed entirely. Lowering the stability Duration slider toward its 100ms floor didn't help. Is it safe to go shorter, or is something else the bottleneck?

**Diagnosis — the Duration slider was a red herring.** Four latencies stack between note onset and the detection badge firing; Duration is the smallest:
1. **FFT window** — `FFT_SIZE 4096` ≈ 85ms of audio integrated per spectrum at 48kHz. Notes shorter than this smear across a mostly-silent window → low HPS peak.
2. **`smoothingTimeConstant`** — exponential frame blending imposes a *rise time*. At the code's actual 0.75, a fresh note needs ~8 frames (~130ms) to reach ~90% amplitude — a 100ms staccato note dies before its energy ever crosses threshold. **Highest-leverage culprit, and free to fix** (doesn't touch frequency resolution).
3. **`stabilityDurationMs`** — the slider (was floored at 100ms).
4. **`ATTACK_MS = 300`** (hardcoded debounce) — even after the gate opens, `aboveMs` must reach 300ms continuously. Effective time-to-detect ≈ Duration + Attack ≈ 400ms min; both counters reset on any failing frame.

**Key insight on safety:** going shorter is safer than it sounds — the *cents tolerance* (pitch steadiness) does the real speech rejection, not Duration. Speech pitch glides; a 60ms staccato note's pitch is rock-steady. Duration was belt-and-suspenders. Attack is the actual gate standing between us and staccato.

**Changes** (`app/index.html`):
- `smoothingTimeConstant` 0.75 → **0.35** (highest leverage; fresh notes ramp in ~3 frames).
- `ATTACK_MS` const → **`attackMs` slider**, default 60ms, range 30–400, persisted `localStorage['detection.attackMs']`. Placed as its own row after Threshold, *above* the stability toggle — grouped with the always-on knobs (Threshold, Attack), separate from the optional gate method (Tolerance, Duration). Rejected putting it under the detection badge: orphans a control above the canvas and pushes visualizations down on iPhone.
- Stability Duration slider floor 100 → **50ms**.

**Discovered en route:** `docs/platform-foundations.md` claimed `smoothingTimeConstant = 0 // no smoothing` — but the code had smoothed at 0.75 the whole time. A documented platform foundation had silently diverged from the implementation, and likely *masked* this problem (a reader would assume instant, raw spectra). Docs corrected to match (now 0.35, attack tunable, duration range 50–500).

**Next resolved to:** re-test staccato on iPhone at Attack ≈ 60ms; if still dropping, push Attack toward 30–40, then consider `FFT_SIZE 2048`.
