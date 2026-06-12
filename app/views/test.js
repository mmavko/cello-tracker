// ── views/test.js ────────────────────────────────────────────────────────────
// Hidden testing panel (long-press the streak on Home to reach it). Drives the
// app's state without the mic so the full date-driven loop — streak, Momentum,
// collection, and the upcoming protection day-types — can be exercised. Every
// control mutates a shell-only fact and reprojects immediately. NOT child-facing;
// any use (except Clear) sets the 🧪 taint flag the controller surfaces app-wide.

import * as store from "../store.js";
import { VERSION } from "../version.js";

export function render({ root, state, actions }) {
  const test = store.loadTest();

  root.className = "view view-test";
  root.innerHTML = `
    <header class="test-head">
      <button class="back" id="back">←</button>
      <h1>🧪 Test panel</h1>
      <p class="test-warn">Fake data for testing. <b>Clear</b> resets to a clean app. · v${VERSION}</p>
    </header>

    <div class="test-readout">
      <div><span>Day</span><b>${store.effectiveToday()}${test.dayOffset ? ` (+${test.dayOffset})` : ""}</b></div>
      <div><span>Today</span><b>${Math.round(state.today.playedMin)} min${state.today.secured ? " ✓" : ""}</b></div>
      <div><span>Streak</span><b>${state.streak.current} <small>(max ${state.streak.longest})</small></b></div>
      <div><span>Momentum</span><b>×${state.momentum}</b></div>
      <div><span>Points</span><b>${state.points.total.toLocaleString()}</b></div>
      <div><span>Unlocked</span><b>${state.collection.unlockedIds.length} / 76</b></div>
    </div>

    <div class="test-controls">
      <button class="tbtn" id="add5">+5 min<small>practice today</small></button>
      <button class="tbtn" id="played">+ played day<small>30 min, then advance</small></button>
      <button class="tbtn" id="advance">+1 day<small>jump to tomorrow</small></button>
      <button class="tbtn danger" id="clear">Clear<small>wipe all data</small></button>
    </div>
  `;

  root.querySelector("#back").addEventListener("click", () => actions.go("home"));
  root.querySelector("#add5").addEventListener("click", () => { store.testAddMinutes(5); actions.go("test"); });
  root.querySelector("#played").addEventListener("click", () => { store.testPlayedDay(30); actions.go("test"); });
  root.querySelector("#advance").addEventListener("click", () => { store.testAdvanceDay(1); actions.go("test"); });

  // Clear is destructive → two-tap confirm (no browser confirm(): it blocks the page).
  const clearBtn = root.querySelector("#clear");
  const clearHTML = clearBtn.innerHTML;
  clearBtn.addEventListener("click", () => {
    if (clearBtn.dataset.confirm === "1") {
      store.testClear();
      actions.go("home");
      return;
    }
    clearBtn.dataset.confirm = "1";
    clearBtn.innerHTML = "Tap again to wipe";
    setTimeout(() => {
      clearBtn.dataset.confirm = "0";
      clearBtn.innerHTML = clearHTML;
    }, 2500);
  });
}
