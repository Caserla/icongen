import assert from "node:assert/strict";
import test from "node:test";
import { ICON_STYLE_PRESET_IDS } from "@icongen/shared";
import { compileIconPrompt, type CompileIconPromptInput } from "./index";

const base: Omit<CompileIconPromptInput, "purpose"> = {
  name: "首页",
  description: "房子入口",
  color: { mode: "solid", color: "#61666E" },
  background: { enabled: true, container: "rounded-square", color: { mode: "gradient", colors: ["#FFFFFF", "#E8EEF8"], direction: "top-left-to-bottom-right" }, cornerRadius: 22 },
  style: { preset: "clay-3d", graphicStructure: "linear", strokeWeight: "regular", cornerStyle: "balanced", detailLevel: "standard" },
  sizes: [32, 64, 128],
  slot: 1,
};

test("interaction template includes visible interaction settings and excludes hidden app style", () => {
  const result = compileIconPrompt({ ...base, purpose: "interaction" });
  assert.match(result.prompt, /linear outline glyph with no fill/);
  assert.match(result.prompt, /solid #61666E/);
  assert.match(result.prompt, /22% corner radius/);
  assert.match(result.prompt, /32, 64, 128px/);
  assert.doesNotMatch(result.prompt, /cute clay 3D/);
});

test("app icon template includes app style and excludes hidden interaction settings", () => {
  const result = compileIconPrompt({ ...base, purpose: "app-icon" });
  assert.match(result.prompt, /home screen, launcher, and app store/);
  assert.match(result.prompt, /matte hand-molded clay/);
  assert.match(result.prompt, /opaque background fills the complete canvas edge to edge/);
  assert.match(result.prompt, /solid white #FFFFFF/);
  assert.match(result.prompt, /no second presentation backdrop/);
  assert.doesNotMatch(result.prompt, /#61666E|22% corner radius|transparent canvas|linear outline glyph|regular visual weight|balanced corner language|standard detail density/);
});

test("every app icon preset has a detailed isolated style specification", () => {
  const appPresets = ICON_STYLE_PRESET_IDS.filter((preset) => preset !== "line-icon");
  const prompts = appPresets.map((preset) => compileIconPrompt({ ...base, purpose: "app-icon", style: { ...base.style, preset } }).prompt);
  for (const prompt of prompts) {
    assert.match(prompt, /Geometry and composition:/);
    assert.match(prompt, /Color and material:|Color and background:/);
    assert.match(prompt, /Small-size rule:/);
    assert.match(prompt, /PRODUCTION BOUNDARY/);
  }
  assert.equal(new Set(prompts).size, appPresets.length);
});

test("the three slots request materially different design concepts", () => {
  const prompts = ([1, 2, 3] as const).map((slot) => compileIconPrompt({ ...base, purpose: "interaction", slot }).prompt);

  assert.match(prompts[0], /Concept A — canonical/);
  assert.match(prompts[1], /Concept B — structural alternative/);
  assert.match(prompts[1], /not a minor redraw, rotation, color change, or stroke adjustment/);
  assert.match(prompts[2], /Concept C — expressive simplification/);
  assert.match(prompts[2], /must differ in geometry, not merely rendering details/);
  assert.equal(new Set(prompts).size, 3);
});
