// ── views/home.js ────────────────────────────────────────────────────────────
// The hub (UX §7.1): streak + Momentum (the two fragile things), a big Start
// button, an understated today-status line, and a Collection preview. Renders a
// snapshot of project()'s output; no detector, no timers.

import { WORLD_TOUR } from "../theme.js";
import { VERSION } from "../version.js";

const byId = Object.fromEntries(WORLD_TOUR.map((t) => [t.id, t]));
const fmtMom = (n) => String(n);

export function render({ root, state, actions }) {
  const { today, streak, momentum, points, collection } = state;
  const next = points.nextTile;

  const unlocked = WORLD_TOUR.filter(
    (t) => collection.unlockedIds.includes(t.id) && t.id !== "home"
  );
  const recent = unlocked.slice(-3).reverse();

  // Status line: a protection/credit label as prefix, with accrued mic minutes
  // appended whenever she played some (sub-floor minutes still earn points, even on
  // a holiday/rest/lesson day — so never hide them). "at home" disambiguates the
  // lesson line, where the lesson's own lenMin and her home practice are two numbers.
  const shownMin = Math.round(today.playedMin);
  let statusLine;
  if (today.secured)                   statusLine = `Today counts ✓ · ${shownMin} min`;
  else if (today.status === "lesson")  statusLine = `Lesson logged ✓${shownMin >= 1 ? ` · ${shownMin} min at home` : ""}`;
  else if (today.status === "holiday") statusLine = shownMin >= 1 ? `Holiday 🏝️ · ${shownMin} min` : "Holiday — enjoy your day off 🏝️";
  else if (today.isRestDay)            statusLine = shownMin >= 1 ? `Rest day · ${shownMin} min` : "Rest day — playing's optional today";
  else if (shownMin >= 1)              statusLine = `${shownMin} min so far`;
  else                                 statusLine = "Not played yet today";

  // Calm reassurance only — what's protecting her, never what she's about to
  // lose (no atRisk here, by design: UX §10 anti-dread).
  const chips = [];
  if (state.freeze.banked)            chips.push({ icon: "❄️", label: "Freeze ready" });
  if (today.status === "holiday")     chips.push({ icon: "🏝️", label: "Holiday" });
  if (today.isRestDay)                chips.push({ icon: "😌", label: "Rest day" });

  const justBest = streak.current === streak.longest && streak.current > 0;

  // Continuous recolour of the preview art only (never the text) — replaces the
  // old binary `.cooled` toggle (Phase 5).
  const dim = collection.dim;
  const warmFilter = `grayscale(${dim}) opacity(${(1 - 0.4 * dim).toFixed(3)})`;
  const cooledNote = state.recovery.active
    ? dim === 1
      ? `<p class="cooled-note">Your world has cooled — play to bring it back.</p>`
      : `<p class="cooled-note">Warming back up — keep playing 🎨</p>`
    : "";

  root.className = "view view-home";
  root.innerHTML = `
    <header class="home-hero">
      <div class="streak">
        <span class="flame">🔥</span>
        <span class="streak-num">${streak.current}</span>
        <span class="streak-label">day${streak.current === 1 ? "" : "s"} in a row</span>
        <span class="streak-best">best ${streak.longest}${justBest ? " · 🌟 your best ever" : ""}</span>
      </div>
      <div class="momentum" title="every practiced minute is worth this much">
        <span class="mom-x">×${fmtMom(momentum)}</span>
        <span class="mom-label">momentum</span>
      </div>
    </header>

    ${chips.length ? `<div class="chips">${chips.map((c) => `<span class="chip">${c.icon} ${c.label}</span>`).join("")}</div>` : ""}
    ${cooledNote}

    <button class="btn-start" id="start">
      <span class="bow">🎻</span> Start practice
    </button>
    <p class="today-status">${statusLine}</p>

    <button class="preview" id="open-collection">
      ${
        next
          ? `<div class="preview-next">
               <span class="next-emoji" style="filter:${warmFilter}">${byId[next.id]?.emoji ?? "🎵"}</span>
               <span class="next-meta">
                 <span class="next-label">Next stop</span>
                 <span class="next-name">${next.name}</span>
                 <span class="next-togo">${points.toNextTile.toLocaleString()} pts to go</span>
               </span>
             </div>`
          : `<div class="preview-next"><span class="next-name">The whole world is yours 🌍</span></div>`
      }
      <div class="preview-recent">
        ${recent.map((t) => `<span class="mini-stamp" title="${t.name}" style="filter:${warmFilter}">${t.emoji}</span>`).join("")}
        <span class="preview-cta">See your world →</span>
      </div>
    </button>

    <footer class="home-foot">
      <span>${points.total.toLocaleString()} points</span>
      <span class="ver">v${VERSION}</span>
      <a class="tune" href="parent.html" title="grown-ups">🔑</a>
    </footer>
  `;

  root.querySelector("#start").addEventListener("click", () => actions.go("practice"));
  root.querySelector("#open-collection").addEventListener("click", () => actions.go("collection"));

  // Hidden entry to the test panel: tap the streak 5× quickly. A long-press is
  // unreliable on iOS Safari (it claims the hold for its own selection gesture),
  // but a tap always fires `click` — nothing for the OS to intercept. Five rapid
  // taps is still unlikely to happen by accident; the 🧪 chip is the backstop.
  const streakEl = root.querySelector(".streak");
  let taps = 0, tapTimer = null;
  streakEl.addEventListener("click", () => {
    if (++taps >= 5) { taps = 0; clearTimeout(tapTimer); actions.go("test"); return; }
    clearTimeout(tapTimer);
    tapTimer = setTimeout(() => { taps = 0; }, 700); // reset if taps slow down
  });
}
