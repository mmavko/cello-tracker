# 2026-06-06 — Designed the main-app motivation UX (streak + Momentum + Collection)

**Motivation:** time to design the *real* main app — a daily motivator for the user's 11–13-year-old to practice cello, replacing the placeholder counter. Design only this session (no code); output is `docs/main-app-ux.md`.

**Central tension (the whole problem):** a Duolingo streak needs a daily qualifying threshold (15 min of detected sound), but the moment that threshold is shown as a goal it becomes the *ceiling* — Goodhart's law. The child's real sessions are much longer; 15 min must never read as "done." Requirement: keep the consistency benefit of streaks without surfacing the floor as a target.

**Resolution — split one number into two currencies, re-link with a multiplier:**
- **Streak** (fragile, resettable) drives daily consistency; its 15-min qualifier is a *quiet turnstile* — no countdown, no bar-to-15, only a small "Today counts ✓" mid-session, numbers always count *up*.
- **Collection** (permanent, never lost; world-tour theme — emoji-tile CSS grid, near-zero art budget) drives depth, fed by total minutes, no ceiling.
- **Momentum** (×1.0→×3.0 by streak length) is the link: longer streak → each practiced minute worth more. Breaking the streak drops Momentum to ×1 (the felt loss) but **never destroys the Collection** — humane loss aversion. Points = `minutes × Momentum`; the floor is never headlined.
- Supporting moves: anchor on her *own* trailing-median session length (not the floor); probabilistic surprise bonuses gated to *overtime* (post-floor) so they reward depth and never gamify the floor.

**Recurring design principle that drove every later decision — "one mechanism, two jobs is a smell."** Surfaced first as the played-vs-qualifying split, then forced a rework of day-handling.

**Day-handling settled into five non-overloaded primitives** (each real-life situation → exactly one):
- **Played** (detected ≥ floor), **Lesson** (parent-credited, no mic), **Rest day** (scheduled weekly day off), **Frozen** (emergency freeze), **Holiday** (pre-declared multi-day pause), else **Missed→break**.
- **Break is "medium":** treasure persists but the world greyscales (one CSS filter) and recolours *gradually* over `2 × your-usual` minutes of return practice (earned comeback, rewards depth).

**Two bugs the user caught, and their fixes (this is why the model has five types, not three):**
1. *Mid-week Holiday silently desynced the weekly rest cadence* — because an earlier design overloaded the emergency **Freeze** to also power the weekly rest, and its 7-day regen counter (which excludes Holiday days) would fall one short. Fix: give the weekly rest its **own primitive** (parent-set **Rest weekday**), independent of the freeze. This let us *delete* the fragile "frozen counts toward regen" rule; Freeze reverts to a rare backstop (regen after 7 played-equivalent days).
2. *The lesson day* — real practice (often the week's most valuable) but she won't run the app in front of the teacher; must count as **played**, which Holiday (a pause) can't do. New **Lesson credit** primitive: parent-gated (anti-gaming — a no-mic played-day+points credit would be trivially faked if child could self-tap), **one tap, today-or-yesterday grace** (covers "forgot to log yesterday"). Implemented as a date added to a `lessonDays` set that the date-driven state machine *replays* over → backfilling yesterday auto-undoes whatever it became (refunds a freeze, even un-breaks a break). Earns `lessonLen × Momentum`.

**Final refinement — Played + Lesson stack.** User flagged that making `played` suppress `lesson` meant a stray short home session could block the parent from logging the lesson. Decoupled points entirely from the day-type machine: a day's points = `detectedMin × Momentum` + (`lessonLen × Momentum` if logged) + bonuses; the **streak still increments once** per played-equivalent day. Stacking is also just *more correct* — a home-practice-plus-lesson day is genuinely more practice.

**Locked parameters/choices with the user:** audience 11–13; theme = world concert tour (locked); break intensity = medium with gradual recolour; Holiday = pre-declared pause; lesson = one-tap-confirm with one-day grace, points = lesson-length × Momentum. Spec includes data-model sketch (`cello.progress`, replay-derived state), the precedence state machine, parameters table, phasing (core loop → day-types/protection → polish), and out-of-scope (practice *quality*, accounts, social, notifications). `docs/README.md` index updated to link it.
