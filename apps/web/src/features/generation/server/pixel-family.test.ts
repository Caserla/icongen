import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { derivePixelFamily } from "./pixel-family";

const source = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" shape-rendering="crispEdges"><path d="M4 4h16v16H4zM9 9v6h6V9z" fill="#B9ACEC" fill-rule="evenodd"/></svg>`;
test("pixel siblings preserve one outer silhouette and actual aperture", async () => {
  const family = await derivePixelFamily(source, "#343A40");
  assert.equal(family.color, source);
  assert.match(family.outline, /shape-rendering="crispEdges"/);
  assert.match(family.solid, /fill="#343A40"/);
  const pixels = async (svg: string) => (await sharp(Buffer.from(svg)).resize(24, 24).ensureAlpha().raw().toBuffer({ resolveWithObject: true })).data;
  const filled = await pixels(family.solid), line = await pixels(family.outline);
  const alpha = (data: Buffer, x: number, y: number) => data[(y * 24 + x) * 4 + 3];
  assert.equal(alpha(filled, 12, 12), 0);
  assert.ok(alpha(filled, 6, 6) > 0);
  assert.equal(alpha(line, 6, 6), 0);
  const opaque = (data: Buffer) => Array.from({ length: 24 * 24 }, (_, i) => data[i * 4 + 3] > 0).filter(Boolean).length;
  assert.ok(opaque(line) > 0 && opaque(line) < opaque(filled));
  const at16 = await sharp(Buffer.from(family.outline)).resize(16, 16).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.ok(Array.from({ length: 16 * 16 }, (_, i) => at16.data[i * at16.info.channels + 3]).some(a => a > 0));
});
