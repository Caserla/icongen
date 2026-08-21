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
