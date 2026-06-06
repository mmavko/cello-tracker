# Main app UX — practice motivation design

Design spec for the *real* main app (replacing the placeholder timer at `/`).
This is a design document, not an implementation brief — it defines the
mechanics, the psychology behind them, the screens, and a data-model sketch.
Numbers here are **defaults, all tunable** (see [Parameters](#parameters)).

Audience: a single child, **age 11–13**, who plays cello. The app is a daily
motivator. It reads practice time from the existing detector (`detector.js`
emits detected-cello-sound seconds); this doc only covers what we build *on top*
of that signal.

---

## 1. Purpose and the core tension

We want two different behaviors, and they pull against each other:

- **(A) Practice every day** — consistency / habit.
- **(B) Practice *long enough* each session** — depth.

Streaks (Duolingo-style) are excellent for (A). The problem: a streak needs a
daily *qualifying threshold* — here, **15 minutes of accrued cello sound** — and
the moment that threshold becomes the visible goal, it becomes the **ceiling**.
A progress bar that fills to `15:00` and says "✓ Done!" actively trains her to
stop at 15. This is Goodhart's law: any number you make salient and completable
stops being a floor and becomes the target.

Fifteen minutes is **not** a goal. It's a turnstile. Her normal session is much
longer, and the app must never teach otherwise.

**The whole design problem is: get the consistency benefit of streaks without
ever letting the qualifying threshold surface as a goal.**

---

## 2. Design principles (the resolution)

The root mistake in most streak apps is using **one number for two behaviors**.
We split them into two currencies that are deliberately decoupled, then re-link
them through a multiplier.

1. **Two currencies.** A fragile, resettable **Streak** drives showing up daily.
   A permanent, never-lost **Collection** (fed by total minutes played) drives
   playing longer. The streak's 15-minute qualifier stays quiet and background;
   the Collection is the headline and has **no ceiling**.

2. **The floor is never a target.** No countdown, no progress-bar-to-15, no "✓
   Done." When she crosses the floor mid-session, the day quietly locks in with
   a small acknowledgment — not a finish line. Numbers on screen only ever count
   **up**, open-ended.

3. **Re-link the two with Momentum (a multiplier).** A longer streak makes each
   practiced minute worth *more* toward the Collection. So daily consistency and
   per-session depth both pay into the same permanent asset. Missing a day
   doesn't destroy the Collection — it drops the multiplier, which is the felt
   loss. (See §3.)

4. **Anchor on her own normal, not the minimum.** The app's implicit reference
   is her trailing typical session length (~her real ≈ 35–40 min), shown as a
   soft marker — never the 15-minute floor. The "enough" line can't collapse to
   15 because it floats with her actual behavior.

5. **Surprise, not satisfice.** Occasional unpredictable bonuses (weighted to
   longer sessions, never at a fixed minute count) keep her curious about "what
   if I play a bit more" instead of stopping at any known target.

6. **Loss aversion, kept humane.** The thing she's afraid to lose is the streak
   *number* and the Momentum multiplier — never the Collection she built. A bad
   day is a setback, not a catastrophe.

---

## 3. The two currencies + Momentum

### 3.1 Streak — drives daily consistency

- **Definition:** consecutive non-broken days. The streak *grows* on
  **played-equivalent** days (Played or Lesson) and is *held* (not broken) by Rest
  days, Frozen days and Holidays. A day is "played" when accrued detected cello
  sound ≥ **daily floor** (default 15 min).
- **Fragile and resettable.** This is the loss-aversion engine.
- **Quiet qualifier.** The floor gates the streak but is never headlined.
- Protected by the five day-types in §5 (Rest day, Freeze, Lesson, Holiday).

### 3.2 Momentum — the multiplier that links consistency to depth

Momentum is a function of current streak length. It multiplies the value of
every practiced minute. This is the "compounding prize" — the longer your
streak, the more each minute is worth, and the more you'd lose by breaking it.

| Current streak | Momentum |
|---|---|
| 1–2 days | ×1.0 |
| 3–6 days | ×1.25 |
| 7–13 days | ×1.5 |
| 14–29 days | ×2.0 |
| 30–59 days | ×2.5 |
| 60+ days | ×3.0 (cap) |

At a 60-day streak, every minute of practice is worth **triple**. Break the
streak and you fall back to ×1.0 — your practice instantly becomes ⅓ as
productive toward the Collection until you rebuild. That is a strong, *legible*
loss that costs her nothing she already earned.

### 3.3 Collection points — the permanent treasure, fed by depth

- **Points earned in a session = minutes_played × current Momentum.**
  *All* practiced minutes count toward points (not just minutes past the floor)
  — this keeps the floor from doing double duty as a target.
- **Points only ever go up.** Never lost, never decremented.
- Points unlock tiles in the Collection (§4).

**Worked example — one week.** Floor = 15 min. She typically plays ~30 min.

| Day | Streak after | Momentum | Min played | Points earned |
|---|---|---|---|---|
| Mon | 1 | ×1.0 | 30 | 30 |
| Tue | 2 | ×1.0 | 25 | 25 |
| Wed | 3 | ×1.25 | 35 | 44 |
| Thu | 4 | ×1.25 | 30 | 38 |
| Fri | 5 | ×1.25 | 40 | 50 |
| Sat | 6 | ×1.25 | 20 | 25 |
| Sun | 7 | ×1.5 | 30 | 45 |

Total: 257 points in week one. Notice the two levers visible to her: the row
grows when she plays *longer* (depth) **and** the multiplier climbs when she
*keeps the streak* (consistency). Neither lever has a "complete" state.

---

## 4. The Collection (the treasure)

A themed set of unlockable **tiles**, displayed as a grid (or simple vertical
path). Points unlock them in order; each tile costs more than the last, so early
unlocks come fast and later ones are aspirational — the compounding feel,
without an endless grind.

### 4.1 Visual budget — this is the whole art cost

**Hard constraint: near-zero custom artwork.** The Collection is **data, not
illustration.** Each tile is a record:

```
{ id, emoji: "🏛️", name: "Vienna", costPoints: 120, fact: "…one-line reward fact" }
```

Rendering is a **CSS grid of cards**: emoji + name. Locked tiles render dimmed
with a 🔒. That is the entire visual surface — no per-tile art, no animation
required. The theme is a swappable JSON array, so the look can change without
touching code.

### 4.2 Theme: World concert tour (locked)

The treasure is a **world concert tour** — she unlocks famous cities and concert
halls one at a time, travelling the world by practicing. Chosen because it's
naturally open-ended ("where do I go next?"), buildable from emoji alone, and
each tile carries a one-line music fact — a small educational reward that suits
an 11–13-year-old better than a cartoon pet. The tile list is still swappable
data, but the theme is settled; build against it.

Starter tile list (emoji + name + escalating cost + reward fact). Costs are
illustrative and tunable; the curve is fast early, aspirational late:

| # | Tile | Cost (pts) | Fact (one line) |
|---|---|---|---|
| 0 | 🏠 Your practice room | 0 | Where every tour begins. |
| 1 | 🎻 Cremona | 40 | Where Stradivari built his violins and cellos. |
| 2 | 🗼 Paris | 90 | Home of the Conservatoire de Paris. |
| 3 | 🏛️ Vienna | 160 | The Musikverein's "Golden Hall." |
| 4 | 🎭 Milan | 250 | La Scala, the world's most famous opera house. |
| 5 | 🏰 Prague | 360 | Where Mozart premiered *Don Giovanni*. |
| 6 | 🗽 New York | 500 | Carnegie Hall — "how do you get there? practice." |
| 7 | 🌉 Sydney | 680 | The Opera House on the harbour. |
| 8 | 🏯 Tokyo | 900 | Suntory Hall, "a jewel box of sound." |
| … | … | … | extend as needed (see §10 "runs out of tiles") |

Rendering = a CSS grid of cards, emoji + name; tap a tile for its fact. Locked
tiles are dimmed with a 🔒. No per-tile artwork.

### 4.3 Setback appearance (the "medium" break landing)

When the streak breaks (§5.5), the Collection is **not** emptied — every unlocked
tile stays. Instead the whole grid goes dormant: a CSS filter
(`filter: grayscale(1) opacity(.6)`) plus a quiet "your world has cooled — play
to bring it back" line. The felt loss is the dimming + the streak reset + the
Momentum drop; the *asset* is safe. This is the agreed "medium — visible
setback" intensity.

**Recovery is gradual, not instant.** Colour does not snap back the moment she
plays again — she has to *earn it back* over roughly **two typical sessions**.
Define a recovery target = `2 × your-usual` minutes (≈ 70 min by default, §6).
Every practiced minute after the break adds to `recoveryMinutes`, and the filter
interpolates:

```
progress       = clamp(recoveryMinutes / recoveryTarget, 0, 1)   // 0 → 1
grayscale      = 1 - progress                                    // 1 → 0
opacity        = 0.6 + 0.4 * progress                            // .6 → 1
```

So after her first session back the world is partly recoloured; after about two
typical sessions it's fully vivid again. This makes the comeback feel like a
small journey of its own, rewards depth (longer sessions restore faster), and
gives the setback real weight without ever destroying anything. All practiced
minutes count toward recovery (not gated by the floor — we want to welcome her
back). If she breaks again mid-recovery, `recoveryMinutes` resets to 0 and the
world re-dims fully. Still a one-property CSS animation — no art.

---

## 5. The five day-types

Every calendar day resolves to exactly one **day-type**. The design rule we
learned the hard way: **each real-life situation gets its own primitive — never
overload one mechanism to do two jobs.** (An earlier draft made the emergency
*freeze* also power the weekly rest day; a mid-week holiday then silently
desynced the freeze counter. Splitting them fixes it.)

**Vocabulary.** A day is **played-equivalent** if it grows the streak and
Momentum — that's **Played** or **Lesson**. A day is **chain-safe** if it doesn't
break the streak — everything except **Missed**.

| Day-type | Trigger | Streak | Momentum | Points | Regen |
|---|---|---|---|---|---|
| **Played** | detected sound ≥ floor | +1 | yes | `min × Mom` | +1 |
| **Lesson** | parent credits it (no mic) | +1 | yes | `lessonLen × Mom` | +1 |
| **Rest day** | scheduled rest weekday, unplayed | held | — | — | — |
| **Frozen** | emergency freeze for a slip | held | — | — | — |
| **Holiday** | pre-declared multi-day pause | paused | — | — | — |
| **Missed** | none of the above | **→ 0** | **→ ×1** | — | — |

Only **played-equivalent** days move `regenCount` and Momentum — we never reward
*not* playing with a higher multiplier (Momentum derives from the streak, §3.2).

### 5.1 Rest day — the planned weekly day off

- Parent sets an optional **rest weekday** (e.g. Sunday). On that weekday, if she
  doesn't play, the day auto-resolves as **Rest**: streak *held*, Momentum kept,
  no break — **without consuming the emergency freeze**, and it recurs every week.
- If she *does* play on her rest day, it's just a normal **Played** day (Rest only
  activates when the day would otherwise be empty).
- This is the weekly-cadence primitive. Because it's a fixed weekday and never
  touches the freeze, a mid-week **Holiday** can no longer desync anything.

### 5.2 Freeze — emergency buffer for the unplanned slip

- **One** freeze banked at a time. An *unplanned* empty day (not the rest weekday,
  no lesson, not holiday) auto-consumes it → day is **Frozen**, streak held.
- **Never two in a row** — a second consecutive unprotected empty day is a break.
- **Regenerates** after **7 played-equivalent days** (`regenCount` reaches 7 → +1
  freeze, cap 1, reset 0). Now that Rest day owns the weekly cadence, the freeze
  is a *rare backstop*, so its regen no longer has to hit a weekly deadline — and
  Frozen days no longer need to count toward regen. Simpler.

### 5.3 Lesson credit — the weekly lesson (real practice, no mic)

The lesson is real practice — often the week's most valuable — but she won't run
the app in front of the teacher. So it's a **played day credited by hand**, not a
pause.

- **Parent-gated, one tap.** The child brings it to a parent, who logs it. It must
  be parent-authorized: a credit that grants a played day *and* points without the
  mic would be trivially gameable if the child could self-tap it.
- **One-day grace.** The parent can log a lesson for **today or yesterday only** —
  covering the realistic "I forgot to log yesterday's lesson, I'll do it during
  today's practice." Mechanically, logging adds the date to a `lessonDays` set and
  the engine re-evaluates from that date (§9); backfilling yesterday therefore
  **auto-undoes** whatever yesterday had become — refunds a spent freeze, even
  un-breaks a break and re-colours the world.
- **Earns points:** `lessonLen × Momentum` (parent sets the lesson length, e.g.
  45 min). Makes the day **played-equivalent** for streak, Momentum and regen, with
  no floor check — there's no mic reading.
- **Stacks with detected play.** A lesson can always be logged regardless of any
  mic-detected sound that day, and its points **add on top** of whatever home
  practice earned. The day where she practiced at home *and* had a lesson is
  genuinely more practice, so it pays more — but the **streak still increments only
  once** (a day is played-equivalent if it reached the floor *or* has a lesson; the
  two together don't double the streak). This removes any interference between a
  stray short session and the parent's ability to log the lesson.
- **Cancellations & school breaks need no special handling:** no lesson → nobody
  logs it → the day resolves like any other (rest / freeze / holiday / break).
  A multi-week break with no practice at all is a **Holiday**.

### 5.4 Holiday pause — parent-declared, for trips

- Parent marks a date range "away" **in advance** (e.g. Mon–Wed family trip).
- Days show **Holiday**: streak **paused** (neither grows nor breaks), Momentum
  preserved, **excluded from regen** (a long trip can't mint free freezes). The
  streak resumes where it left off on return.
- **Pre-declared on purpose** — set ahead of time, so it can never be an
  after-the-fact loophole to undo a lazy day. Lives in the **Parent area** (§7.6).

### 5.5 Break — an unplanned empty day with no protection left

- Triggered by an empty day that is not played, not a lesson, not the rest
  weekday, not a holiday, and has no freeze available (or would be a second
  consecutive freeze).
- Effects: **streak → 0**, **Momentum → ×1.0**, **Collection dims** and recolours
  over `2 × your-usual` minutes of return practice (§4.3).
- **Nothing earned is lost** — all tiles and points remain. Only the fragile layer
  (streak + multiplier) resets.

### 5.6 Which mechanism for which situation

| Real life | Day-type | Who triggers | When |
|---|---|---|---|
| Practiced at home | Played | automatic (mic) | live |
| Weekly lesson | Lesson | parent, one tap | today or yesterday |
| Regular day off (e.g. Sunday) | Rest day | automatic (scheduled weekday) | that weekday |
| Forgot / unplanned slip | Frozen | automatic (emergency freeze) | at rollover |
| Trip, multi-day, known ahead | Holiday | parent, in advance | pre-declared range |
| Empty day, no protection | Missed → break | automatic | at rollover |

---

## 6. The daily loop and anti-satisficing details

How a single practice session feels, screen by moment — this is where the §2
principles become concrete.

- **Start.** One big "Start practice" button on Home. Wake Lock on (existing
  pattern). Detector runs.
- **During practice — everything counts up.** Live readout: minutes played today
  and points accruing (`minutes × Momentum`, ticking). **No countdown. No bar to
  15.** A faint **"your usual ≈ 35 min"** marker sits on the timeline as a soft,
  positive reference (passing it adds a small sparkle; falling short shows
  nothing negative). The marker is the *trailing median of her last ~10 sessions*
  — so the reference is her real behavior, never the floor.
- **Crossing the floor — quiet.** When detected sound passes the daily floor, a
  small unintrusive toast: **"Today counts ✓."** No fanfare, no stop cue. Points
  keep climbing visibly afterward. This is the single most important UX rule in
  the whole app: *the qualifying moment must read as "secured," never as "done."*
- **Surprise bonuses.** Unpredictable bonus-point drops that appear only in
  "overtime" (after the day is secured) and get more likely the longer she plays.
  Fully specified in §6.1.
- **Stop → session summary.** Shows: minutes today, the points math made legible
  (`32 min × ×1.5 = 48 pts` — so the multiplier is felt), progress toward the
  next tile, and streak status. Forward-looking and positive. No grade.

---

### 6.1 Surprise bonuses — full spec

The goal of bonuses is narrow: keep her playing *a little more* past her usual,
without creating any minute count she can aim at. So the whole mechanic is
**probabilistic** and gated to **overtime**.

- **What drops:** **bonus points** — same currency as everything else (one
  economy, no second system). Most drops are small; rare ones are big.
- **When it's eligible:** only *after the day is secured* (floor crossed). Before
  that, bonuses are impossible — we never want to gamify the 15-minute floor or
  give her a reason to stop early. Bonuses live entirely in the "you've already
  done enough, now you're just playing" zone, which is exactly the behavior we
  want to reward.
- **How it fires:** every **5 minutes** of continued play past the floor, roll
  once. Probability *ramps* with how long she's been in overtime:
  `p = min(0.15 + 0.05 × overtime_checkpoints, 0.40)` — ~15% at the first
  checkpoint, climbing to a 40% cap. Because it's a roll, **no specific minute
  ever guarantees a bonus** — the timing stays genuinely unpredictable, which is
  what makes it a surprise rather than a target.
- **How often:** at most **one bonus per session** (cap), so it stays special and
  can't be farmed. On a short over-the-floor day she'll often get nothing; on a
  long session she'll usually get one, but never knows when.
- **How big:** draw from a small pool — **+10 to +40 points** normally
  (≈ a third to a full session's worth, so it feels real against the typical
  ~30–50 pt session), with a **rare "golden" drop of +100** at about **1 in 10**
  bonuses. Bonus points are **flat — not multiplied by Momentum** — so the number
  she sees is the number she gets (legible delight; keeps the honest
  minutes × Momentum economy as the main driver).
- **How it's offered:** a brief, celebratory toast mid-session — "🎁 Bonus! +25"
  — that lands in her points counter. Tappable to "collect" for a beat of agency,
  but auto-collects if ignored. Appearing unpredictably during overtime is what
  creates the "ooh — if I keep going, maybe another" pull.
- **Why it can't be gamed:** it requires real *detected cello sound* past the
  floor, it's capped at one per session, and it never fires before the day is
  secured. The only way to "farm" it is to genuinely practice longer — which is
  the point.

All five knobs (checkpoint interval, base probability, ramp, per-session cap,
point pool, golden odds) are parameters (§11).

## 7. Screens / information architecture

Six surfaces. The first four are the child's daily app; the last is gated for
the parent.

### 7.1 Home (hub)
- Streak flame + number, and current Momentum (×) right beside it — the two
  fragile things, always in view.
- Big **Start practice** button.
- **Today's status**, understated: not-yet / "Today counts ✓" / minutes so far.
- Collection preview: the next locked tile + a couple recently unlocked — tap to
  open the full Collection.
- Small status chips when relevant: Freeze available, Holiday active.

### 7.2 Practice (active session)
- Counts **up** only (minutes + points). Soft "your usual" marker. Quiet floor-
  crossing toast. Surprise bonuses. Stop button. (§6.)

### 7.3 Session summary (on stop)
- Minutes, the points math spelled out, progress to next tile, streak status.
  Positive, brief, forward-looking.

### 7.4 Collection / World
- The emoji-tile grid (§4). Unlocked in color, locked dimmed + 🔒, a progress
  indicator toward the next tile. Goes greyscale when in a break state (§4.3).
  This is where "compounding" is made visible and where she spends idle browsing
  time daydreaming about the next unlock.

### 7.5 Calendar / history
- Month grid, one cell per day, colour-coded by day-type: **played**, **lesson**,
  **rest**, **frozen**, **holiday**, **missed (break)**. This is the streak's
  story made legible — and where a parent or child can see patterns.

### 7.6 Parent area (gated)
- Entry gated by a simple PIN (the child shouldn't self-serve here).
- Controls:
  - **Log a lesson** — one tap, choose **today or yesterday** (§5.3). The high-
    frequency parent action; keep it the most prominent button here.
  - Set **rest weekday** (the weekly day off, §5.1) and **lesson length** (minutes,
    for lesson points).
  - Set **daily floor** minutes; declare **Holiday** ranges.
  - View stats (totals, longest streak, weekly minutes); optionally grant an extra
    freeze.
- Detection tuning stays where it is (`/settings`); this is *motivation* config,
  kept separate.

---

## 8. Data model sketch (localStorage)

Builds on the existing `cello.sessions` log. New key `cello.progress`:

```jsonc
{
  "dailyFloorMin": 15,
  "theme": "world-tour",            // locked
  "config": {
    "restWeekday": 0,               // 0=Sun … 6=Sat; null = no fixed rest day
    "lessonLenMin": 45              // lesson points = lessonLenMin × Momentum
  },
  "streak": {
    "current": 7,                   // grows on played-equivalent days only
    "longest": 7,
    "lastEvaluatedDate": "2026-06-06",
    "freezeBanked": true,           // at most 1
    "lastFrozenDate": null,
    "regenCount": 6                 // played-equivalent days toward next freeze; refill at 7
  },
  "points": { "total": 257 },
  "collection": { "unlockedTileIds": ["home", "cremona", "paris"] },
  "recovery": {                     // present only while recolouring after a break
    "active": false,
    "minutesTarget": 70,            // 2 × your-usual at time of break
    "minutesDone": 0
  },
  "holidays":  [ { "start": "2026-07-10", "end": "2026-07-13" } ],
  "lessonDays": ["2026-06-09"],     // dates parent-credited as lessons (no mic)
  "days": {
    "2026-06-06": { "soundSec": 1980, "status": "played", "pointsEarned": 45 }
    // status ∈ played | lesson | rest | frozen | holiday | missed
  }
}
```

- `days[*].soundSec` is derived from `cello.sessions` (sum of detected sound for
  that date). `days[*].status` and the whole `streak` block are **derived** by
  replaying the §9 state machine over the inputs (`days`, `holidays`,
  `lessonDays`, `config`) — so logging a lesson or a holiday just edits an input
  and re-runs. Momentum is derived from `streak.current` (§3.2), not stored.
- Tile definitions (`{id, emoji, name, costPoints, fact}`) live in a static theme
  file, not in saved state.

This is a sketch for design review, not a schema to freeze — names and shape will
shift in implementation.

---

## 9. Rollover / state-machine logic

The streak must be computed from **dates**, never from app-open events — she may
not open the app on a missed day, and the device may be off for days. It's a pure
**replay** over the inputs (`days`, `holidays`, `lessonDays`, `config`): re-run
from the earliest changed date through yesterday. (So logging yesterday's lesson
just adds a date and replays — the backfill/un-break is automatic.) Day-type
precedence per day **D**, first match wins:

```
def regen():                                   # played-equivalent days only
    regenCount += 1
    if regenCount >= 7:
        freezeBanked = true                     # cap 1
        regenCount  = 0

for each elapsed day D (oldest → newest):
    played = soundSec(D) >= dailyFloor
    lesson = D in lessonDays                     # parent-credited; no mic, no floor

    if D within a declared holiday range:
        status = holiday                         # paused: no streak/break/regen, no freeze use
    elif played or lesson:                        # played-equivalent — the two STACK
        status = "played" if played else "lesson" # both → "played" + a lesson badge
        streak.current += 1                       # ONCE, even when both are true
        addRecovery((played ? soundMinutes(D) : 0) + (lesson ? lessonLenMin : 0))
        regen()
        # points stack — see note below
    elif weekday(D) == config.restWeekday:        # planned weekly day off
        status = rest                             # streak HELD; no freeze used; no regen
    elif freezeBanked and previousDayStatus != frozen:
        status = frozen                           # emergency buffer; streak HELD
        freezeBanked = false
    else:
        status = missed                           # BREAK
        streak.current = 0; regenCount = 0
        recovery = { active: true, minutesTarget: round(2 * yourUsual), minutesDone: 0 }

def addRecovery(mins):
    if recovery.active:
        recovery.minutesDone += mins
        if recovery.minutesDone >= recovery.minutesTarget:
            recovery.active = false              # world fully vivid again
```

**Points are separate and additive.** A day's earned points =
`detectedMinutes × Momentum` (every detected minute, accrued live during the
session) **+** `lessonLen × Momentum` if a lesson is logged **+** any surprise
bonuses. So played and lesson *stack*; a stray short session can never block the
parent from logging a lesson, and a home-practice-plus-lesson day pays for both.
The day-type machine above governs only streak / Momentum / regen / recovery — it
never gates points. Precedence among the *non-played* types still matters: the
planned **Rest day is taken before the scarce emergency Freeze**. Today (the
in-progress day) is evaluated live — the "Today counts ✓" turnstile fires the
moment `soundSec ≥ dailyFloor`, and the world recolours *during* a comeback
session.

Key invariants:
- "Miss one day" = exactly the single auto-Freeze (or the scheduled Rest day). Two
  consecutive unprotected empty days = break.
- Only **played-equivalent** days (Played, Lesson) grow `streak.current`, Momentum,
  and `regenCount`. Rest, Frozen and Holiday hold the streak but never grow it.
- Holiday days are skipped entirely (no streak/break/regen, no freeze consumed).
- Logging a lesson for **today or yesterday** is the only retroactive edit, and the
  replay makes it self-consistent (refunds a freeze, un-breaks a break).
- A break never touches `points.total` or `collection.unlockedTileIds` — only the
  fragile layer (streak, Momentum) resets; the world re-dims and recolours over
  `2 × your-usual` minutes of return practice (§4.3).

---

## 10. Edge cases and risks

| Risk | Mitigation |
|---|---|
| **Floor becomes the goal** (the whole reason for this design) | Floor never shown as a target; no countdown/bar; quiet "Today counts ✓"; headline is unbounded points→Collection (§2, §6). |
| **Gaming the floor** with 15 min of junk to keep the streak | The floor is *detected cello sound*, not wall-clock — she can't fake it without actually bowing. The detector is the enforcement. |
| **Streak dread / anxiety** (real with kids + streaks) | Break is soft (treasure safe), Freeze forgives slips, Holiday removes trip-anxiety. Tone throughout is "rebuild," not "ruined." |
| **Detected sound ≪ wall-clock** (home practice has tuning, page turns, pauses) | Set the floor with this in mind: 15 min *detected* ≈ a 25–30 min real session. Floor is parent-tunable if it lands wrong. |
| **Gaming the lesson credit** (it grants a played day + points with no mic) | Parent-gated: only a parent can log a lesson, and only for today/yesterday. The child can't self-credit. |
| **Lesson forgotten past the one-day grace** | Costs at most one day; absorbed by the emergency Freeze, and any break is soft and recoverable (§4.3). Parent can still avoid it by logging same-day. |
| **Mid-week Holiday desyncing the weekly cadence** (the bug that prompted this) | Fixed: the weekly cadence is the dedicated Rest day, independent of the freeze counter; Holiday no longer touches regen timing. |
| **"Your usual" marker becomes a new ceiling** | It's a soft, positive-only reference; nothing bad happens below it; points keep climbing past it. |
| **Light/tired day she genuinely can't reach the floor** | Freeze absorbs the occasional shortfall; parent can lower the floor; break is recoverable. |
| **Device clock / timezone games** | Compute from local dates; tolerate clock drift; never reward a clock that jumped backward (don't grant retroactive played days). |
| **Collection runs out of tiles** | World-tour list should be long; late tiles cost more so they pace out; add a second band (e.g. "famous pieces") before she hits the end. |

---

## 11. Parameters (all tunable)

| Parameter | Default | Notes |
|---|---|---|
| Daily floor (qualify) | 15 min detected sound | Parent-set. The turnstile, never shown as a goal. |
| Momentum tiers | ×1.0 → ×3.0 (§3.2) | Cap at ×3.0 at 60-day streak. |
| Points formula | `minutes × Momentum` | All minutes count. |
| Rest weekday | parent-set (e.g. Sunday); may be none | The planned weekly day off (§5.1); owns the weekly cadence. |
| Lesson length | 45 min | Lesson points = `lessonLen × Momentum` (§5.3). |
| Lesson log grace | today or yesterday | How far back a parent may credit a lesson. |
| Freeze bank | 1 | Max held at once; emergency backstop only. |
| Freeze regen | 7 played-equivalent days | Played or Lesson days (not rest/frozen/holiday). |
| Max consecutive frozen days | 1 | Second consecutive unprotected miss = break. |
| "Your usual" marker | median of last ~10 sessions | Soft reference only; also sets recovery target. |
| Recovery target (recolour) | 2 × your-usual (≈70 min) | Minutes of return practice to fully recolour after a break. |
| Bonus checkpoint interval | 5 min of overtime | Roll cadence after the floor is secured. |
| Bonus probability | `min(0.15 + 0.05·n, 0.40)` | Per checkpoint `n`; ramps to a 40% cap. |
| Bonus per-session cap | 1 | Stays special; can't be farmed. |
| Bonus point pool | +10…+40 (flat) | Not multiplied by Momentum. |
| Golden bonus | +100, ~1 in 10 bonuses | Rare big drop. |
| Tile costs | increasing per tile | Fast early, aspirational late. |

---

## 12. Phasing

The build order lives in **[main-app-implementation.md](main-app-implementation.md)**
(the canonical phase list). In short: a test-first pure engine, then UI, in
shippable increments — core loop first (delivers the §2 resolution), then the
day-types/protection of §5, then polish (bonuses, anchor, gradual recolour).

---

## 13. Out of scope

- **Practice *quality*.** The detector measures sound, not whether the practice is
  good (in tune, on the hard passage). 15 min of detected sound ≠ 15 min of good
  practice. Quality coaching is a different product.
- **Multi-child / accounts.** Single user, single device, localStorage. No backend.
- **Social / leaderboards.** Deliberately omitted — the motivation is personal
  (her own streak and Collection), not competitive.
- **Notifications / reminders.** A daily nudge would help retention but needs a
  platform story (web push on iOS is fragile); deferred until the core loop proves
  out.
```