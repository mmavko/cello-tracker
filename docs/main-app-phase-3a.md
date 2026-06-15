# Phase 3a spec — maintenance: lesson-minutes retrofit + Detector rename

**Ephemeral phase.** 3a adds **no feature surface**. It *corrects* already-built work
(Phases 1–3 + the detector-tuning page) so the spec and code match the design we
settled on, and must land **before Phase 4** because the parent-area lesson UI builds
on the new lesson shape. Per the maintenance-phase convention
([implementation §"How we use this doc"](main-app-implementation.md)), its doc edits
are made **in place** in the relevant `phase-N`/`ux`/`arch` files; once executed, this
spec and the roadmap's 3a row collapse to a one-line tombstone, with the durable
record living in `chronicles.md` + git.

- Behavior/why → [main-app-ux.md](main-app-ux.md) §5.3.
- Structure/no-build → [main-app-architecture.md](main-app-architecture.md) §1.
- Roadmap slot/done-criteria → [main-app-implementation.md](main-app-implementation.md) Phase 3a.
- Contract this amends → [main-app-phase-1.md](main-app-phase-1.md) (input schema),
  [main-app-phase-3.md](main-app-phase-3.md) (lesson points/recovery).

There are two independent workstreams: **A. per-lesson minutes** and **B. the
`settings` → `Detector` rename**. They share this phase only because both are
"clean up prior work."

---

## A. Per-lesson minutes

**Why.** A logged lesson should carry its *own* length — a longer masterclass one
week should be worth more than a short weekly lesson. The current model gives every
lesson one global length (`config.lessonLenMin`), which can't express that.

### A.1 Data shape

`lessonDays[]` changes from a date-string array to an object array:

```jsonc
// before:  "lessonDays": ["2026-06-09"]
// after:   "lessonDays": [ { "date": "2026-06-09", "lenMin": 45 } ]
```

`config.lessonLenMin` is **removed** — it has no remaining engine role once each
lesson carries its own `lenMin`.

**No migration.** `lessonDays` has always been `[]` in the wild (reserved since
Phase 1, never written by any code), so there is no on-disk data to convert. The
store's defensive `load()` simply keeps `lessonDays` an array; entries only ever
arrive in the new shape (first writer is Phase 4).

### A.2 Engine changes (`app/motivation.js`)

The lesson lookup goes from a `Set<date>` to a `Map<date, lenMin>`; each place that
used the global `lessonLenMin` reads the **per-lesson** value instead. Touchpoints
(as of the current file):

- `const lessonLenMin = cfg.lessonLenMin ?? 45;` (~L95) — **removed.**
- `const lessonSet = new Set(inputs.lessonDays ?? []);` (~L97) → a map keyed by
  `date`, value `lenMin` (defensive `?? 45` per entry against a hand-edited record).
- `for (const k of lessonSet) consider(k);` (~L108) → iterate the map's keys.
- `const lesson = lessonSet.has(D);` (~L149) → `lessonMap.has(D)`; capture the day's
  `lenMin` for use below.
- recovery: `addRecovery((detPlayed ? min : 0) + (lesson ? lessonLenMin : 0));`
  (~L162) → use the day's own `lenMin`.
- points: `const lessonMin = … ? lessonLenMin : 0;` (~L183) → the day's own `lenMin`.

The engine stays pure; the `project(inputs, ctx) → state` signature is unchanged.
Stacking semantics (played + lesson → streak +1 once, points
`round((detectedMin + lenMin) × Momentum)`) are unchanged in *meaning* — only the
source of `lenMin` moves from global to per-lesson.

### A.3 UI default & prefill (specified here; built in Phase 4)

There is **no persisted "last length"** and **no `cello.prefs` key**. The Phase-4
log-a-lesson minute stepper:

- seeds from a **hardcoded constant `45`** when no lessons exist yet;
- otherwise pre-fills from the **last recorded lesson's `lenMin`** — derived by
  reading `lessonDays`, never stored.

This keeps "persist facts only, never a derived/UI value" intact and still makes the
typical entry one-tap.

### A.4 Tests

- Update existing lesson cases (P7 lesson-only, P8 played+lesson stack, P20 lesson
  recovery credit) to the new `{date, lenMin}` shape.
- **New:** two lessons of **different** lengths in one fixture project the correct
  per-lesson points (guards against a regression to a single global length).
- Confirm no `config.lessonLenMin` reference remains in engine or tests.

---

## B. Rename `settings` → `Detector`

**Why.** The page is detector-tuning only; "settings" implied a broader scope it
never had. The motivation config lives in the (Phase-4) parent area instead.

**Scope.**
- Rename the page and its label to **Detector** (`app/settings.html` →
  `app/detector.html`, plus the on-page heading). `SettingsStore` (`app/settings.js`)
  and its localStorage **keys stay untouched** — this is a rename of the page, not
  the detection-param storage.
- The on-Home entry point is **relocated under the parent area in Phase 4** (cleaner
  UI). The page itself stays **directly reachable and unprotected** — the child may
  visit it; relocation is tidiness, not a gate.
- Update any references to `/settings` / "settings page" in `README.md`, `arch` §2/§5,
  and `phase-2` to the Detector page.

---

## Edits already applied (ahead of execution)

While fixing the separately-agreed doc contradictions (the lesson **date-grace**
removal and **stats** de-gating), a few 3a-flavored edits landed early. They are
**intentional and correct** — listed here so a reviewer knows 3a is partially
pre-applied, and so the rest of the docs may already assume 3a's outcome:

- **UX §7.6** — "Log a lesson" now reads "any past date *and* the lesson's length in
  minutes," and "lesson length" was dropped from the parent-config list (it's
  per-lesson now, not a global). §7.6 also already refers to the **"Detector" page.**
- **Implementation doc** — the Phase 4–8 overviews already assume the new lesson
  shape and the Detector rename (e.g. Phase 4 logs "a chosen length"; Phase 4 notes
  the Detector-link relocation).

Separately, the **date-grace removal** (UX §5.3/§5.6/§7.6/§9/§10/§11, phase-3 §"No
lesson date-window") is **not** part of 3a — it's an independent design change,
already fully applied. It's mentioned only because it's what surfaced the early 3a
bleed above.

### Still to do at execution

- UX §5.3 lesson-points wording and §11 "Lesson length" row → per-lesson `lenMin`.
- `arch` §1 + `phase-1`/`phase-2`/`phase-3` input-schema blocks → `lessonDays`
  `[{date, lenMin}]`, `config.lessonLenMin` removed.
- The engine, store, tests, and the page rename (B) — all code.

---

## Done when

- `npm test` green, including the two-different-length-lessons fixture; **no
  `config.lessonLenMin`** remains in code or tests.
- `lessonDays` entries are `{date, lenMin}` end-to-end; the store's defensive load
  tolerates an empty/array value.
- The detector-tuning page reads **"Detector"**; no stale "settings page" references
  remain in the docs.
- All amended specs (1/2/3, ux, arch) read seamlessly as if the new shape was always
  there — no dangling `config.lessonLenMin` or date-grace language.

## Files

`app/motivation.js`, `app/store.js`, `app/settings.html`→`app/detector.html`
(+ heading/label), `test/` updates; in-place doc edits to
`main-app-{phase-1,phase-2,phase-3,ux,architecture}.md` and `README.md`.
