import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { SharpImageProcessor } from "./sharp-image-processor";

test("derives a real square PNG at the requested size", async () => {
  const source = await sharp({ create: { width: 8, height: 8, channels: 4, background: { r: 103, g: 80, b: 232, alpha: 0.5 } } }).png().toBuffer();
  const result = await new SharpImageProcessor().process({ bytes: source, size: 24 });
  const metadata = await sharp(result.bytes).metadata();
  assert.equal(metadata.width, 24);
  assert.equal(metadata.height, 24);
  assert.equal(result.hasAlpha, true);
});

test("uses nearest-neighbor scaling for pixel-art assets", async () => {
  const source = await sharp({
    create: { width: 2, height: 2, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  }).composite([
    { input: Buffer.from([255, 0, 0, 255]), raw: { width: 1, height: 1, channels: 4 }, left: 0, top: 0 },
    { input: Buffer.from([0, 0, 255, 255]), raw: { width: 1, height: 1, channels: 4 }, left: 1, top: 0 },
  ]).png().toBuffer();
  const result = await new SharpImageProcessor().process({ bytes: source, size: 8, profile: "pixel-art" });
  const { data } = await sharp(result.bytes).raw().toBuffer({ resolveWithObject: true });
  const colors = new Set<string>();
  for (let index = 0; index < data.length; index += 4) colors.add([...data.subarray(index, index + 4)].join(","));
  assert.equal(colors.has("255,0,0,255"), true);
  assert.equal(colors.has("0,0,255,255"), true);
  assert.equal(colors.size <= 3, true);
});

test("keeps transparent PNG output while sharpening a downscaled icon", async () => {
  const source = await sharp({ create: { width: 512, height: 512, channels: 4, background: { r: 97, g: 102, b: 110, alpha: 0.8 } } }).png().toBuffer();
  const result = await new SharpImageProcessor().process({ bytes: source, size: 64, profile: "icon" });
  const metadata = await sharp(result.bytes).metadata();
  assert.equal(metadata.width, 64);
  assert.equal(metadata.height, 64);
  assert.equal(metadata.hasAlpha, true);
});

test("applies a real alpha mask to rounded app-icon corners", async () => {
  const source = await sharp({ create: { width: 100, height: 100, channels: 3, background: "#ffffff" } }).png().toBuffer();
  const result = await new SharpImageProcessor().applyRoundedMask({ bytes: source, cornerRadiusPercent: 22 });
  const { data, info } = await sharp(result.bytes).raw().toBuffer({ resolveWithObject: true });
  assert.equal(result.hasAlpha, true);
  assert.equal(info.channels, 4);
  assert.equal(data[3], 0);
  const centerAlpha = data[((50 * info.width) + 50) * info.channels + 3];
  assert.equal(centerAlpha, 255);
});

test("converts a generated chroma-key background into real transparency", async () => {
  const source = await sharp({
    create: {
      width: 8,
      height: 8,
      channels: 3,
      background: { r: 0, g: 255, b: 0 },
    },
  })
    .composite([
      {
        input: Buffer.from([255, 80, 40, 255]),
        raw: { width: 1, height: 1, channels: 4 },
        left: 4,
        top: 4,
      },
    ])
    .png()
    .toBuffer();
  const result = await new SharpImageProcessor().removeChromaBackground({
    bytes: source,
    color: { red: 0, green: 255, blue: 0 },
    tolerance: 72,
  });
  const { data, info } = await sharp(result.bytes)
    .raw()
    .toBuffer({ resolveWithObject: true });
  assert.equal(info.channels, 4);
  assert.equal(data[3], 0);
  assert.equal(data[(4 * info.width + 4) * 4 + 3], 255);
});

test("distinguishes an opaque RGBA canvas from real transparency", async () => {
  const opaqueRgba = await sharp({
    create: {
      width: 8,
      height: 8,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
  const transparentRgba = await sharp({
    create: {
      width: 8,
      height: 8,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 0 },
    },
  })
    .png()
    .toBuffer();
  const processor = new SharpImageProcessor();

  assert.deepEqual(await processor.inspect({ bytes: opaqueRgba }), {
    width: 8,
    height: 8,
    hasAlpha: true,
    hasTransparency: false,
  });
  assert.deepEqual(await processor.inspect({ bytes: transparentRgba }), {
    width: 8,
    height: 8,
    hasAlpha: true,
    hasTransparency: true,
  });
});
