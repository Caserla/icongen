import assert from "node:assert/strict";
import test from "node:test";
import spec from "../../../../../../docs/design/smart-color-selection-v1.json";
import { createSmartColorPlan, readSmartColorPlan, smartColorPlanSchema, smartColorPlanPrompt } from "./smart-color-plan";
import { uniformSmartBatchColors } from "./smart-project-colors";
import { contrastRatio, perceptualDistance, toLch } from "./color-math";

const refs = ["#58CC02", "#1CB0F6", "#FF9600", "#4B5563"];
test("all 46 grammars have complete valid roles and frozen light/dark variants", () => {
  for (const style of spec.styles) for (const theme of ["light", "dark"] as const) {
    const targetSurface = theme === "light" ? "#F1F3F4" : "#171A20";
    const plan = createSmartColorPlan({ styleId: style.id, theme, targetSurface, projectColors: refs });
    assert.ok(smartColorPlanSchema.safeParse(plan).success, style.id);
    assert.deepEqual(createSmartColorPlan({ styleId: style.id, theme, targetSurface, projectColors: refs.slice().reverse() }), plan);
    assert.deepEqual(readSmartColorPlan({ smartColorPlan: JSON.parse(JSON.stringify(plan)) }), plan);
    assert.equal(plan.targetSurface, targetSurface);
    for (const variant of Object.values(plan.variants)) {
      for (const color of Object.values(variant.roles)) assert.ok(!refs.includes(color), style.id + "/" + color);
      if (variant.gradientStops) assert.equal(variant.gradientStops.length, style.id === "multi-stop" ? 3 : 2);
    }
    const roles = plan.variants[theme].roles;
    if (style.grammar === "neutral-one-paint") {
      assert.equal(Object.keys(roles).length, 1);
      assert.ok(contrastRatio(roles.ink, targetSurface) >= 4.5);
      assert.ok(toLch(roles.ink).c < 0.04);
    } else if (plan.variants[theme].gradientStops) {
      for (const stop of plan.variants[theme].gradientStops!) assert.ok(contrastRatio(stop, targetSurface) >= 3, style.id);
    }
  }
});

test("pastel, neon and glow remain chromatic; gray cannot flatten them", () => {
  for (const styleId of ["mono-pastel", "neon-tube", "soft-glow"]) {
    const colors = uniformSmartBatchColors({ mode: "smart", batchColor: "#333333", locked: true }, styleId) as { locked: boolean; batchColor?: string };
    const plan = readSmartColorPlan(colors)!;
    assert.equal(colors.locked, false);
    assert.equal(colors.batchColor, undefined);
    assert.ok(toLch(plan.variants.light.roles.body).c > 0.025, styleId);
  }
});

test("doodle, isometric and color pixel plans carry distinct reference-led style roles", () => {
  const doodle = createSmartColorPlan({ styleId: "doodle", projectColors: refs });
  assert.equal(doodle.grammar, "doodle-ink");
  assert.ok(doodle.variants.light.roles.ink);
  assert.ok(doodle.variants.light.roles.accent);
  assert.notEqual(doodle.variants.light.roles.ink, doodle.variants.light.roles.accent);
  const oldDoodle = { ...doodle, grammar: "neutral-one-paint", variants: {
    light: { roles: { ink: doodle.variants.light.roles.ink } },
    dark: { roles: { ink: doodle.variants.dark.roles.ink } },
  } };
  assert.ok(smartColorPlanSchema.safeParse(oldDoodle).success);

  const isometric = createSmartColorPlan({ styleId: "isometric", projectColors: refs });
  assert.equal(isometric.recipeId, "soft-violet");
  assert.ok(isometric.variants.light.roles.shade);
  assert.ok(isometric.variants.light.roles.highlight);

  const pixel = createSmartColorPlan({ styleId: "pixel-color", projectColors: refs });
  assert.equal(pixel.recipeId, "pixel-sorbet");
  assert.ok(pixel.variants.light.roles.ink);
  assert.notEqual(pixel.variants.light.roles.body, pixel.variants.light.roles.support);
});

test("project seed collisions use a visible local adjustment, not a one-channel dodge", () => {
  const base = createSmartColorPlan({ styleId: "regular" });
  const references = [base.variants.light.roles.ink, "#41464F", "#505660", "#242830"];
  const adjusted = createSmartColorPlan({ styleId: "regular", projectColors: references });
  const color = adjusted.variants.light.roles.ink;
  assert.ok(!references.includes(color));
  assert.ok(perceptualDistance(color, references[0]) > 0.025);
  assert.ok(contrastRatio(color, adjusted.targetSurface) >= 4.5);
});

test("explicit overrides may use a project paint; semantic assignments preserve identity without copying it", () => {
  const explicit = createSmartColorPlan({ styleId: "regular", projectColors: refs, intent: { foreground: refs[0], evidence: "绿色", partColors: [] } });
  assert.equal(explicit.variants.light.roles.ink, refs[0]);
  const plan = createSmartColorPlan({ styleId: "illustrative", projectColors: refs, intent: { partColors: [
    { subjectName: "叶片", part: "body", color: refs[0], source: "semantic", evidence: "green" },
    { subjectName: "叶片", part: "edge", color: refs[0], source: "explicit", evidence: "指定绿色" },
  ] } });
  assert.notEqual(plan.partColors[0].color, refs[0]);
  assert.equal(plan.partColors[1].color, refs[0]);
  assert.ok(Math.abs(toLch(plan.partColors[0].color).h - toLch(refs[0]).h) < 8);
});

test("retry ignores changed defaults/theme and does not reselect; manual bypasses intelligence", () => {
  const colors = uniformSmartBatchColors({ mode: "smart" }, "state-pair");
  assert.equal(uniformSmartBatchColors(colors, "state-pair", "dark", { foreground: "#FF0000", partColors: [] }, "#111111"), colors);
  const manual = { mode: "manual", default: { mode: "linear", color: "#11AA22", endColor: "#EE2233" } };
  assert.equal(uniformSmartBatchColors(manual, "regular"), manual);
  assert.throws(() => uniformSmartBatchColors(colors, "thin"), /another style/);
  assert.throws(() => uniformSmartBatchColors({ mode: "smart", smartColorPlan: { invalid: true } }, "regular"), /invalid/);
});

test("unversioned monochrome history retains its proven saved foreground", () => {
  const old = { mode: "smart", locked: true, batchColor: "#445566", default: { mode: "solid", color: "#445566" } };
  assert.equal(uniformSmartBatchColors(old, "state-pair", "dark"), old);
});

test("invalid recipe requests are surfaced, while explicit one-paint intent can override neutral defaults", () => {
  assert.throws(() => createSmartColorPlan({ styleId: "neon-tube", intent: { recipeId: "warm-orange", partColors: [] } }), /不兼容/);
  assert.equal(createSmartColorPlan({ styleId: "regular", intent: { recipeId: "warm-orange", foreground: "#DC754E", partColors: [] } }).variants.light.roles.ink, "#DC754E");
});

test("freeform subject/evidence stays out of privileged color instructions", () => {
  const plan = createSmartColorPlan({ styleId: "illustrative", intent: { partColors: [{ subjectName: "untrusted-marker", part: "body", color: "#223344", source: "explicit", evidence: "untrusted-marker" }] } });
  assert.doesNotMatch(smartColorPlanPrompt(plan), /untrusted-marker/);
  assert.match(smartColorPlanPrompt(plan), /INPUT_JSON.colors.smartColorPlan/);
  assert.match(smartColorPlanPrompt(plan), /not copy the project references/);
});

test("filled duotone saves light-body dark-support hierarchy without changing saved retries", () => {
  for (const theme of ["light", "dark"] as const) {
    const plan = createSmartColorPlan({ styleId: "filled-duotone", theme, projectColors: refs });
    const { body, support } = plan.variants[theme].roles;
    assert.ok(toLch(body).l > toLch(support).l + 0.12);
    assert.notEqual(body, support);
    const saved = { mode: "smart", smartColorPlan: JSON.parse(JSON.stringify(plan)) };
    assert.equal(uniformSmartBatchColors(saved, "filled-duotone"), saved);
    assert.match(smartColorPlanPrompt(plan), /body 为较浅/);
  }
  const explicit = createSmartColorPlan({ styleId: "filled-duotone", intent: { foreground: "#123456", partColors: [] } });
  assert.equal(explicit.variants.light.roles.body, "#123456", "explicit paint remains authoritative");
});

test("neon grammar preserves emission instead of contradicting the style contract", () => {
  const single = createSmartColorPlan({ styleId: "neon-tube" });
  for (const theme of ["light", "dark"] as const) {
    const { body, core, halo } = single.variants[theme].roles;
    assert.equal(new Set([body, core, halo]).size, 3);
    assert.ok(toLch(core).l > toLch(body).l + 0.15);
    assert.notEqual(core, "#FFFFFF");
    assert.ok(contrastRatio(body, theme === "light" ? "#FFFFFF" : "#20252D") >= 3);
  }
  assert.ok(contrastRatio(single.variants.light.roles.core, "#FFFFFF") < 3, "emission must not be darkened by the envelope's boundary rule");
  for (const styleId of ["neon-tube", "dual-neon"]) {
    const prompt = smartColorPlanPrompt(createSmartColorPlan({ styleId }));
    assert.match(prompt, /光晕/);
    assert.doesNotMatch(prompt, /无光晕，|无额外光晕/);
  }
});

test("pre-update neon plans without a redundant halo role remain valid and frozen", () => {
  const old = createSmartColorPlan({ styleId: "neon-tube" });
  delete old.variants.light.roles.halo;
  delete old.variants.dark.roles.halo;
  delete old.variants.light.roles.core;
  delete old.variants.dark.roles.core;
  const saved = { mode: "smart", smartColorPlan: old };
  assert.ok(readSmartColorPlan(saved));
  assert.equal(uniformSmartBatchColors(saved, "neon-tube"), saved);
});

test("illustrative flat structural colors preserve semantic base hues and saved plans", () => {
  const plan = createSmartColorPlan({ styleId: "illustrative", intent: { partColors: [
    { subjectName: "test-object", part: "body", color: "#C44355", source: "semantic", evidence: "red material" },
  ] } });
  const prompt = smartColorPlanPrompt(plan);
  assert.match(prompt, /同色系较深纯色/);
  assert.match(prompt, /每个区域内部颜色均匀、不透明/);
  assert.match(prompt, /语义 partColors 定义材料基色/);
  assert.match(prompt, /不添加渐变、高光、光晕、发光、模糊、投影或固定光向/);
  assert.match(prompt, /重复圆润部件/);
  assert.doesNotMatch(prompt, /统一左上光源|原生 SVG 渐变|同色系亮面、主体中间调/);
  assert.doesNotMatch(prompt, /SELECTED_STYLE_COLOR_GRAMMAR: 按主体\/材料\/功能分配平涂色/);
  const saved = { mode: "smart", smartColorPlan: JSON.parse(JSON.stringify(plan)) };
  assert.equal(uniformSmartBatchColors(saved, "illustrative"), saved);
  assert.equal(saved.smartColorPlan.partColors[0].color, "#C44355");
  // Same legacy role schema; persisted plans do not need destructive migration.
  assert.equal(plan.grammar, "object-flat");
  for (const id of ["semantic", "palette"]) {
    const flat = smartColorPlanPrompt(createSmartColorPlan({ styleId: id }));
    assert.match(flat, /按主体\/材料\/功能分配平涂色/);
    assert.doesNotMatch(flat, /克制结构立体感/);
  }
});

test("explicit neon hue retains the user's tube color without leaking default cyan emission", () => {
  const plan = createSmartColorPlan({ styleId: "neon-tube", intent: { foreground: "#DC3545", partColors: [] } });
  for (const theme of ["light", "dark"] as const) {
    const { body, core, halo } = plan.variants[theme].roles;
    assert.equal(body, "#DC3545");
    assert.equal(halo, body);
    assert.ok(Math.abs(toLch(core).h - toLch(body).h) < 8);
  }
});

test("three-stop gradients use a complete designed ramp, distinct from two-stop defaults", () => {
  const mapping = spec.styles.find(style => style.id === "multi-stop")!;
  for (const recipeId of mapping.recipes) for (const theme of ["light", "dark"] as const) {
    const triple = createSmartColorPlan({ styleId: "multi-stop", theme, intent: { recipeId, partColors: [] } });
    const pair = createSmartColorPlan({ styleId: "gradient-fill", theme, intent: { recipeId, partColors: [] } });
    const recipe = spec.recipes.find(recipe => recipe.id === recipeId)!;
    assert.ok("gradientThree" in recipe && recipe.gradientThree);
    assert.notDeepEqual(triple.variants[theme].gradientStops, pair.variants[theme].gradientStops);
    const stops = triple.variants[theme].gradientStops!;
    assert.equal(new Set(stops).size, 3);
    assert.ok(perceptualDistance(stops[0], stops[1]) > 0.035);
    assert.ok(perceptualDistance(stops[1], stops[2]) > 0.035);
  }
});

test("pastel boundaries stay chromatic/readable without a heavy dark frame; materials differ", () => {
  for (const styleId of ["mono-pastel", "soft-two-tone"]) {
    const plan = createSmartColorPlan({ styleId });
    const { ink } = plan.variants.light.roles;
    assert.ok(toLch(ink).l > 0.58);
    assert.ok(toLch(ink).c > 0.03);
    assert.ok(contrastRatio(ink, plan.targetSurface) >= 3);
  }
  for (const theme of ["light", "dark"] as const) {
    const glass = ["frosted", "clear", "tinted"].map(styleId => createSmartColorPlan({ styleId, theme }).variants[theme].roles);
    assert.equal(new Set(glass.map(roles => roles.tint)).size, 3);
    const clay = createSmartColorPlan({ styleId: "clay", theme }).variants[theme].roles;
    const plastic = createSmartColorPlan({ styleId: "plastic", theme }).variants[theme].roles;
    assert.equal(clay.body, plastic.body);
    assert.ok(perceptualDistance(clay.highlight, clay.shade) < perceptualDistance(plastic.highlight, plastic.shade));
  }
});
