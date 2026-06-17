# 2026-06-17 2219 — Phase 5 implemented (status surfacing: chips, longest headline, gradual recolour), reviewed clean

The Sonnet coding agent implemented Phase 5 to spec (`79b95f6`); Opus reviewed it — clean, no correctness bugs, faithful to the spec. Home now shows calm protection chips (Freeze ready / Holiday / Rest day), a promoted "best N" streak headline (replacing the duplicate footer line), a protection-aware status line (no longer misreads a holiday/rest day as an empty one), and the cooled world recolours **continuously** from `collection.dim` instead of the old binary cooled/not-cooled toggle. `npm test` 38 → **39**.

**What landed, against the three load-bearing spec decisions:**
- **Engine `today.isRestDay`** (decision #1) — added exactly as specced and nowhere else. Needed because the `D === today` branch resolves today to `open` before the rest/frozen/missed checks, so a view can't read "today is the rest day" off `status`. Derived from the same condition the engine already evaluates for `atRisk`; test P22 covers unplayed-rest / played-rest / non-rest-weekday. Kept the engine the single source of derived truth rather than re-deriving the weekday rule in the view.
- **Recolour warm-up** (decision #2) — the filter math matches UX §4.3 (`grayscale(dim)` 1→0, `opacity 1−0.4·dim` .6→1). Because a full `innerHTML` render makes `.world` a brand-new element each time, a bare `transition: filter` has nothing to animate *from*; the implementer used the one-frame entrance (render a step greyer → `requestAnimationFrame` to true `dim`) so the comeback visibly "warms" on each visit. Home's preview art is static-correct (no warm-up — it's the glanceable surface).
- **No `atRisk` on Home** (decision #3) — honored; chips state what protects her, never what she's about to lose.

**Review nit → backlog (not blocking):** the "best N" line and the "🌟 your best ever" flourish show throughout a *growing* streak (where `current === longest` every day), so the celebration is a constant label rather than a moment, and "best N" is redundant beside the live streak number. Faithful to the spec (which said show-best-always + optional flourish), so it's a design refinement, parked in `docs/polish-backlog.md` to gate the flourish to the actual record-setting day.

**Process:** the agent also cleaned two more stray `</content></invoke>` tool-call artifacts (in `main-app-phase-5.md` + `polish-backlog.md`) — the third occurrence traced to Opus's large doc Writes; worth self-checking the tail of written docs going forward. Prod was on Phase 4 (build 0617-2150) at review time; Phase 5 deployed immediately after this entry.

[refines: entries/2026-06-17-2110-phase-4-implemented-parent-area-reviewed-clean-polish-backlog-started.md]
