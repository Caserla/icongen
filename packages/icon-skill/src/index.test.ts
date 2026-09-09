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
    subjectSizePercent: 70,
    linearStrokeWidthPercent: 3.5,
    subjectOpacityPercent: 100,
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
  assert.match(result.prompt, /Subject opacity: 100%/);
  assert.match(result.prompt, /22% corner radius/);
  assert.match(result.prompt, /#FFFFFF.*to #E8EEF8/);
  assert.doesNotMatch(result.prompt, /32, 64, 128px/);
  assert.doesNotMatch(result.prompt, /cute clay 3D/);
});

test("transparent filled interaction icons separate the glyph from the alpha canvas", () => {
  const result = compileIconPrompt({
    ...base,
    purpose: "interaction",
    background: { enabled: false },
    style: { ...base.style, graphicStructure: "filled", subjectOpacityPercent: 45 },
  });
  assert.equal(result.outputBackground, "transparent");
  assert.match(result.prompt, /Subject opacity: 45%/);
  assert.match(result.prompt, /TRANSPARENT FILLED GLYPH CONTRACT/);
  assert.match(result.prompt, /must not be interpreted as a filled square, tile, badge, card, container, or canvas background/);
});

test("interaction template resolves automatic subject background colors before prompting", () => {
  const result = compileIconPrompt({
    ...base,
    purpose: "interaction",
    background: {
      enabled: true,
      container: "rounded-square",
      cornerRadius: 22,
      autoColor: true,
      color: { mode: "solid", color: "#FFFFFF" },
    },
  });

  assert.doesNotMatch(result.prompt, /container filled with solid #FFFFFF/);
  assert.match(result.prompt, /filled with solid #[0-9A-F]{6}/);
});

test("multi-subject interaction prompts lock optical scale and linear weight", () => {
  const result = compileIconPrompt({
    ...base,
    purpose: "interaction",
    iconSetConsistency: {
      enabled: true,
      subjectCount: 6,
      targetOccupancyPercent: 70,
      targetStrokeWidthPercent: 4.5,
    },
  });
  assert.match(result.prompt, /ICON SET CONSISTENCY \(MANDATORY\)/);
  assert.match(result.prompt, /coordinated set of 6 icons/);
  assert.match(result.prompt, /FIXED SUBJECT SIZE PARAMETER/);
  assert.match(result.prompt, /must occupy 70% of the square canvas/);
  assert.match(result.prompt, /FIXED STROKE WIDTH PARAMETER/);
  assert.match(result.prompt, /stroke width 4.5% of the canvas/);
  assert.match(result.prompt, /identical rounded caps/);
});

test("multi-subject app icon prompts lock a shared optical bounding box", () => {
  const result = compileIconPrompt({
    ...base,
    purpose: "app-icon",
    iconSetConsistency: {
      enabled: true,
      subjectCount: 4,
      targetOccupancyPercent: 70,
      targetStrokeWidthPercent: 4.5,
    },
  });
  assert.match(result.prompt, /coordinated set of 4 icons/);
  assert.match(result.prompt, /same optical scale, visual center, safe margins/);
  assert.match(result.prompt, /approximately 70% of the square canvas/);
});

test("symmetric subjects preserve canonical geometry in every variant", () => {
  const result = compileIconPrompt({
    ...base,
    purpose: "interaction",
    name: "收藏",
    description: "五角星",
    slot: 3,
  });
  assert.match(result.prompt, /GEOMETRY INTEGRITY \(MANDATORY\)/);
  assert.match(result.prompt, /symmetric-symbol/);
  assert.match(result.prompt, /Do not skew, stretch, twist, collapse/);
  assert.match(result.prompt, /must never damage the canonical semantic skeleton/);
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

test("user transparency wording cannot override the configured background", () => {
  const result = compileIconPrompt({
    ...base,
    purpose: "app-icon",
    description: "房子入口，不需要背景",
  });
  assert.equal(result.outputBackground, "opaque");
  assert.ok(result.qualityContract);
  assert.doesNotMatch(result.prompt, /不需要背景/);
  assert.match(result.prompt, /one intentional full-bleed background/);
});

test("subject normalization removes user-authored transparency output rules", () => {
  const result = compileIconPrompt({
    ...base,
    purpose: "app-icon",
    background: { enabled: false },
    name: "FOLD原创咖啡品牌",
    description:
      "折纸屋檐的小亭与杯身F折叠标志呼应，等距微缩结构偏左下，柜台向右上延伸，铜橙、奶油黄、蓝灰色。真实透明背景，无底板、天空、地面或投影，主体和镂空间隙之外全部透明，保留4%透明边缘。",
  });
  assert.match(result.prompt, /折纸屋檐的小亭与杯身F折叠标志呼应/);
  assert.match(result.prompt, /柜台向右上延伸/);
  assert.doesNotMatch(result.prompt, /真实透明背景|无底板|全部透明|4%透明边缘/);
  assert.equal(result.outputBackground, "transparent");
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
    /only the requested object and its essential parts; no background/,
  );
  assert.doesNotMatch(transparent.prompt, /full-bleed|background treatment fills|delivery pipeline applies.*mask|home screen, launcher, and app store/i);

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
    assert.match(prompt, /Icon category: (?:illustrative|functional)/);
    assert.match(prompt, /Color system:/);
    assert.match(prompt, /48 px|24–32 px|16–32 px/);
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
    const compiled = compileIconPrompt({
      ...base,
      purpose: "app-icon",
      style: { ...base.style, preset },
    });
    assert.equal(
      compiled.referenceImageAssetUrl,
      new URL(
        `../assets/style-references/${reference.assetFile}`,
        import.meta.url,
      ).href,
    );
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
  assert.match(result.prompt, /fills the entire square master canvas edge to edge/);
  assert.match(result.prompt, /approximately 22% rounded-square alpha mask/);
  assert.match(result.prompt, /keeping 80%–90% flatness/);
  assert.match(result.prompt, /uniform matte solid background color #FFD85A/);
  assert.match(result.prompt, /teal #20BFAE/);
  assert.match(result.prompt, /coral #FF4F4F/);
  assert.match(result.prompt, /full-bleed square RGBA PNG master/);
  assert.doesNotMatch(
    result.prompt,
    /transparency outside the colored container/,
  );
  assert.match(result.prompt, /glossy plastic/);
  assert.match(result.prompt, /realistic 3D lighting/);
});

test("duplicate character input is normalized into a concrete single-subject description", () => {
  const result = compileIconPrompt({
    ...base,
    purpose: "app-icon",
    name: "可爱白人小女孩头像，双马尾",
    description: "可爱白人小女孩头像，双马尾",
    style: { ...base.style, preset: "flat-playful" },
  });
  assert.match(result.prompt, /one complete centered character/);
  assert.match(result.prompt, /hairstyle silhouette/);
  assert.match(result.prompt, /do not add a second character/);
});

test("app icon style protocols preserve transparent, solid, gradient, rounded, circle, and square controls", () => {
  const backgrounds = [
    { enabled: false as const },
    { enabled: true as const, container: "rounded-square" as const, color: { mode: "solid" as const, color: "#A1B2C3" }, cornerRadius: 14 },
    { enabled: true as const, container: "circle" as const, color: { mode: "gradient" as const, colors: ["#112233", "#DDEEFF"] as [string, string], direction: "left-to-right" as const } },
    { enabled: true as const, container: "square" as const, color: { mode: "solid" as const, color: "#A1B2C3" } },
  ];
  for (const preset of ICON_STYLE_PRESET_IDS.filter((item) => item !== "line-icon")) {
    const prompts = backgrounds.map((background) =>
      compileIconPrompt({ ...base, purpose: "app-icon", background, style: { ...base.style, preset } }).prompt,
    );
    assert.match(prompts[0], /only the requested object and its essential parts; no background/);
    assert.doesNotMatch(prompts[0], /full-bleed|background treatment fills|delivery pipeline applies.*mask/i);
    assert.match(prompts[0], /keeps its walls, interior surfaces, dark parts, and self-shading/);
    assert.match(prompts[1], /14% rounded-square alpha mask/);
    assert.match(prompts[2], /centered circular alpha mask/);
    assert.match(prompts[2], /left-to-right gradient/);
    assert.match(prompts[3], /full square canvas/);
  }
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
    /Never manufacture variation by skewing, stretching, twisting, collapsing, or deforming/,
  );
  assert.equal(new Set(prompts).size, 3);
});
