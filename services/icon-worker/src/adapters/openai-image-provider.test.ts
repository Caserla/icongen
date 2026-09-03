import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { buildOpenAIImagePrompt, prepareTransparentEditInput } from "./openai-image-provider";

const png = {
  bytes: new Uint8Array([137, 80, 78, 71]),
  mimeType: "image/png" as const,
  filename: "image.png",
};

test("generation mode treats the attached board as style-only reference", () => {
  const prompt = buildOpenAIImagePrompt({
    mode: "generation",
    prompt: "Create a home icon",
    background: "opaque",
    referenceImage: png,
    wantsTransparency: false,
  });
  assert.match(prompt, /STYLE REFERENCE IMAGE/);
  assert.match(prompt, /blank square canvas/);
  assert.match(prompt, /do not return, crop, extract, preserve, or reconstruct the reference board/i);
});

test("detail-edit mode makes the source authoritative and does not request regeneration", () => {
  const prompt = buildOpenAIImagePrompt({
    mode: "detail-edit",
    prompt: "Make the star slightly rounder",
    background: "opaque",
    sourceImage: png,
    wantsTransparency: false,
  });
  assert.match(prompt, /source image is the only editable artwork/i);
  assert.match(prompt, /do not start from a blank canvas/i);
  assert.doesNotMatch(prompt, /STYLE REFERENCE IMAGE/);
});

test("detail-edit transparency requests native alpha first", () => {
  const prompt = buildOpenAIImagePrompt({
    mode: "detail-edit",
    prompt: "Remove one small highlight",
    background: "transparent",
    sourceImage: png,
    wantsTransparency: true,
    transparencyStrategy: "native-alpha",
  });
  assert.match(prompt, /TRANSPARENT OUTPUT REQUIREMENT/);
  assert.match(prompt, /source image is the only editable artwork/i);
});

test("native-alpha edit input preserves the source alpha channel", async () => {
  const transparent = await sharp({
    create: {
      width: 4,
      height: 4,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).png().toBuffer();
  const prepared = await prepareTransparentEditInput(
    { bytes: transparent, mimeType: "image/png", filename: "source.png" },
    true,
    "native-alpha",
  );
  const pixel = await sharp(prepared).ensureAlpha().raw().toBuffer();
  assert.equal(pixel[3], 0);
});

test("chroma fallback uses the selected key color", async () => {
  const transparent = await sharp({ create: { width: 4, height: 4, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
  const prepared = await prepareTransparentEditInput(
    { bytes: transparent, mimeType: "image/png", filename: "source.png" },
    true,
    "chroma-key",
    { red: 255, green: 0, blue: 255 },
  );
  const pixel = await sharp(prepared).raw().toBuffer();
  assert.deepEqual([...pixel.subarray(0, 3)], [255, 0, 255]);
});
