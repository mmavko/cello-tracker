# 2026-05-30 — Repo reorganized; established doc conventions

**Question:** Docs were accumulating in inconsistent places (`sound-analysis/spec.md` from the PoC era, new `docs/`, status info duplicated across README and chronicles). Where does each kind of content belong, going forward?

**Decision — one source of truth per concern:**
- `README.md` → vision + deploy + repo map only. No status, no design re-explanation, no "what's next" — all of those drift. Vision kept high-level enough that updates are rare.
- `chronicles.md` → all history, status, motivations, killed ideas. The canonical place to learn *why*.
- `docs/` → current technical design. Includes `docs/platform-foundations.md` (mic flow, audio pipeline, wake lock, iOS background recovery — extracted from the obsolete PoC spec) and the detection pipeline specs.
- `app/` → the implementation. Renamed from `sound-analysis/` because that name was an artifact of the PoC era — it's the whole app now, not a side experiment. Deploy command updated to `wrangler pages deploy app/ ...`.

**Deleted:** `app/spec.md` (PoC-era "Audio Wave Monitor" spec — superseded; still-useful patterns extracted into `docs/platform-foundations.md`, the obsolete framing dropped).

**Convention for future agents:** new design docs go in `docs/`. Status and rationale go in chronicles. README stays a door.
