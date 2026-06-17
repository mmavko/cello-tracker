# Phase 5 — UI: status surfacing (chips + recolour)

Deep spec for Phase 5 (see [main-app-implementation.md](main-app-implementation.md)).
Make the protection state the engine **already computes** visible in the child app —
now testable because Phase 4 can create those states (lessons, days-off/holidays,
rest weekday, floor). Three deliverables: **Home status chips**, the **longest-streak
headline**, and **gradual recolour** of the cooled world.

This is almost entirely shell work. The one engine touch is a single derived
**output** field (`today.isRestDay`) — see decision #1; `project()`'s inputs,
machine, and every existing assertion are unchanged.

---

## Load-bearing decisions (read before writing code)

1. **One small engine addition: `today.isRestDay`.** Today is resolved to `open` (not
   `rest`/`frozen`/`missed`) because the `D === today` branch in §9 short-circuits
   before those — today's protections are decided at rollover, not live. So the view
   **cannot** read "today is a rest day" from `today.status`. The engine already
   evaluates this exact condition for `atRisk`; expose it as a derived boolean rather
   than **re-deriving the weekday rule in the view** (which would duplicate engine
   logic and violate "the engine is the single source of derived state"). Compute it
   beside the existing today-capture and add it to the returned `today` object:
   ```js
   // after the replay loop, where todayStatus / restWeekday / weekdayOf exist:
   const todayIsRestDay =
     restWeekday != null && weekdayOf(today) === restWeekday && todayStatus === "open";
   // …and in the returned today: { …, isRestDay: todayIsRestDay }
   ```
   This expands Phase 5's file list beyond the roadmap's `views/* + main.js` to also
   touch `motivation.js` + one test — a deliberate, flagged trade vs. view-side
   re-derivation. Everything else in the engine is untouched; `npm test` goes 38 → 39.

2. **Gradual recolour is render-the-continuous-`dim`, not a live tween.** The engine
   already exposes `collection.dim` (continuous `1 → 0` over `2 × your-usual` minutes,
   §4.3) and `recovery.progress`. The recolour is **observed between visits** (she's on
   the Practice screen during the comeback session, not looking at the world), so the
   feature is "each time she opens Home/Collection it's rendered at the correct warmth."
   **Gotcha:** both views set `root.innerHTML = …` every render, so `.world` is a *new*
   element each time — a bare `transition: filter` will **not** animate (nothing to
   transition *from*). To get the rewarding "warming" feel, use a one-frame entrance:
   render slightly greyer, then `requestAnimationFrame` to the true value (snippet in
   the Collection section). The must-have is correct static warmth; the warm-up is the
   delight on top.

3. **No "at-risk" warning on Home — deliberate.** `streak.atRisk` is available and
   tempting to surface, but the design's humane-loss-aversion line (UX §10 "streak
   dread / anxiety", §2.6) says the felt loss is the Momentum drop, never a nagging
   countdown. Chips state what's *protecting* her (calm), never what she's about to
   lose. Leave `atRisk` unsurfaced here.

4. **Chips read existing outputs** (plus #1): `freeze.banked`, `today.status ===
   "holiday"`, `today.isRestDay`. No new inputs, no store changes.

---

## Files

| File | Change |
|---|---|
| `app/motivation.js` | **edit** — add the derived `today.isRestDay` (decision #1). Nothing else. |
| `test/protection.test.js` | **edit** — one assertion for `today.isRestDay` (below). |
| `app/views/home.js` | **edit** — chip row, longest-streak headline, protection-aware status line, continuous recolour of the preview emojis. |
| `app/views/collection.js` | **edit** — continuous recolour + entrance warm-up; two-tier cooled note. |
| `app/index.html` | **edit** — CSS for chips, the streak-best line, and the `transition: filter` rule (the views are inline-styled HTML strings, so their CSS lives here). |
| `store.js`, inputs | **untouched.** |

---

## Engine: `today.isRestDay` + test

Add the field per decision #1. Then in `test/protection.test.js` (dates: `2026-06-14`
is a **Sunday** = weekday `0`; `2026-06-17` is a Wednesday):

```js
test("P22 · today.isRestDay flags an unplayed rest weekday, not a played one", () => {
  const rest = project(mk({ config: { restWeekday: 0 } }), { today: "2026-06-14" });
  assert.equal(rest.today.isRestDay, true);            // Sunday, nothing played → optional
  const playedRest = project(mk({ config: { restWeekday: 0 }, sessions: played(["2026-06-14"]) }), { today: "2026-06-14" });
  assert.equal(playedRest.today.isRestDay, false);     // she played → it's a Played day
  const weekday = project(mk({ config: { restWeekday: 0 } }), { today: "2026-06-17" });
  assert.equal(weekday.today.isRestDay, false);        // Wednesday → not the rest day
});
```

---

## Home (`app/views/home.js` + CSS)

**A. Status chips.** A small pill row under the hero (above the Start button), shown
only when non-empty. Calm, reassuring tone.

```js
const chips = [];
if (state.freeze.banked)            chips.push({ icon: "❄️", label: "Freeze ready" });
if (today.status === "holiday")     chips.push({ icon: "🏝️", label: "Holiday" });
if (today.isRestDay)                chips.push({ icon: "😌", label: "Rest day" });
// render: <div class="chips">…<span class="chip">❄️ Freeze ready</span>…</div>  (omit row if empty)
```
(Optional, default OFF to keep Home calm: when `!freeze.banked`, a muted "freeze in
`freeze.regenInDays` days" chip. Mention to the user before adding.)

**B. Longest-streak headline.** Currently buried in the footer (`🔥 longest N`).
**Promote** it next to the streak hero as a quiet record line (e.g. under the
"days in a row" label: `best ${streak.longest}`), and **remove the footer copy** so
it isn't shown twice. When `streak.current === streak.longest && current > 0`, an
optional "🌟 your best ever" flourish. Keep `points.total` + version + 🔑 in the footer.

**C. Protection-aware status line.** A plain "Not played yet today" misreads a
protected or lesson-credited day as a gap. The label is a **prefix**; accrued mic
minutes **append whenever she played some** — sub-floor minutes still earn points even
on a holiday/rest/lesson day, so never hide them. `secured` is checked first (playing
to the floor beats a holiday and secures a lesson day). The lesson line carries an
**"at home"** qualifier because a lesson day has two minute quantities — the lesson's
own `lenMin` and her home practice — so a bare "· N min" would read as the lesson length
(holiday/rest can't have a lesson — that would make `status === "lesson"` — so their N
is unambiguous):
```js
const shownMin = Math.round(today.playedMin);
let statusLine;
if (today.secured)                   statusLine = `Today counts ✓ · ${shownMin} min`;
else if (today.status === "lesson")  statusLine = `Lesson logged ✓${shownMin >= 1 ? ` · ${shownMin} min at home` : ""}`;
else if (today.status === "holiday") statusLine = shownMin >= 1 ? `Holiday 🏝️ · ${shownMin} min` : "Holiday — enjoy your day off 🏝️";
else if (today.isRestDay)            statusLine = shownMin >= 1 ? `Rest day · ${shownMin} min` : "Rest day — playing's optional today";
else if (shownMin >= 1)              statusLine = `${shownMin} min so far`;
else                                 statusLine = "Not played yet today";
```

**D. Recolour the preview emojis.** Replace the binary `.cooled` toggle. Compute the
filter from the continuous dim and apply it inline to the preview emojis
(`.next-emoji`, `.mini-stamp`) — greys the *emoji art*, never the text:
```js
const dim = state.collection.dim;                       // 0..1
const warmFilter = `grayscale(${dim}) opacity(${(1 - 0.4 * dim).toFixed(3)})`;
// set style="filter:${warmFilter}" on each preview emoji span
```
Show the cooled note while `recovery.active` (two-tier copy): `dim === 1` →
"Your world has cooled — play to bring it back."; `0 < dim < 1` → "Warming back up —
keep playing 🎨". (Home is the glanceable surface; no entrance animation needed here —
static-correct warmth is enough. The Collection is the showcase.)

---

## Collection (`app/views/collection.js` + CSS)

Replace the binary `cooled = dim === 1` with continuous recolour on `.world`, plus the
entrance warm-up (decision #2):

```js
const dim = state.collection.dim;
const warmFilter = `grayscale(${dim}) opacity(${(1 - 0.4 * dim).toFixed(3)})`;
// …after setting root.innerHTML…
const world = root.querySelector(".world");
if (dim > 0) {
  // start a step greyer, then animate to the true warmth on the next frame
  world.style.filter = `grayscale(${Math.min(dim + 0.3, 1)}) opacity(${(1 - 0.4 * Math.min(dim + 0.3, 1)).toFixed(3)})`;
  requestAnimationFrame(() => { world.style.filter = warmFilter; });
} else {
  world.style.filter = warmFilter;                      // grayscale(0) opacity(1) = no effect
}
```
- CSS: `.world { transition: filter 1.2s ease; }` (replaces the old
  `.view-collection.cooled .world { … }` rule).
- Cooled note: same two-tier copy as Home, shown while `recovery.active`.
- The grid contents, fact-sheet, and unlock rendering are unchanged.

---

## CSS (`app/index.html`)

Add, in the warm palette (tokens already defined):
- `.chips { display:flex; gap:8px; flex-wrap:wrap; justify-content:center; margin:6px 0; }`
  and a `.chip` pill (reuse `.badge`-like styling: `var(--paper-2)`, `1px var(--line)`,
  `999px`, small + tabular). Keep them visually quiet — they're reassurance, not alerts.
- `.streak-best` — small, `var(--ink-soft)`, tabular-nums, sits under the streak label.
- `.world { transition: filter 1.2s ease; }` — and **delete** the old
  `.view-collection.cooled .world` / `.view-home.cooled` filter rules (now inline).

---

## Verification

- **`npm test` = 39/39** — the existing 38 unchanged + the new `today.isRestDay` test.
  If any of the 38 move, the engine edit overreached.
- **Browser QA (delegate to a Haiku subagent; localhost or after Clear).** Drive states
  via the parent area + test panel:
  1. Bank a freeze (fresh user) → "❄️ Freeze ready" chip on Home.
  2. Mark today as a day off in the parent area → "🏝️ Holiday" chip + status line
     "enjoy your day off"; streak doesn't read as at-risk.
  3. Set rest weekday = today's weekday, don't play → "😌 Rest day" chip + "playing's
     optional"; play ≥ floor → chip gone, "Today counts ✓".
  4. Build a streak, break it (test panel: advance 2 empty days) → world greyscales,
     cooled note shows; longest-streak headline holds its value.
  5. Play part of a comeback → reopen Collection: world is **partly** recoloured and
     visibly warms on open; readout/recovery progress advances; play enough → fully
     vivid, note gone.

### Done when (iPhone field-test)

Chips reflect states created via the parent area; the longest-streak headline shows;
a break greys the world and a return **gradually** warms it back over ~2 typical
sessions, animating on each visit. All from existing engine output (plus
`today.isRestDay`); facts-only, no stored derived values.

---

## Out of scope (later phases)

- Calendar + detailed stats (Phase 6) — the day-by-day `daysIndex` history view.
- Bonuses + "your usual" anchor (Phase 7).
- Any `atRisk` surfacing (decision #3 — intentionally never).
