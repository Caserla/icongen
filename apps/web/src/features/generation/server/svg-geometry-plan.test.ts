import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { assembleSvgGeometry, compileGeometryPaths, svgGeometryPlanSchema, type SvgGeometryPlan } from "./svg-geometry-plan";

const wrap = (content: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${content}</svg>`;
const path = (commands: unknown[], extra = {}) => ({ version: "1", paths: [{ id: "unit", commands, ...extra }] });
const parse = (p: unknown) => svgGeometryPlanSchema.parse(p);
const alpha = async (svg: string, size = 24) => (await sharp(Buffer.from(svg)).resize(size, size).ensureAlpha().raw().toBuffer()).filter((_, i) => i % 4 === 3);

test("legacy SVG is byte-for-byte unchanged without a geometry plan", () => {
  const svg = wrap('<circle cx="12" cy="12" r="4" fill="#345678"/>');
  assert.equal(assembleSvgGeometry(svg), svg);
});
test("native primitives need no invented custom paths in the explicit output envelope", () => {
  const geometry = parse({ version: "1", paths: [] });
  const svg = assembleSvgGeometry(wrap('<circle cx="12" cy="12" r="4" fill="#345678"/>'), geometry);
  assert.match(svg, /<circle cx="12" cy="12" r="4" fill="#345678">/);
  assert.doesNotMatch(svg, /<path|data-geometry/);
  assert.throws(() => assembleSvgGeometry(wrap('<path data-geometry="missing"/>'), geometry), /unresolved/);
});
test("radial contour expands one numeric unit, with one move and no internal closing seams", () => {
  const plan = path([["M", 12, 4], ["L", 17, 4], ["L", 20, 12]], { repeat: { kind: "radial", center: [12, 12], count: 4 }, join: "closed" });
  const d = compileGeometryPaths(plan).get("unit")!;
  assert.equal((d.match(/M/g) ?? []).length, 1);
  assert.equal((d.match(/Z/g) ?? []).length, 1);
  assert.ok(d.endsWith("Z"));
  assert.ok(!d.includes("e-"));
  const svg = assembleSvgGeometry(wrap('<path data-geometry="unit" data-part-id="body" fill="none" stroke="#123456"/>'), parse(plan));
  assert.match(svg, /data-part-id="body"/);
  assert.match(svg, /stroke="#123456"/);
  assert.doesNotMatch(svg, /data-geometry|<use|href=/);
});
test("one already closed source contour tolerates a redundant closed label without a model retry", () => {
  const commands = [["M", 3, 3], ["H", 20], ["V", 20], ["H", 3], ["Z"]];
  const original = compileGeometryPaths(path(commands)).get("unit");
  assert.equal(compileGeometryPaths(path(commands, { join: "closed" })).get("unit"), original);
  assert.equal((original!.match(/Z/g) ?? []).length, 1);
  assert.throws(() => compileGeometryPaths(path(commands, { join: "open" })), /joined units/);
});
test("pixel dihedral assembly preserves reflection, quarter-turn symmetry and native whole pixels", async () => {
  // A generic stepped octant; this tests arithmetic, not a subject-specific asset.
  const plan = path([["M", 20.5, 12], ["V", 14.5], ["H", 18.5], ["V", 16.5], ["H", 16.5]], {
    repeat: { kind: "radial", count: 4, center: [12, 12], mirror: true }, join: "closed",
  });
  const d = compileGeometryPaths(plan).get("unit")!;
  assert.doesNotMatch(d, /[LCQ]/);
  const svg = assembleSvgGeometry(wrap('<path data-geometry="unit" fill="none" stroke="#343A40" stroke-width="1" stroke-linejoin="miter"/>'), parse(plan));
  for (const size of [24, 48]) {
    const pixels = await alpha(svg, size);
    assert.ok(pixels.some(a => a > 0));
    assert.ok(pixels.every(a => a === 0 || a === 255), `${size}: no fractional cell coverage`);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      assert.equal(pixels[y * size + x], pixels[x * size + size - 1 - y]);
      assert.equal(pixels[y * size + x], pixels[y * size + size - 1 - x]);
    }
  }
});
test("mirror joins reverse cubic controls, not just endpoints", () => {
  const plan = path([["M", 12, 3], ["C", 4, 4, 5, 17, 12, 21]], { repeat: { kind: "mirror", axis: "x", at: 12 }, join: "closed" });
  assert.equal(compileGeometryPaths(plan).get("unit"), "M12 3C4 4 5 17 12 21C19 17 20 4 12 3Z");
});
test("linear repetition preserves separate units or joins exact endpoints without invented edges", () => {
  const plan = path([["M", 2, 4], ["H", 5]], { repeat: { kind: "linear", count: 3, step: [3, 0] }, join: "open" });
  assert.equal(compileGeometryPaths(plan).get("unit"), "M2 4H5H8H11");
  const separate = parse(plan); separate.paths[0].join = "separate";
  assert.equal(compileGeometryPaths(separate).get("unit"), "M2 4H5 M5 4H8 M8 4H11");
});
test("a rounded radial seam is tolerated, but a visible gap is not silently bridged", () => {
  const rounded = path([["M", 19.25, 12], ["L", 17.127, 17.127]], {
    repeat: { kind: "radial", center: [12, 12], count: 8 }, join: "closed",
  });
  assert.ok(compileGeometryPaths(rounded).get("unit")?.endsWith("Z"));
  const gap = path([["M", 19.25, 12], ["L", 17.14, 17.14]], {
    repeat: { kind: "radial", center: [12, 12], count: 8 }, join: "closed",
  });
  assert.throws(() => compileGeometryPaths(gap), /joined endpoints/);
});
test("one geometry is reused by material layers; native filters and masks remain local", () => {
  const plan = parse(path([["M", 4, 5], ["H", 19]]));
  const svg = assembleSvgGeometry(wrap('<defs><filter id="h"><feGaussianBlur stdDeviation="0.5"/></filter></defs><g fill="none" stroke="#123456"><path data-geometry="unit" filter="url(#h)"/><path data-geometry="unit" stroke="#ABCDEF"/></g>'), plan);
  assert.equal((svg.match(/d="M4 5H19"/g) ?? []).length, 2);
  assert.match(svg, /filter="url\(#h\)"/);
  assert.match(svg, /stroke="#ABCDEF"/);
});
test("multiple geometry IDs preserve real evenodd transparent apertures", async () => {
  const plan = parse({ version: "1", paths: [
    { id: "outer", commands: [["M", 3, 3], ["H", 21], ["V", 21], ["H", 3], ["Z"]] },
    { id: "hole", commands: [["M", 9, 9], ["H", 15], ["V", 15], ["H", 9], ["Z"]] },
  ] });
  const svg = assembleSvgGeometry(wrap('<path data-geometry="outer hole" fill="#112233" fill-rule="evenodd"/>'), plan);
  const pixels = await alpha(svg);
  assert.equal(pixels[12 * 24 + 12], 0);
  assert.equal(pixels[5 * 24 + 5], 255);
});
test("invalid/disconnected plans fail clearly without silently replacing the subject", () => {
  assert.throws(() => compileGeometryPaths(path([["M", 4, 4], ["H", 8]], { repeat: { kind: "linear", step: [6, 0], count: 2 }, join: "open" })), /joined endpoints/);
  assert.throws(() => compileGeometryPaths(path([["M", 4, 4], ["H", 8]], { join: "closed" })), /last endpoint/);
  assert.throws(() => compileGeometryPaths(path([["M", 4, 4], ["H", 8], ["Z"]], { repeat: { kind: "radial", center: [12, 12], count: 4 }, join: "closed" })), /joined units/);
  assert.throws(() => assembleSvgGeometry(wrap('<path data-geometry="unknown"/>')), /unresolved geometry/);
  assert.throws(() => assembleSvgGeometry(wrap('<g data-geometry="unit"><path d="M1 1H2"/></g>'), parse(path([["M", 1, 1], ["H", 2]]))), /only bind a path/);
});
test("geometry schema is finite, bounded data, never executable expressions", () => {
  for (const bad of [NaN, Infinity, "12+1", "process.env", 129]) assert.equal(svgGeometryPlanSchema.safeParse(path([["M", bad, 4], ["H", 8]])).success, false);
  assert.throws(() => parse(path([["L", 1, 1], ["M", 2, 2]])), /one initial/);
  assert.throws(() => parse(path([["M", 1, 1], ["Z"], ["H", 2]])), /Z is only/);
  assert.throws(() => parse(path([["M", 1, 1], ["H", 2]], { repeat: { kind: "radial", center: [12, 12], count: 1_000_000 } })));
  const p = parse(path([["M", 1, 1], ["H", 2]]));
  assert.throws(() => parse({ version: "1", paths: [...p.paths, ...p.paths] }), /unique/);
  const large = Array.from({ length: 24 }, (_, i) => ({ ...p.paths[0], id: `part-${i}`, commands: [["M", 1, 1], ...Array.from({ length: 127 }, () => ["H", 2])], repeat: { kind: "radial", center: [12, 12], count: 32 } }));
  assert.throws(() => parse({ version: "1", paths: large }), /8192/);
});
test("unsafe XML and duplicate/local-reference problems are not hidden by assembly", () => {
  const p: SvgGeometryPlan = parse(path([["M", 1, 1], ["H", 2]]));
  assert.throws(() => assembleSvgGeometry(wrap('<path data-geometry="unit" onclick="x()"/>'), p), /Unsafe/);
  assert.throws(() => assembleSvgGeometry(wrap('<path data-geometry="unit" filter="url(#missing)"/>'), p), /broken reference/);
  assert.throws(() => assembleSvgGeometry(wrap('<script/>'), p), /Unsupported/);
});
