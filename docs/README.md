# Design docs

Current technical design. For *why* we got here — past decisions, killed
hypotheses, the arc — read `../chronicles.md`. This folder is what's true now;
chronicles is how it became true.

- **[platform-foundations.md](platform-foundations.md)** — mic permission flow,
  audio pipeline, wake lock, iOS background recovery. Patterns now encapsulated
  in `app/detector.js` (`CelloDetector`) that should not change without
  re-testing on a real iPhone.
- **Detection pipeline** (this document below) — the upgrade path from
  "HPS alone" to a layered detection pipeline that rejects human voice during
  cello practice.
- **[main-app-ux.md](main-app-ux.md)** — UX design for the real main app: the
  streak + Momentum + Collection motivation system, the freeze / holiday / break
  rules, screens, and the data/state-machine sketch. Design only, no
  implementation yet.

## Module layout

The app is split into a reusable detection module and two thin UI pages over it:

```
app/detector.js    CelloDetector — mic + Web Audio + DSP (HPS, f0, gates) + the
                   analysis loop + iOS recovery + wake lock. DOM/storage-agnostic;
                   emits onFrame (viz data) / onDetectionChange / onStatus.
app/settings.js    SettingsStore — detection-param defaults + localStorage load/save.
app/settings.html  Tuning UI at "/settings". Writes params via SettingsStore, runs a
                   live detector, renders the spectrum / f0 strip / gate visualizations.
app/index.html     Main app at "/". Seeds the detector from SettingsStore, start/stop a
                   session, counts detected playing time, logs sessions to localStorage.
```

The detection algorithms (this document, and the stage specs) live in `detector.js`.
The visualizations and tuning controls live in `settings.html`. When a spec below says
"integration point," it means `detector.js` for detection logic and `settings.html` for
any UI/visualization.

---

## Detection pipeline

## Why we need more than HPS

HPS (harmonic product spectrum) was meant to discriminate harmonic sources from
non-harmonic ones. That works for noise, fricatives, and clatter — but **voiced
speech is itself harmonic** (vocal folds produce a clean f, 2f, 3f, 4f series),
so HPS spikes on conversational voice too. Field testing on iPhone confirmed
this: no usable threshold separates cello from talking.

The fix is to layer cheap, targeted gates on top of HPS, each exploiting a
*different* real difference between cello and voice. Detection fires only when
**all enabled gates agree**.

## The pipeline

```
mic → FFT → HPS → f0 (existing)
                   │
                   ├─→ Gate 0: HPS amplitude threshold     (already built)
                   ├─→ Gate 1: pitch stability             (Stage 1)
                   └─→ Gate 2: harmonic extent             (Stage 2)
                                  │
                                  ▼
                       Detection = AND of enabled gates
                                  │
                                  ▼
                       Debounce (attack 30–400ms, default 60 / 1500ms release)
```

Each gate has an on/off toggle, so during tuning you can isolate one at a time
or A/B against any subset.

## What each gate exploits

| Gate | Exploits | Kills | Misses |
|---|---|---|---|
| HPS amplitude | Periodicity | Broadband noise, hiss, clatter | Voice (also periodic) |
| Stability | Sustained pitch | Speech (constantly sliding f0), short transients | Very short pizzicato notes |
| Harmonic extent | High harmonic count | Sustained voiced sounds (3–5 harmonics) | Soft high-register cello (harmonics may be quiet) |

## Staging

We're **not** building both gates at once. The plan is:

1. **Stage 1 — pitch stability.** Cheap, addresses the dominant failure mode
   (people talking nearby). Field-test on iPhone in a real practice session.
2. **Stage 2 — harmonic extent.** Only build this if Stage 1 is insufficient —
   e.g., if sustained voiced sounds (humming, singing in the next room) still
   cause false positives.

Implementation specs live in:
- [stage-1-pitch-stability.md](stage-1-pitch-stability.md)
- [stage-2-harmonic-extent.md](stage-2-harmonic-extent.md)

Both docs are self-contained briefs for a coding agent: algorithm, parameter
ranges, UI controls, visualizations, and integration points — detection logic
into `app/detector.js`, controls and visualizations into `app/settings.html`.

## Out of scope

- **Singing rejection.** Stage 1 + Stage 2 will not reliably reject sustained
  singing (sung vowels look very similar to bowed notes on every dimension we
  measure). If singing turns out to be a real ambient problem, MFCC template
  matching is the principled next step — but that's a much larger build and is
  deferred until evidence demands it.
- **Music playback rejection.** If recorded music plays in the room, gates will
  fire. Not in scope for this iteration.
