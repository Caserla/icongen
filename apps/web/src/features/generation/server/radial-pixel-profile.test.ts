import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { renderRadialPixelProfile } from "./radial-pixel-profile";

test("repeated radial source preserves a real hole and equal angular tooth pitch", async () => {
  const svg = renderRadialPixelProfile({ center: [12, 12], count: 8, rootRadius: 7.3, tipRadius: 10.2, holeRadius: 2.7, tipFraction: 0.56 }, "#343A40");
  const { data, info } = await sharp(Buffer.from(svg)).resize(24, 24).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const visible = (x: number, y: number) => data[(y * 24 + x) * info.channels + 3] > 0;
  assert.equal(visible(12, 12), false);
  assert.equal(visible(21, 12), true);
  assert.equal(visible(2, 12), true);
  assert.equal(visible(12, 2), true);
  assert.equal(visible(12, 21), true);
  assert.throws(() => renderRadialPixelProfile({ center: [12, 12], count: 8, rootRadius: 9.8, tipRadius: 10, holeRadius: 2.7, tipFraction: 0.56 }, "#343A40"));
});
