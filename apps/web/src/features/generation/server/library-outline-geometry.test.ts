import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { compileLibraryOutline } from "./library-outline-geometry";
const wrap = (s: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><g data-part-id="body">${s}</g></svg>`;
test("Outline expands curves and primitives without changing the optical footprint", async () => {
  for (const geometry of [
    '<path d="M4 18C4 4 20 4 20 18"/>',
    '<circle cx="12" cy="12" r="7"/>',
    '<ellipse cx="12" cy="12" rx="8" ry="5"/>',
    '<rect x="4" y="5" width="16" height="14" rx="3"/>',
    '<line x1="4" y1="5" x2="20" y2="19"/>',
    '<polyline points="4,16 9,7 15,7 20,16"/>',
    '<polygon points="4,16 9,7 15,7 20,16"/>',
  ]) {
    const result = await compileLibraryOutline(wrap(geometry));
    assert.equal(result.evidence.expandedPaths, 1);
    assert.match(result.svg, /data-part-id="body"/);
    assert.ok(result.evidence.samples.every(s => s.relativeAlphaError < 0.045), JSON.stringify(result.evidence));
    assert.doesNotMatch(result.svg, /<(circle|ellipse|rect|line|polyline|polygon)\b/);
  }
});
test("Outline preserves real evenodd holes, semantic IDs and group opacity on either theme", async () => {
  const source = wrap('<g opacity="0.4"><path data-part-id="disc" data-hole-ids="aperture" fill="currentColor" fill-rule="evenodd" d="M4 4H20V20H4ZM9 9H15V15H9Z"/></g>');
  const { svg } = await compileLibraryOutline(source);
  assert.match(svg, /data-hole-ids="aperture"/);
  assert.match(svg, /fill-rule="evenodd"/);
  for (const color of ["#343A40", "#F1F3F5"]) {
    const bytes = await sharp(Buffer.from(svg.replace(/currentColor/g, color))).resize(24, 24).ensureAlpha().raw().toBuffer();
    assert.equal(bytes[(12 * 24 + 12) * 4 + 3], 0, "hole must remain transparent");
    assert.ok(bytes[(6 * 24 + 6) * 4 + 3] >= 100 && bytes[(6 * 24 + 6) * 4 + 3] <= 103);
  }
});
test("Outline rejects unsupported effects or hand-expanded source rather than silently altering them", async () => {
  for (const source of [
    wrap('<path d="M4 4H20" stroke-dasharray="2 2"/>'),
    wrap('<g transform="scale(0.5)"><circle cx="12" cy="12" r="5"/></g>'),
    wrap('<path d="M4 4H20" stroke-width="0.5"/>'),
    wrap('<circle cx="12" cy="12" r="5" fill="currentColor" stroke="none"/>'),
  ]) await assert.rejects(compileLibraryOutline(source));
});
