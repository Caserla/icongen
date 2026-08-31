import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { ICON_STYLE_PRESET_IDS } from "@icongen/shared";
import { compileIconPrompt, type CompileIconPromptInput } from "./index";
import { APPROVED_APP_ICON_STYLE_REFERENCES } from "./style-specs/approved-style-references";

const base: Omit<CompileIconPromptInput, "purpose"> = {
  name: "首页",
  description: "房子入口",
  color: { mode: "solid", color: "#61666E" },
  background: {
    enabled: true,
    container: "rounded-square",
    color: {
      mode: "gradient",
      colors: ["#FFFFFF", "#E8EEF8"],
      direction: "top-left-to-bottom-right",
    },
    cornerRadius: 22,
  },
  style: {
    preset: "clay-3d",
    graphicStructure: "linear",
    strokeWeight: "regular",
    cornerStyle: "balanced",
    detailLevel: "standard",
  },
  sizes: [32, 64, 128],
  slot: 1,
};

test("interaction template includes visible interaction settings and excludes hidden app style", () => {
  const result = compileIconPrompt({ ...base, purpose: "interaction" });
  assert.equal(result.outputBackground, "opaque");
  assert.match(result.prompt, /linear outline glyph with no fill/);
  assert.match(result.prompt, /solid #61666E/);
  assert.match(result.prompt, /22% corner radius/);
  assert.doesNotMatch(result.prompt, /32, 64, 128px/);
  assert.doesNotMatch(result.prompt, /cute clay 3D/);
});

test("app icon template includes app style and excludes hidden interaction settings", () => {
  const result = compileIconPrompt({ ...base, purpose: "app-icon" });
  assert.equal(result.outputBackground, "opaque");
  assert.ok(result.qualityContract);
  assert.match(result.prompt, /home screen, launcher, and app store/);
  assert.match(result.prompt, /matte hand-molded clay/);
  assert.match(
    result.prompt,
    /fills the entire square master canvas edge to edge/,
  );
  assert.match(
    result.prompt,
    /delivery pipeline applies an approximately 22% rounded-square alpha mask/,
  );
  assert.match(
    result.prompt,
    /no secondary outline, rim, stroke, keyline, frame, exterior ring, or contrasting border/,
  );
  assert.match(result.prompt, /FILE OUTPUT/);
  assert.match(result.prompt, /full-bleed square RGBA PNG master/);
  assert.match(
    result.prompt,
    /delivery pipeline applies an approximately 22% rounded-square alpha mask after generation/,
  );
  assert.doesNotMatch(result.prompt, /solid white #FFFFFF/);
  assert.doesNotMatch(
    result.prompt,
    /checkerboard|simulated transparency|alpha channel/i,
  );
  assert.match(result.prompt, /second presentation backdrop/);
  assert.doesNotMatch(
    result.prompt,
    /#61666E|transparent canvas|linear outline glyph|regular visual weight|balanced corner language|standard detail density/,
  );
});

test("an explicit no-background request overrides the default rounded colored background", () => {
  const result = compileIconPrompt({
    ...base,
    purpose: "app-icon",
    description: "房子入口，不需要背景",
  });
  assert.equal(result.outputBackground, "transparent");
  assert.equal(result.qualityContract, undefined);
  assert.match(result.prompt, /explicitly requested no background/);
  assert.match(
    result.prompt,
    /native RGBA PNG icon file with a transparent background/,
  );
  assert.doesNotMatch(
    result.prompt,
    /The only visible content is the complete icon subject and one intentional/,
  );
});

test("the app icon background controls are authoritative in the Image2 prompt", () => {
  const transparent = compileIconPrompt({
    ...base,
    purpose: "app-icon",
    background: { enabled: false },
  });
  assert.equal(transparent.outputBackground, "transparent");
  assert.equal(transparent.qualityContract, undefined);
  assert.match(
    transparent.prompt,
    /native RGBA PNG icon file with a transparent background/,
  );

  const solid = compileIconPrompt({
    ...base,
    purpose: "app-icon",
    background: {
      enabled: true,
      container: "rounded-square",
      color: { mode: "solid", color: "#A1B2C3" },
      cornerRadius: 22,
    },
  });
  assert.equal(solid.outputBackground, "opaque");
  assert.deepEqual(
    solid.qualityContract && "color" in solid.qualityContract
      ? solid.qualityContract.color
      : undefined,
    "#A1B2C3",
  );
  assert.match(solid.prompt, /uniform matte solid background color #A1B2C3/);

  const gradient = compileIconPrompt({
    ...base,
    purpose: "app-icon",
    background: {
      enabled: true,
      container: "rounded-square",
      color: {
        mode: "gradient",
        colors: ["#112233", "#DDEEFF"],
        direction: "left-to-right",
      },
      cornerRadius: 22,
    },
  });
  assert.equal(gradient.outputBackground, "opaque");
  assert.deepEqual(
    gradient.qualityContract && "colors" in gradient.qualityContract
      ? gradient.qualityContract.colors
      : undefined,
    ["#112233", "#DDEEFF"],
  );
  assert.match(
    gradient.prompt,
    /left-to-right gradient from #112233 to #DDEEFF/,
  );
});

test("every app icon preset has a detailed isolated style specification", () => {
  const appPresets = ICON_STYLE_PRESET_IDS.filter(
    (preset) => preset !== "line-icon",
  );
  const prompts = appPresets.map(
    (preset) =>
      compileIconPrompt({
        ...base,
        purpose: "app-icon",
        style: { ...base.style, preset },
      }).prompt,
  );
  for (const prompt of prompts) {
    assert.match(
      prompt,
      /Geometry and composition:|高饱和、可爱卡通、圆润扁平化/,
    );
    assert.match(
      prompt,
      /Color and material:|Color and background:|2–4 种醒目的大块均匀纯色/,
    );
    assert.match(prompt, /Small-size rule:|缩小到 48 px 时仍清楚可辨/);
    assert.match(prompt, /STYLE FINGERPRINT/);
    assert.match(prompt, /APPROVED STYLE REFERENCE PROFILE/);
    assert.match(prompt, /COMPOSITION AND SAFE AREA/);
    assert.match(prompt, /COLOR, MATERIAL, AND DEPTH/);
    assert.match(prompt, /VARIANT DIRECTION/);
    assert.match(prompt, /EDGE AND SMALL-SIZE QUALITY/);
    assert.match(prompt, /PRODUCTION BOUNDARY/);
    assert.match(prompt, /FILE OUTPUT/);
    assert.match(
      prompt,
      /exactly one original, production-ready app icon asset/,
    );
    assert.doesNotMatch(
      prompt,
      /checkerboard|chessboard|simulated transparency|fake transparency|solid white|alpha channel/i,
    );
    assert.match(
      prompt,
      /one uninterrupted boundary made only from the background's own treatment/,
    );
    assert.match(prompt, /fills the entire square master canvas edge to edge/);
    assert.doesNotMatch(prompt, /5%–8% empty outer safety margin/);
    assert.doesNotMatch(
      prompt,
      /rounded-square colored background container|colored container/,
    );
  }
  assert.equal(new Set(prompts).size, appPresets.length);
});

test("app styles use the user-selected full-bleed background", () => {
  const solidPresets = [
    "clay-3d",
    "isometric-3d",
    "pixel-art",
    "low-poly",
    "cute-sticker",
    "flat-illustration",
    "minimal-logo",
  ] as const;
  for (const preset of solidPresets) {
    const prompt = compileIconPrompt({
      ...base,
      purpose: "app-icon",
      background: {
        enabled: true,
        container: "rounded-square",
        color: { mode: "solid", color: "#A1B2C3" },
        cornerRadius: 22,
      },
      style: { ...base.style, preset },
    }).prompt;
    assert.match(
      prompt,
      /Use exactly one uniform matte solid background color #A1B2C3/,
    );
    assert.match(
      prompt,
      /Material lighting, ambient occlusion, contact shadow, color bounce, texture, and tonal modeling apply only to the subject/,
    );
  }
  const neon = compileIconPrompt({
    ...base,
    purpose: "app-icon",
    style: { ...base.style, preset: "neon" },
  }).prompt;
  assert.match(
    neon,
    /smooth top-left-to-bottom-right gradient from #FFFFFF to #E8EEF8/,
  );
  assert.match(neon, /Neon glow belongs only to the subject's luminous paths/);
});

test("every app icon style has an approved 1536x1024 PNG reference asset", async () => {
  const appPresets = ICON_STYLE_PRESET_IDS.filter(
    (preset) => preset !== "line-icon",
  );
  assert.equal(
    Object.keys(APPROVED_APP_ICON_STYLE_REFERENCES).length,
    appPresets.length,
  );
  for (const preset of appPresets) {
    const reference = APPROVED_APP_ICON_STYLE_REFERENCES[preset];
    assert.ok(reference, `missing approved reference for ${preset}`);
    const bytes = await readFile(
      new URL(
        `../assets/style-references/${reference.assetFile}`,
        import.meta.url,
      ),
    );
    assert.equal(bytes.subarray(1, 4).toString("ascii"), "PNG");
    assert.equal(bytes.readUInt32BE(16), 1536);
    assert.equal(bytes.readUInt32BE(20), 1024);
  }
});

test("flat playful app icons use the production template derived from the flat playful library", () => {
  const result = compileIconPrompt({
    ...base,
    purpose: "app-icon",
    background: {
      enabled: true,
      container: "rounded-square",
      color: { mode: "solid", color: "#FFD85A" },
      cornerRadius: 22,
    },
    style: { ...base.style, preset: "flat-playful" },
  });
  assert.match(result.prompt, /铺满整张方形母版并一直延伸到四边/);
  assert.match(result.prompt, /约 22% 的圆角透明遮罩由交付流程生成/);
  assert.match(result.prompt, /保持 80%–90% 平面感/);
  assert.match(result.prompt, /固定为 #FFD85A 的均匀哑光纯色背景/);
  assert.match(result.prompt, /full-bleed square RGBA PNG master/);
  assert.doesNotMatch(
    result.prompt,
    /transparency outside the colored container/,
  );
  assert.doesNotMatch(result.prompt, /bevels|ambient occlusion/);
});

test("the three slots request materially different design concepts", () => {
  const prompts = ([1, 2, 3] as const).map(
    (slot) =>
      compileIconPrompt({ ...base, purpose: "interaction", slot }).prompt,
  );

  assert.match(prompts[0], /Concept A — canonical/);
  assert.match(prompts[1], /Concept B — structural alternative/);
  assert.match(
    prompts[1],
    /not a minor redraw, rotation, color change, or stroke adjustment/,
  );
  assert.match(prompts[2], /Concept C — expressive simplification/);
  assert.match(
    prompts[2],
    /must differ in geometry, not merely rendering details/,
  );
  assert.equal(new Set(prompts).size, 3);
});
