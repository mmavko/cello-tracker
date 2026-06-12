// ── views/summary.js ─────────────────────────────────────────────────────────
// The session summary (UX §7.3): minutes today, the points math made legible so
// the multiplier is felt, progress to the next tile, streak. Positive, brief,
// forward-looking — no grade. Pure snapshot of project()'s output.

import { WORLD_TOUR } from "../theme.js";

const fmtMom = (n) => String(n);

export function render({ root, state, actions, unlocksAtStart }) {
  const { today, streak, points, collection } = state;
  const min = Math.round(today.playedMin);

  // Anything unlocked since practice began (controller snapshots the count).
  const grew = collection.unlockedIds.length - (unlocksAtStart ?? collection.unlockedIds.length);
  const justUnlocked =
    grew > 0
      ? WORLD_TOUR.filter((t) => collection.unlockedIds.includes(t.id)).slice(-grew)
      : [];

  const next = points.nextTile;

  root.className = "view view-summary";
  root.innerHTML = `
    <div class="summary-wrap">
      <h1 class="sum-title">Nice playing.</h1>

      ${
        justUnlocked.length
          ? `<div class="unlocked-celebrate">
               <div class="unlock-emojis">${justUnlocked.map((t) => `<span>${t.emoji}</span>`).join("")}</div>
               <p>✨ Unlocked ${justUnlocked.map((t) => t.name).join(", ")}!</p>
             </div>`
          : ""
      }

      <div class="sum-math">
        <span class="sum-min">${min} min</span>
        <span class="op">×</span>
        <span class="sum-mom">×${fmtMom(state.momentum)}</span>
        <span class="op">=</span>
        <span class="sum-pts">${today.pointsToday} pts</span>
      </div>

      <p class="sum-next">
        ${
          next
            ? `${points.toNextTile.toLocaleString()} points to <strong>${next.name}</strong>`
            : `You've unlocked the whole world 🌍`
        }
      </p>

      <p class="sum-streak">
        🔥 ${streak.current} day${streak.current === 1 ? "" : "s"}${
          streak.longest > streak.current ? ` · longest ${streak.longest}` : ""
        }
      </p>

      <button class="btn-done" id="done">Done</button>
    </div>
  `;

  root.querySelector("#done").addEventListener("click", () => actions.go("home"));
}
