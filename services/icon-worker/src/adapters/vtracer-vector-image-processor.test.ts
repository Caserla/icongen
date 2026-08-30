import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { VTracerVectorImageProcessor } from "./vtracer-vector-image-processor";

test("vectorizes PNG bytes into a sanitized SVG", async () => {
  const png = await sharp({ create: { width: 64, height: 64, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 0 } } })
    .composite([{ input: Buffer.from('<svg width="64" height="64"><circle cx="32" cy="32" r="20" fill="#111111"/></svg>') }])
    .png().toBuffer();
  const result = await new VTracerVectorImageProcessor().process({ bytes: png, mode: "binary" });
  const svg = new TextDecoder().decode(result.bytes);
  assert.match(svg, /^<svg\b/);
  assert.doesNotMatch(svg, /<script|foreignObject|(?:href|xlink:href)=["'](?:https?:|data:)/i);
  assert.match(svg, /<path\b/);
  assert.equal(result.mimeType, "image/svg+xml");
  assert.equal(result.width, 64);
});
