// ── views/practice.js ────────────────────────────────────────────────────────
// The active session (UX §7.2, §6). The ONLY view that touches the detector.
// Counts UP only (today minutes + points); no countdown, no bar-to-15. Detected
// seconds accumulate in memory and flush into the live sessions[] record on a
// throttle (arch §5); a quiet "Today counts ✓" toast fires when today crosses the
// floor. `CelloDetector` / `SettingsStore` are top-level lexical globals from the
// classic scripts loaded before this module.

import { project } from "../motivation.js";
import * as store from "../store.js";

const fmtMom = (n) => String(n);

export function render({ root, state, actions }) {
  const inputs = store.load();
  const floor = inputs.config?.dailyFloorMin ?? 15;
  const today = store.effectiveToday();

  // Today's seconds from records that already exist (the live one is appended
  // below at 0) — constant for this session, so display = priorTodaySec + liveSec
  // never double-counts the live record.
  const priorTodaySec = inputs.sessions
    .filter((s) => String(s.start).slice(0, 10) === today)
    .reduce((a, s) => a + (s.playedSec ?? 0), 0);

  const recIndex = store.startSession(store.effectiveNowISO());

  // In-memory detected-seconds accumulator (the live truth for this session).
  let bankedSec = 0;
  let playStart = null; // performance.now() while currently detecting
  const liveSec = () => bankedSec + (playStart != null ? (performance.now() - playStart) / 1000 : 0);
  const bankTail = () => {
    if (playStart != null) {
      bankedSec += (performance.now() - playStart) / 1000;
      playStart = null;
    }
  };

  let curMomentum = state.momentum;
  let secured = priorTodaySec / 60 >= floor;
  let stopped = false;

  root.className = "view view-practice";
  root.innerHTML = `
    <div class="practice-wrap">
      <div class="badge" id="badge">● listening…</div>
      <div class="big-min"><span id="min">0</span><span class="unit">min today</span></div>
      <div class="big-pts"><span id="pts">0</span> points <span class="mom" id="mom">×${fmtMom(curMomentum)}</span></div>
      <div class="secured-chip${secured ? " on" : ""}" id="secured">Today counts ✓</div>
      <p class="status" id="status"></p>
      <button class="btn-stop" id="stop">Stop</button>
    </div>
    <div class="toast" id="toast"></div>
  `;

  const el = (id) => root.querySelector("#" + id);
  const $min = el("min"), $pts = el("pts"), $mom = el("mom");
  const $badge = el("badge"), $secured = el("secured"), $status = el("status"), $toast = el("toast");

  const todayMin = () => (priorTodaySec + liveSec()) / 60;

  let toastTimer = null;
  function showToast(msg) {
    $toast.textContent = msg;
    $toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $toast.classList.remove("show"), 2600);
  }

  function paintLive() {
    const m = todayMin();
    $min.textContent = Math.round(m);
    $pts.textContent = Math.round(m * curMomentum);
    $mom.textContent = "×" + fmtMom(curMomentum);
    if (!secured && m >= floor) {
      secured = true;
      $secured.classList.add("on");
      showToast("Today counts ✓");
    }
  }

  // Persist the live count + reproject so momentum (and the secured edge) stay
  // truthful as today's total crosses the floor.
  function flush() {
    store.flushSession(recIndex, Math.round(liveSec()), store.effectiveNowISO());
    curMomentum = project(store.load(), { today }).momentum;
  }

  // ── Detector ──────────────────────────────────────────────────────────────
  let det = null;
  try {
    det = new CelloDetector(SettingsStore.load());
  } catch {
    persist();
    return showError("Audio isn't available in this browser.");
  }

  det.onDetectionChange((on) => {
    if (on) playStart = performance.now();
    else bankTail();
    $badge.textContent = on ? "● cello detected" : "● listening…";
    $badge.classList.toggle("detecting", on);
    if (!on) flush(); // bank + persist on each note-off
  });

  det.onStatus((evt) => {
    switch (evt.kind) {
      case "requesting-mic":
        $status.textContent = "Requesting microphone…";
        break;
      case "listening":
        $status.textContent = "";
        break;
      case "reconnecting":
      case "reconnecting-mic":
        $status.textContent = "Reconnecting…";
        break;
      case "error":
        persist();
        showError(micMessage(evt.error));
        break;
    }
  });

  const tick = setInterval(paintLive, 1000);
  const flushTimer = setInterval(() => {
    flush();
    paintLive();
  }, 5000);

  function cleanup() {
    clearInterval(tick);
    clearInterval(flushTimer);
    clearTimeout(toastTimer);
    try {
      det && det.stop();
    } catch {}
  }
  actions.registerTeardown(cleanup);

  function persist() {
    bankTail();
    store.flushSession(recIndex, Math.round(liveSec()), store.effectiveNowISO());
    store.endSession(recIndex);
  }

  function finalizeAndGo(next) {
    if (stopped) return;
    stopped = true;
    persist();
    actions.go(next); // runs cleanup() → det.stop() releases the wake lock
  }

  el("stop").addEventListener("click", () => finalizeAndGo("summary"));

  function showError(msg) {
    cleanup();
    root.innerHTML = `
      <div class="practice-wrap error">
        <p class="err-msg">${msg}</p>
        <button class="btn-stop" id="back">Back</button>
      </div>`;
    el("back").addEventListener("click", () => {
      stopped = true;
      actions.go("home");
    });
  }

  // Kick off the mic + wake lock (existing field-tested path). On failure
  // (permission denied, no device), persist what little we had and surface it.
  det.start().catch((err) => {
    persist();
    showError(micMessage(err));
  });

  paintLive();
}

function micMessage(err) {
  const name = err && err.name;
  if (name === "NotAllowedError" || name === "SecurityError")
    return "Microphone permission was denied. Allow it for this site to track practice.";
  if (name === "NotFoundError") return "No microphone was found.";
  return "Couldn't start the microphone. Check that the site has mic access.";
}
