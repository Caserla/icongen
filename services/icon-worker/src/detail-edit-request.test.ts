import assert from "node:assert/strict";
import test from "node:test";
import { createDetailEditRequest } from "./detail-edit-request";
import { createPromptCompiler } from "./registries";

test("detail editing sends only the current icon as the editable image", () => {
  const request = createDetailEditRequest({
    compiledPrompt: "Keep the approved flat-playful visual contract.",
    instruction: "Make the smile slightly wider.",
    outputBackground: "opaque",
    sourceBytes: new Uint8Array([1, 2, 3]),
  });

  assert.equal(request.mode, "detail-edit");
  assert.equal(request.sourceImage?.filename, "source-icon.png");
  assert.equal(request.referenceImage, undefined);
  assert.match(request.prompt, /only editable artwork/i);
  assert.match(request.prompt, /Make the smile slightly wider/);
  assert.match(request.prompt, /IMMUTABLE STYLE AND OUTPUT CONTRACT/);
  assert.match(request.prompt, /EDGE INTEGRITY — HARD REQUIREMENT/);
  assert.match(request.prompt, /full-bleed through every canvas edge and corner/i);
  assert.match(request.prompt, /white or near-white border/i);
});

test("transparent detail editing forbids white matte and alpha-edge artifacts", () => {
  const request = createDetailEditRequest({
    compiledPrompt: "Keep the approved transparent icon contract.",
    instruction: "Make the star more symmetrical.",
    outputBackground: "transparent",
    sourceBytes: new Uint8Array([1, 2, 3]),
  });

  assert.equal(request.background, "transparent");
  assert.match(request.prompt, /native RGBA PNG/i);
  assert.match(request.prompt, /white, black, colored or checkerboard matte/i);
  assert.match(request.prompt, /all four corners/i);
  assert.doesNotMatch(request.prompt, /chroma green/i);
});

test("flat-playful detail edit preserves the real style contract without resending its style board", () => {
  const compiled = createPromptCompiler("default-ui-icon").compile({
    purpose: "app-icon",
    name: "双马尾眼镜女孩",
    description: "可爱卡通女孩头像，双马尾、圆框眼镜和友好笑容",
    color: { mode: "solid", color: "#61666E" },
    background: {
      enabled: true,
      container: "rounded-square",
      cornerRadius: 18,
      color: { mode: "solid", color: "#F8BBD0" },
    },
    style: {
      preset: "flat-playful",
      graphicStructure: "filled",
      subjectSizePercent: 70,
      linearStrokeWidthPercent: 3.5,
      strokeWeight: "regular",
      cornerStyle: "balanced",
      detailLevel: "standard",
    },
    sizes: [64, 128, 256],
    slot: 2,
  });
  assert.ok(compiled.referenceImage, "initial generation should have a flat-playful style board");

  const sourceBytes = new Uint8Array([137, 80, 78, 71]);
  const request = createDetailEditRequest({
    compiledPrompt: compiled.prompt,
    instruction: "只把圆框眼镜的镜框稍微变细，其他内容保持不变",
    outputBackground: compiled.outputBackground,
    sourceBytes,
  });

  assert.equal(request.mode, "detail-edit");
  assert.equal(request.sourceImage?.bytes, sourceBytes);
  assert.equal(request.referenceImage, undefined);
  assert.equal(request.background, "opaque");
  assert.match(request.prompt, /只把圆框眼镜的镜框稍微变细/);
  assert.match(request.prompt, /flat-playful/);
  assert.match(request.prompt, /rounded-square/i);
  assert.match(request.prompt, /approximately 18% rounded-square alpha mask/i);
  assert.match(request.prompt, /Do not redesign, reinterpret or regenerate/i);
});
