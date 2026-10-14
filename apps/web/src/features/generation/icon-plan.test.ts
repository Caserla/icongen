import test from "node:test";
import assert from "node:assert/strict";
import { expandStatePairPlan, expandStylePairPlan, ICON_PLAN_PROMPT, normalizeIconPlan } from "./icon-plan";
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
test("state pair expands every subject into separate default and selected icons", () => {
  const plan = normalizeIconPlan({ ...base, subjects: [{ name: "收藏", description: "收藏按钮" }, { name: "主页", description: "主页入口" }] });
  const paired = expandStatePairPlan(plan);
  assert.equal(paired.count, 4);
  assert.deepEqual(paired.subjects.map(subject => [subject.name, subject.state]), [
    ["收藏", "outline"], ["收藏", "solid"], ["主页", "outline"], ["主页", "solid"],
  ]);
  assert.equal(new Set(paired.subjects.map(subject => subject.id)).size, 4);
});
test("secondary style expands each subject into two independent icons without changing the subject", () => {
  const plan = normalizeIconPlan({ ...base, subjects: [{ name: "搜索", description: "放大镜" }, { name: "设置", description: "齿轮" }] });
  const paired = expandStylePairPlan(plan);
  assert.equal(paired.count, 4);
  assert.deepEqual(paired.subjects.map(subject => [subject.name, subject.description, subject.styleRole]), [
    ["搜索", "放大镜", "main"], ["搜索", "放大镜", "secondary"],
    ["设置", "齿轮", "main"], ["设置", "齿轮", "secondary"],
  ]);
  assert.equal(new Set(paired.subjects.map(subject => subject.id)).size, 4);
  assert.deepEqual(expandStylePairPlan(paired), paired);
});
