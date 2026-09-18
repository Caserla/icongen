import test from "node:test";
import assert from "node:assert/strict";
import { ICON_PLAN_PROMPT, normalizeIconPlan } from "./icon-plan";
const base = { recognizable: true, intent: "explicit_subjects", referenceUse: "none", summary: "test" };
test("retains separate subjects and derives their count", () => {
  const plan = normalizeIconPlan({ ...base, subjects: [{ name: "猫", description: "猫" }, { name: "狗", description: "狗" }] });
  assert.equal(plan.count, 2); assert.equal(plan.fallback, false);
  assert.equal(new Set(plan.subjects.map(s => s.id)).size, 2);
});
test("unrecognizable intent gets exactly twenty fixed icons", () => {
  const plan = normalizeIconPlan({ ...base, recognizable: false, intent: "unclear", subjects: [] });
  assert.equal(plan.count, 20); assert.equal(plan.fallback, true);
});
test("malformed and empty recognizable responses fail instead of silently falling back", () => {
  assert.throws(() => normalizeIconPlan({ ...base, subjects: [] }));
  assert.throws(() => normalizeIconPlan({ error: "upstream unavailable" }));
});
test("planner extracts intent without optimizing or changing it", () => {
  assert.match(ICON_PLAN_PROMPT, /without optimizing, rewriting, expanding or changing it/);
  assert.match(ICON_PLAN_PROMPT, /Preserve the user's wording and semantic scope/);
  assert.match(ICON_PLAN_PROMPT, /must not enrich an already explicit subject/);
  assert.doesNotMatch(ICON_PLAN_PROMPT, /Translate each one into/);
});
