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
   and no DOM; UI phases (2, 4) hang views on an already-proven core.

## Phase overview

| # | Phase | Layer | Field-test | Depends on | Spec status |
|---|---|---|---|---|---|
| 0 | Scaffolding & test harness | infra | — | — | **✅ done** |
| 1 | Engine: core loop | pure | tests only | 0 | **✅ done** ([spec](main-app-phase-1.md)) |
| 2 | UI: core loop | shell | ✅ first real app | 1 | outline |
| 3 | Engine: day-types & protection | pure | tests only | 1 | outline |
| 4 | UI: protection & parent area | shell | ✅ | 2, 3 | outline |
| 5 | Polish & stickiness | both | ✅ | 4 | outline |

Deploys are manual (`wrangler pages deploy app/`), so building on `master` doesn't
touch the live placeholder until we choose to deploy. Phase 2 is the first deploy
of the real app; Phases 0–1 can land without deploying. Use a preview branch if
on-device testing is wanted earlier.

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
- **Lesson backfill** (today/yesterday) handled purely by replay.
- Tests: every day-type; precedence order; freeze consume/regen/no-two-in-a-row;
  weekly rest cadence **with a mid-week holiday and no desync**; lesson backfill
  un-breaks a break; holiday pause; recovery recolour; stacking. Phase-1 tests
  still pass.

**Out of scope.** UI for any of it (Phase 4); bonuses (Phase 5).

**Done when.** Extended suite green including the tricky transitions; no regressions.

**Files.** `app/motivation.js` (extended), `test/` additions.

---

## Phase 4 — UI: protection & parent area

**Goal.** Expose protection and parent controls; show the streak's story.

**Scope.**
- `parent.html` — PIN-gated (UX §7.6). Prominent **Log a lesson** (today/yesterday);
  set **rest weekday** and **lesson length**; declare **Holiday** ranges; set
  **daily floor**; stats; grant an extra freeze.
- `views/calendar.js` — month grid colour-coded by day-type (played/lesson/rest/
  frozen/holiday/missed), UX §7.5.
- Home status chips: freeze available, holiday active, rest day.
- Store mutators + actions: add `lessonDays`/`holidays`/`config` → reproject.

**Out of scope.** Bonuses, anchor, gradual recolour.

**Done when (iPhone field-test).** Parent can log a lesson (incl. yesterday) and it
reflects — un-breaking a break if applicable; the rest weekday holds the streak; a
holiday pauses it; the calendar shows the day-type history.

**Files.** `app/parent.html`, `app/views/calendar.js`, `app/main.js` (+actions),
`app/store.js` (+mutators).

---

## Phase 5 — Polish & stickiness

**Goal.** The motivational finish.

**Scope.**
- **Surprise bonuses** — pure `shouldOfferBonus` rule (UX §6.1) + shell RNG roll in
  the practice view; on a hit, append to `bonuses[]` and reproject. Overtime-gated,
  per-session cap, probability ramp, golden drop.
- **"Your usual" anchor** — per-session trailing-median marker in the practice view
  (UX §6); this is also the recovery-target source.
- **Gradual recolour** — animate `dim` 1 → 0 over 2 × your-usual minutes of return
  practice (UX §4.3) in collection/home.
- Longest-streak record display; surface any remaining tunables.

**Done when.** Bonuses fire only in overtime with correct odds (seeded test for the
rule); the anchor shows; recolour animates; field-test pass.

**Files.** `app/motivation.js` (`shouldOfferBonus`, your-usual), `app/views/{practice,collection}.js`,
`test/` additions.

---

## Next action

Phase 0 + Phase 1 are **built and green** (`app/motivation.js`, `app/theme.js`,
`test/` — `npm test` passes 15/15 against the spec's matrix), and the full 76-tile
world-tour collection is authored (`app/theme.js`, 0→100k pts). The browser shell
(`index.html`/`main.js`) was intentionally deferred to Phase 2 to avoid gutting the
working placeholder. Next: write the **Phase 2 spec** (UI: core loop — Home /
Practice / Summary / Collection, the store, detector wiring, first real deploy) and
implement.
