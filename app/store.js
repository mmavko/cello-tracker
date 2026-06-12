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
    config: { dailyFloorMin: 15, restWeekday: null, lessonLenMin: 45 },
    sessions: [], // { start, end, playedSec } — local-dated timestamps (see localISO)
    lessonDays: [], // reserved (Phase 3/4)
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
