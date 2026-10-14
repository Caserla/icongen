import assert from "node:assert/strict";
import test from "node:test";
import { contrastRatio, oklchHex, perceptualDistance, perceptualStylePalette, toOklab } from "./perceptual-palette";
import { COLOR_POLICY_VERSION, projectPaletteGuidance, uniformSmartBatchColors } from "./smart-project-colors";
import { productionAuthoringPrompt, parseProductionOutput } from "./production-authoring";
import { linearBoldPrompt } from "./linear-bold-authoring";
import contracts from "../../../../../../docs/design/svg-style-production-v3.json";
import { createSmartColorPlan, colorPlanCompatibility } from "./smart-color-plan";

const theme = { primary: "#58CC02", secondary: "#1CB0F6", tertiary: "#FF9600", neutral: "#4B5563" };
const themes = [theme,
  { primary: "#F0D7B5", secondary: "#BC6952", tertiary: "#9D7045", neutral: "#544339" },
  { primary: "#222222", secondary: "#555555", tertiary: "#AAAAAA", neutral: "#EEEEEE" },
];

test("perceptual conversion round-trips sRGB and compresses gamut without invalid paints", () => {
  for (const color of ["#000000", "#FFFFFF", "#FF0000", "#00FF00", "#0000FF", "#1CB0F6"]) {
    const { l, a, b } = toOklab(color);
    assert.equal(oklchHex({ l, c: Math.hypot(a, b), h: Math.atan2(b, a) * 180 / Math.PI }), color);
    assert.equal(perceptualDistance(color, color), 0);
  }
  assert.equal(contrastRatio("#FFFFFF", "#000000"), 21);
  assert.match(oklchHex({ l: 0.9, c: 0.45, h: 195 }), /^#[0-9A-F]{6}$/);
});

test("palettes are role-order invariant, deterministic and outside every project paint", () => {
  for (const source of themes) for (const style of Object.keys(contracts.styles)) for (const surface of ["light", "dark"] as const) {
    const palette = perceptualStylePalette(source, style, surface);
    const swapped = { primary: source.neutral, secondary: source.tertiary, tertiary: source.primary, neutral: source.secondary };
    assert.deepEqual(palette, perceptualStylePalette(swapped, style, surface));
    assert.deepEqual(palette, perceptualStylePalette(source, style, surface));
    for (const color of Object.values(palette)) {
      assert.match(color, /^#[0-9A-F]{6}$/);
      assert.ok(!Object.values(source).includes(color), `${style}: ${color}`);
    }
  }
});

test("thin chromatic contours and all gradient stops remain readable on the target surface", () => {
  for (const source of themes) for (const surface of ["light", "dark"] as const) {
    const background = surface === "light" ? "#FFFFFF" : "#171A20";
    for (const style of ["neon-tube", "gradient-fill", "gradient-outline", "multi-stop", "dual-neon"]) {
      const p = perceptualStylePalette(source, style, surface);
      for (const color of [p.primary, p.secondary, p.tertiary]) assert.ok(contrastRatio(color, background) >= 3.2, `${style}/${surface}/${color}`);
      if (style === "neon-tube") assert.equal(p.primary, p.secondary);
    }
    const pastel = perceptualStylePalette(source, "mono-pastel", surface);
    assert.ok(contrastRatio(pastel.secondary, background) >= 3.3);
    const duo = perceptualStylePalette(source, "filled-duotone", surface);
    assert.ok(contrastRatio(duo.secondary, background) >= 2);
    assert.ok(perceptualDistance(duo.primary, duo.secondary) >= 0.06);
  }
});

test("explicit warm/cool directions select complete recipes without averaging project hues", () => {
  const select = (recipeId: string) => colorPlanCompatibility(createSmartColorPlan({ styleId: "mono-pastel", projectColors: Object.values(themes[1]), intent: { recipeId, partColors: [] } }));
  const warm = select("warm-orange");
  const cool = select("clear-blue");
  assert.ok(perceptualDistance(warm.primary, cool.primary) > 0.05);
});

test("historical snapshots stay frozen; fresh requests use the new policy and retries stay stable", () => {
  const old = { mode: "smart", palette: theme, colorPolicyVersion: "3", colorStyleId: "neon-tube", colorSurface: "light", adaptedPalette: theme };
  assert.equal(uniformSmartBatchColors(old, "neon-tube"), old);
  const next = uniformSmartBatchColors({ mode: "smart", palette: theme }, "neon-tube") as typeof old;
  assert.equal(next.colorPolicyVersion, COLOR_POLICY_VERSION);
  assert.notDeepEqual(next.adaptedPalette, theme);
  assert.deepEqual(uniformSmartBatchColors(next, "neon-tube"), next);
  const manual = { mode: "manual", default: { color: "#0BD0D0", mode: "solid" } };
  assert.equal(uniformSmartBatchColors(manual, "neon-tube"), manual);
  assert.match(projectPaletteGuidance(next)!, /SELECTED_STYLE_COLOR_GRAMMAR/);
  const illustrative = uniformSmartBatchColors({ mode: "smart", palette: theme }, "illustrative");
  assert.match(projectPaletteGuidance(illustrative)!, /identity takes precedence/);
});

test("all production styles plan optical mass and color area; pair permits controlled inner-edge compensation", () => {
  for (const style of Object.keys(contracts.styles)) assert.match(productionAuthoringPrompt(style, {}), /COLLECTION ART DIRECTION/);
  const prompt = linearBoldPrompt({ styleId: "state-pair", pair: true, subject: { name: "搜索", description: "搜索符号" }, theme: "light" }, "test");
  assert.match(prompt, /STATE-PAIR WEIGHT/);
  assert.match(prompt, /Do not require identical inner edge coordinates/);
  assert.doesNotMatch(prompt, /exact shared silhouette landmarks, opening shapes\/bounds/);
  const designCard = { recognition: "symbol", layout: "17-unit body", openings: "open center", connections: "one joint", stylePlan: "two tones", opticalPlan: "balanced mass", colorPlan: "dominant body with quieter support", parts: [{ partId: "body", meaning: "body" }] };
  assert.deepEqual(parseProductionOutput(JSON.stringify({ designCard, svg: "<svg/>" })).designCard, designCard);
});
