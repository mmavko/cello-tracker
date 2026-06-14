# Phase 3 spec — engine: day-types & protection (pure, test-first)

The full streak-protection lifecycle, proven in `node --test` before any UI for it
(that's Phase 4). This is **UX §5 in full** + the **§9 precedence machine**, layered
**additively** onto the Phase-1 engine — same `project(inputs, ctx) → state`
signature, new input fields honored, new `status` cases, no rewrite of what shipped.

- Behavior/why → [main-app-ux.md](main-app-ux.md) §5, §9 (referenced as `UX §n`).
- Structure/no-build → [main-app-architecture.md](main-app-architecture.md).
- Roadmap slot/done-criteria → [main-app-implementation.md](main-app-implementation.md) Phase 3.
- Prior contract this extends → [main-app-phase-1.md](main-app-phase-1.md).

**Out of scope:** any UI for protection or the parent area (Phase 4); surprise
bonuses (Phase 5). `shouldOfferBonus` stays the Phase-5 stub. The lesson/holiday/
rest **mutators + parent controls** are Phase 4 — Phase 3 only makes `project()`
*read* these inputs correctly.

---

## What changes vs. Phase 1

Phase 1's loop was a two-state machine: each elapsed day is **Played** (daily
detected total ≥ floor → streak +1) or **Missed** (→ break). Phase 3 replaces the
per-day decision with a **first-match-wins precedence machine**:

```
played-or-lesson (STACK)  →  holiday  →  rest  →  frozen  →  missed (break)
```

**Played-equivalent is checked first** — if she actually practiced (or a lesson is
logged), that day *counts*, even if it falls inside a declared holiday range. The
holiday is a **safety net for the days she didn't play**, never a ceiling on the
days she did. (UX §5.4, §9.)

and adds the **freeze lifecycle**, **continuous recovery**, and a **pure
your-usual** computation (pulled forward from Phase 5 because the recovery target
needs it — see Locked decisions). Phase-1's 16 tests stay green except the two that
asserted the *old* semantics, which are updated, not deleted (see Test matrix).

---

## Input schema — newly honored fields

The store skeleton already carries these (currently ignored); Phase 3 reads them.
No persisted shape changes.

| Input | Shape | Meaning |
|---|---|---|
| `config.restWeekday` | `0..6` (0=Sun) or `null` | The planned weekly day off (UX §5.1). `null` = none. |
| `config.lessonLenMin` | minutes (default 45) | Lesson points = `lessonLenMin × Momentum`; lesson recovery credit. |
| `lessonDays[]` | `["YYYY-MM-DD", …]` | Parent-credited lesson dates (no mic, no floor). UX §5.3. |
| `holidays[]` | `[{ start, end }, …]` | Inclusive `YYYY-MM-DD` ranges, pre-declared. UX §5.4. |

`config.dailyFloorMin` and `sessions[]` are unchanged from Phase 1. The today/
yesterday **grace** on logging a lesson is a *shell* constraint (Phase 4 parent UI
restricts the date picker) — the engine replays **any** `lessonDays` date so a
backfill is automatic and general.

---

## Core definitions

```
playedMinOf(D)   = Σ playedSec of records whose start-date == D, ÷ 60   (Phase 1)
detectedPlayed(D)= playedMinOf(D) ≥ config.dailyFloorMin
lessonOn(D)      = D ∈ lessonDays
inHoliday(D)     = ∃ h ∈ holidays : h.start ≤ D ≤ h.end
weekdayOf(D)     = new Date(D+"T12:00:00Z").getUTCDay()    // 0=Sun; pure (given string)
playedEquiv(D)   = detectedPlayed(D) || lessonOn(D)        // grows streak/Momentum/regen
```

**Replay window.** `from = min(all input dates ≤ today)` over session day-keys,
`lessonDays`, and `holidays[].start`; capped so `from ≤ today`. (Future-dated
holidays/lessons sit past `today` and are never reached.) If there are no dated
inputs at all, `from = today` (a fresh user is bright, not cooled).

**Carried replay state** (oldest → newest): `current`, `longest`, `total`,
`freezeBanked` (**init `true`** — a new learner gets one forgiving buffer),
`regenCount` (init 0), `prevStatus`, and `recovery = {active, minutesDone,
minutesTarget}`. A rolling `playedTotals[]` (per-day detected-minute totals, in
date order, for days where `detectedPlayed`) feeds the your-usual median.

---

## The §9 precedence machine (per day D)

```
def regen():                      # played-equivalent days only
    regenCount += 1
    if regenCount >= 7 and not freezeBanked:
        freezeBanked = true        # cap 1
        regenCount   = 0
    elif regenCount >= 7:
        regenCount   = 0           # already banked → just reset the counter

entering = current
min      = playedMinOf(D)
dayMom   = momentumFor(entering)   # default; overridden to tier(entering+1) on a streak-up

# ── precedence (first match wins) ─────────────────────────────────────────────
if playedEquiv(D):                # PLAYED and/or LESSON — beats holiday; the two STACK
    status  = detectedPlayed(D) ? "played" : "lesson"
    current = entering + 1         # ONCE, even when both true
    longest = max(longest, current)
    dayMom  = momentumFor(entering + 1)         # look-ahead tier (Phase-1 rule, LOCKED)
    regen()
    addRecovery((detectedPlayed(D) ? min : 0) + (lessonOn(D) ? lessonLenMin : 0))
    if detectedPlayed(D): playedTotals.push(min)

elif inHoliday(D):
    status = "holiday"             # PAUSED: streak held, no break, no regen, no freeze use

elif D == today:                  # empty, non-holiday today
    status = "open"                # in-progress: never breaks; protections decided at rollover

elif weekdayOf(D) == config.restWeekday:
    status = "rest"                # planned day off: streak HELD, no freeze, no regen

elif freezeBanked and prevStatus != "frozen":
    status = "frozen"             # emergency buffer: streak HELD, no regen
    freezeBanked = false

else:
    status = "missed"             # BREAK
    current    = 0
    regenCount = 0
    recovery   = { active: true,
                   minutesTarget: round(2 × yourUsual(playedTotals)),  # captured AT break
                   minutesDone: 0 }

# ── points accrue EVERY day, independent of the machine above (UX §9 note) ─────
lessonMin = (status in {"played","lesson"}) and lessonOn(D) ? lessonLenMin : 0
total += round((min + lessonMin) × dayMom)

prevStatus     = status
daysIndex[D]   = status

def addRecovery(mins):
    if recovery.active:
        recovery.minutesDone += mins
        if recovery.minutesDone >= recovery.minutesTarget:
            recovery.active = false       # world fully vivid again
```

**Notes that bite:**

- **Played-equivalent beats holiday.** A holiday day on which she reaches the floor
  (or has a lesson logged) resolves as `played`/`lesson` — streak +1, regen,
  recovery, the lot — *not* `holiday`. Only the holiday days she **didn't** play stay
  paused. So a trip protects the empty days without penalizing the days she
  practiced anyway. A **sub-floor** holiday day (some stray minutes, below the floor)
  isn't played-equivalent → falls through to `holiday` (paused), and those stray
  minutes still earn points (points are never gated by the machine).
- **Stacking.** `played + lesson` on one day: streak `+1` **once**, `daysIndex` =
  `"played"`, points = `round((detectedMin + lessonLen) × Mom)`. The lesson badge a
  calendar shows is derivable from `inputs.lessonDays` (Phase 4 has it) — the engine
  doesn't duplicate it into `daysIndex`.
- **Sub-floor on the rest weekday** falls through `playedEquiv` (didn't reach floor)
  to `rest` — held, stray minutes still earn at the entering tier. Matches §5.1
  ("Rest only activates when the day would otherwise be empty").
- **Never two frozen in a row.** With bank cap 1 and `regen` needing 7 played-equiv
  days, two consecutive frozen days are already impossible from normal flow; the
  `prevStatus != "frozen"` guard is the backstop for a Phase-4 parent-granted extra
  freeze.
- **Lesson backfill** (yesterday) is just a date in `lessonDays` + this replay: the
  prior day re-resolves played-equivalent, which **refunds a freeze** (the day no
  longer consumed it) or **un-breaks a break** (no `missed`, recovery never armed) —
  zero special-case code.

---

## "Your usual" (pulled into Phase 3 — pure)

The recovery target is `2 × your-usual`, so the median is computed **in the engine
now** (it's pure and cheap). Phase 5's remaining job shrinks to the *practice-screen
marker UI* and the *recolour CSS animation* — not the math.

```
yourUsual(playedTotals) = median(last ~10 entries of playedTotals)   // minutes
                          or DEFAULT_USUAL_MIN if empty
```

- `playedTotals` holds per-day **detected** minute totals for `detectedPlayed` days,
  in date order. Lesson-only days (no mic reading) don't contribute.
- Captured **at the moment of a break** and frozen into `recovery.minutesTarget`
  (UX §8: "2 × your-usual *at time of break*") — deterministic under replay.
- `DEFAULT_USUAL_MIN = 35` (exported), so the default target is `2 × 35 = 70` min
  (UX §11). In practice a break always has prior played days, so the fallback is a
  safety net, not the common path.
- Exposed as a top-level helper for tests + the Phase-5 marker:
  `export function yourUsualMin(inputs, ctx)`.

---

## Recovery & dim (now continuous)

Phase 1 emitted `collection.dim ∈ {0,1}`. Phase 3 makes it a **float** as she earns
the world back; Phase 5 only adds the CSS transition over it.

```
progress = recovery.active ? clamp(recovery.minutesDone / recovery.minutesTarget, 0, 1) : 1
dim      = recovery.active ? 1 - progress : 0
```

- All practiced minutes count toward recovery (floor-gated **off** — welcome her
  back), plus a logged lesson's `lessonLenMin`. Both flow through `addRecovery`,
  including **today live**, so the world recolours *during* a comeback session.
- Breaking again mid-recovery re-arms `recovery` (target recomputed, `minutesDone`
  0) → world re-dims fully.
- Fresh user / no break → `dim 0`, `recovery.active false`.

---

## `project()` output contract

```jsonc
{
  today: {
    date,                  // ctx.today
    playedSec, playedMin,  // today's detected aggregate
    secured,               // detectedPlayed(today) — the MIC floor crossing only
    counts,                // playedEquiv(today): secured || lessonOn(today) — "Today counts ✓"
    isOvertime,            // == secured (overtime nuance is Phase 5)
    pointsToday,           // round((playedMin + (lessonToday ? lessonLen : 0)) × momentum)
    status                 // "holiday" | "played" | "lesson" | "open"
  },
  streak:   { current, longest, atRisk },
  momentum,                                   // momentumFor(streak.current)
  freeze:   { banked, regenInDays },          // regenInDays = banked ? null : 7 - regenCount
  points:   { total, toNextTile, nextTile },
  recovery: { active, minutesDone, minutesTarget, progress },
  collection: { unlockedIds, nextId, dim },   // dim is now a float (1 → 0)
  daysIndex: { [date]: "played"|"lesson"|"rest"|"frozen"|"holiday"|"missed"|"open" }
}
```

**`streak.atRisk`** (refined from Phase 1's `!secured && entering>0`): true only if
today is unresolved **and would actually break** if it stayed empty —
```
atRisk = !today.counts
         && entering > 0
         && !inHoliday(today)
         && weekdayOf(today) != config.restWeekday
         && !(freezeBanked && prevStatus != "frozen")
```
So a rest day, an available freeze, or an active holiday each clear `atRisk` even
with an empty today.

`momentum = momentumFor(streak.current)` — unchanged identity: a held day (rest/
frozen/holiday) keeps `current`, a played-equiv today bumps it. Purity guard from
Phase 1 still holds: no `Date.now()` / `Math.random()` / browser globals.

---

## Exported API surface

```js
// motivation.js
export function project(inputs, ctx) { … }       // extended
export function momentumFor(streak) { … }        // unchanged
export function yourUsualMin(inputs, ctx) { … }  // NEW — pure median (for Phase-5 marker too)
export const MOMENTUM_TIERS = [ … ];             // unchanged
export const DEFAULT_USUAL_MIN = 35;             // NEW — recovery fallback (2× = 70)
export const FREEZE_REGEN_DAYS = 7;              // NEW — exported tunable
export function shouldOfferBonus(/* … */) { return null; }  // still the Phase-5 stub
```

Engine-internal tunables are exported named constants (arch §8: one source of truth)
so Phase-4 tests and the parent screen reference the same values.

---

## Test matrix (`node --test`)

Phase-1 fixtures stay green; **#9** and **#6** below *update* the two that asserted
old semantics (binary dim → continuous; `atRisk` refinement). New file
`test/protection.test.js` for the day-type cases; keep `motivation.test.js` for the
core loop.

| # | Scenario | Assert |
|---|---|---|
| P1 | **Rest day holds** — play Mon–Sat, `restWeekday`=Sun, Sun empty, today Mon empty | Sun `daysIndex` "rest", streak held across Sun, no freeze consumed, `atRisk` false on rest-Sun-as-today |
| P2 | **Rest day played** = normal Played | playing on the rest weekday → "played", streak +1 (rest only fires when otherwise empty) |
| P3 | **Freeze absorbs a slip** — streak going, one unplanned empty non-rest day, then play | empty day "frozen", streak held, `freeze.banked` false after, then regenerates |
| P4 | **Two empty in a row = break** — freeze available, two consecutive unprotected empties | day 1 "frozen", day 2 "missed", streak → 0, momentum ×1 |
| P5 | **Freeze regen at 7** — break (bank spent), then 7 played-equiv days | `freeze.banked` true again after the 7th; `regenCount` resets; `regenInDays` counts down 7→…→0 |
| P6 | **Initial freeze banked** — brand-new user, play day 1, skip day 2 (non-rest) | day 2 "frozen" not "missed" (the gifted buffer); streak held |
| P7 | **Lesson grows streak, no mic** — empty mic day in `lessonDays`, floor 15 | "lesson", streak +1, points `round(lessonLen × Mom)`, played-equivalent for regen |
| P8 | **Played + Lesson stack** — 30 min detected **and** lesson same day | `daysIndex` "played", streak +1 **once**, pointsToday `round((30+lessonLen)×Mom)` |
| P9 | **Lesson backfill un-breaks** — D1 played, D2 empty→would break, add D2 to `lessonDays`, replay | without lesson: D2 "missed", streak 0; with lesson: D2 "lesson", streak continuous, recovery never armed |
| P10 | **Lesson backfill refunds a freeze** — slip frozen on D2, then log D2 as lesson | D2 "lesson", the freeze that D2 had consumed is back banked |
| P11 | **Holiday pauses** — streak 5, declare D6–D8 holiday, play D9 | D6–D8 "holiday", streak resumes at 5→6 on D9, no break, no freeze consumed |
| P12 | **Holiday excluded from regen** — long holiday >7 days, no playing | unplayed holiday days don't move `regenCount`; `freeze.banked` does **not** mint from them |
| P13 | **Mid-week holiday, no rest desync** — `restWeekday`=Sun, a Tue–Wed holiday in the week | the following Sun still resolves "rest"; cadence intact (the bug §5/§10 guards) |
| P14 | **Precedence: rest before freeze** — empty rest-weekday day with a freeze banked | resolves "rest" (held, freeze **preserved**), not "frozen" |
| P15 | **Precedence: played beats holiday** — reach the floor on a day inside a holiday range | resolves "played" (streak +1, regen, recovery), **not** "holiday"; a *sub-floor* holiday day stays "holiday" (paused) with stray points |
| P16 | **Recovery continuous** — break, then a partial comeback session (< target) | `recovery.active` true, `dim` == `1 - minutesDone/minutesTarget` (a float strictly between 0 and 1); fully recolours (`dim` 0) once `minutesDone ≥ target` |
| P17 | **Recovery target = 2 × your-usual at break** — varied played history, then a break | `recovery.minutesTarget` == `round(2 × median(last ~10 played totals))`; `DEFAULT_USUAL_MIN` path when no history |
| P18 | **Re-break mid-recovery** — break, partial return, break again | `recovery` re-armed, `minutesDone` 0, `dim` back to 1 |
| P19 | **atRisk refinement** — empty today under each protection | `atRisk` false when today is rest weekday / freeze available / holiday; true only when an empty today would genuinely break |
| P20 | **Lesson recovery credit** — break, then a lesson day during recovery | `minutesDone += lessonLen` (lesson welcomes her back too) |
| U1 | *(updated)* Phase-1 **#9 dim** | continuous semantics: fresh 0; just-broken `dim` 1; mid-recovery a float; recovered 0 |
| U2 | *(updated)* Phase-1 **#13 reserved inputs** | now **active**: non-empty `lessonDays`/`holidays`/`restWeekday` change output per the rules above (only `bonuses[]` stays reserved → Phase 5) |
| D1 | **Determinism / order-independence** holds with all new inputs | shuffling `sessions[]` / `lessonDays` / `holidays` order → identical output |

---

## Done criteria

- New + updated matrix green under `npm test`; Phase-1 core-loop tests still pass
  (the 16, with #9 and #13 updated to the new semantics).
- `motivation.js` imports under `node --test` with **no** browser shims (purity
  guard) — `yourUsualMin` and the median are pure.
- `project()` output matches the contract for every fixture, including the tricky
  transitions: rest-before-freeze, mid-week-holiday-no-desync, lesson backfill
  un-break/refund, freeze regen-at-7, continuous recovery.
- No store/UI changes shipped — this phase touches `app/motivation.js` and `test/`
  only (arch §7: additive).

---

## Locked decisions

- **Your-usual pulled into Phase 3 — DECIDED.** The recovery target needs it and the
  median is pure/cheap; computing it here keeps "engine before UI." Phase 5 keeps
  only the practice-screen marker UI + the recolour animation. (Supersedes the
  Phase-1 note that filed your-usual entirely under Phase 5.)
- **New user starts with 1 banked freeze — DECIDED.** Forgiving onboarding; matches
  the §8 data sketch (`freezeBanked: true`). A first-week slip is absorbed once.
- **`dim` is continuous now — DECIDED.** `project()` emits `dim = 1 - progress` (a
  float); Phase 5 adds only the CSS transition. Phase-1's binary-dim test is updated,
  not removed.
- **Momentum look-ahead rule — still LOCKED** (Phase 1): `dayMom = tier(entering +
  (streak-up ? 1 : 0))`; held days use `tier(entering)`.
- **Played-equivalent beats holiday — LOCKED** (UX §5.4, §9). Practicing on a trip
  (or a logged lesson) *counts* — streak +1 — rather than being paused; holiday is a
  net for the unplayed days, not a ceiling on the played ones. Only sub-floor/empty
  holiday days stay paused.
- **Points are never gated by the day-type machine — LOCKED** (UX §9): detected
  minutes (and a logged lesson) always earn, even on holiday/rest/frozen/missed days;
  the machine governs only streak / Momentum / regen / recovery.
- **Lesson grace (today/yesterday) is a shell constraint, not engine** — `project()`
  replays any `lessonDays` date; Phase 4's parent UI enforces the window.
