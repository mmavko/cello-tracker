// ── views/home.js ────────────────────────────────────────────────────────────
// The hub (UX §7.1): streak + Momentum (the two fragile things), a big Start
// button, an understated today-status line, and a Collection preview. Renders a
// snapshot of project()'s output; no detector, no timers.

import { WORLD_TOUR } from "../theme.js";

const byId = Object.fromEntries(WORLD_TOUR.map((t) => [t.id, t]));
const fmtMom = (n) => String(n);

export function render({ root, state, actions }) {
  const { today, streak, momentum, points, collection } = state;
  const cooled = collection.dim === 1;
  const next = points.nextTile;

  const unlocked = WORLD_TOUR.filter(
    (t) => collection.unlockedIds.includes(t.id) && t.id !== "home"
  );
  const recent = unlocked.slice(-3).reverse();

  const shownMin = Math.round(today.playedMin);
  const statusLine = today.secured
    ? `Today counts ✓ · ${shownMin} min`
    : shownMin >= 1
      ? `${shownMin} min so far`
      : "Not played yet today";

  root.className = "view view-home" + (cooled ? " cooled" : "");
  root.innerHTML = `
    <header class="home-hero">
      <div class="streak">
        <span class="flame">🔥</span>
        <span class="streak-num">${streak.current}</span>
        <span class="streak-label">day${streak.current === 1 ? "" : "s"} in a row</span>
      </div>
      <div class="momentum" title="every practiced minute is worth this much">
        <span class="mom-x">×${fmtMom(momentum)}</span>
        <span class="mom-label">momentum</span>
      </div>
    </header>

    ${cooled ? `<p class="cooled-note">Your world has cooled — play to bring it back.</p>` : ""}

    <button class="btn-start" id="start">
      <span class="bow">🎻</span> Start practice
    </button>
    <p class="today-status">${statusLine}</p>

    <button class="preview" id="open-collection">
      ${
        next
          ? `<div class="preview-next">
               <span class="next-emoji">${byId[next.id]?.emoji ?? "🎵"}</span>
               <span class="next-meta">
                 <span class="next-label">Next stop</span>
                 <span class="next-name">${next.name}</span>
                 <span class="next-togo">${points.toNextTile.toLocaleString()} pts to go</span>
               </span>
             </div>`
          : `<div class="preview-next"><span class="next-name">The whole world is yours 🌍</span></div>`
      }
      <div class="preview-recent">
        ${recent.map((t) => `<span class="mini-stamp" title="${t.name}">${t.emoji}</span>`).join("")}
        <span class="preview-cta">See your world →</span>
      </div>
    </button>

    <footer class="home-foot">
      <span>${points.total.toLocaleString()} points</span>
      <span>·</span>
      <span>🔥 longest ${streak.longest}</span>
      <a class="tune" href="settings.html" title="tune detection">⚙</a>
    </footer>
  `;

  root.querySelector("#start").addEventListener("click", () => actions.go("practice"));
  root.querySelector("#open-collection").addEventListener("click", () => actions.go("collection"));

  // Hidden entry to the test panel: long-press (~700ms) the streak. Deliberately
  // undiscoverable in normal tapping; the 🧪 chip is the backstop if used.
  //
  // iOS Safari cancels a Pointer Events long-press — it claims the touch for its
  // own selection/callout/scroll gesture and fires `pointercancel`, killing the
  // timer before it can fire. So we use touch events with preventDefault() (+
  // `touch-action: none` in CSS) to keep the gesture ours, and a small movement
  // tolerance so a still hold survives micro-jitter. Mouse events cover desktop.
  const streakEl = root.querySelector(".streak");
  let lpTimer = null, lpFrom = null;
  const lpEnd = () => { clearTimeout(lpTimer); lpTimer = null; lpFrom = null; };
  const lpBegin = (x, y) => {
    lpFrom = { x, y };
    lpTimer = setTimeout(() => { lpTimer = null; actions.go("test"); }, 700);
  };
  const lpMove = (x, y) => { if (lpFrom && Math.hypot(x - lpFrom.x, y - lpFrom.y) > 12) lpEnd(); };

  streakEl.addEventListener("touchstart", (e) => { e.preventDefault(); const t = e.touches[0]; lpBegin(t.clientX, t.clientY); }, { passive: false });
  streakEl.addEventListener("touchmove", (e) => { const t = e.touches[0]; lpMove(t.clientX, t.clientY); }, { passive: true });
  streakEl.addEventListener("touchend", lpEnd);
  streakEl.addEventListener("touchcancel", lpEnd);
  streakEl.addEventListener("mousedown", (e) => lpBegin(e.clientX, e.clientY));
  streakEl.addEventListener("mousemove", (e) => lpMove(e.clientX, e.clientY));
  streakEl.addEventListener("mouseup", lpEnd);
  streakEl.addEventListener("mouseleave", lpEnd);
}
