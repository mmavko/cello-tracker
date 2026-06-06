// ── motivation.js ────────────────────────────────────────────────────────────
// The pure motivation engine. Given recorded facts (`inputs`) and the current date
// (`ctx.today`), it PROJECTS the full derived state — streak, Momentum, points,
// collection, recovery. Nothing is stored that can be recomputed.
//
// Purity (this is what makes it unit-testable): no browser APIs, and nothing time-
// or random-shaped is read internally. `today` is a parameter; the RNG (Phase 5)
// will be injected. Parsing a *given* date string with `new Date` is deterministic
// and fine — the rule is only that we never read the *ambient* clock (`Date.now()`)
// or `Math.random()`. Same inputs → same output, always.
//
// Phase 1 scope: only Played and Missed → break (a single empty past day breaks the
// streak). `lessonDays` / `holidays` / `bonuses` are accepted in the input shape but
// ignored here — Freeze / Rest / Lesson / Holiday land in Phase 3, bonuses in Phase
// 5. See docs/main-app-phase-1.md for the contract this implements.

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

export function project(inputs, ctx) {
  const today    = ctx.today;
  const floorMin = inputs.config?.dailyFloorMin ?? 15;
  const sessions = inputs.sessions ?? [];

  // Per-day played seconds, keyed by the local date of each record's `start`.
  const dailySec = {};
  for (const s of sessions) {
    const k = dayKey(s.start);
    dailySec[k] = (dailySec[k] ?? 0) + (s.playedSec ?? 0);
  }
  const playedMinOf = (D) => (dailySec[D] ?? 0) / 60;

  // Earliest day to evaluate = earliest session date, never later than today.
  let from = today;
  for (const k of Object.keys(dailySec)) if (k < from) from = k;

  // Replay every calendar day oldest → newest (the Phase-1 reduced machine).
  let current = 0;          // running streak
  let longest = 0;
  let recoveryActive = false;
  let total = 0;            // lifetime points
  const daysIndex = {};

  // Captured when we reach `today` (the last day in range).
  let enteringToday = 0;
  let todayMomentum = momentumFor(0);
  let todaySecured  = false;
  let pointsToday   = 0;

  for (let D = from; D <= today; D = addDays(D, 1)) {
    const min      = playedMinOf(D);
    const played   = min >= floorMin;
    const entering = current;
    let dayMom;

    if (played) {
      current = entering + 1;
      longest = Math.max(longest, current);
      recoveryActive = false;
      daysIndex[D] = "played";
      dayMom = momentumFor(entering + 1);   // look-ahead: the tier the day reaches
    } else if (D < today) {
      current = 0;                          // BREAK (unprotected past empty day)
      recoveryActive = true;
      daysIndex[D] = "missed";
      dayMom = momentumFor(entering);       // stray minutes valued at the entering tier
    } else {
      // D === today, empty so far — in progress, doesn't break; current unchanged.
      daysIndex[D] = "open";
      dayMom = momentumFor(entering);
    }

    total += Math.round(min * dayMom);      // every day's minutes earn (even sub-floor)

    if (D === today) {
      enteringToday = entering;
      todayMomentum = dayMom;
      todaySecured  = played;
      pointsToday   = Math.round(min * dayMom);
    }
  }

  const todaySec = dailySec[today] ?? 0;

  // Collection — costPoints are cumulative lifetime-point thresholds (UX §4).
  const unlockedIds = WORLD_TOUR.filter((t) => t.costPoints <= total).map((t) => t.id);
  const nextTile    = WORLD_TOUR.find((t) => t.costPoints > total) ?? null;

  return {
    today: {
      date:       today,
      playedSec:  todaySec,
      playedMin:  todaySec / 60,
      secured:    todaySecured,
      isOvertime: todaySecured,                 // Phase 1: == secured
      pointsToday,
      status:     todaySecured ? "played" : "open",
    },
    streak: {
      current,                                  // == enteringToday + (secured ? 1 : 0)
      longest,
      atRisk: !todaySecured && enteringToday > 0,
    },
    momentum: todayMomentum,                    // the displayed × (bumps when today secures)
    points: {
      total,
      nextTile,
      toNextTile: nextTile ? nextTile.costPoints - total : null,
    },
    collection: {
      unlockedIds,
      nextId: nextTile ? nextTile.id : null,
      dim:    recoveryActive ? 1 : 0,
    },
    daysIndex,
  };
}
