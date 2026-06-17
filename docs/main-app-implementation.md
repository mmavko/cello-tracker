# Main app — implementation roadmap

The build sequence for the main app. This is the **canonical phase list** — it
supersedes the phasing notes that used to live in `main-app-ux.md` §12 and
`main-app-architecture.md` §7 (both now point here).

- **Behavior** (what each feature does, and why) → [main-app-ux.md](main-app-ux.md),
  referenced by `UX §n` below.
- **Structure** (modules, the pure engine, no-build setup) →
  [main-app-architecture.md](main-app-architecture.md).
- This doc = **order of work, scope boundaries, and done-criteria** per phase.

## How we use this doc

1. Phases are implemented **one at a time**, top to bottom.
2. Before a phase is built, its **detailed spec** is written so implementation is
   unambiguous — exact input/output shapes, exact UI, exact test cases. Deep specs
   live in sibling files `docs/main-app-phase-N.md` (mirroring the
   `stage-1/stage-2` detection-doc pattern), created just-in-time. This roadmap
   only *outlines*; it intentionally doesn't pre-specify everything.
3. Each phase is a **coherent, shippable increment**. From Phase 2 on, every phase
   ends in a real iPhone field-test.
4. **Engine before UI.** Pure-logic phases (1, 3) come with a `node --test` suite
   and no DOM; UI phases (2, 4–8) hang views on an already-proven core.
5. **Maintenance phases** (suffixed, e.g. `3a`) only *correct* already-built phases
   — they edit the relevant `phase-N`/`ux`/`arch` docs **in place** so the spec stays
   self-consistent, and carry no forward design of their own. Once implemented they
   are **collapsed to a one-line tombstone** here; the durable record of what changed
   and when lives in `chronicles.md` + git history, not as a standing phase section.

## Phase overview

| # | Phase | Layer | Field-test | Depends on | Spec status |
|---|---|---|---|---|---|
| 0 | Scaffolding & test harness | infra | — | — | **✅ done** |
| 1 | Engine: core loop | pure | tests only | 0 | **✅ done** ([spec](main-app-phase-1.md)) |
| 2 | UI: core loop | shell | ⏳ on-device test | 1 | **built + live** ([spec](main-app-phase-2.md)) |
| 3 | Engine: day-types & protection | pure | tests only | 1 | **✅ done** ([spec](main-app-phase-3.md)) |
| 3a | Maintenance: lesson-minutes retrofit + Detector rename | both | tests only | 1–3 | **✅ done** *(tombstoned)* |
| 4 | UI: parent area + store mutators | shell | ✅ | 3a | outline |
| 5 | UI: status surfacing (chips + recolour) | shell | ✅ | 4 | outline |
| 6 | UI: history & stats (calendar) | shell | ✅ | 4 | outline |
| 7 | Bonuses & "your usual" anchor | both | ✅ | 4 | outline |
| 8 | Super-admin / engineer view | shell | ✅ | 4 | outline |

Deploys are manual (`./deploy.sh` — cache-busts each module URL; see arch §3), so
building on `main` doesn't touch the live app until we choose to deploy. Phase 2 was
the first deploy of the real app; Phases 0–1 landed without deploying.

---

## Phase 0 — Scaffolding & test harness

**Goal.** Establish the no-build ESM + `node --test` skeleton so every later phase
drops into a known-good structure. First time we introduce modules and tests, so
prove the plumbing before any logic.

**Scope.**
- Root `package.json`: `{ "type": "module", "scripts": { "test": "node --test" } }`,
  **zero dependencies**.
- `app/motivation.js`, `app/theme.js` — pure stubs exporting the agreed signatures
  (`project`, `shouldOfferBonus`, `MOMENTUM_TIERS`).
- `test/smoke.test.js` — imports the stub, asserts it loads & returns a shape.
  Proves native ESM import under `node --test`.
- `app/main.js` stub + an `index.html` module shell that loads `detector.js`
  (classic) then `<script type="module" src="main.js">` and renders a placeholder.
  Proves browser module loading coexists with the detector global.

**Out of scope.** Any real logic; replacing the live placeholder app (keep it until
Phase 2).

**Done when.** `npm test` is green; `index.html` loads `main.js` as a module and
renders with no console errors; `window.CelloDetector` is still reachable.

**Files.** `package.json`, `test/smoke.test.js`, `app/{motivation,theme,main}.js`,
`app/index.html` (shell).

---

## Phase 1 — Engine: core loop (pure, test-first)

**Goal.** A proven-correct motivation engine for the core loop, no UI. Delivers the
brain behind UX §2's anti-satisficing resolution.

**Scope.**
- Finalize the **input schema** (`config`, `sessions[]`; `lessonDays[]`/`holidays[]`/
  `bonuses[]` reserved but unhandled yet) — arch §1.
- `project(inputs, {today})` handling **Played** (daily played total ≥ floor) and
  **Missed → break**; `streak.current/longest`; **Momentum** tiers
  (UX §3.2); **points** = Σ(min × Momentum) (UX §3.3); **collection** unlock from
  points (UX §4); live today (`secured`, `isOvertime`, `pointsToday`); `daysIndex`.
- `theme.js` — the world-tour tile list with escalating costs (UX §4.2).
- `node --test` suite: Momentum tiers, points math, collection-unlock thresholds,
  streak grow/break, multi-day replay determinism, live partial-day projection.

**Out of scope (later phases break the streak on any miss for now).** Freeze, Rest
day, Lesson, Holiday (Phase 3); gradual recovery — a simple `dim` flag is fine
(Phase 5 animates it); bonus logic (`shouldOfferBonus` stays a stub).

**Done when.** Suite green over the listed cases; `motivation.js`/`theme.js` import
cleanly under `node --test` with no browser shims (purity guard).

**Files.** `app/motivation.js`, `app/theme.js`, `test/motivation.*.test.js`.

---

## Phase 2 — UI: core loop (first real app)

**Goal.** The core loop usable and field-testable on iPhone. First deploy of the
real app, replacing the placeholder.

**Scope.**
- `store.js` — `localStorage['cello.progress']` ⇄ inputs; append a finished session.
- `main.js` — controller + tiny view router (hash or show/hide) + the
  `load → project → render` loop and `action → reproject → render` (arch §4).
- Views: **home** (streak, Momentum, Start button, collection preview, understated
  today status), **practice** (wires `CelloDetector`, counts **up**, live
  points/Momentum, quiet "Today counts ✓", **no countdown**, Stop), **summary**
  (minutes, points math spelled out, progress to next tile, streak), **collection**
  (emoji-tile CSS grid, unlocked/locked + 🔒, `dim` on break).
- Seed detector from `SettingsStore`; wake lock via the detector.

**Out of scope.** Parent area, calendar, all protection day-types, bonuses, the
"your usual" anchor, gradual recolour.

**Done when (iPhone field-test).** Start/stop accrues detected time; the day
secures at the floor with a quiet ack (never a finish line); points/Momentum/streak
update and persist across reloads; collection unlocks render; a missed day dims the
world.

**Files.** `app/store.js`, `app/main.js`, `app/views/{home,practice,summary,collection}.js`,
`app/index.html`.

---

## Phase 3 — Engine: day-types & protection (pure, test-first)

**Goal.** The full streak-protection lifecycle, proven in tests, before any UI for
it. This is UX §5 in full.

**Scope.**
- Extend `project()` to the complete §9 precedence machine: **Lesson**, **Rest
  day**, **Frozen** (regen after 7 played-equivalent days; never two in a row),
  **Holiday** (pause; excluded from regen), with **played + lesson stacking**
  (streak +1 once, points stack) and **recovery accounting** (recolour budget =
  2 × your-usual).
- Honor new inputs: `lessonDays[]`, `holidays[]`, `config.restWeekday`,
  `config.lessonLenMin`. Derive `freeze.{banked,regenInDays}`, `streak.atRisk`.
- **Lesson backfill** (any past date) handled purely by replay.
- Tests: every day-type; precedence order; freeze consume/regen/no-two-in-a-row;
  weekly rest cadence **with a mid-week holiday and no desync**; lesson backfill
  un-breaks a break; holiday pause; recovery recolour; stacking. Phase-1 tests
  still pass.

**Out of scope.** UI for any of it (Phase 4); bonuses (Phase 5).

**Done when.** Extended suite green including the tricky transitions; no regressions.

**Files.** `app/motivation.js` (extended), `test/` additions.

---

## Phase 3a — Maintenance: lesson-minutes retrofit + Detector rename

**Done — tombstoned.** `lessonDays[]` is now `[{date, lenMin}]` (per-lesson points/
recovery, `config.lessonLenMin` removed); `app/settings.html` → `app/detector.html`.
Full history: chronicles + git.

---

## Phase 4 — UI: parent area + store mutators

**Goal.** The parent input surface — every protection knob becomes enter-able, which
unblocks observing protection in the child UI (Phases 5–6).

**Scope.**
- `parent.html` — entry gated by a **first-time PIN** (set-by-entering-twice; **no
  reset path yet** — parked, see Phase 8). New parent-area icon on Home, distinct
  from the Detector-page link (now relocated here).
- Controls (UX §7.6): prominent **Log a lesson** — pick **any past date** (date
  stepper, default today, capped at today) with a per-lesson **minute stepper**
  (+5/−5, pre-filled from the last lesson); set **rest weekday**; set **daily
  floor**; declare **Holiday** ranges; optionally **grant a freeze**. Parent-gating
  is the *sole* anti-gaming guard (no date-window restriction — UX §5.3).
- Store mutators + actions: append/edit `lessonDays`/`holidays`, set `config` →
  reproject.

**Out of scope.** Home status chips + recolour (Phase 5); calendar/stats (Phase 6);
bonuses/anchor (Phase 7); editing/removing past facts (Phase 8).

**Done when (iPhone field-test).** Parent can log a lesson for any past date with a
chosen length and it reflects — un-breaking a break if applicable; the rest weekday
holds the streak; a holiday pauses it. All via reproject, facts only.

**Files.** `app/parent.html`, `app/main.js` (+actions), `app/store.js` (+mutators).

---

## Phase 5 — UI: status surfacing (chips + recolour)

**Goal.** Make the protection state the engine already computes **visible** in the
child app — now testable because Phase 4 can create those states.

**Scope.**
- Home **status chips**: freeze available, holiday active, rest day (UX §7.1).
- **Longest-streak headline** on Home (child-visible; UX §3, §7.1).
- **Gradual recolour** — animate `dim` 1 → 0 over 2 × your-usual minutes of return
  practice (UX §4.3) in collection/home. *Order-independent:* the continuous `dim`
  value already exists (Phase 3), so this is only the CSS transition over it and
  could land any time after Phase 2.

**Out of scope.** Calendar + detailed stats (Phase 6).

**Done when (iPhone field-test).** Chips reflect states created via the parent area;
the recolour animates smoothly on a break→return; longest-streak shows.

**Files.** `app/views/{home,collection}.js`, `app/main.js`.

---

## Phase 6 — UI: history & stats (calendar)

**Goal.** The streak's story, made legible — and a tidy home for the drier numbers.
*Deferrable:* the streak works without it.

**Scope.**
- `views/calendar.js` — month grid colour-coded by day-type (played/lesson/rest/
  frozen/holiday/missed), UX §7.5.
- **Detailed stats** co-located here (totals, weekly minutes) — **child-visible, not
  gated** (the PIN guards *controls*, not *visibility*; UX §7.6). Keeps Home
  uncluttered while the headline stats stay on Home (Phase 5).

**Out of scope.** Bonuses/anchor (Phase 7).

**Done when (iPhone field-test).** Calendar shows the day-type history; detailed
stats render; nothing here requires the PIN.

**Files.** `app/views/calendar.js`, `app/main.js`.

---

## Phase 7 — Bonuses & "your usual" anchor

**Goal.** The motivational finish — the genuinely-new stickiness work.

**Scope.**
- **Surprise bonuses** — pure `shouldOfferBonus` rule (UX §6.1) + shell RNG roll in
  the practice view; on a hit, append to `bonuses[]` and reproject. Overtime-gated,
  per-session cap, probability ramp, golden drop.
- **"Your usual" anchor** — per-session trailing-median marker in the practice view
  (UX §6); also the recovery-target source.

**Out of scope.** Direct fact editing (Phase 8).

**Done when (iPhone field-test).** Bonuses fire only in overtime with correct odds
(seeded test for the rule); the anchor shows.

**Files.** `app/motivation.js` (`shouldOfferBonus`, your-usual), `app/views/practice.js`,
`test/` additions.

---

## Phase 8 — Super-admin / engineer view

**Goal.** A single recovery surface that makes any wrong state fixable — which is why
earlier phases can skip defensive guards.

**Scope.**
- A gated **engineer view** to directly edit/remove any underlying fact (`sessions`,
  `lessonDays`, `holidays`, `config`); everything re-derives through `project()`.
- Candidate owner of **PIN reset** and mistake-correction (e.g. remove a
  wrongly-logged lesson). *Open:* how a forgotten PIN is recovered when this view
  itself sits behind the PIN — to be designed in this phase's deep spec.

**Done when.** *(deep spec TBD)* — drafted just-in-time, after Phase 7.

**Files.** *(TBD in the deep spec.)*

---

## Next action

Phases 0–3a are **built**. Phase 2 (the real app) is **live** at
https://cello.mavko.consulting; Phase 3 (engine: day-types & protection) is green but
**not yet wired to any UI** — pure engine + tests only. `npm test` passes.

**Next = Phase 4** (UI: parent area + store mutators), now unblocked since 3a's
lesson shape (`{date, lenMin}`) and the Detector rename are in place.

Still outstanding from Phase 2: the **iPhone field-test** of the core loop (mic
accrual, the quiet "Today counts ✓", persistence across reloads, an unlock, a break
dimming the world, Start→immediate-Stop leaves no live mic).
