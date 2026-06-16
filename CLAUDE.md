# CLAUDE.md — cello-tracker

**Orient first:** project memory lives in `.chronicles/` — `Read` `.chronicles/digest.md` (current state, invariants, gotchas, open questions) before acting. The `SessionStart` hook only signals its *presence* (entry count + last-updated), **not** its content, so it isn't auto-injected — you must read it. Individual `.chronicles/entries/*` hold the full history and are read **on demand**, only when a task needs the deeper *why* (the digest's invariants point to the exact entry; `.chronicles/index.md` is the chronological list). Then `docs/` = design specs (`main-app-*`), `README.md` = the door.

## Browser verification → delegate to a Haiku subagent
This project's loop is **edit → `./deploy.sh` → verify in a browser**, so browser work dominates and it's the #1 context sink here. **When a check needs 3+ browser actions, delegate it** — `Agent`, `subagent_type: general-purpose`, `model: haiku`, a precise checklist, "report ≤N lines, no screenshots." With Agent Teams enabled, keep one QA worker and `SendMessage` it follow-ups (resumes warm, no cold-start re-pay) rather than re-spawning. Full rationale: the user-level "Delegate browser work" lifehack in `~/.claude/CLAUDE.md`.

## Deploy + cache: confirm the build before trusting a check
- Deploy with **`./deploy.sh`**, never raw `wrangler` — it stamps `?v=<build>` onto every `<script src>` / module import to defeat Cloudflare Pages' 4h JS cache. A query on the *page* URL can't bust sub-resources; only each module's own URL can.
- After deploying, **check the footer version stamp (the tiny `v0.3 · MMDD-HHMM` next to ⚙) matches the build you just shipped** before believing any browser result — otherwise you may be looking at a cached page.
- `?cb=` cache-buster curls **bypass** Cloudflare's edge cache, so they can mask staleness. To see what a real browser gets, curl the **plain** URL.

## Test panel / localStorage gotcha
- The hidden test panel (tap the 🔥 streak **5×**) writes **synthetic, tainted data to `localStorage`, per origin**, and it ships to production.
- **Don't drive the test panel against the production origin** (`cello.mavko.consulting`) in a browser profile you care about — fake state (day-offset, points) accumulates there across runs. QA against **localhost**, or have the worker **`Clear` first** and again when done. The 🧪 "test data — not real" chip marks a tainted state until `Clear` wipes it.
- It's shell-only by design: `cello.test = {dayOffset, tainted}` feeds the engine's injected `today` param; real session timestamps are never rewritten. The engine stays pure.

## Conventions that bite if ignored
- App source is **build-free** (native ESM, no bundler); `deploy.sh` (a `cp` + `sed`) is the only transform. Keep `motivation.js` / `theme.js` **pure** — no browser APIs, clock, or RNG; `today` and randomness are injected.
- Persist **facts only** (`config`, `sessions[]`, `lessonDays[]`, `holidays[]`, `bonuses[]`); everything else (streak/points/status/unlocks) is recomputed by `project()`. Never store a derived value.
- Session timestamps use `localISO()` (local date), never `toISOString()` (UTC) — the engine keys a session's day on `start.slice(0,10)`.
- Commit/push only when asked. Engine changes → keep `npm test` green.
