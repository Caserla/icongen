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

test("repairs low-alpha black matte contamination after resizing", async () => {
  const width = 12;
  const pixels = Buffer.alloc(width * width * 4);
  for (let y = 3; y <= 8; y += 1) for (let x = 3; x <= 8; x += 1) {
    const offset = (y * width + x) * 4;
    const edge = x === 3 || x === 8 || y === 3 || y === 8;
    pixels[offset] = edge ? 0 : 110;
    pixels[offset + 1] = edge ? 0 : 80;
    pixels[offset + 2] = edge ? 0 : 220;
    pixels[offset + 3] = edge ? 24 : 255;
  }
  const source = await sharp(pixels, { raw: { width, height: width, channels: 4 } }).png().toBuffer();
  const result = await new SharpImageProcessor().process({ bytes: source, size: width });
  const data = await sharp(result.bytes).ensureAlpha().raw().toBuffer();
  const edge = (3 * width + 4) * 4;
  assert.ok(Math.max(data[edge], data[edge + 1], data[edge + 2]) >= 56);
  assert.ok(data[edge + 3] > 0 && data[edge + 3] <= 64);
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

test("restores the source alpha mask instead of multiplying generated alpha", async () => {
  const source = await sharp({
    create: {
      width: 64,
      height: 64,
      channels: 4,
      background: { r: 160, g: 140, b: 210, alpha: 1 },
    },
  })
    .composite([{
      input: Buffer.from('<svg width="64" height="64"><rect width="64" height="64" rx="14" fill="white"/></svg>'),
      blend: "dest-in",
    }])
    .png()
    .toBuffer();
  const edited = await sharp({
    create: {
      width: 64,
      height: 64,
      channels: 4,
      background: { r: 240, g: 120, b: 80, alpha: 0.55 },
    },
  }).png().toBuffer();

  const result = await new SharpImageProcessor().restoreAlphaMask({
    bytes: edited,
    alphaSourceBytes: source,
  });
  const sourceAlpha = await sharp(source).ensureAlpha().extractChannel("alpha").raw().toBuffer();
  const resultAlpha = await sharp(result.bytes).ensureAlpha().extractChannel("alpha").raw().toBuffer();

  assert.deepEqual(resultAlpha, sourceAlpha);
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

test("removes a black temporary edit canvas connected to all four corners", async () => {
  const source = await sharp({
    create: { width: 12, height: 12, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } },
  })
    .composite([{ input: { create: { width: 6, height: 6, channels: 4, background: "#ff4f4f" } }, left: 3, top: 3 }])
    .png()
    .toBuffer();
  const result = await new SharpImageProcessor().normalizeTransparentBackground({
    bytes: source,
    chromaColor: { red: 0, green: 255, blue: 0 },
    tolerance: 72,
  });
  const { data, info } = await sharp(result.bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(data[3], 0, "top-left black corner should become transparent");
  const centerOffset = (6 * info.width + 6) * info.channels;
  assert.equal(data[centerOffset + 3], 255, "the disconnected icon subject must remain opaque");
  assert.ok(data[centerOffset] > 200, "the subject color must be preserved");
});

test("clears hidden chroma RGB and despills the antialiased icon boundary", async () => {
  const width = 8;
  const height = 8;
  const pixels = Buffer.alloc(width * height * 4);
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const offset = pixel * 4;
    pixels[offset] = 0;
    pixels[offset + 1] = 255;
    pixels[offset + 2] = 0;
    pixels[offset + 3] = 255;
  }
  for (let y = 2; y <= 5; y += 1) {
    for (let x = 2; x <= 5; x += 1) {
      const offset = (y * width + x) * 4;
      const isBoundary = x === 2 || x === 5 || y === 2 || y === 5;
      pixels[offset] = 40;
      pixels[offset + 1] = isBoundary ? 220 : 80;
      pixels[offset + 2] = isBoundary ? 160 : 220;
    }
  }
  const source = await sharp(pixels, { raw: { width, height, channels: 4 } }).png().toBuffer();
  const result = await new SharpImageProcessor().normalizeTransparentBackground({
    bytes: source,
    chromaColor: { red: 0, green: 255, blue: 0 },
    tolerance: 72,
  });
  const { data } = await sharp(result.bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.deepEqual([...data.subarray(0, 4)], [0, 0, 0, 0], "transparent pixels must not retain green RGB");
  const boundary = (2 * width + 2) * 4;
  assert.ok(data[boundary + 1] <= Math.max(data[boundary], data[boundary + 2]), "green spill must be removed from the boundary");
  assert.ok(data[boundary + 3] < 255, "the keyed antialias boundary should become partially transparent");
  const center = (3 * width + 3) * 4;
  assert.deepEqual([...data.subarray(center, center + 4)], [40, 80, 220, 255], "interior artwork must remain unchanged");
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
