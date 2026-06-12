# Phase 2 spec — UI core loop (first real app)

Build-ready spec for **Phase 2** — the browser shell that makes the Phase-1 engine
usable and field-testable on iPhone, per the roadmap in
[main-app-implementation.md](main-app-implementation.md). Behavior references are to
[main-app-ux.md](main-app-ux.md) (`UX §n`); structure to
[main-app-architecture.md](main-app-architecture.md) (`arch §n`).

**Deliverable:** the impure shell — `app/store.js`, `app/main.js`,
`app/views/{home,practice,summary,collection}.js`, and a rebuilt `app/index.html`
that **replaces the placeholder timer**. The pure engine (`motivation.js`,
`theme.js`) is **unchanged** — Phase 2 only *consumes* `project()`. This is the
**first deploy of the real app** (`wrangler pages deploy app/`).

**In scope.** The four child-facing views; the `localStorage` store of *inputs*; the
`load → project → render` / `action → reproject → render` loop; detector wiring with
throttled flush + wake lock; a designed, kid-facing look with the Collection grid as
centerpiece.

**Out of scope (later phases).** Parent area + PIN, calendar/history, all protection
day-types (Rest/Freeze/Lesson/Holiday — Phase 3/4), surprise bonuses, the "your
usual" anchor marker, **gradual** recolour (Phase 2 renders the engine's **binary**
`dim` only), PWA manifest / add-to-home-screen (decided: plain Safari page this
phase).

---

## Decisions locked for this phase

- **Look & feel:** a **designed, kid-facing** aesthetic (an 11–13-yo, not babyish),
  with the **Collection grid as the visual centerpiece**. Use the `frontend-design`
  skill during implementation. One self-contained stylesheet, no framework, no build.
- **Existing data:** **start clean.** The real app reads/writes a *new* key
  (`cello.progress`); the placeholder's `cello.sessions` is **left untouched** and
  never migrated. A fresh user begins bright (not "cooled") with an empty collection.
- **Install:** **plain Safari page** — no manifest/standalone this phase. Wake lock
  still works via the detector in a normal tab.

---

## The store — `app/store.js`

The **only** module besides the views that touches `localStorage`. It persists the
**`inputs` object verbatim** (arch §1) — the same shape `project()` already eats:

```jsonc
// localStorage['cello.progress']  (= the persisted `inputs`)
{
  config: { dailyFloorMin: 15, restWeekday: null, lessonLenMin: 45 },
  sessions: [ { start, end, playedSec } ],   // one record per listening period
  lessonDays: [],   // reserved (Phase 3/4)
  holidays:   [],   // reserved (Phase 4)
  bonuses:    []    // reserved (Phase 5)
}
```

**No derived value is ever stored** — streak, points, status, unlocks, freeze,
recovery are all recomputed by `project()` (arch §8). The store is small,
append-mostly arrays.

### API

```js
load()                       // → inputs, defaults filled; creates a clean record on first run
save(inputs)                 // whole-object setItem (atomic; storage never half-written)
startSession(startISO)       // append { start: startISO, end: startISO, playedSec: 0 }; save; return its index
flushSession(i, playedSec, endISO)  // update sessions[i].playedSec/end in place; save
endSession(i)                // if sessions[i].playedSec < 1 → drop the record (prune empty listening period); save
```

- **First run = clean start.** If `cello.progress` is absent, `load()` returns the
  default skeleton above and writes it. It **does not** read `cello.sessions`.
- **No "running" flag.** The active listening period is just the last appended
  record, kept current by the practice view's throttled flush (arch §1). A reload
  mid-session leaves a shorter-but-valid record — today's total survives.
- `load()` defensively fills missing `config` keys and coerces missing arrays to
  `[]`, so a partially-written or hand-edited record still projects.

### Local-date correctness — **must get this right**

The engine keys a session to a day by `String(start).slice(0,10)` and compares it to
`ctx.today` (arch / phase-1 §"Input schema"). Both must be the **local** date, or a
session near midnight lands on the wrong day.

- **Do not use `new Date().toISOString()`** — that's UTC; its first 10 chars are the
  UTC date, which drifts from local near midnight (this is a latent bug in the
  placeholder's `saveSession`).
- The shell provides one helper used everywhere a timestamp or `today` is produced:

  ```js
  // local 'YYYY-MM-DDThh:mm:ss' (no 'Z') — slice(0,10) is the LOCAL date
  function localISO(d = new Date()) {
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`
         + `T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  }
  const localToday = () => localISO().slice(0, 10);   // ctx.today
  ```

`session.start`/`end` are written with `localISO()`; `ctx.today = localToday()`. (Raw
`start`/`end` are still kept as analysis data per arch §1 — only their first 10 chars
feed the engine.)

---

## The controller + router — `app/main.js`

A tiny unidirectional loop, no framework (arch §4):

```
inputs = store.load()
rerender():  state = project(inputs, { today: localToday() });  router.render(state)
action:      mutate an input via store → rerender()
```

```js
import { project } from './motivation.js';
import { WORLD_TOUR } from './theme.js';
import * as store from './store.js';
import { Home, Practice, Summary, Collection } from './views/…';

let inputs = store.load();
let view   = 'home';

function rerender() {
  const state = project(inputs, { today: localToday() });
  VIEWS[view].render(root, state, inputs, actions);
}

const actions = {
  go(next) { … },          // switch view (tears down practice if leaving it); rerender
  reloadInputs() { inputs = store.load(); rerender(); },  // after a flush from practice
};
```

### Router model — **in-memory, no hash** (locked)

Views switch by an in-memory `view` variable (show/hide / re-render into `#root`),
**not** URL hash. Rationale:

- On iPhone the back-swipe on a hash route could **exit a live practice session**
  mid-record. In-memory nav can't be triggered by the browser back gesture.
- Single-user, single-session app — bookmarkable routes buy nothing here.
- Leaving the **practice** view must **stop the detector** (release mic + wake lock);
  `actions.go()` owns that teardown so it can never be skipped.

`Summary → Home` and `Collection → Home` are explicit buttons. The browser back
button is a no-op by design.

---

## Detector integration (practice view only) — arch §5

Only `views/practice.js` touches the detector; the engine never knows it exists.
`CelloDetector` and `SettingsStore` are **top-level lexical globals** from the classic
scripts loaded before the module (see index.html) — reach them directly, no `import`.

### Accumulation + throttled flush

```js
const det = new CelloDetector(SettingsStore.load());   // seed detection params (unchanged pattern)
let recIndex = store.startSession(localISO());          // append the live record
let bankedSec = 0, playStart = null;                    // in-memory detected seconds

det.onDetectionChange(on => {
  if (on)                    playStart = performance.now();
  else if (playStart != null){ bankedSec += (performance.now()-playStart)/1000; playStart = null; }
  setBadge(on);
});
const liveSec = () => bankedSec + (playStart != null ? (performance.now()-playStart)/1000 : 0);

await det.start();   // requests mic + wake lock (existing field-tested path); may throw → show message
```

- **Flush every ~5 s** (and on each detection→off edge): write the live count into the
  record, then reproject so persisted state + the secured/momentum logic stay truthful:

  ```js
  store.flushSession(recIndex, Math.round(liveSec()), localISO());
  actions.reloadInputs();   // reproject; picks up secured edge, momentum bump, points
  ```
- **A reload mid-session** loses at most the seconds since the last flush; today's
  total is intact (arch §1).

### Live display — counts **up** only (UX §6, §7.2)

- A **1 s UI tick** updates the on-screen numbers *locally* (no storage write), so the
  count is smooth between flushes. To avoid double-counting the live record, today's
  displayed seconds =

  ```
  todayShownSec = (Σ playedSec of today's records EXCEPT the live one) + liveSec()
  ```

  `todayMin = todayShownSec/60`; `pointsShown = round(todayMin × state.momentum)`.
- **No countdown, no bar-to-15, no "✓ Done".** Numbers are open-ended.
- **Floor-cross toast — quiet.** When `todayMin` first reaches `config.dailyFloorMin`
  (rising edge), show a small, dismiss-itself toast **"Today counts ✓"** — *secured,
  never done*. Points keep climbing after. (The authoritative `secured`/momentum bump
  comes from the next reproject; the toast may fire off the local edge for immediacy.)
- **Detection badge** (subtle): "● cello detected / ● listening…", reusing the
  detector's `onDetectionChange`/`onStatus`. Wake-lock + error states surface via
  `onStatus` exactly as the placeholder handled them.
- Deferred to Phase 5: the "your usual" marker and surprise bonuses — **not** in this
  view yet.

### Stop

```
if (playStart != null) bank the tail;                       // no lost seconds
store.flushSession(recIndex, Math.round(liveSec()), localISO());
store.endSession(recIndex);    // prune if <1s played
det.stop();                    // tears down audio + releases wake lock
actions.reloadInputs(); actions.go('summary');
```

Leaving practice by any path (Stop, or `go()` elsewhere) runs the same teardown.

---

## Views — exact UI

All four render from the single `project()` output (phase-1 §"output contract"):
`state.today.{playedMin,secured,pointsToday,status}`, `state.streak.{current,longest,
atRisk}`, `state.momentum`, `state.points.{total,toNextTile,nextTile}`,
`state.collection.{unlockedIds,nextId,dim}`. Tile metadata comes from `WORLD_TOUR`.

### Home (hub) — UX §7.1

- **Streak** 🔥 + number and **Momentum ×N** side by side — the two fragile things,
  always in view. (Both read 0 / ×1.0 on a fresh start; that's fine and inviting.)
- Big **Start practice** button → `go('practice')` + arm the detector.
- **Today's status, understated** — one quiet line driven by `state.today`:
  - not played: "Not played yet today"
  - secured: "Today counts ✓ · {playedMin|0} min"
  - in progress, sub-floor: "{playedMin} min so far"
  Never a countdown, never a finish line.
- **Collection preview:** the next locked tile (`nextTile`: emoji, name, and
  `toNextTile` → "X pts to go") plus a couple of recently-unlocked tiles. Tap → open
  Collection.
- **Cooled state:** when `state.collection.dim === 1` (a break with no play since),
  preview tiles render greyscaled and a gentle line shows: *"Your world has cooled —
  play to bring it back."* Streak shows 0.
- **Status chips** (Freeze available / Holiday active) are **deferred** — those
  inputs don't exist until Phase 3/4. Render nothing for them now.

### Practice (active session) — UX §7.2, §6

Counts up only (today minutes + points), quiet floor-cross toast, detection badge,
**Stop** button. Full behavior in "Detector integration" above. No countdown, no
"your usual" marker, no bonuses (Phase 5).

### Session summary (on Stop) — UX §7.3

Positive, brief, forward-looking — **no grade**. From the post-stop projection:

- **Minutes today** (`state.today.playedMin`, rounded).
- **Points math made legible:** `"{min} min × ×{momentum} = {pointsToday} pts"` — so
  the multiplier is *felt* (UX §3.3/§6).
- **Progress to next tile:** `nextTile` name + `toNextTile` "pts to go" (or a "whole
  world unlocked!" line if `nextTile == null`).
- **Streak status:** current streak + "🔥 longest {longest}" when relevant.
- A **Done** button → Home. (If a tile unlocked this session — `nextId` moved — a small
  "✨ Unlocked {name}!" celebration is a nice-to-have, not required.)

### Collection / World — UX §7.4, §4

- **CSS grid of cards**, one per `WORLD_TOUR` tile, in cost order: emoji + name.
  Unlocked (`id ∈ unlockedIds`) in full colour; locked dimmed with **🔒** (and its
  `costPoints` shown as the aspirational target). This is the entire visual surface —
  **no per-tile artwork** (UX §4.1).
- **Tap a tile** → reveal its one-line `fact` (and for locked tiles, the cost). Simple
  in-place expand or a small sheet.
- **Progress indicator** toward `nextTile` (`toNextTile`).
- **Break/cooled state:** when `dim === 1`, the whole grid goes greyscale via one CSS
  filter `grayscale(1) opacity(.6)` + the "your world has cooled" line (UX §4.3).
  **Phase 2 is binary** (0 or 1); the **gradual** recolour over `2 × your-usual`
  minutes is Phase 5.
- All ~76 tiles render as plain DOM cards (no perf concern); the engine is
  count-agnostic.

---

## `index.html` — the shell (replaces the placeholder)

Rebuilt page. Load order matters (classic globals before the module):

```html
<script src="detector.js"></script>   <!-- classic: defines lexical global `CelloDetector` -->
<script src="settings.js"></script>    <!-- classic: defines lexical global `SettingsStore` -->
<script type="module" src="main.js"></script>   <!-- ESM controller; reads those globals -->
```

- `CelloDetector` (a `class`) and `SettingsStore` (a `const`) are **top-level lexical
  globals** of the classic scripts; module code in the same realm reads them directly
  once those scripts have run. (Phase 0 already proved module/global coexistence.)
- The page holds a single `#root` the controller renders into, plus the one
  kid-facing stylesheet (inline or `app/app.css` — implementer's call; keep it one
  file, no build).
- `detector.js` / `settings.js` / `settings.html` stay **untouched** (arch §2). The
  old placeholder body and its `cello.sessions` logic are removed; `/settings`
  (detection tuning) is unchanged and still reachable.

---

## Edge cases & how they're handled

| Case | Handling |
|---|---|
| **First run, no data** | `load()` writes the clean skeleton; everything reads 0 / bright / empty (not "cooled"). |
| **Reload mid-session** | Last flush is in storage; today's total intact. Mic stops; user taps Start to re-arm (new record appended). At most ~5 s of un-flushed sound lost. |
| **Session straddles midnight** | `localISO()` stamps the record's `start` with the local date it began; the engine keys by `start`'s date. (Acceptable: a session that crosses midnight counts to its start day — same as the placeholder's day attribution, now *local*-correct.) |
| **Mic permission denied / `det.start()` throws** | Catch, show the message (reuse placeholder's error copy), prune the empty record, return to Home. No half-armed state. |
| **iOS backgrounds/kills the tab during practice** | The record is a valid shorter listening period (last flush); wake-lock/detector recovery is the existing field-tested path in `detector.js`. |
| **Stop with nothing played** | `endSession()` prunes the `<1 s` record — no empty listening periods clutter `sessions[]`. |
| **Break dims the world** | `project()` sets `collection.dim = 1`; Home + Collection render greyscale until the next played day clears it. |
| **Clock jumped backward** | Engine never grants retroactive played days (phase-1 rule); the shell just reads current local date — no special handling needed in Phase 2. |

---

## Done criteria — iPhone field-test (UX §6 the daily loop)

Deploy `app/` to Cloudflare Pages, open on the iPhone in Safari, and confirm:

1. **Start/stop accrues detected time** — bowing moves the minutes; silence doesn't.
2. **The day secures at the floor with a quiet ack** — "Today counts ✓" appears as
   *secured*, **never** a finish line; **no countdown/bar** anywhere; points keep
   climbing past the floor.
3. **Points / Momentum / streak update and persist across reloads** — reload
   mid-session and after Stop; today's minutes and lifetime points survive.
4. **Collection unlocks render** — crossing a tile's threshold shows it unlock; the
   grid reflects unlocked-vs-locked + 🔒; tapping shows the fact.
5. **A missed day dims the world** — simulate (or wait for) a break: streak → 0,
   Momentum → ×1.0, the Collection greyscales, points/tiles **preserved**; the next
   played day re-brightens it.
6. **No console errors;** `/settings` still tunes detection; `window`-global detector
   path intact.
7. **Start → immediate Stop leaves no live mic** — tap Start, then Stop *before*
   granting or denying the mic prompt (and again right after granting). The detector
   fully stops: no lingering recording indicator, no battery drain, no "zombie"
   session. (This exercises the `start()`-cancellation fix; without it, a `stop()`
   that lands while `getUserMedia`/the wake-lock request is still pending leaves a
   live stream + RAF loop owned by no view.)

Plus, before deploy: the app loads with **no console errors** and the engine tests
(`npm test`) remain green (Phase 2 doesn't touch the engine, but guard against an
accidental edit).

---

## Files

- `app/store.js` — `cello.progress` ⇄ inputs; session append/flush/end; `localISO`.
- `app/main.js` — controller, in-memory router, `actions`, the `load→project→render`
  loop.
- `app/views/home.js`, `practice.js`, `summary.js`, `collection.js`.
- `app/index.html` — rebuilt shell (replaces the placeholder), one kid-facing
  stylesheet.
- **Unchanged:** `app/motivation.js`, `app/theme.js`, `app/detector.js`,
  `app/settings.js`, `app/settings.html`.

---

## Test panel (dev tool, ships to prod)

A hidden panel to drive the whole date-driven loop without the mic — essential
for exercising streak/Momentum/collection and the upcoming Phase 3 protection
day-types on the deployed phone.

- **Reach it:** long-press (~800ms) the 🔥 streak number on Home. Deliberately
  undiscoverable in normal tapping; no URL, works from the home-screen icon.
- **Controls:** **+5 min** (synthetic detected practice on the effective today),
  **+ played day** (30 min then advance — fast-builds streaks), **+1 day** (jump
  the effective clock forward), **Clear** (two-tap; wipes `cello.progress` +
  `cello.test`).
- **Non-destructive clock:** a shell-only `cello.test = { dayOffset, tainted }`
  feeds the engine `effectiveToday = realToday + dayOffset` (its `today` is an
  injected parameter — the exact seam). Real session timestamps are never
  rewritten; the offset is reversible. **`motivation.js` is untouched** — the panel
  lives entirely in the impure shell.
- **Taint guard:** any control except Clear sets `tainted`, and the controller
  renders an app-wide **🧪 test data — not real** chip until Clear — so faked
  progress is unmistakable and the child can't mistake it for real (or silently
  trigger it).
- Verified locally: +played day ×7 → streak 7, ×1.5, 257 pts, 5/76; +1 day →
  break (streak 0, ×1, treasure preserved) + world greyscales; Clear → clean app.

## Locked decisions

- **Designed kid-facing look; Collection grid is the centerpiece** — use the
  `frontend-design` skill; one self-contained stylesheet, no build.
- **Start clean** — new `cello.progress` key; the placeholder's `cello.sessions` is
  never read or migrated.
- **Plain Safari page** — no PWA manifest/standalone this phase.
- **In-memory router, no URL hash** — so the iPhone back-swipe can't exit a live
  session, and leaving practice always tears the detector down.
- **`localISO()` for every timestamp + `today`** — session days and `ctx.today` must
  be **local** dates; never `toISOString()` (UTC) where the engine keys on
  `slice(0,10)`.
- **Binary `dim` only** — render the engine's 0/1 dim; gradual recolour is Phase 5.
- **Persist inputs only** — if you reach for a stored streak/points/unlock, stop; it
  belongs in `project()` (arch §8).
</content>
</invoke>
