// ── main.js ──────────────────────────────────────────────────────────────────
// The controller: the tiny unidirectional loop (arch §4).
//   store.load() → project() → render();  an action mutates an input → reproject.
// Owns an in-memory view router (NO url hash, by design) so the iPhone back-swipe
// can't exit a live practice session, and leaving practice always tears the
// detector down via the registered teardown. See docs/main-app-phase-2.md.

import { project } from "./motivation.js";
import * as store from "./store.js";
import * as Home from "./views/home.js";
import * as Practice from "./views/practice.js";
import * as Summary from "./views/summary.js";
import * as Collection from "./views/collection.js";
import * as Test from "./views/test.js";

const VIEWS = { home: Home, practice: Practice, summary: Summary, collection: Collection, test: Test };

const root = document.getElementById("root");
let view = "home";
let teardown = null; // set by the practice view; run when we leave it
let unlocksAtStart = 0; // snapshot for the summary's "just unlocked" celebration

function rerender() {
  // Always reload from store so any storage mutation (a flush, an ended session)
  // is reflected — load() is O(small) and keeps the loop honest. `today` is the
  // EFFECTIVE day (real clock + any test offset; 0 in normal use).
  const state = project(store.load(), { today: store.effectiveToday() });
  document.body.classList.toggle("tainted", store.loadTest().tainted);
  if (view === "practice") unlocksAtStart = state.collection.unlockedIds.length;
  VIEWS[view].render({ root, state, actions, unlocksAtStart });
}

const actions = {
  go(next) {
    if (teardown) {
      try {
        teardown();
      } catch {}
      teardown = null;
    }
    view = next;
    rerender();
  },
  // Practice registers its detector/timer cleanup here so go() can run it on exit.
  registerTeardown(fn) {
    teardown = fn;
  },
};

rerender();
