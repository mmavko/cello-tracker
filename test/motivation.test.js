// Phase 1 engine test matrix (docs/main-app-phase-1.md §"Test matrix").
// The engine is pure, so multi-day scenarios are just fixtures + a chosen `today`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { project, momentumFor } from "../app/motivation.js";

// A listening-period record of `min` minutes on `date` (start at `hour`:00).
const sess = (date, min, hour = 10) => ({
  start: `${date}T${String(hour).padStart(2, "0")}:00:00`,
  end:   `${date}T${String(hour).padStart(2, "0")}:30:00`,
  playedSec: Math.round(min * 60),
});
const inputsWith = (sessions) => ({
  config: { dailyFloorMin: 15, restWeekday: null, lessonLenMin: 45 },
  sessions,
  lessonDays: [],
  holidays: [],
  bonuses: [],
});

// 1 — Momentum tier boundaries
test("1 · momentumFor tier boundaries", () => {
  const cases = [
    [0, 1.0], [1, 1.0], [2, 1.0], [3, 1.25], [6, 1.25], [7, 1.5], [13, 1.5],
    [14, 2.0], [29, 2.0], [30, 2.5], [59, 2.5], [60, 3.0], [100, 3.0],
  ];
  for (const [n, m] of cases) assert.equal(momentumFor(n), m, `streak ${n}`);
});

// 2 — Single played day
test("2 · single played day", () => {
  const s = project(inputsWith([sess("2026-06-06", 30)]), { today: "2026-06-06" });
  assert.equal(s.streak.current, 1);
  assert.equal(s.streak.longest, 1);
  assert.equal(s.momentum, 1.0);
  assert.equal(s.today.pointsToday, 30);
  assert.equal(s.today.secured, true);
  assert.equal(s.points.total, 30);
});

// 3 — Golden week (UX §3.2 worked example)
test("3 · golden week → total 257, streak 7", () => {
  const days = ["2026-06-01", "2026-06-02", "2026-06-03", "2026-06-04", "2026-06-05", "2026-06-06", "2026-06-07"];
  const mins = [30, 25, 35, 30, 40, 20, 30];
  const s = project(inputsWith(days.map((d, i) => sess(d, mins[i]))), { today: "2026-06-07" });
  assert.equal(s.points.total, 257);
  assert.equal(s.streak.current, 7);
  assert.equal(s.streak.longest, 7);
  assert.equal(s.today.pointsToday, 45); // Sun: 30 × tier(7)=1.5
});

// 4 — Look-ahead momentum
test("4 · look-ahead momentum (entering 2 → tier 3)", () => {
  const s = project(inputsWith([sess("2026-06-01", 30), sess("2026-06-02", 30), sess("2026-06-03", 35)]), { today: "2026-06-03" });
  assert.equal(s.momentum, 1.25);        // tier(3), not tier(2)=1.0
  assert.equal(s.today.pointsToday, 44); // round(35 × 1.25 = 43.75)
});

// 5 — Break via gap
test("5 · break via gap resets streak, preserves longest", () => {
  const s = project(inputsWith([
    sess("2026-06-01", 30), sess("2026-06-02", 30), sess("2026-06-03", 30), // streak → 3
    sess("2026-06-05", 30),                                                  // 06-04 empty
  ]), { today: "2026-06-05" });
  assert.equal(s.daysIndex["2026-06-04"], "missed");
  assert.equal(s.streak.current, 1); // rebuilt at 06-05
  assert.equal(s.streak.longest, 3);
});

// 6 — Today in progress, sub-floor
test("6 · today sub-floor: streak held, atRisk, entering-tier points", () => {
  const s = project(inputsWith([sess("2026-06-01", 30), sess("2026-06-02", 30), sess("2026-06-03", 10)]), { today: "2026-06-03" });
  assert.equal(s.today.secured, false);
  assert.equal(s.today.status, "open");
  assert.equal(s.streak.current, 2);     // held at entering
  assert.equal(s.streak.atRisk, true);
  assert.equal(s.momentum, 1.0);         // entering tier(2)
  assert.equal(s.today.pointsToday, 10); // round(10 × 1.0)
});

// 6b — …then today crosses the floor
test("6b · today crosses floor: secured, streak+1, momentum bumps a tier", () => {
  const s = project(inputsWith([sess("2026-06-01", 30), sess("2026-06-02", 30), sess("2026-06-03", 20)]), { today: "2026-06-03" });
  assert.equal(s.today.secured, true);
  assert.equal(s.streak.current, 3);
  assert.equal(s.momentum, 1.25);        // tier(3), bumped from tier(2)=1.0
  assert.equal(s.today.pointsToday, 25); // round(20 × 1.25)
  assert.equal(s.streak.atRisk, false);
});

// 7 — Sub-floor PAST day (discriminating: entering tier ≠ reset tier)
test("7 · sub-floor past day earns entering-tier points then breaks", () => {
  const s = project(inputsWith([
    sess("2026-06-01", 30), sess("2026-06-02", 30), sess("2026-06-03", 30), // streak → 3
    sess("2026-06-04", 10),                                                  // sub-floor, < today
  ]), { today: "2026-06-05" });                                             // today empty
  assert.equal(s.daysIndex["2026-06-04"], "missed");
  // 30 + 30 + round(30×1.25)=38 + round(10×1.25)=13 + 0 = 111
  // (if day-4 were wrongly valued at the post-break tier 1.0 it would be 10 → total 108)
  assert.equal(s.points.total, 111);
  assert.equal(s.streak.current, 0);
});

// 8 — Collection unlock thresholds (reuse golden week → 257)
test("8 · collection unlock at total 257", () => {
  const days = ["2026-06-01", "2026-06-02", "2026-06-03", "2026-06-04", "2026-06-05", "2026-06-06", "2026-06-07"];
  const mins = [30, 25, 35, 30, 40, 20, 30];
  const s = project(inputsWith(days.map((d, i) => sess(d, mins[i]))), { today: "2026-06-07" });
  assert.deepEqual(s.collection.unlockedIds, ["home", "cremona", "paris", "vienna", "milan"]);
  assert.equal(s.collection.nextId, "prague");
  assert.equal(s.points.toNextTile, 103); // 360 − 257
});

// 9 — Dim flag
test("9 · dim: fresh 0, after break 1, play-after-break 0", () => {
  assert.equal(project(inputsWith([]), { today: "2026-06-06" }).collection.dim, 0);
  // 06-01 played, 06-02 missed, today 06-03 still empty
  assert.equal(project(inputsWith([sess("2026-06-01", 30)]), { today: "2026-06-03" }).collection.dim, 1);
  // …then play today → cleared
  assert.equal(project(inputsWith([sess("2026-06-01", 30), sess("2026-06-03", 30)]), { today: "2026-06-03" }).collection.dim, 0);
});

// 10 — Determinism & order independence
test("10 · deterministic and order-independent", () => {
  const sessions = [sess("2026-06-02", 20, 9), sess("2026-06-01", 30), sess("2026-06-02", 10, 14)];
  const a1 = project(inputsWith(sessions), { today: "2026-06-02" });
  const a2 = project(inputsWith(sessions), { today: "2026-06-02" });
  assert.deepEqual(a1, a2);
  const shuffled = project(inputsWith([sessions[2], sessions[0], sessions[1]]), { today: "2026-06-02" });
  assert.deepEqual(a1, shuffled);
});

// 11 — Rounding (round-half-up)
test("11 · points round half-up", () => {
  // entering 2 (two played days), then today of the target length
  const s375 = project(inputsWith([sess("2026-06-01", 30), sess("2026-06-02", 30), sess("2026-06-03", 30)]), { today: "2026-06-03" });
  assert.equal(s375.today.pointsToday, 38); // 30 × 1.25 = 37.5 → 38
  const s4375 = project(inputsWith([sess("2026-06-01", 30), sess("2026-06-02", 30), sess("2026-06-03", 35)]), { today: "2026-06-03" });
  assert.equal(s4375.today.pointsToday, 44); // 35 × 1.25 = 43.75 → 44
});

// 12 — Multi-record day
test("12 · multi-record day sums by playedSec; day = local date of start", () => {
  const s = project(inputsWith([sess("2026-06-06", 8, 9), sess("2026-06-06", 10, 14)]), { today: "2026-06-06" });
  assert.equal(s.today.playedSec, Math.round(8 * 60) + Math.round(10 * 60)); // 1080
  assert.equal(s.today.secured, true); // 18 min ≥ 15
});

// 13 — Reserved inputs ignored
test("13 · reserved inputs (lessonDays/holidays/bonuses/restWeekday) ignored", () => {
  const sessions = [sess("2026-06-01", 30), sess("2026-06-02", 30)];
  const a = project(inputsWith(sessions), { today: "2026-06-02" });
  const b = project({
    config: { dailyFloorMin: 15, restWeekday: 0, lessonLenMin: 45 },
    sessions,
    lessonDays: ["2026-06-01", "2026-06-02"],
    holidays: [{ start: "2026-06-01", end: "2026-06-02" }],
    bonuses: [{ date: "2026-06-02", points: 999 }],
  }, { today: "2026-06-02" });
  assert.deepEqual(a, b);
});
