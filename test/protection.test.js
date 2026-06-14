// Phase 3 engine test matrix (docs/main-app-phase-3.md §"Test matrix").
// Day-types & protection: Lesson / Rest / Frozen / Holiday, the freeze lifecycle,
// continuous recovery, and the pure your-usual median. Pure engine → fixtures only.
//
// June 2026 weekdays (UTC-midday keyed): 06-01 Mon … 06-07 Sun(0) … 06-14 Sun(0).
import { test } from "node:test";
import assert from "node:assert/strict";
import { project } from "../app/motivation.js";

const sess = (date, min, hour = 10) => ({
  start: `${date}T${String(hour).padStart(2, "0")}:00:00`,
  end:   `${date}T${String(hour).padStart(2, "0")}:30:00`,
  playedSec: Math.round(min * 60),
});
const mk = (over = {}) => ({
  config: { dailyFloorMin: 15, restWeekday: null, lessonLenMin: 45, ...(over.config || {}) },
  sessions:   over.sessions   || [],
  lessonDays: over.lessonDays || [],
  holidays:   over.holidays   || [],
  bonuses:    [],
});
const played = (dates) => dates.map((d) => sess(d, 30));

// ── Rest day ──────────────────────────────────────────────────────────────────

// P1 — a scheduled rest weekday holds the streak, without touching the freeze.
test("P1 · rest weekday holds the streak", () => {
  const s = project(mk({
    config: { restWeekday: 0 },                                   // Sunday
    sessions: played(["2026-06-01", "2026-06-02", "2026-06-03", "2026-06-04", "2026-06-05", "2026-06-06"]),
  }), { today: "2026-06-08" });                                  // 06-07 Sun empty, today Mon empty
  assert.equal(s.daysIndex["2026-06-07"], "rest");
  assert.equal(s.streak.current, 6);                             // held across Sunday
  assert.equal(s.freeze.banked, true);                           // rest never spends the freeze
});

// P2 — playing on the rest weekday is just a normal Played day.
test("P2 · playing on the rest weekday = Played", () => {
  const s = project(mk({
    config: { restWeekday: 0 },
    sessions: played(["2026-06-06", "2026-06-07"]),               // Sat, Sun both played
  }), { today: "2026-06-07" });
  assert.equal(s.today.status, "played");
  assert.equal(s.streak.current, 2);
});

// ── Freeze ────────────────────────────────────────────────────────────────────

// P3 — an unplanned slip auto-consumes the freeze; streak held.
test("P3 · freeze absorbs a slip", () => {
  const s = project(mk({
    sessions: played(["2026-06-01", "2026-06-02", "2026-06-03", "2026-06-05"]), // 06-04 empty
  }), { today: "2026-06-05" });
  assert.equal(s.daysIndex["2026-06-04"], "frozen");
  assert.equal(s.streak.current, 4);          // held through the frozen day, then +1
  assert.equal(s.freeze.banked, false);       // spent, not yet regenerated
});

// P4 — two unprotected empties in a row break, dropping Momentum to ×1.
test("P4 · second consecutive empty breaks → Momentum ×1", () => {
  const s = project(mk({
    sessions: played(["2026-06-01", "2026-06-02", "2026-06-03", "2026-06-06"]), // 06-04, 06-05 empty
  }), { today: "2026-06-06" });
  assert.equal(s.daysIndex["2026-06-04"], "frozen");
  assert.equal(s.daysIndex["2026-06-05"], "missed");
  assert.equal(s.streak.current, 1);          // rebuilt at 06-06
  assert.equal(s.momentum, 1.0);              // reset to ×1
});

// P5 — after a break the freeze regenerates on exactly the 7th played-equiv day.
test("P5 · freeze regenerates after 7 played-equivalent days", () => {
  const sessions = played([
    "2026-06-01", "2026-06-02", "2026-06-03",                    // streak 3
    // 06-04 frozen, 06-05 missed (break: freeze gone, regenCount 0)
    "2026-06-06", "2026-06-07", "2026-06-08", "2026-06-09",
    "2026-06-10", "2026-06-11", "2026-06-12",                    // 7 comeback days
  ]);
  const at6 = project(mk({ sessions }), { today: "2026-06-11" }); // 6 days back
  assert.equal(at6.freeze.banked, false);
  assert.equal(at6.freeze.regenInDays, 1);                       // one more to go
  const at7 = project(mk({ sessions }), { today: "2026-06-12" }); // 7th day
  assert.equal(at7.freeze.banked, true);
  assert.equal(at7.freeze.regenInDays, null);                    // banked → no countdown
});

// P6 — a brand-new learner starts with one banked freeze (forgiving onboarding).
test("P6 · new user starts with a banked freeze", () => {
  const s = project(mk({
    sessions: played(["2026-06-01"]),                            // day 1, then skip 06-02
  }), { today: "2026-06-03" });
  assert.equal(s.daysIndex["2026-06-02"], "frozen");            // the gifted buffer, not a break
  assert.equal(s.streak.current, 1);
});

// ── Lesson ────────────────────────────────────────────────────────────────────

// P7 — a logged lesson grows the streak with no mic and earns lessonLen × Momentum.
test("P7 · lesson grows the streak, no mic", () => {
  const s = project(mk({
    sessions: played(["2026-06-01", "2026-06-02"]),
    lessonDays: ["2026-06-03"],                                   // no session that day
  }), { today: "2026-06-03" });
  assert.equal(s.today.status, "lesson");
  assert.equal(s.today.secured, false);                          // no floor crossing (no mic)
  assert.equal(s.today.counts, true);                            // but it counts (played-equivalent)
  assert.equal(s.streak.current, 3);
  assert.equal(s.today.pointsToday, 56);                         // round(45 × tier(3)=1.25)
});

// P8 — Played + Lesson stack: streak +1 ONCE, points add both.
test("P8 · played + lesson stack (streak +1 once, points add)", () => {
  const s = project(mk({
    sessions: [...played(["2026-06-01", "2026-06-02"]), sess("2026-06-03", 30)],
    lessonDays: ["2026-06-03"],
  }), { today: "2026-06-03" });
  assert.equal(s.today.status, "played");                        // detected play wins the label
  assert.equal(s.streak.current, 3);                             // +1 once, not 4
  assert.equal(s.today.pointsToday, 94);                         // round((30 + 45) × 1.25)
});

// P9 — backfilling a lesson un-breaks a break (pure replay).
test("P9 · lesson backfill un-breaks a break", () => {
  const base = mk({ sessions: played(["2026-06-01", "2026-06-04"]) }); // 06-02 frozen, 06-03 break
  const noLesson = project(base, { today: "2026-06-04" });
  assert.equal(noLesson.daysIndex["2026-06-03"], "missed");
  assert.equal(noLesson.streak.current, 1);
  const withLesson = project({ ...base, lessonDays: ["2026-06-03"] }, { today: "2026-06-04" });
  assert.equal(withLesson.daysIndex["2026-06-03"], "lesson");
  assert.equal(withLesson.streak.current, 3);                    // 1(06-01) → frozen → 2 → 3
  assert.equal(withLesson.recovery.active, false);               // the break never happened
});

// P10 — backfilling a lesson onto a frozen day refunds the freeze.
test("P10 · lesson backfill refunds a spent freeze", () => {
  const base = mk({ sessions: played(["2026-06-01", "2026-06-02", "2026-06-03", "2026-06-05"]) }); // 06-04 frozen
  assert.equal(project(base, { today: "2026-06-05" }).freeze.banked, false);
  const refunded = project({ ...base, lessonDays: ["2026-06-04"] }, { today: "2026-06-05" });
  assert.equal(refunded.daysIndex["2026-06-04"], "lesson");
  assert.equal(refunded.freeze.banked, true);                    // the freeze 06-04 had spent is back
});

// ── Holiday ───────────────────────────────────────────────────────────────────

// P11 — a declared holiday pauses the streak; it resumes on return.
test("P11 · holiday pauses, then resumes", () => {
  const s = project(mk({
    sessions: played(["2026-06-01", "2026-06-02", "2026-06-03", "2026-06-04", "2026-06-05", "2026-06-09"]),
    holidays: [{ start: "2026-06-06", end: "2026-06-08" }],
  }), { today: "2026-06-09" });
  assert.equal(s.daysIndex["2026-06-06"], "holiday");
  assert.equal(s.daysIndex["2026-06-08"], "holiday");
  assert.equal(s.streak.current, 6);                             // 5 paused over the trip, +1 on return
  assert.equal(s.freeze.banked, true);                           // never consumed during the pause
});

// P12 — holiday days are excluded from regen (a long trip can't mint a freeze).
test("P12 · holiday excluded from regen", () => {
  const s = project(mk({
    sessions: played(["2026-06-01", "2026-06-02", "2026-06-03"]),
    // 06-04 frozen, 06-05 missed (break: freeze gone, regenCount 0), then a long holiday
    holidays: [{ start: "2026-06-06", end: "2026-06-14" }],
  }), { today: "2026-06-14" });
  assert.equal(s.freeze.banked, false);                          // 9 holiday days minted nothing
  assert.equal(s.freeze.regenInDays, 7);                         // regenCount never moved off 0
});

// P13 — a mid-week holiday does NOT desync the weekly rest cadence (the §10 bug).
test("P13 · mid-week holiday doesn't desync the rest day", () => {
  const s = project(mk({
    config: { restWeekday: 0 },                                  // Sunday
    sessions: played(["2026-06-08", "2026-06-11", "2026-06-12", "2026-06-13"]), // Mon, Thu–Sat
    holidays: [{ start: "2026-06-09", end: "2026-06-10" }],       // Tue–Wed trip
  }), { today: "2026-06-15" });                                  // 06-14 Sun empty, today Mon
  assert.equal(s.daysIndex["2026-06-09"], "holiday");
  assert.equal(s.daysIndex["2026-06-14"], "rest");               // Sunday still resolves as rest
  assert.equal(s.streak.current, 4);
});

// P14 — precedence: rest is taken before the scarce freeze (freeze preserved).
test("P14 · rest before freeze (freeze preserved)", () => {
  const s = project(mk({
    config: { restWeekday: 0 },
    sessions: played(["2026-06-01", "2026-06-02", "2026-06-03", "2026-06-04", "2026-06-05", "2026-06-06"]),
  }), { today: "2026-06-08" });
  assert.equal(s.daysIndex["2026-06-07"], "rest");               // not "frozen"
  assert.equal(s.freeze.banked, true);                           // still in the bank
});

// P15 — precedence: played BEATS holiday; a sub-floor holiday day stays paused.
test("P15 · played beats holiday; sub-floor holiday stays paused", () => {
  const over = { sessions: played(["2026-06-01", "2026-06-02"]), holidays: [{ start: "2026-06-03", end: "2026-06-05" }] };
  // reaches the floor inside the holiday range → counts as Played, streak grows
  const playedIn = project(mk({ ...over, sessions: [...over.sessions, sess("2026-06-04", 30)] }), { today: "2026-06-04" });
  assert.equal(playedIn.daysIndex["2026-06-03"], "holiday");     // the unplayed holiday day stays paused
  assert.equal(playedIn.today.status, "played");
  assert.equal(playedIn.streak.current, 3);
  // sub-floor inside the holiday → falls through to "holiday" (paused) but stray points still earn
  const subFloor = project(mk({ ...over, sessions: [...over.sessions, sess("2026-06-04", 10)] }), { today: "2026-06-04" });
  assert.equal(subFloor.today.status, "holiday");
  assert.equal(subFloor.streak.current, 2);                      // paused
  assert.equal(subFloor.today.pointsToday, 10);                  // round(10 × tier(2)=1.0)
});

// ── Recovery ──────────────────────────────────────────────────────────────────

// P16 — recovery is continuous: a partial comeback recolours partway, full clears.
test("P16 · recovery accounting (partial then full)", () => {
  const broken = played(["2026-06-01", "2026-06-02", "2026-06-03"]); // target 2×30 = 60
  const partial = project(mk({ sessions: [...broken, sess("2026-06-06", 30)] }), { today: "2026-06-06" });
  assert.equal(partial.recovery.active, true);
  assert.equal(partial.recovery.minutesTarget, 60);
  assert.equal(partial.recovery.minutesDone, 30);
  assert.equal(partial.recovery.progress, 0.5);
  assert.equal(partial.collection.dim, 0.5);
  const full = project(mk({ sessions: [...broken, sess("2026-06-06", 60)] }), { today: "2026-06-06" });
  assert.equal(full.recovery.active, false);
  assert.equal(full.collection.dim, 0);
});

// P17 — recovery target = round(2 × your-usual) captured at the break.
test("P17 · recovery target = 2 × your-usual (and the no-history default)", () => {
  // played history 20/20/50 → median 20 → target 40
  const varied = project(mk({
    sessions: [sess("2026-06-01", 20), sess("2026-06-02", 20), sess("2026-06-03", 50), sess("2026-06-06", 30)],
  }), { today: "2026-06-06" });                                  // 06-04 frozen, 06-05 break
  assert.equal(varied.recovery.minutesTarget, 40);
  // no detected-played days at all (a lesson-only streak) → DEFAULT_USUAL_MIN 35 → target 70
  const noHistory = project(mk({ lessonDays: ["2026-06-01", "2026-06-02"] }), { today: "2026-06-05" });
  // 06-03 frozen, 06-04 missed → recovery armed at the default
  assert.equal(noHistory.recovery.minutesTarget, 70);
});

// P18 — breaking again mid-recovery re-arms the dim fully.
test("P18 · re-break mid-recovery resets the dim", () => {
  const s = project(mk({
    sessions: played(["2026-06-01", "2026-06-02", "2026-06-03", "2026-06-06"]),
    // 06-04 frozen, 06-05 break, 06-06 partial return, 06-07 empty → break again
  }), { today: "2026-06-08" });
  assert.equal(s.daysIndex["2026-06-07"], "missed");
  assert.equal(s.recovery.active, true);
  assert.equal(s.recovery.minutesDone, 0);                       // reset on the second break
  assert.equal(s.collection.dim, 1);                             // world re-dimmed fully
});

// P19 — atRisk fires only when an empty today would genuinely break.
test("P19 · atRisk only when today would actually break", () => {
  // (a) rest weekday today → safe
  const rest = project(mk({ config: { restWeekday: 0 }, sessions: played(["2026-06-01", "2026-06-02", "2026-06-03", "2026-06-04", "2026-06-05", "2026-06-06"]) }), { today: "2026-06-07" });
  assert.equal(rest.streak.atRisk, false);
  // (b) a freeze is banked → safe
  const freeze = project(mk({ sessions: played(["2026-06-01", "2026-06-02"]) }), { today: "2026-06-03" });
  assert.equal(freeze.streak.atRisk, false);
  // (c) today is a holiday → safe
  const holiday = project(mk({ sessions: played(["2026-06-01", "2026-06-02"]), holidays: [{ start: "2026-06-03", end: "2026-06-03" }] }), { today: "2026-06-03" });
  assert.equal(holiday.streak.atRisk, false);
  // (d) freeze already spent, no other protection → genuinely at risk
  const risk = project(mk({ sessions: played(["2026-06-01", "2026-06-02", "2026-06-03", "2026-06-05"]) }), { today: "2026-06-06" }); // 06-04 frozen
  assert.equal(risk.streak.atRisk, true);
});

// P20 — a lesson during recovery also welcomes her back (credits its minutes).
test("P20 · lesson credits recovery minutes", () => {
  const s = project(mk({
    sessions: played(["2026-06-01", "2026-06-02", "2026-06-03"]), // target 60
    lessonDays: ["2026-06-06"],                                   // 06-04 frozen, 06-05 break, 06-06 lesson
  }), { today: "2026-06-06" });
  assert.equal(s.today.status, "lesson");
  assert.equal(s.recovery.active, true);
  assert.equal(s.recovery.minutesDone, 45);                      // lessonLen toward the 60 target
});

// ── Determinism ───────────────────────────────────────────────────────────────

// D1 — order-independent across ALL input arrays (sessions, lessonDays, holidays).
test("D1 · deterministic & order-independent with all inputs", () => {
  const inputs = mk({
    config: { restWeekday: 0 },
    sessions: [sess("2026-06-02", 30), sess("2026-06-01", 30), sess("2026-06-09", 20)],
    lessonDays: ["2026-06-05", "2026-06-03"],
    holidays: [{ start: "2026-06-11", end: "2026-06-12" }, { start: "2026-06-06", end: "2026-06-07" }],
  });
  const a = project(inputs, { today: "2026-06-12" });
  const shuffled = project({
    ...inputs,
    sessions: [inputs.sessions[2], inputs.sessions[0], inputs.sessions[1]],
    lessonDays: [...inputs.lessonDays].reverse(),
    holidays: [...inputs.holidays].reverse(),
  }, { today: "2026-06-12" });
  assert.deepEqual(a, shuffled);
});
