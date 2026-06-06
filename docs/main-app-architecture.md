# Main app — engineering & architecture

How the main app is built. The *what/why* of the behaviour lives in
[main-app-ux.md](main-app-ux.md); this doc is the *how*: module boundaries, the
pure-engine design, the no-build setup, testing, and how the staged build slots
together. No framework, no bundler, no transpile.

---

## 1. Keystone: the brain is a pure projection

The motivation logic is **not** a stateful object that holds and mutates streak /
points. It's a **pure function from recorded facts to derived state**:

```js
// app/motivation.js — pure; zero browser APIs
export function project(inputs, { today, liveSessionSec }) → state
export function shouldOfferBonus(state, sessionCtx, rng) → bonus | null
```

The design rule, straight out of §8/§9 of the UX doc: **persist only what actually
happened; recompute everything else.**

| Persisted **inputs** (facts) | Derived by `project()` (never stored) |
|---|---|
| `config` — floor, restWeekday, lessonLen | per-day `status`, `streak.current`, `longest` |
| `sessions[]` — `{date, sec}` per finished session | daily sound totals, **your-usual** (median) |
| `lessonDays[]` — parent-credited dates | `momentum`, `points.total`, `toNextTile` |
| `holidays[]` — `{start, end}` ranges | `collection.unlocked`, recovery / dim level |
| `bonuses[]` — `{date, points}` realized awards | `freezeBanked`, `regenCount`, streak `atRisk` |

So `localStorage['cello.progress']` is a handful of small append-mostly arrays.
Streak, Momentum, points, collection, freeze, recovery are *all projections* —
which is why "logging a lesson un-breaks yesterday's break" needs no special code:
it's a date added to `lessonDays[]` followed by a replay.

**Two purity rules that buy testability — never break them:**

1. **Inject the clock and the RNG.** `motivation.js` never calls `Date.now()` or
   `Math.random()`. `today` is a parameter; the RNG is passed to
   `shouldOfferBonus`. This is what lets a test simulate *"30 days, missed day 12,
   lesson on day 7, holiday in week 3"* and assert the exact streak / momentum /
   points, and exercise bonus odds with a seeded RNG.
2. **Randomness lives in the shell, determinism in the engine.** The shell rolls a
   bonus (via the pure `shouldOfferBonus`); on a hit it *appends the result* to
   `bonuses[]`. `project()` only ever replays recorded facts → fully deterministic,
   same inputs → same state, every time.

`project()` replays the whole history each call — O(days), microseconds at a few
thousand days. Calling it live during a session (throttled) is fine. Memoizing
"derived-through-yesterday" and only recomputing today is an available
optimization, not needed initially.

---

## 2. Module layout — the pure/impure boundary made physical

```
app/
  detector.js   settings.js   settings.html   ← UNCHANGED (classic globals, field-tested)
  index.html        ← main-app shell: loads detector.js (classic) + main.js (module)
  parent.html       ← gated parent area (phase 2), its own module entry

  motivation.js     ★ PURE brain (ESM): the §9 state machine, momentum, points,
                       collection unlock, recovery, bonus rule. No browser APIs.
  theme.js          ★ world-tour tile data (ESM, swappable)

  store.js          localStorage ⇄ inputs — the I/O boundary (ESM, impure)
  main.js           controller: load → project → render; owns the view router
  views/
    home.js  practice.js  summary.js  collection.js   calendar.js (phase 2)

test/
  motivation.test.js …   ← node --test, zero dependencies
package.json             ← { "type": "module", "scripts": { "test": "node --test" } }, no deps
```

- **Pure (browser *and* Node):** `motivation.js`, `theme.js`. Importable by the
  views and by the test runner alike.
- **Impure shell (browser only):** `store.js`, `main.js`, `views/*`. The only code
  that touches `localStorage`, the DOM, the clock, and `Math.random`.
- **Untouched:** `detector.js` / `settings.js` / `settings.html` stay classic
  globals. `main.js` (a module) reads `window.CelloDetector`, and **only the
  practice view touches it** — so the fragile field-tested iOS recovery code is
  fully isolated from this refactor. Modularizing the detector later is optional
  and independent.

---

## 3. No build step: native ES modules + `node --test`

- **Browser:** `index.html` loads `detector.js` classically, then
  `<script type="module" src="main.js">`. ESM `import`/`export` resolve natively
  (Safari 11+, fine on the target iPhone). Cloudflare Pages serves the nested
  static files as-is — no `_redirects`, no config.
- **Node:** the pure engine is plain ESM, so `node --test test/` imports it
  directly. **This is running tests, not a build** — no bundler, no transpile, and
  the `package.json` carries *zero dependencies*, only a `test` script.
- The `package.json` lives at repo root (`{"type":"module"}` makes root/test `.js`
  ESM for Node; the browser ignores it). `npm test` → `node --test`.

---

## 4. Engine interface (sketch)

```js
// motivation.js
export function project(inputs, ctx) {
  // ctx = { today: 'YYYY-MM-DD', liveSessionSec: 0 }
  // replays sessions/lessons/holidays/bonuses day-by-day (the §9 precedence machine)
  return {
    today:   { date, status, soundSec, secured, isOvertime, pointsToday },
    streak:  { current, longest, atRisk },     // atRisk: breaks if today ends empty
    momentum,                                   // × (derived from streak, §3.2)
    points:  { total, toNextTile, nextTile },
    collection: { unlockedIds, nextId, dim },   // dim 0..1 from recovery (§4.3)
    freeze:  { banked, regenInDays },
    recovery:{ active, progress },
    daysIndex: { [date]: status },              // played|lesson|rest|frozen|holiday|missed
  };
}

export function shouldOfferBonus(state, sessionCtx, rng) { /* pure; §6.1 */ }

export const MOMENTUM_TIERS = [ /* §3.2 */ ];   // exported for tests + parent UI
```

`inputs` is exactly the persisted shape from §1. Tunable knobs the parent sets
live in `inputs.config`; engine-internal constants (momentum tiers, bonus odds)
are exported named constants so tests and the parent screen reference one source.

**Data flow — a tiny unidirectional loop, no framework:**

```
store.load() → inputs ──project()──▶ state ──render()──▶ DOM
      ▲                                                    │
      └──────── action mutates an input, store.save() ◀────┘   (then reproject + render)
```

Actions: a practice tick raises `liveSessionSec` (reproject live); stopping appends
to `sessions[]`; a parent logs a lesson → add to `lessonDays[]`; declare a holiday
→ add to `holidays[]`. Every action is "mutate one input array, reproject, render."

---

## 5. Detector integration

`detector.js` is consumed only by `views/practice.js`: it `new`s the global
`CelloDetector`, and translates detected-sound time into the practice session's
running seconds. On stop, the view hands the session total to `store` (→
`sessions[]`). The engine never imports or knows about the detector — it only ever
sees `sessions[].sec`. Detection params still come from `SettingsStore`
(`settings.js`), read once to seed the detector, exactly as today.

---

## 6. Testing

`node --test`, zero dependencies. The engine's purity makes the hard parts
trivial to cover deterministically:

- **Day-type precedence & transitions:** played / lesson / rest / frozen / holiday
  / missed, in the §9 order; played + lesson **stack points, streak +1 once**.
- **Freeze:** consume on a slip, never two in a row, regen after 7
  played-equivalent days.
- **Streak & break:** two unprotected misses → streak 0, Momentum ×1; soft, points
  preserved.
- **Lesson backfill:** add yesterday to `lessonDays[]` → replay refunds a freeze /
  un-breaks a break.
- **Holiday:** pauses streak/regen, no freeze consumed; mid-week holiday does *not*
  desync the rest-day cadence.
- **Momentum tiers**, **points = minutes × Momentum + lesson + bonuses**,
  **collection unlock thresholds**, **recovery recolour** over `2 × your-usual`.
- **Bonuses:** `shouldOfferBonus` with a seeded RNG — overtime-gated, per-session
  cap, probability ramp.

Pattern: build an `inputs` fixture, call `project(inputs, { today })`, assert the
projection. Multi-day scenarios are just fixtures with several `sessions[]` /
gaps and a chosen `today`.

---

## 7. Staging maps to additive modules

Because `project(inputs) → state` is a stable signature, each phase **adds** an
input field + a `status` case + a view, without rewriting prior code or the UI
plumbing. The full phase list and done-criteria live in
**[main-app-implementation.md](main-app-implementation.md)**; the architectural
point is only that staging is *additive* — extending `project()` and adding view
modules never forces a rewrite of what shipped before.

---

## 8. Conventions to hold the line

- **`motivation.js` and `theme.js` import nothing from the browser** — no `window`,
  `document`, `localStorage`, `Date`, `Math.random`. If the engine needs "now" or
  "a random number," it takes it as a parameter. CI guard: they must be importable
  by `node --test` with no shims.
- **Persist inputs only.** If you find yourself saving a derived value (streak,
  points, an unlock list), stop — it belongs in `project()`. (Sole exception worth
  considering later: a collection-unlock *high-water mark*, only if tile costs ever
  change after release; not needed for a fixed theme.)
- **One source of truth for tunables:** parent-settable in `inputs.config`,
  engine-internal as exported constants.
- New design docs → `docs/`; status/rationale → `chronicles.md`; `README.md` stays
  a door (per the 2026-05-30 convention).

---

## 9. Out of scope / deferred

- **Modularizing `detector.js` / `settings.js`.** They work as globals; leave them
  until there's a reason. Touching the detector means re-testing on a real iPhone.
- **Bundling / minification / a router framework.** Not at this scale (single user,
  a few small files, HTTP/2). Revisit only if file count or view logic actually
  hurts.
- **Open alignment note (flag for the UX doc):** UX §6 defines "your usual" as the
  *trailing median of the last ~10 sessions*. The minimal inputs here support both
  per-session median (from `sessions[]`) and a simpler per-day-total median. We'll
  go per-session to match the UX doc unless the per-day total proves steadier in
  practice — noting it so the two docs don't silently diverge.
```