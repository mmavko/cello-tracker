// ── store.js ─────────────────────────────────────────────────────────────────
// The I/O boundary: localStorage['cello.progress'] ⇄ the `inputs` object the pure
// engine eats. Persists FACTS ONLY (config, sessions, lessonDays, holidays,
// bonuses) — streak / points / status / unlocks are all recomputed by project().
//
// A "session" is just a listening period (mic on→off); there is no "running" flag.
// The active period is the last appended record, kept current by the practice
// view's throttled flush, so a reload leaves a shorter-but-valid record and today's
// total survives. See docs/main-app-phase-2.md ("The store") + arch §1.

const KEY = "cello.progress";

function defaults() {
  return {
    config: { dailyFloorMin: 15, restWeekday: null },
    sessions: [], // { start, end, playedSec } — local-dated timestamps (see localISO)
    lessonDays: [], // { date, lenMin } — reserved (first writer is Phase 4)
    holidays: [], // reserved (Phase 4)
    bonuses: [], // reserved (Phase 5)
  };
}

// Load inputs, filling any missing field defensively so a partial/hand-edited
// record still projects. First run writes (and returns) a clean skeleton — it
// NEVER reads the placeholder's old `cello.sessions` key (decided: start clean).
export function load() {
  let raw = null;
  try {
    raw = JSON.parse(localStorage.getItem(KEY));
  } catch {
    raw = null;
  }
  if (!raw || typeof raw !== "object") {
    const fresh = defaults();
    save(fresh);
    return fresh;
  }
  const d = defaults();
  return {
    config: { ...d.config, ...(raw.config || {}) },
    sessions: Array.isArray(raw.sessions) ? raw.sessions : [],
    lessonDays: Array.isArray(raw.lessonDays) ? raw.lessonDays : [],
    holidays: Array.isArray(raw.holidays) ? raw.holidays : [],
    bonuses: Array.isArray(raw.bonuses) ? raw.bonuses : [],
  };
}

// Whole-object write — atomic, so storage is never half-written.
export function save(inputs) {
  localStorage.setItem(KEY, JSON.stringify(inputs));
}

// Append the live listening record; return its index for in-place flushing.
export function startSession(startISO) {
  const inputs = load();
  inputs.sessions.push({ start: startISO, end: startISO, playedSec: 0 });
  save(inputs);
  return inputs.sessions.length - 1;
}

// Update the live record's detected seconds + end in place (throttled by caller).
export function flushSession(i, playedSec, endISO) {
  const inputs = load();
  const rec = inputs.sessions[i];
  if (!rec) return;
  rec.playedSec = playedSec;
  rec.end = endISO;
  save(inputs);
}

// Finalize a record on stop; prune empty listening periods (<1s played) so an
// opened-then-closed-with-nothing session never clutters sessions[].
export function endSession(i) {
  const inputs = load();
  const rec = inputs.sessions[i];
  if (!rec) return;
  if ((rec.playedSec ?? 0) < 1) inputs.sessions.splice(i, 1);
  save(inputs);
}

// Local 'YYYY-MM-DDThh:mm:ss' (no 'Z') so slice(0,10) is the LOCAL date — the
// engine keys a session's day on the first 10 chars and compares to ctx.today.
// NEVER use toISOString() (UTC) here: it mis-dates sessions near midnight.
export function localISO(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` +
    `T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
  );
}

export const localToday = () => localISO().slice(0, 10);

// ── Test mode (shell-only — the engine NEVER sees this) ──────────────────────
// A separate key holds a non-destructive day offset + a "tainted" flag. We feed
// the engine `effectiveToday = realToday + dayOffset` (its `today` is an injected
// parameter — exactly the seam for this), and date synthetic sessions at the
// effective day. Real facts are never rewritten; the offset is reversible.
const TEST_KEY = "cello.test";

export function loadTest() {
  let raw = null;
  try {
    raw = JSON.parse(localStorage.getItem(TEST_KEY));
  } catch {
    raw = null;
  }
  return { dayOffset: Number(raw?.dayOffset) || 0, tainted: !!raw?.tainted };
}

export function saveTest(t) {
  localStorage.setItem(TEST_KEY, JSON.stringify(t));
}

function addDaysStr(dateStr, n) {
  const d = new Date(dateStr + "T12:00:00Z"); // UTC midday dodges DST drift
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// "Today"/"now" shifted by the test offset. With offset 0 these equal the real
// clock, so normal operation is byte-for-byte unchanged.
export function effectiveToday() {
  return addDaysStr(localToday(), loadTest().dayOffset);
}
export function effectiveNowISO() {
  const p = (n) => String(n).padStart(2, "0");
  const now = new Date();
  return `${effectiveToday()}T${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}`;
}

function markTainted() {
  const t = loadTest();
  if (!t.tainted) {
    t.tainted = true;
    saveTest(t);
  }
}

// Append synthetic detected minutes to the effective today.
export function testAddMinutes(min) {
  const inputs = load();
  const at = effectiveNowISO();
  inputs.sessions.push({ start: at, end: at, playedSec: Math.round(min * 60), synthetic: true });
  save(inputs);
  markTainted();
}

// Jump the effective clock forward; yesterday's data becomes historic.
export function testAdvanceDay(n = 1) {
  const t = loadTest();
  t.dayOffset += n;
  t.tainted = true;
  saveTest(t);
}

// One full secured day, then advance — fast-builds streak/Momentum/collection.
export function testPlayedDay(min = 30) {
  testAddMinutes(min);
  testAdvanceDay(1);
}

// Wipe everything back to a clean, untainted app.
export function testClear() {
  localStorage.removeItem(KEY);
  localStorage.removeItem(TEST_KEY);
}
