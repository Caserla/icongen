import assert from "node:assert/strict";
import test from "node:test";
import { compileGeometryPaths, svgGeometryPlanSchema } from "./svg-geometry-plan";
import { normalizeIsometricGearGeometry, radialGearPath } from "./radial-gear-profile";

test("one bounded tooth unit produces a joined eight-tooth perimeter", () => {
  const path = radialGearPath({ id: "gear", center: [12, 12], count: 8, rootRadius: 7.2, tipRadius: 9.1 });
  const compiled = compileGeometryPaths(svgGeometryPlanSchema.parse({ version: "1", paths: [path] })).get("gear")!;
  assert.equal((compiled.match(/M/g) ?? []).length, 1);
  assert.equal((compiled.match(/Z/g) ?? []).length, 1);
  assert.ok((compiled.match(/[LHV]/g) ?? []).length >= 40);
});

test("normalization is restricted to an explicit gear subject and radial source", () => {
  const geometry = svgGeometryPlanSchema.parse({ version: "1", paths: [
    { id: "body", commands: [["M", 19.25, 12], ["L", 20, 13], ["L", 19, 16], ["L", 17.127, 17.127]],
      repeat: { kind: "radial", center: [12, 12], count: 8 }, join: "closed" },
  ] });
  assert.equal(normalizeIsometricGearGeometry(geometry, "太阳"), geometry);
  const normalized = normalizeIsometricGearGeometry(geometry, "设置齿轮")!;
  assert.notDeepEqual(normalized.paths[0].commands, geometry.paths[0].commands);
  assert.ok(compileGeometryPaths(normalized).get("body")?.endsWith("Z"));
});
