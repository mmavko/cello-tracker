# Phase 4 — UI: parent area + store mutators

Deep spec for Phase 4 (see [main-app-implementation.md](main-app-implementation.md)
for where it sits). **Engine-complete already** — every knob below is an input the
pure engine *already* honors (lessons since Phase 3a, holidays/floor/rest-weekday
since Phase 3). So Phase 4 is **pure shell**: a gated input surface that mutates
facts and lets `project()` re-derive everything. **Do not touch `motivation.js`** —
if you feel the urge to, you've mis-scoped something; stop and re-read this.

## Goal

Give the parent an input surface for every protection knob, so the protection logic
the engine already computes becomes *observable* in the child UI (unblocks Phases
5–6). The child app re-projects on its next load — no derived state is ever stored.

---

## Load-bearing decisions (read before writing code)

1. **Separate page + its own module entry: `parent.html` + `parent.js`.** Not an
   in-router view. This matches arch §2 and parallels `detector.html`. **Why a
   `parent.js` module and not an inline script:** `deploy.sh` cache-busts
   `from "./x.js"` only inside **`.js`** files and `src="x.js"` only inside
   **`.html`**. An inline `<script type="module">` in the HTML that did
   `import … from "./store.js"` would **not** get its import stamped → stale-module
   risk (the 4h CF cache gotcha). So: `parent.html` carries
   `<script type="module" src="parent.js">` (stamped as an HTML `src`), and
   `parent.js` does the `import … from "./store.js"` (stamped as a JS `from`). Both
   URLs bust correctly. Verify after deploy that the footer build stamp matches.

2. **The PIN is shell auth state, NOT an engine fact.** It lives in its **own**
   localStorage key `cello.parent`, never in `cello.progress`. Keeping it out of the
   engine input object preserves the "inputs = the 5 fact arrays" shape (same reason
   `cello.test` is separate). Plaintext is acceptable for the threat model (one young
   child, one device, no backend); SHA-256 via SubtleCrypto is optional hardening,
   not required.

3. **"Protect a day off" = a one-day Holiday.** A parent-declared day that holds the
   streak is the `Holiday` primitive (§9 checks it before the auto-freeze; excluded
   from regen; "playing beats it"). A single sick day is `{start: D, end: D}` in
   `holidays[]`; a trip is a wider range. No engine change. Because Holiday is checked
   before the auto-freeze, declaring a known day off does **not** consume the
   automatic backstop — it stays banked for a genuine surprise slip. (Future hook, NOT
   built now: an optional `kind` field on a holiday entry if Phase 6's calendar later
   wants to colour sick-days distinctly from trips — re-skinnable with no data
   migration.)

4. **Every mutation is "edit one fact array → save → re-read → re-render."** No
   derived values are written. After a mutation, re-`project()` for the on-page
   readout so the parent sees the effect (and so it's field-testable).

5. **Use `store.effectiveToday()` for date defaults/caps, never the raw clock.** The
   test panel drives the app via a day-offset; `parent.js` must read the *effective*
   day so QA through the test harness (and the iPhone field-test) stays consistent.

---

## Files

| File | Change |
|---|---|
| `app/parent.html` | **new** — shell: warm-palette tokens + a `<div id="root">` + `<script type="module" src="parent.js">`. |
| `app/parent.js` | **new** — the module: PIN gate → controls → mutate → reproject → readout. |
| `app/store.js` | **edit** — add the mutators + PIN helpers below; export `addDaysStr`. |
| `app/views/home.js` | **edit** — relocate the Detector ⚙ into the parent area; add a parent-area entry icon on Home. |
| `motivation.js`, `test/*` | **untouched.** `npm test` stays 38/38. |

---

## Store mutators (`app/store.js`)

All operate on `cello.progress` via the existing `load()`/`save()`. Add:

```js
// ── Parent-area facts ────────────────────────────────────────────────────────

// Upsert a lesson: one lesson per date (replace any existing entry for that date,
// so re-logging the same day corrects rather than duplicates). lenMin is the
// lesson's own length (Phase 3a: lessonDays[] = [{date, lenMin}]).
export function logLesson(date, lenMin) {
  const inputs = load();
  inputs.lessonDays = inputs.lessonDays.filter((l) => l.date !== date);
  inputs.lessonDays.push({ date, lenMin: Math.max(1, Math.round(lenMin)) });
  save(inputs);
}

// Append a parent-declared protected range (inclusive). One day = start === end.
// Overlaps are harmless (engine's inHoliday is "D within ANY range").
export function addHoliday(start, end) {
  const inputs = load();
  inputs.holidays.push({ start, end });
  save(inputs);
}

// Merge a config patch (dailyFloorMin, restWeekday). Low-stakes → save on change.
export function setConfig(patch) {
  const inputs = load();
  inputs.config = { ...inputs.config, ...patch };
  save(inputs);
}

// ── PIN (separate key; not an engine input) ──────────────────────────────────
const PARENT_KEY = "cello.parent";
export function hasPin() {
  try { return !!JSON.parse(localStorage.getItem(PARENT_KEY))?.pin; } catch { return false; }
}
export function setPin(pin) { localStorage.setItem(PARENT_KEY, JSON.stringify({ pin })); }
export function checkPin(pin) {
  try { return JSON.parse(localStorage.getItem(PARENT_KEY))?.pin === pin; } catch { return false; }
}
```

Also **export `addDaysStr`** (currently module-private) so the date stepper can
step days: `export function addDaysStr(dateStr, n) { … }` (unchanged body).

**Editing/removing past facts is out of scope** (Phase 8 / engineer view) — except
the lesson **upsert** above, which is just keeping one-lesson-per-day canonical, not
a general edit surface. There is no `removeHoliday`/`removeLesson` in Phase 4.

---

## `parent.html` + `parent.js`

**Shell (`parent.html`).** Mirror `index.html`'s `<head>` for the warm
musician's-passport palette — copy the `:root` token block and the base
`body`/`#root`/`button`/`h1` rules (or factor them out; a copy is fine, no-build
project). Body = `<main id="root"></main>` + `<script type="module" src="parent.js">`.
No detector/settings scripts needed here.

**Module (`parent.js`).**

```js
import { project } from "./motivation.js";
import * as store from "./store.js";
```

### PIN gate (renders first)

- `unlocked` is an **in-memory** boolean, **never persisted** — leaving or reloading
  `parent.html` always re-gates (a child picking up the device later still hits it).
- **First run** (`!store.hasPin()`): "Create a PIN." Enter a 4-digit PIN, then
  confirm it; on match → `store.setPin(pin)` → unlock. On mismatch → clear + retry.
- **Returning** (`store.hasPin()`): "Enter PIN." On `store.checkPin` true → unlock;
  on false → clear input + a brief shake/error (no lockout needed).
- Input: `<input type="password" inputmode="numeric" maxlength="4" autocomplete="off">`.
- **No reset path** (parked → Phase 8). One-line note in the gate: a forgotten PIN is
  recovered from the future grown-up tools; for now, clearing site data resets it.

### Controls (render after unlock)

Re-render the readout after every mutation: recompute
`const state = project(store.load(), { today: store.effectiveToday() });`

**A. Log a lesson** — *the* high-frequency action; make it the most prominent card.
- **Date** — a stepper: `−` / displayed date / `+`. State starts at
  `store.effectiveToday()`. `−` = `store.addDaysStr(d, -1)` (no lower bound); `+` =
  `+1` but **capped at `effectiveToday()`** (disable `+` when already today — a
  lesson can only be logged for today or the past). Show weekday + date + a relative
  hint ("today" / "yesterday" / "N days ago"). When formatting, parse as
  `new Date(dateStr + "T12:00:00")` (local noon) so the day never shifts by TZ.
- **Length** — a minute stepper `−5` / value / `+5`, range **5–180**, default =
  **last lesson's `lenMin`** (the entry with the max date in `inputs.lessonDays`) or
  **45** if none.
- **Log lesson** button → `store.logLesson(date, lenMin)` → toast "✓ Lesson logged
  for {date}" → re-render. (Engine then credits streak +1, `lenMin × Momentum`
  points, and recovery — and back-dating un-breaks a break / refunds a freeze for
  free.)

**B. Protect days off** — the parent's freeze, *and* trips, in one control.
- Two native `<input type="date">`: **start** (default `effectiveToday()`) and
  **end** (default = start; if start moves past end, snap end to start). These MAY be
  future (pre-declared trips) or past (a sick day already happened).
- Helper: *"One day off (sick, recital)? Leave the end date the same. A trip? Set the
  range. These days hold the streak — they never break it, and they don't spend the
  emergency freeze."*
- **Mark days off** button → validate `end >= start` → `store.addHoliday(start, end)`
  → toast → re-render.

**C. Daily floor** — minute stepper `−5`/value/`+5`, range **5–60**, default
`state` config floor (15). Save on change → `store.setConfig({ dailyFloorMin })`.

**D. Rest weekday** — a single-select of **None · Sun · Mon · Tue · Wed · Thu · Fri ·
Sat** → `null` or `0–6`. Default from config. Save on change →
`store.setConfig({ restWeekday })`.

**E. Detector link** — "Tune note detection →" → `href="detector.html"`. (Relocated
here from Home for a clean hub; `detector.html` itself stays directly URL-reachable,
so it's effectively unprotected — fine, it's detection tuning, not motivation.)

**F. Live readout** (like the test panel's) — Day (`effectiveToday`), Streak (+max),
Momentum, Points, Floor, Rest day, lessons logged, days-off declared. This is the
field-test verification surface; re-render it after each mutation.

**G. Back to tracker** — `href="/"` (full nav back to `index.html`, which reloads →
re-projects fresh; mirrors `detector.html`'s back link).

---

## Home change (`app/views/home.js`)

The footer currently has `<a class="tune" href="detector.html">⚙</a>`. **Relocate**
that Detector link into the parent area (control E above) and put a **parent-area
entry** on Home in its place — a distinct, adult-reading icon (e.g. `🔑` /
"grown-ups") linking to `parent.html`. Keep it understated (it's not a child action).
Match the existing `.tune` footer styling.

---

## Deploy & cache-bust

`deploy.sh` globs all `*.html`/`*.js`, so `parent.html` + `parent.js` are picked up
automatically — **provided** the module structure in decision #1 is followed (HTML
`src=` + JS `from`). After `./deploy.sh`, confirm the Home footer build stamp matches
the build you shipped **before** trusting any browser check (the standing gotcha).

---

## Testing & verification

- **`npm test` stays 38/38** — there is no engine change. If the suite count moves,
  you've touched something you shouldn't have.
- **No new node tests** — store mutators touch `localStorage` (browser-only) and the
  engine paths they feed are already covered (P7–P10, P15, P20, holiday/floor/rest
  tests). Don't add brittle DOM tests.
- **Browser QA (delegate to a Haiku subagent, localhost or after Clear — never drive
  the test panel against prod).** Checklist:
  1. First visit to `/parent.html` → create-PIN flow; set a PIN; controls appear.
  2. Reload `/parent.html` → re-gated; correct PIN unlocks, wrong PIN errors.
  3. Log a lesson for **2 days ago** at 30 min → readout streak/points reflect it;
     open `/` → Home shows the change.
  4. With a fresh streak, advance the test clock to create a **break**, then log a
     lesson for the missed day → break un-does (streak restored). *(This is the
     headline "facts-only reproject" proof.)*
  5. Mark **today** as a day off (start = end) → an otherwise-empty today doesn't
     break the streak; the banked freeze is still shown banked (not spent).
  6. Set floor to 20 and rest weekday to Sun → readout reflects; child app honors.
  7. Detector link opens `detector.html`; "Back to tracker" returns to `/`.

### Done when (iPhone field-test)

Parent can: log a lesson for any past date with a chosen length and see it reflect
(un-breaking a break if applicable); mark a day/range off that holds the streak
without spending the freeze; set the floor and rest weekday. All via reproject, facts
only — no stored derived values, `npm test` green.

---

## Out of scope (later phases)

- Home status chips + gradual recolour (Phase 5).
- Calendar + detailed stats (Phase 6); the `kind`-tagged holiday colour hook.
- Bonuses + "your usual" anchor (Phase 7).
- Editing/removing arbitrary past facts; PIN reset (Phase 8 / engineer view).
