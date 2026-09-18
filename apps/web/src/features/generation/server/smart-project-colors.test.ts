import { strict as assert } from "node:assert";
import { test } from "node:test";
import { colorApplicationPolicy, deriveIllustrativePalette, lockSmartColorsToProject, projectPaletteGuidance } from "./smart-project-colors";

const theme = { primary: "#112233", secondary: "#445566", tertiary: "#778899", neutral: "#AABBCC" };

test("smart colors use the saved project theme as adaptive anchors", () => {
  const result = lockSmartColorsToProject({ mode: "smart", locked: true, palette: {}, default: { mode: "radial", color: "#000000", endColor: "#FFFFFF" } }, theme) as { locked: boolean; paletteMode: string; palette: typeof theme; adaptedPalette: typeof theme; default: { color: string; endColor: string } };
  assert.deepEqual(result.palette, theme);
  assert.equal(result.adaptedPalette, undefined);
  assert.equal(result.locked, false);
  assert.equal(result.paletteMode, "adaptive-project-theme");
  assert.equal(result.default.color, theme.primary);
  assert.equal(result.default.endColor, theme.secondary);
});

test("illustrative palette builds a stable new harmony without copying raw hex", () => {
  const source = { primary: "#58CC02", secondary: "#1CB0F6", tertiary: "#FF9600", neutral: "#4B5563" };
  const adapted = deriveIllustrativePalette(source);
  for (const key of Object.keys(source) as Array<keyof typeof source>) assert.notEqual(adapted[key], source[key]);
  assert.deepEqual(deriveIllustrativePalette(source), adapted);
});

test("manual colors are not overwritten", () => {
  const colors = { mode: "manual", default: { mode: "solid", color: "#FF0000" } };
  assert.equal(lockSmartColorsToProject(colors, theme), colors);
});

test("guidance names all four project color roles", () => {
  const guidance = projectPaletteGuidance({ mode: "smart", palette: theme }) ?? "";
  for (const color of Object.values(theme)) assert.match(guidance, new RegExp(color));
  assert.match(guidance, /reference anchors, not mandatory literal paint values/);
  assert.match(guidance, /New hues outside the project palette are explicitly allowed/);
});

test("smart policy adapts while manual policy locks exact values", () => {
  assert.match(colorApplicationPolicy({ mode: "smart" }), /Do not copy the four project hex values mechanically/);
  assert.match(colorApplicationPolicy({ mode: "manual" }), /Use those exact values/);
});
