import test from "node:test";
import assert from "node:assert/strict";
import { compactDrawingPrompt, compileDrawingTask, parseCompactOutput } from "./compact-generation-task";
import { generationSnapshotSchema } from "../generation-snapshot";
import { applyLockedGradient } from "./apply-generated-colors";
import { applyLockedSolidColor } from "./solid-color";
import { subjectStructureBlueprintSchema } from "./subject-structure-blueprint";

const svg = '<svg viewBox="0 0 24 24"><path d="M4 4L20 20" stroke="#123456" fill="none"/></svg>';
test("simple output needs no design card or numeric geometry, pair requires two separate SVGs", () => {
  assert.equal(Object.values(parseCompactOutput(JSON.stringify({ svg }), false).svgs)[0], svg);
  assert.deepEqual(Object.keys(parseCompactOutput(JSON.stringify({ outlineSvg: svg, solidSvg: svg }), true).svgs), ["outline", "solid"]);
  assert.throws(() => parseCompactOutput(JSON.stringify({ svg }), true));
  assert.doesNotMatch(compactDrawingPrompt("illustrative", false), /RETAIN_PREVIOUS_DESIGN_CARD|GEOMETRY_ASSEMBLY|MONOCHROME_FORM_RULES/);
});
test("compact output normalizes equivalent absolute geometry encodings without accepting relative paths", () => {
  const base = { svg, geometry: { version: "1", paths: [
    { id: "one", d: "M2 3L8 3Q9 4 8 5Z" },
    { id: "two", commands: [{ type: "M", values: [10, 10] }, { type: "L", values: [11, 11] }] },
  ] } };
  const result = parseCompactOutput(JSON.stringify(base), false);
  assert.deepEqual(result.geometry?.paths[0].commands, [["M", 2, 3], ["L", 8, 3], ["Q", 9, 4, 8, 5], ["Z"]]);
  assert.deepEqual(result.geometry?.paths[1].commands, [["M", 10, 10], ["L", 11, 11]]);
  assert.throws(() => parseCompactOutput(JSON.stringify({ ...base, geometry: { version: "1", paths: [{ id: "bad", d: "M2 3l4 0" }] } }), false));
});
test("compact prompt carries construction rules for reported visual failures", () => {
  for (const style of ["cutout", "outline-duotone", "outline-fill", "background-tile", "radial", "extruded", "isometric", "doodle", "colored-doodle", "pixel-outline", "pixel-solid", "pixel-color"]) {
    const prompt = compactDrawingPrompt(style, false);
    if (["isometric", "doodle", "pixel-outline", "pixel-solid", "pixel-color"].includes(style)) assert.match(prompt, /SUBJECT FIRST/);
    else if (style === "colored-doodle") assert.match(prompt, /HAND-DRAWN REPETITION/);
    else {
      assert.match(prompt, /RIGID REPETITION/);
      assert.match(prompt, /one continuous exposed perimeter/);
    }
    assert.match(prompt, /SELECTED_STYLE/);
    assert.match(prompt, /ANATOMY LOCK — NO UNINTENDED DEFORMATION/);
    assert.match(prompt, /Never stretch, squash, compress, shear, twist, pinch or warp/);
    assert.match(prompt, /uniform scaling and optical placement/);
  }
  assert.match(compactDrawingPrompt("radial", false), /ONE radial gradient/);
  assert.match(compactDrawingPrompt("extruded", false), /Never show an entire shifted duplicate/);
  assert.match(compactDrawingPrompt("isometric", false), /continuous visible side thickness/);
  assert.match(compactDrawingPrompt("isometric", false), /rotation and uniform scale only/);
  assert.match(compactDrawingPrompt("isometric", false, true), /oblique\/sheared\/nonuniform matrix is NOT/);
  assert.match(compactDrawingPrompt("clear", false), /two long edges share the same axis and width/);
  assert.match(compactDrawingPrompt("clear", false), /full painted stroke width/);
  assert.match(compactDrawingPrompt("background-tile", false), /at least 3 viewBox units/);
  assert.match(compactDrawingPrompt("outline-duotone", false), /genuinely transparent/);
  assert.match(compactDrawingPrompt("doodle", false), /one or two very short warm ticks/);
  const doodleCandidate = compactDrawingPrompt("doodle", false, false, true);
  assert.match(doodleCandidate, /confident pen gestures/);
  assert.match(doodleCandidate, /A decorative flick cannot substitute for expressive subject contours/);
  assert.match(doodleCandidate, /one or two separate short accent paths outside the subject/);
  assert.match(doodleCandidate, /in locked manual color omit them/);
  assert.match(compactDrawingPrompt("colored-doodle", false), /friendly pastel illustration language/);
  assert.match(compactDrawingPrompt("doodle", false, true, true), /confident pen gestures/);
  assert.doesNotMatch(compactDrawingPrompt("outline-duotone", false), /\b(?:lens|magnifier|handle)\b/i);
  assert.match(compactDrawingPrompt("pixel-outline", false), /PIXEL LINE/);
  assert.match(compactDrawingPrompt("pixel-solid", false), /PIXEL MASS/);
  assert.match(compactDrawingPrompt("pixel-color", false), /one continuous material may use BODY alone/);
  for (const style of ["isometric", "doodle", "pixel-outline", "pixel-solid", "pixel-color"]) {
    assert.doesNotMatch(compactDrawingPrompt(style, false), /\b(?:gear|magnifier|lens|handle)\b/i);
  }
});
test("geometry prompts are available to the product core while legacy prompts remain replayable", () => {
  assert.doesNotMatch(compactDrawingPrompt("isometric", false), /EXPERIMENTAL ISOMETRIC|front-geometry contract/i);
  assert.doesNotMatch(compactDrawingPrompt("doodle", false), /EXPERIMENTAL DOODLE|thin-attachment/i);
  assert.match(compactDrawingPrompt("isometric", false, true), /EXPERIMENTAL ISOMETRIC FRONT-GEOMETRY CONTRACT/);
  assert.match(compactDrawingPrompt("doodle", false, false, true), /EXPERIMENTAL DOODLE GEOMETRY CONTRACT/);
});
test("manual settings survive compilation and reference survives persisted snapshot", () => {
  const value = { mode: "linear", color: "#123456", endColor: "#654321", alpha: 0.2, endAlpha: 0.7, angle: 30, startOffset: 10, endOffset: 80 };
  const task = compileDrawingTask({ styleId: "gradient-fill", subject: { name: "搜索", description: "放大镜" }, theme: "dark", colors: { mode: "manual", locked: true, default: value } }, false, "test");
  assert.deepEqual((task.paint as { value: unknown }).value, value);
  const snapshot = generationSnapshotSchema.parse({ projectId: "00000000-0000-4000-8000-000000000046", styleId: "regular", referenceImage: "data:image/png;base64,AAAA", referenceUse: "style" });
  assert.equal(snapshot.referenceUse, "style");
  assert.equal(snapshot.referenceImage, "data:image/png;base64,AAAA");
  const rendered = applyLockedGradient(svg, { locked: true, default: value }, "test");
  assert.match(rendered, /gradientUnits="userSpaceOnUse"/);
  assert.match(rendered, /rotate\(30 12 12\)/);
  assert.match(rendered, /offset="0.1"[^>]*stop-opacity="0.2"/);
  assert.match(rendered, /offset="0.8"[^>]*stop-opacity="0.7"/);
  assert.match(applyLockedSolidColor(svg, "#123456", 0.4), /<g opacity="0.4">/);
});
test("an available subject structure reaches the actual drawing task", () => {
  const structureBlueprint = subjectStructureBlueprintSchema.parse({ version: "1", subject: "settings gear", canonicalSilhouette: "one connected gear perimeter",
    viewpoint: "front", proportions: "equal x and y", identityFeatures: ["evenly spaced outer teeth", "centered hub opening"],
    partRelationships: ["teeth belong to the same body"], negativeSpaces: ["true center hole"],
    confusionRisks: [{ mistakenFor: "badge", prevention: "keep equal tooth-and-valley rhythm" }],
    invariantGeometry: ["connected tooth ring", "open central aperture"], allowedStyleChanges: ["single isometric projection", "one shared pixel grid"] });
  const task = compileDrawingTask({ styleId: "pixel-solid", subject: { name: "设置", description: "齿轮" }, structureBlueprint, theme: "light" }, false, "test");
  assert.deepEqual(task.subjectStructure, structureBlueprint);
  assert.match(compactDrawingPrompt("pixel-solid", false), /When TASK\.subjectStructure is present/);
});
