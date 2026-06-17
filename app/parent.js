// ── parent.js ────────────────────────────────────────────────────────────────
// The gated parent area (UX §7.6, Phase 4 spec docs/main-app-phase-4.md). A
// separate page + module entry (not an in-router view) so its own
// `<script type="module" src="parent.js">` gets cache-busted correctly by
// deploy.sh (arch's HTML-src / JS-from stamping). PURE SHELL: every control
// below mutates a fact array the engine already honors (lessons since Phase 3a,
// holidays/floor/rest-weekday since Phase 3) and reprojects — motivation.js is
// untouched.

import { project } from "./motivation.js";
import * as store from "./store.js";

const root = document.getElementById("root");
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

let unlocked = false; // in-memory only — reload/leave always re-gates
let pinStage = store.hasPin() ? "enter" : "create"; // "enter" | "create" | "confirm"
let pinFirst = "";
let pinError = false;

// UI-only state for the not-yet-committed control values (never persisted).
const ui = {
  lessonDate: store.effectiveToday(),
  lessonLen: lastLessonLen(),
  holStart: store.effectiveToday(),
  holEnd: store.effectiveToday(),
};

function lastLessonLen() {
  const days = store.load().lessonDays;
  if (!days.length) return 45;
  return [...days].sort((a, b) => (a.date < b.date ? -1 : 1)).at(-1).lenMin;
}

function daysBetween(dateA, dateB) {
  return Math.round((new Date(dateB + "T12:00:00") - new Date(dateA + "T12:00:00")) / 86400000);
}

function fmtDate(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  const weekday = WEEKDAYS[d.getDay()];
  const diff = daysBetween(dateStr, store.effectiveToday());
  const rel = diff === 0 ? "today" : diff === 1 ? "yesterday" : `${diff} days ago`;
  return `${weekday} ${dateStr.slice(5)} <small>(${rel})</small>`;
}

let toastTimer = null;
function toast(msg) {
  const el = root.querySelector("#toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2400);
}

function render() {
  if (!unlocked) return renderGate();
  renderControls();
}

// ── PIN gate ───────────────────────────────────────────────────────────────
function renderGate() {
  const creating = pinStage !== "enter";
  const title = pinStage === "enter" ? "Enter PIN" : pinStage === "confirm" ? "Confirm PIN" : "Create a PIN";
  const note = creating
    ? "Grown-ups only. This PIN guards lesson logging, days off, and the practice floor — not stats."
    : "";

  root.innerHTML = `
    <div class="pin-wrap">
      <span class="pin-lock">🔑</span>
      <h2 class="pin-title">${title}</h2>
      ${note ? `<p class="pin-note">${note}</p>` : ""}
      <input class="pin-input${pinError ? " err" : ""}" id="pin" type="password" inputmode="numeric"
             maxlength="4" autocomplete="off" placeholder="••••" />
      <button class="pin-go" id="go">${pinStage === "create" ? "Next" : pinStage === "confirm" ? "Set PIN" : "Unlock"}</button>
      <p class="pin-reset-note">Forgot the PIN? There's no reset yet — clearing site data starts over.</p>
    </div>
  `;

  const $pin = root.querySelector("#pin");
  $pin.focus();
  const submit = () => {
    const val = $pin.value.trim();
    if (val.length !== 4) return;
    if (pinStage === "enter") {
      if (store.checkPin(val)) {
        unlocked = true;
        pinError = false;
        render();
      } else {
        pinError = true;
        $pin.value = "";
        render();
      }
    } else if (pinStage === "create") {
      pinFirst = val;
      pinStage = "confirm";
      pinError = false;
      render();
    } else if (pinStage === "confirm") {
      if (val === pinFirst) {
        store.setPin(val);
        unlocked = true;
        render();
      } else {
        pinStage = "create";
        pinFirst = "";
        pinError = true;
        render();
      }
    }
  };
  root.querySelector("#go").addEventListener("click", submit);
  $pin.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
}

// ── Controls ──────────────────────────────────────────────────────────────
function renderControls() {
  const inputs = store.load();
  const state = project(inputs, { today: store.effectiveToday() });
  const cfg = inputs.config;

  // Clamp UI-only date defaults that may have drifted past "today" (e.g. the
  // test panel advanced the clock while this page sat unlocked).
  if (ui.lessonDate > store.effectiveToday()) ui.lessonDate = store.effectiveToday();

  root.innerHTML = `
    <header class="p-head">
      <h1>🔑 Parent area</h1>
      <p class="p-sub">Controls only — stats stay visible to her everywhere else.</p>
    </header>

    <div class="p-controls">
      <section class="pcard primary">
        <h2>🎻 Log a lesson</h2>
        <div class="row">
          <span class="row-label">Date</span>
          <div class="stepper">
            <button id="date-minus">−</button>
            <span class="val">${fmtDate(ui.lessonDate)}</span>
            <button id="date-plus" ${ui.lessonDate >= store.effectiveToday() ? "disabled" : ""}>+</button>
          </div>
        </div>
        <div class="row">
          <span class="row-label">Length</span>
          <div class="stepper">
            <button id="len-minus">−5</button>
            <span class="val">${ui.lessonLen} min</span>
            <button id="len-plus">+5</button>
          </div>
        </div>
        <button class="pbtn" id="log-lesson">Log lesson</button>
      </section>

      <section class="pcard">
        <h2>🛡️ Protect days off</h2>
        <div class="date-range">
          <label>Start <input type="date" id="hol-start" value="${ui.holStart}" /></label>
          <label>End <input type="date" id="hol-end" value="${ui.holEnd}" /></label>
        </div>
        <p class="pcard-hint">One day off (sick, recital)? Leave the end date the same. A trip? Set the
          range. These days hold the streak — they never break it, and they don't spend the emergency freeze.</p>
        <button class="pbtn ghost" id="mark-off">Mark days off</button>
      </section>

      <section class="pcard">
        <h2>⏱️ Daily floor</h2>
        <div class="row">
          <span class="row-label">Minutes to count a day</span>
          <div class="stepper">
            <button id="floor-minus">−5</button>
            <span class="val">${cfg.dailyFloorMin}</span>
            <button id="floor-plus">+5</button>
          </div>
        </div>
      </section>

      <section class="pcard">
        <h2>📅 Rest weekday</h2>
        <div class="row">
          <span class="row-label">Planned day off each week</span>
          <select class="p-select" id="rest-weekday">
            <option value="" ${cfg.restWeekday == null ? "selected" : ""}>None</option>
            ${WEEKDAYS.map((w, i) => `<option value="${i}" ${cfg.restWeekday === i ? "selected" : ""}>${w}</option>`).join("")}
          </select>
        </div>
      </section>

      <a class="detector-link" href="detector.html">Tune note detection →</a>

      <section class="pcard">
        <h2>📊 Live readout</h2>
        <div class="p-readout">
          <div><span>Day</span><b>${store.effectiveToday()}</b></div>
          <div><span>Streak</span><b>${state.streak.current} <small>(max ${state.streak.longest})</small></b></div>
          <div><span>Momentum</span><b>×${state.momentum}</b></div>
          <div><span>Points</span><b>${state.points.total.toLocaleString()}</b></div>
          <div><span>Floor</span><b>${cfg.dailyFloorMin} min</b></div>
          <div><span>Rest day</span><b>${cfg.restWeekday == null ? "None" : WEEKDAYS[cfg.restWeekday]}</b></div>
          <div><span>Lessons</span><b>${inputs.lessonDays.length}</b></div>
          <div><span>Days off</span><b>${inputs.holidays.length}</b></div>
        </div>
      </section>

      <a class="back-tracker" href="/">← Back to tracker</a>
    </div>

    <div class="toast" id="toast"></div>
  `;

  root.querySelector("#date-minus").addEventListener("click", () => {
    ui.lessonDate = store.addDaysStr(ui.lessonDate, -1);
    renderControls();
  });
  root.querySelector("#date-plus").addEventListener("click", () => {
    if (ui.lessonDate >= store.effectiveToday()) return;
    ui.lessonDate = store.addDaysStr(ui.lessonDate, 1);
    renderControls();
  });
  root.querySelector("#len-minus").addEventListener("click", () => {
    ui.lessonLen = Math.max(5, ui.lessonLen - 5);
    renderControls();
  });
  root.querySelector("#len-plus").addEventListener("click", () => {
    ui.lessonLen = Math.min(180, ui.lessonLen + 5);
    renderControls();
  });
  root.querySelector("#log-lesson").addEventListener("click", () => {
    store.logLesson(ui.lessonDate, ui.lessonLen);
    const logged = ui.lessonDate;
    renderControls();
    toast(`✓ Lesson logged for ${logged}`);
  });

  const $holStart = root.querySelector("#hol-start");
  const $holEnd = root.querySelector("#hol-end");
  $holStart.addEventListener("change", () => {
    ui.holStart = $holStart.value;
    if (ui.holStart > ui.holEnd) ui.holEnd = ui.holStart;
    renderControls();
  });
  $holEnd.addEventListener("change", () => {
    ui.holEnd = $holEnd.value;
    renderControls();
  });
  root.querySelector("#mark-off").addEventListener("click", () => {
    if (ui.holEnd < ui.holStart) {
      toast("End date must be on or after the start date");
      return;
    }
    store.addHoliday(ui.holStart, ui.holEnd);
    renderControls();
    toast("✓ Days off marked");
  });

  root.querySelector("#floor-minus").addEventListener("click", () => {
    store.setConfig({ dailyFloorMin: Math.max(5, cfg.dailyFloorMin - 5) });
    renderControls();
  });
  root.querySelector("#floor-plus").addEventListener("click", () => {
    store.setConfig({ dailyFloorMin: Math.min(60, cfg.dailyFloorMin + 5) });
    renderControls();
  });
  root.querySelector("#rest-weekday").addEventListener("change", (e) => {
    const v = e.target.value;
    store.setConfig({ restWeekday: v === "" ? null : Number(v) });
    renderControls();
  });
}

render();
