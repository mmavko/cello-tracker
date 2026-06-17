# Phase 1 spec — engine core loop (+ Phase 0 scaffolding)

Build-ready spec for **Phase 0** (scaffolding) and **Phase 1** (the pure engine
core loop), per the roadmap in [main-app-implementation.md](main-app-implementation.md).
Behavior references are to [main-app-ux.md](main-app-ux.md) (`UX §n`); structure to
[main-app-architecture.md](main-app-architecture.md).

**Deliverable:** `app/motivation.js` + `app/theme.js`, pure and fully tested under
`node --test`. **No UI** (that's Phase 2). The engine handles only **Played** and
**Missed → break** — a single empty past day breaks the streak (Freeze / Rest /
Lesson / Holiday arrive in Phase 3). `lessonDays`/`holidays`/`bonuses` exist in the
input shape but are **ignored** by Phase 1 `project()`.

---

## Phase 0 — scaffolding & harness

Establish the no-build ESM + `node --test` skeleton. Concretely:

- **`package.json`** at repo root:
  ```json
  { "type": "module", "private": true, "scripts": { "test": "node --test" } }
  ```
  No dependencies. (Running tests ≠ a build step.)
- **`app/motivation.js`**, **`app/theme.js`** — real for Phase 1 (below), but Phase 0
  can land them as stubs that export the named surface so the smoke test imports.
- **`test/smoke.test.js`** — imports `motivation.js`, asserts `project` and
  `momentumFor` are functions and `project({…minimal…}, {today})` returns an object.
  Proves native ESM import under `node --test`.
- **`app/index.html` shell** + **`app/main.js`** stub — `index.html` loads
  `detector.js` (classic `<script src>`) then `<script type="module" src="main.js">`;
  `main.js` writes a placeholder to the DOM and reads `window.CelloDetector` to prove
  the module/global coexistence. (Keep the existing placeholder app behavior until
  Phase 2; the shell can live behind it or replace the body — your call, since
  deploys are manual.)

**Done when:** `npm test` is green; `index.html` loads `main.js` as a module with no
console errors and `window.CelloDetector` is reachable.

---

## Input schema (the persisted facts)

`project(inputs, ctx)`. Phase-1-active fields marked ✓; reserved fields are accepted
and ignored.

```jsonc
inputs = {
  config: {
    dailyFloorMin: 15,        // ✓ a day is "played" at ≥ this many detected minutes
    restWeekday: null         // reserved (Phase 3)
  },
  sessions: [                 // ✓ one record per listening period (mic on→off)
    { start: "2026-06-06T14:30:00", end: "2026-06-06T15:01:00", playedSec: 1860 }
  ],
  lessonDays: [],             // reserved — { date, lenMin } objects (Phase 3)
  holidays:   [],             // reserved (Phase 3)
  bonuses:    []              // reserved (Phase 5)
}

ctx = {
  today: "2026-06-06"         // ✓ local date string, supplied by the shell
}
```

- A `sessions[]` record is a listening period: `start`/`end` timestamps + `playedSec`
  (detected cello seconds). Phase 1 only needs `playedSec` and the local date of
  `start`; `start`/`end` are kept as **raw data for later analysis** (start times,
  wall-clock duration `end − start`). There is **no `liveSessionSec` and no "running"
  flag** — the active listening period is just the last record, its `playedSec`/`end`
  flushed on a throttle by the shell (arch §1/§5), so persisted state is always valid
  and today's total survives a reload.
- Dates are **local `YYYY-MM-DD` strings**; a session's day = the local date of its
  `start`. The engine does only string/date arithmetic; the shell computes `today`
  from local time. To enumerate the day range without DST/off-by-one bugs, parse
  dates as **UTC midday** (`new Date(s+"T12:00:00Z")`) and step in 24 h increments.

---

## Core definitions

- **`playedMin(D)`** = (Σ `sessions[].playedSec` where `localDate(start) == D`) ÷ 60.
  Fractional. Order of same-day records is irrelevant. (The active listening period is
  one of these records, kept current by the shell's throttled flush — the engine reads
  it like any other.)
- **`played(D)`** = `playedMin(D) ≥ config.dailyFloorMin`.
- **Day range to evaluate:** from the earliest session date (or `today` if none)
  through `today`, inclusive, every calendar day — including empty ones.
- **`streakEntering(D)`** = `streak.current` after resolving day `D−1` (0 for the
  first evaluated day, and 0 immediately after a break).

### Streak & break (Phase 1 reduced machine)

Iterate `D` oldest → newest:

```
if played(D):
    streak.current = streakEntering(D) + 1
    longest = max(longest, streak.current)
    status[D] = "played"
elif D < today:                 # a past empty day, unprotected in Phase 1
    streak.current = 0
    status[D] = "missed"        # BREAK
else:                           # D == today, empty so far — in progress, doesn't break yet
    streak.current = streakEntering(today)   # held at the entering value
    status[today] = "open"
```

Today never breaks the streak while in progress; only a *past* empty day does. After
a break, the streak rebuilds from the next played day. `longest` is preserved across
breaks.

---

## Momentum (UX §3.2)

Tier function of a streak count `n ≥ 0`:

| streak `n` | `momentumFor(n)` |
|---|---|
| 0–2 | 1.0 |
| 3–6 | 1.25 |
| 7–13 | 1.5 |
| 14–29 | 2.0 |
| 30–59 | 2.5 |
| ≥ 60 | 3.0 |

**A day's Momentum uses a one-step look-ahead — the streak the day *results in*:**

```
dayMomentum(D) = momentumFor( streakEntering(D) + (played(D) ? 1 : 0) )
```

So a played day's minutes are valued at the tier the day pushes the streak *to*
(matches the §3.2 table). A non-played day's minutes (a stray short session) are
valued at the tier she was *entering* the day — i.e., before any break — which is
generous and avoids retroactively shrinking points. For the in-progress `today`,
`played(today)` is just `secured` (below): minutes earn at the entering tier until
the floor is crossed, then bump up one tier at the "Today counts ✓" moment.

**Verification against the §3.2 worked week** (start from streak 0):

| Day | entering | played? | tier arg | Momentum | min | round(min×M) |
|---|---|---|---|---|---|---|
| Mon | 0 | ✓ | 1 | 1.0 | 30 | 30 |
| Tue | 1 | ✓ | 2 | 1.0 | 25 | 25 |
| Wed | 2 | ✓ | 3 | 1.25 | 35 | 44 |
| Thu | 3 | ✓ | 4 | 1.25 | 30 | 38 |
| Fri | 4 | ✓ | 5 | 1.25 | 40 | 50 |
| Sat | 5 | ✓ | 6 | 1.25 | 20 | 25 |
| Sun | 6 | ✓ | 7 | 1.5 | 30 | 45 |

Total **257**, streak **7**, longest **7** — matches the doc exactly. This week is a
golden-path test fixture.

---

## Points (UX §3.3)

- **Per day:** `points(D) = round( playedMin(D) × dayMomentum(D) )`, round-half-up
  (`37.5 → 38`, `43.75 → 44`).
- **Total:** `points.total = Σ_D points(D)` over the evaluated range (includes
  `today`, whose total reflects the active record's latest flush). Phase 1 has no
  bonuses; `bonuses[]` add in later as flat addends.
- Every day's minutes earn, **even sub-floor days** (UX §9 note) — the day-type
  machine governs only streak, never whether points accrue.

---

## Collection (UX §4)

Tile `costPoints` are **cumulative point thresholds** (not incremental costs). A tile
is unlocked when `points.total ≥ tile.costPoints`. Therefore:

- `collection.unlockedIds` = ids of tiles with `costPoints ≤ points.total` (derived,
  never stored).
- `collection.nextId` = first tile with `costPoints > points.total` (or `null` at the
  end of the list).
- `points.toNextTile` = `nextTile.costPoints − points.total` (or `null`).

Tiles must be sorted ascending by `costPoints` (first is `home` at 0).

---

## Recovery dim (Phase 1: binary; Phase 5 makes it gradual)

`collection.dim ∈ {0, 1}`:

- `1` while **recovery is active** = a break has occurred and there have been **0
  played days since** it.
- `0` otherwise — including a brand-new user with no history (a fresh start is bright
  and inviting, *not* "cooled"). The first played day after a break clears it.

---

## `project()` output contract

```jsonc
{
  today: {
    date,                 // ctx.today
    playedSec, playedMin, // today's aggregate (Σ playedSec of today's records)
    secured,              // playedMin ≥ floor
    isOvertime,           // Phase 1: == secured (overtime nuance is Phase 5)
    pointsToday,          // round(today.playedMin × dayMomentum(today))
    status                // "played" if secured else "open"
  },
  streak:   { current, longest, atRisk },   // atRisk: !secured && streakEntering(today) > 0
  momentum,                                  // dayMomentum(today)  (the displayed ×)
  points:   { total, toNextTile, nextTile }, // nextTile: {id,…} | null
  collection: { unlockedIds, nextId, dim },
  daysIndex: { [date]: "played" | "missed" }  // for the future calendar; today omitted or "open"
}
```

- `streak.current` shown to the user = `streakEntering(today) + (secured ? 1 : 0)` —
  i.e., it ticks up the moment today secures.
- `momentum` = `dayMomentum(today)` — bumps a tier when today secures.

Pure-purity guard: `motivation.js` and `theme.js` must import cleanly under
`node --test` with **no** `window`/`document`/`localStorage`/`Date.now()`/
`Math.random()`. Anything time- or random-shaped is a parameter.

---

## `theme.js`

Exports the world-tour tile list (UX §4.2), sorted ascending by `costPoints`.
**Phase 1 ships only this ~9-tile testing subset** — enough to exercise unlock
thresholds (the matrix asserts unlocks at total 257). Tiles aren't *seen* until the
Phase 2 collection view, so the **full multi-year list (~76 tiles, banded cost
curve — UX §4.2 "sizing") is authored as a data task before Phase 2**; the engine is
count-agnostic, so growing it touches no code.

```js
export const WORLD_TOUR = [
  { id: "home",    emoji: "🏠", name: "Your practice room", costPoints: 0,   fact: "Where every tour begins." },
  { id: "cremona", emoji: "🎻", name: "Cremona",            costPoints: 40,  fact: "Where Stradivari built his violins and cellos." },
  { id: "paris",   emoji: "🗼", name: "Paris",              costPoints: 90,  fact: "Home of the Conservatoire de Paris." },
  { id: "vienna",  emoji: "🏛️", name: "Vienna",             costPoints: 160, fact: "The Musikverein's \"Golden Hall.\"" },
  { id: "milan",   emoji: "🎭", name: "Milan",              costPoints: 250, fact: "La Scala, the world's most famous opera house." },
  { id: "prague",  emoji: "🏰", name: "Prague",             costPoints: 360, fact: "Where Mozart premiered Don Giovanni." },
  { id: "newyork", emoji: "🗽", name: "New York",           costPoints: 500, fact: "Carnegie Hall — how do you get there? practice." },
  { id: "sydney",  emoji: "🌉", name: "Sydney",             costPoints: 680, fact: "The Opera House on the harbour." },
  { id: "tokyo",   emoji: "🏯", name: "Tokyo",              costPoints: 900, fact: "Suntory Hall, a jewel box of sound." }
  // extend the list as needed
];
```

---

## Exported API surface

```js
// motivation.js
export function project(inputs, ctx) { … }
export function momentumFor(streak) { … }      // tier function above
export const MOMENTUM_TIERS = [ … ];           // the boundary table, for tests + future parent UI
// shouldOfferBonus is a Phase-5 stub here (e.g. always returns null)

// theme.js
export const WORLD_TOUR = [ … ];
```

---

## Test matrix (`node --test`)

| # | Scenario | Assert |
|---|---|---|
| 1 | `momentumFor` boundaries: 0,1,2,3,6,7,13,14,29,30,59,60,100 | 1.0,1.0,1.0,1.25,1.25,1.5,1.5,2.0,2.0,2.5,2.5,3.0,3.0 |
| 2 | Single played day (30 min, floor 15) | streak 1, longest 1, momentum 1.0, pointsToday 30, today.secured true |
| 3 | **Golden week** (§3.2 fixture, 7 consecutive days) | per-day points as table, points.total 257, streak 7, longest 7 |
| 4 | Look-ahead momentum (Wed, 35 min, entering 2) | points(Wed) 44 (tier 3, not tier 2) |
| 5 | Break via gap: play D1–D3, empty D4, play D5 (today) | D4 status "missed", streak resets to 1 at D5, longest 3 preserved |
| 6 | Today in progress, sub-floor (today's record(s) sum < floor) | secured false, status "open", streak held at entering, atRisk true (if entering>0), pointsToday at entering tier |
| 6b | …then today's record grows past the floor | secured true, streak = entering+1, momentum bumps one tier |
| 7 | Sub-floor **past** day (10 min) before today | earns points at entering tier, but status "missed" → streak breaks |
| 8 | Collection unlock at total 257 | unlockedIds through "milan" (≤250), nextId "prague", toNextTile 103 |
| 9 | Dim flag | fresh user (no sessions) dim 0; after a break, before next play, dim 1; first play after break dim 0 |
| 10 | Determinism / order independence | same inputs → identical output; shuffling `sessions[]` array order (incl. same-day) → identical |
| 11 | Rounding | 37.5 → 38, 43.75 → 44 (round-half-up) |
| 12 | Multi-record day | several `sessions[]` records on one date sum by `playedSec`; a record's day = local date of `start` |
| 13 | Reserved inputs ignored | non-empty `lessonDays`/`holidays`/`bonuses` do **not** change Phase-1 output |

---

## Done criteria

- All matrix tests green under `npm test`; `motivation.js`/`theme.js` import with no
  browser shims.
- `project()` output matches the contract for the fixtures above.
- Phase 0 shell loads in the browser (module + detector global coexist).

---

## Locked decisions

- **Momentum look-ahead rule — LOCKED:** `dayMomentum(D) = tier(streakEntering(D) +
  (played(D) ? 1 : 0))`. Chosen (and confirmed) because it reproduces the §3.2 worked
  example *and* avoids retroactively devaluing minutes when a day later breaks.
- **"Your usual" = per-*day* median — LOCKED** (drives the anchor + recovery target,
  both Phase 5; not needed in Phase 1). A "session" is just listening-mode on/off, so
  session length is noise; the median of recent **daily played totals** is the truer
  measure. Raw per-session data is still kept for analysis.
