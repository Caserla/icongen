import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { svgGeometryPlanSchema } from "./svg-geometry-plan";
import { renderDoodleGeometry } from "./doodle-geometry";

const plan = svgGeometryPlanSchema.parse({ version: "1", paths: [
  { id: "page", commands: [["M", 4, 6], ["Q", 4.2, 5.7, 5, 5.8], ["L", 19, 6], ["L", 19.2, 20], ["L", 4.1, 20], ["Z"]] },
  { id: "binding", commands: [["M", 7, 7], ["L", 7, 4], ["Q", 7.2, 2.8, 8, 2.9], ["Q", 8.9, 2.9, 9, 4], ["L", 9, 7]] },
  { id: "date", commands: [["M", 8, 13], ["L", 9, 13.1]] },
] });
const roles = { page: "contour", binding: "thin-attachment", date: "surface-mark" };

test("doodle renderer preserves an open attachment and a sparse mark", async () => {
  const svg = renderDoodleGeometry(plan, roles, "#343A40", "#B69462", "test");
  assert.match(svg, /data-part-role="thin-attachment"/);
  assert.match(svg, /attachment-occlusion/);
  assert.doesNotMatch(svg, /fill="#[0-9A-F]/i);
  const raw = await sharp(Buffer.from(svg)).resize(240, 240).ensureAlpha().raw().toBuffer();
  const alphaAt = (x: number, y: number) => raw[(y * 240 + x) * 4 + 3];
  assert.equal(alphaAt(80, 60), 0, "the page line must not cross the attachment opening");
});

test("doodle renderer refuses a closed double-outline attachment and a hidden mark grid", () => {
  const closed = svgGeometryPlanSchema.parse({ ...plan, paths: plan.paths.map(path => path.id === "binding"
    ? { ...path, commands: [...path.commands, ["Z"]] } : path) });
  assert.throws(() => renderDoodleGeometry(closed, roles, "#343A40", "#B69462", "test"), /open centerline/);
  const dense = svgGeometryPlanSchema.parse({ ...plan, paths: [...plan.paths, ...[1, 2, 3].map(index => ({
    id: `mark-${index}`, commands: [["M", 8, 13 + index], ["L", 9, 13 + index]],
  }))] });
  assert.throws(() => renderDoodleGeometry(dense, { ...roles, "mark-1": "surface-mark", "mark-2": "surface-mark", "mark-3": "surface-mark" }, "#343A40", "#B69462", "test"), /detail balance/);
});

test("adjoining open contour gestures retain authored geometry and restrained pen weight", () => {
  const gestures = svgGeometryPlanSchema.parse({ version: "1", paths: [
    { id: "arc-a", commands: [["M", 5, 12], ["Q", 6, 5, 12, 5]] },
    { id: "arc-b", commands: [["M", 12, 5], ["Q", 19, 6, 19, 12]] },
  ] });
  const svg = renderDoodleGeometry(gestures, { "arc-a": "contour", "arc-b": "contour" }, "#343A40", "#B69462", "test");
  assert.match(svg, /stroke-width="1\.24"/);
  assert.match(svg, /stroke-width="1\.34"/);
  assert.match(svg, /d="M5 12Q6 5 12 5"/);
  assert.match(svg, /d="M12 5Q19 6 19 12"/);
  assert.doesNotMatch(svg, /doodle-signature/);
});
