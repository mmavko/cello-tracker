// Phase 0 smoke test — proves native ESM import works under `node --test` and the
// engine's exported surface is present. (The real coverage is in motivation.test.js.)
import { test } from "node:test";
import assert from "node:assert/strict";
import { project, momentumFor, shouldOfferBonus } from "../app/motivation.js";
import { WORLD_TOUR } from "../app/theme.js";

test("smoke: ESM imports and project returns a shape", () => {
  assert.equal(typeof project, "function");
  assert.equal(typeof momentumFor, "function");
  assert.equal(typeof shouldOfferBonus, "function");
  assert.ok(Array.isArray(WORLD_TOUR) && WORLD_TOUR.length > 0);

  const s = project({ config: { dailyFloorMin: 15 }, sessions: [] }, { today: "2026-06-06" });
  assert.equal(typeof s, "object");
  assert.ok(s.today && s.streak && s.points && s.collection && s.daysIndex);
});
