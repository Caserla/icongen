import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { assembleSvgGeometry, svgGeometryPlanSchema } from "./svg-geometry-plan";
import { extrudeIsometricSvg } from "./isometric-extrusion";

const geometry = svgGeometryPlanSchema.parse({ version: "1", paths: [
  { id: "outer", commands: [["M", 3, 3], ["H", 19], ["V", 19], ["H", 3], ["Z"]] },
  { id: "hole", commands: [["M", 8, 8], ["H", 14], ["V", 14], ["H", 8], ["Z"]] },
] });
const front = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path data-geometry="outer hole" data-extrude-source="outer hole" data-extrude-hole="hole" fill="#8069C7" fill-rule="evenodd"/></svg>`;

test("one source contour produces a continuous side while preserving the transparent front hole", async () => {
  const svg = extrudeIsometricSvg(assembleSvgGeometry(front, geometry), geometry, "#4E348D", "test");
  assert.equal((svg.match(/fill="#4E348D"/g) ?? []).length, 8);
  assert.doesNotMatch(svg, /data-extrude|data-geometry/);
  const pixels = await sharp(Buffer.from(svg)).resize(240, 240).ensureAlpha().raw().toBuffer();
  const alphaAt = (x: number, y: number) => pixels[(y * 240 + x) * 4 + 3];
  assert.equal(alphaAt(110, 110), 0);
  assert.ok(alphaAt(195, 120) > 0);
});

test("candidate extrusion rejects a side source that differs from its front", () => {
  const different = assembleSvgGeometry(front, geometry).replace('data-extrude-source="outer hole"', 'data-extrude-source="outer"');
  assert.throws(() => extrudeIsometricSvg(different, geometry, "#4E348D", "test"), /same exact geometry/);
});

test("candidate extrusion rejects a compressed front-face camera", () => {
  const squashed = front.replace("<path", '<g transform="matrix(0.92 0.24 -0.18 0.82 3.12 -0.72)"><path').replace("</svg>", "</g></svg>");
  assert.throws(() => extrudeIsometricSvg(assembleSvgGeometry(squashed, geometry), geometry, "#4E348D", "test"), /compressed or sheared/);
  const uniform = front.replace("<path", '<g transform="matrix(0.92 0.18 -0.18 0.92 3.12 -0.72)"><path').replace("</svg>", "</g></svg>");
  assert.doesNotThrow(() => extrudeIsometricSvg(assembleSvgGeometry(uniform, geometry), geometry, "#4E348D", "test"));
});
