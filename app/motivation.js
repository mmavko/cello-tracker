// ── motivation.js ────────────────────────────────────────────────────────────
// The pure motivation engine. Given recorded facts (`inputs`) and the current date
// (`ctx.today`), it PROJECTS the full derived state — streak, Momentum, points,
// collection, freeze, recovery. Nothing is stored that can be recomputed.
//
// Purity (this is what makes it unit-testable): no browser APIs, and nothing time-
// or random-shaped is read internally. `today` is a parameter; the RNG (Phase 5)
// will be injected. Parsing a *given* date string with `new Date` is deterministic
// and fine — the rule is only that we never read the *ambient* clock (`Date.now()`)
// or `Math.random()`. Same inputs → same output, always.
//
// Phase 3 scope: the full §9 precedence machine — Played / Lesson (they STACK) /
// Rest / Frozen / Holiday / Missed, with the freeze lifecycle, continuous recovery,
// and a pure "your usual" median (recovery target = 2 × your-usual). See
// docs/main-app-phase-3.md for the contract this implements (played-equivalent is
// checked BEFORE holiday — playing beats the pause).

import { WORLD_TOUR } from "./theme.js";

// Momentum tiers (UX §3.2): a streak count maps to a per-minute multiplier.
export const MOMENTUM_TIERS = [
  { upTo: 2,        mult: 1.0  },
  { upTo: 6,        mult: 1.25 },
  { upTo: 13,       mult: 1.5  },
  { upTo: 29,       mult: 2.0  },
  { upTo: 59,       mult: 2.5  },
  { upTo: Infinity, mult: 3.0  },
];

export function momentumFor(streak) {
  for (const t of MOMENTUM_TIERS) if (streak <= t.upTo) return t.mult;
  return 3.0; // unreachable (Infinity tier) — defensive
}

// Protection tunables (one source of truth — arch §8). Parent-settable knobs live
// in inputs.config; these engine-internal constants are exported for tests + the
// future parent UI.
export const FREEZE_REGEN_DAYS = 7;  // played-equivalent days to mint a freeze (cap 1)
export const DEFAULT_USUAL_MIN = 35; // "your usual" fallback with no history → target 70

// Phase-5 stub. Kept so the exported surface is stable from the start.
export function shouldOfferBonus(/* state, sessionCtx, rng */) {
  return null;
}

// ── date helpers (YYYY-MM-DD strings; UTC-midday stepping dodges DST drift) ─────
function dayKey(ts) {
  return String(ts).slice(0, 10); // local date of a "YYYY-MM-DDThh:mm:ss" timestamp
}
function addDays(dateStr, n) {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function weekdayOf(dateStr) {
  return new Date(dateStr + "T12:00:00Z").getUTCDay(); // 0=Sun … 6=Sat
}
function median(nums) {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// Per-day detected minutes, keyed by the local date of each record's `start`.
function dailyMinutes(sessions) {
  const sec = {};
  for (const s of sessions) {
    const k = dayKey(s.start);
    sec[k] = (sec[k] ?? 0) + (s.playedSec ?? 0);
  }
  const min = {};
  for (const k of Object.keys(sec)) min[k] = sec[k] / 60;
  return { sec, min };
}

// "Your usual" = median of the last ~10 days she reached the floor (UX §6/§11).
// Per-DAY totals, floor-gated (a Played day). Pure — also the Phase-5 marker source.
export function yourUsualMin(inputs, ctx) {
  const floorMin = inputs.config?.dailyFloorMin ?? 15;
  const { min } = dailyMinutes(inputs.sessions ?? []);
  const totals = Object.keys(min)
    .filter((D) => D <= ctx.today && min[D] >= floorMin)
    .sort()
    .map((D) => min[D]);
  const m = median(totals.slice(-10));
  return m == null ? DEFAULT_USUAL_MIN : m;
}

export function project(inputs, ctx) {
  const today        = ctx.today;
  const cfg          = inputs.config ?? {};
  const floorMin     = cfg.dailyFloorMin ?? 15;
  const restWeekday  = cfg.restWeekday ?? null;     // 0=Sun … 6=Sat; null = none
  const sessions     = inputs.sessions ?? [];
  const lessonMap    = new Map(
    (inputs.lessonDays ?? []).map((l) => [l.date, l.lenMin ?? 45]),
  );
  const holidays     = (inputs.holidays ?? []).filter(Boolean);

  const { sec: dailySec, min: dailyMin } = dailyMinutes(sessions);
  const playedMinOf = (D) => dailyMin[D] ?? 0;
  const inHoliday   = (D) => holidays.some((h) => h.start <= D && D <= h.end);

  // Earliest day to evaluate = earliest dated input, never later than today.
  let from = today;
  const consider = (k) => { if (k && k < from && k <= today) from = k; };
  for (const k of Object.keys(dailySec)) consider(k);
  for (const k of lessonMap.keys()) consider(k);
  for (const h of holidays) consider(h.start);

  // ── replay state (carried oldest → newest) ──────────────────────────────────
  let current      = 0;
  let longest      = 0;
  let total        = 0;
  let freezeBanked = true;   // a new learner starts with one forgiving buffer (§5.2)
  let regenCount   = 0;
  let prevStatus   = null;
  let recovery     = { active: false, minutesDone: 0, minutesTarget: 0 };
  const playedTotals = [];   // detected minutes of Played days, in date order
  const daysIndex    = {};

  const usualAt = () => {
    const m = median(playedTotals.slice(-10));
    return m == null ? DEFAULT_USUAL_MIN : m;
  };
  const regen = () => {                       // played-equivalent days only
    regenCount += 1;
    if (regenCount >= FREEZE_REGEN_DAYS) {
      freezeBanked = true;                     // cap 1
      regenCount = 0;
    }
  };
  const addRecovery = (mins) => {
    if (!recovery.active) return;
    recovery.minutesDone += mins;
    if (recovery.minutesDone >= recovery.minutesTarget) recovery.active = false;
  };

  // Captured when we reach `today` (the last day in range).
  let todayStatus = "open";
  let todaySecured = false;
  let todayCounts  = false;
  let pointsToday  = 0;
  let atRisk       = false;

  for (let D = from; D <= today; D = addDays(D, 1)) {
    const min         = playedMinOf(D);
    const detPlayed   = min >= floorMin;
    const lesson      = lessonMap.has(D);
    const lessonLen   = lessonMap.get(D) ?? 0;
    const playedEquiv = detPlayed || lesson;
    const entering    = current;
    const prevBefore  = prevStatus;            // yesterday's status (for the atRisk model)
    let dayMom = momentumFor(entering);
    let status;

    if (playedEquiv) {                          // PLAYED and/or LESSON — beats holiday; STACK
      status  = detPlayed ? "played" : "lesson";
      current = entering + 1;                   // ONCE, even when both true
      longest = Math.max(longest, current);
      dayMom  = momentumFor(entering + 1);      // look-ahead tier (Phase-1 rule, LOCKED)
      regen();
      addRecovery((detPlayed ? min : 0) + (lesson ? lessonLen : 0));
      if (detPlayed) playedTotals.push(min);
    } else if (inHoliday(D)) {
      status = "holiday";                       // PAUSED: no streak/break/regen/freeze
    } else if (D === today) {
      status = "open";                          // in-progress; protections decided at rollover
    } else if (restWeekday != null && weekdayOf(D) === restWeekday) {
      status = "rest";                          // planned day off: streak HELD, no freeze/regen
    } else if (freezeBanked && prevStatus !== "frozen") {
      status = "frozen";                        // emergency buffer: streak HELD
      freezeBanked = false;
    } else {
      status = "missed";                        // BREAK
      current    = 0;
      regenCount = 0;
      recovery   = { active: true, minutesTarget: Math.round(2 * usualAt()), minutesDone: 0 };
    }

    // Points accrue every day, independent of the machine: detected minutes + a
    // logged lesson, valued at the day's Momentum (UX §9 note). Held/missed days
    // value stray sub-floor minutes at the entering tier.
    const lessonMin = (status === "played" || status === "lesson") && lesson ? lessonLen : 0;
    const dayPoints = Math.round((min + lessonMin) * dayMom);
    total += dayPoints;

    prevStatus    = status;
    daysIndex[D]  = status;

    if (D === today) {
      todayStatus  = status;
      todaySecured = detPlayed;
      todayCounts  = playedEquiv;
      pointsToday  = dayPoints;
      // atRisk: an unresolved today that would actually BREAK if left empty —
      // false when a rest day, an available freeze, or a holiday would catch it.
      atRisk =
        !playedEquiv &&
        entering > 0 &&
        !inHoliday(today) &&
        !(restWeekday != null && weekdayOf(today) === restWeekday) &&
        !(freezeBanked && prevBefore !== "frozen");
    }
  }

  const todaySec = dailySec[today] ?? 0;

  // Recovery → continuous dim (1 → 0). Phase 5 adds only the CSS transition.
  const progress = recovery.active
    ? Math.min(Math.max(recovery.minutesTarget > 0 ? recovery.minutesDone / recovery.minutesTarget : 0, 0), 1)
    : 1;
  const dim = recovery.active ? 1 - progress : 0;

  // Collection — costPoints are cumulative lifetime-point thresholds (UX §4).
  const unlockedIds = WORLD_TOUR.filter((t) => t.costPoints <= total).map((t) => t.id);
  const nextTile    = WORLD_TOUR.find((t) => t.costPoints > total) ?? null;

  return {
    today: {
      date:       today,
      playedSec:  todaySec,
      playedMin:  todaySec / 60,
      secured:    todaySecured,                 // the MIC floor crossing only
      counts:     todayCounts,                  // played-equivalent (secured || lesson today)
      isOvertime: todaySecured,                 // == secured (overtime nuance is Phase 5)
      pointsToday,
      status:     todayStatus,                  // holiday | played | lesson | open
    },
    streak: {
      current,
      longest,
      atRisk,
    },
    momentum: momentumFor(current),             // the displayed × (bumps when today secures)
    freeze: {
      banked:      freezeBanked,
      regenInDays: freezeBanked ? null : FREEZE_REGEN_DAYS - regenCount,
    },
    points: {
      total,
      nextTile,
      toNextTile: nextTile ? nextTile.costPoints - total : null,
    },
    recovery: {
      active:        recovery.active,
      minutesDone:   recovery.minutesDone,
      minutesTarget: recovery.minutesTarget,
      progress,
    },
    collection: {
      unlockedIds,
      nextId: nextTile ? nextTile.id : null,
      dim,
    },
    daysIndex,
  };
}
