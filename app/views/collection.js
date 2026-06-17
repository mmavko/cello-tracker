// ── views/collection.js ──────────────────────────────────────────────────────
// The World Tour (UX §7.4, §4): a CSS grid of emoji "stamps". Unlocked in colour,
// locked dimmed + 🔒 with the cost shown. Tap a tile for its one-line fact. A break
// continuously greyscales the grid from `collection.dim` (1 → 0 as she earns the
// world back, Phase 5) — the showcase surface for the gradual recolour.
// No per-tile artwork — the entire visual surface is data.

import { WORLD_TOUR } from "../theme.js";

export function render({ root, state, actions }) {
  const { collection, points } = state;
  const unlocked = new Set(collection.unlockedIds);
  const dim = collection.dim;
  const next = points.nextTile;
  const cooledNote = state.recovery.active
    ? dim === 1
      ? `<p class="cooled-note">Your world has cooled — play to bring it back.</p>`
      : `<p class="cooled-note">Warming back up — keep playing 🎨</p>`
    : "";

  root.className = "view view-collection";
  root.innerHTML = `
    <header class="coll-head">
      <button class="back" id="back">←</button>
      <h1>Your World Tour</h1>
      <p class="coll-sub">${unlocked.size} of ${WORLD_TOUR.length} places · ${points.total.toLocaleString()} points</p>
      ${
        next
          ? `<p class="coll-next">${points.toNextTile.toLocaleString()} pts to <strong>${next.name}</strong></p>`
          : `<p class="coll-next">The whole world is yours 🌍</p>`
      }
      ${cooledNote}
    </header>

    <div class="world">
      ${WORLD_TOUR.map((t, i) => {
        const on = unlocked.has(t.id);
        return `
          <button class="stamp ${on ? "unlocked" : "locked"}" data-id="${t.id}" style="--i:${i}">
            <span class="stamp-emoji">${on ? t.emoji : "🔒"}</span>
            <span class="stamp-name">${t.name}</span>
            <span class="stamp-meta">${on ? "visited" : t.costPoints.toLocaleString() + " pts"}</span>
          </button>`;
      }).join("")}
    </div>

    <div class="fact-sheet" id="fact" hidden></div>
  `;

  // Continuous recolour with a one-frame entrance warm-up: a full innerHTML
  // render makes `.world` a brand-new element each time, so a bare
  // `transition: filter` has nothing to animate FROM — start a step greyer,
  // then animate to the true warmth on the next frame (Phase 5 decision #2).
  const warmFilter = `grayscale(${dim}) opacity(${(1 - 0.4 * dim).toFixed(3)})`;
  const world = root.querySelector(".world");
  if (dim > 0) {
    const entryDim = Math.min(dim + 0.3, 1);
    world.style.filter = `grayscale(${entryDim}) opacity(${(1 - 0.4 * entryDim).toFixed(3)})`;
    requestAnimationFrame(() => { world.style.filter = warmFilter; });
  } else {
    world.style.filter = warmFilter; // grayscale(0) opacity(1) = no effect
  }

  root.querySelector("#back").addEventListener("click", () => actions.go("home"));

  const fact = root.querySelector("#fact");
  root.querySelectorAll(".stamp").forEach((btn) => {
    btn.addEventListener("click", () => {
      const t = WORLD_TOUR.find((x) => x.id === btn.dataset.id);
      const on = unlocked.has(t.id);
      fact.innerHTML = `
        <span class="fact-emoji">${on ? t.emoji : "🔒"}</span>
        <span class="fact-name">${t.name}</span>
        <span class="fact-body">${on ? t.fact : `${t.costPoints.toLocaleString()} points to unlock`}</span>`;
      fact.hidden = false;
      // restart the entrance animation each tap
      fact.classList.remove("show");
      void fact.offsetWidth;
      fact.classList.add("show");
    });
  });
}
