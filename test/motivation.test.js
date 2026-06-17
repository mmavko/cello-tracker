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
  config: { dailyFloorMin: 15, restWeekday: null },
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

// 5 — Break via gap (Phase 3: the initial banked freeze absorbs the FIRST empty
// day, so a real break now needs two consecutive empties — then longest is kept).
test("5 · two empty days break the streak, preserve longest", () => {
  const s = project(inputsWith([
    sess("2026-06-01", 30), sess("2026-06-02", 30), sess("2026-06-03", 30), // streak → 3
    sess("2026-06-06", 30),                                                  // 06-04, 06-05 empty
  ]), { today: "2026-06-06" });
  assert.equal(s.daysIndex["2026-06-04"], "frozen");  // freeze absorbs the first slip
  assert.equal(s.daysIndex["2026-06-05"], "missed");  // second consecutive empty → break
  assert.equal(s.streak.current, 1); // rebuilt at 06-06
  assert.equal(s.streak.longest, 3);
});

// 6 — Today in progress, sub-floor (Phase 3: atRisk is now false because the
// banked freeze would absorb an empty today — see protection P19 for atRisk=true).
test("6 · today sub-floor: streak held, entering-tier points, freeze covers it", () => {
  const s = project(inputsWith([sess("2026-06-01", 30), sess("2026-06-02", 30), sess("2026-06-03", 10)]), { today: "2026-06-03" });
  assert.equal(s.today.secured, false);
  assert.equal(s.today.status, "open");
  assert.equal(s.streak.current, 2);      // held at entering
  assert.equal(s.streak.atRisk, false);   // a freeze is banked → today wouldn't break
  assert.equal(s.momentum, 1.0);          // entering tier(2)
  assert.equal(s.today.pointsToday, 10);  // round(10 × 1.0)
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

// 7 — Sub-floor break day earns ENTERING-tier points (discriminating: entering tier
// ≠ post-break tier). Freeze is exhausted on 06-04 first, so 06-05's stray minutes
// land on a genuine break and are still valued at the entering tier, not the reset.
test("7 · stray minutes on a break day earn entering-tier points", () => {
  const s = project(inputsWith([
    sess("2026-06-01", 30), sess("2026-06-02", 30), sess("2026-06-03", 30), // streak → 3
    sess("2026-06-05", 10),                                                  // 06-04 empty → frozen
  ]), { today: "2026-06-06" });                                             // 06-05 sub-floor → break
  assert.equal(s.daysIndex["2026-06-04"], "frozen");
  assert.equal(s.daysIndex["2026-06-05"], "missed");
  // 30 + 30 + round(30×1.25)=38 + frozen 0 + round(10×1.25)=13 = 111
  // (if day-5 were wrongly valued at the post-break tier 1.0 it would be 10 → total 108)
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

// 9 — Dim is now CONTINUOUS (Phase 3): 1 → 0 as she earns the world back over
// 2 × your-usual minutes. Break = streak ×3 (target 2×30 = 60), then comeback.
test("9 · dim continuous: fresh 0, broken 1, mid-recovery a float, recovered 0", () => {
  const broken = [sess("2026-06-01", 30), sess("2026-06-02", 30), sess("2026-06-03", 30)]; // 06-04, 06-05 empty
  assert.equal(project(inputsWith([]), { today: "2026-06-06" }).collection.dim, 0);          // fresh
  assert.equal(project(inputsWith(broken), { today: "2026-06-06" }).collection.dim, 1);      // just broken, no return
  assert.equal(project(inputsWith([...broken, sess("2026-06-06", 30)]), { today: "2026-06-06" }).collection.dim, 0.5); // 30/60 back
  assert.equal(project(inputsWith([...broken, sess("2026-06-06", 60)]), { today: "2026-06-06" }).collection.dim, 0);   // 60/60 → vivid
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

// 13 — Phase 3: only bonuses[] stays reserved (Phase 5); lessonDays / holidays /
// restWeekday are now LIVE inputs that change the projection.
test("13 · bonuses[] still inert; lessonDays now active", () => {
  const sessions = [sess("2026-06-01", 30), sess("2026-06-02", 30)];
  const base = project(inputsWith(sessions), { today: "2026-06-02" });
  // bonuses[] is realized in Phase 5 — must not affect Phase-3 output
  const withBonus = project({ ...inputsWith(sessions), bonuses: [{ date: "2026-06-02", points: 999 }] }, { today: "2026-06-02" });
  assert.deepEqual(withBonus, base);
  // a lesson on an otherwise-empty day is now honored → streak + status change
  const withLesson = project({ ...inputsWith(sessions), lessonDays: [{ date: "2026-06-03", lenMin: 45 }] }, { today: "2026-06-03" });
  assert.equal(withLesson.daysIndex["2026-06-03"], "lesson");
  assert.equal(withLesson.streak.current, 3);
});
