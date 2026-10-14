import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { linearBoldPrompt, parseLinearBoldOutput, usesLinearBoldAuthoring } from "./linear-bold-authoring";

const subject = { name: "旅行颈枕", description: "圆厚 U 形软枕，向下开口" };
test("only regular, pure-solid and state-pair adopt the library authoring contract", () => {
  for (const id of ["regular", "pure-solid", "state-pair"]) assert.equal(usesLinearBoldAuthoring(id), true);
  for (const id of ["thin", "bold-outline", "illustrative", "neon-tube", "cutout"]) assert.equal(usesLinearBoldAuthoring(id), false);
});
test("linear has a concrete card and 1.5 stroke without legacy preview instructions", () => {
  const prompt = linearBoldPrompt({styleId:"regular",subject,theme:"light"}, "test");
  assert.match(prompt, /uniform 1.5-unit strokes/);
  assert.match(prompt, /data-part-id/);
  assert.match(prompt, /complete Linear SVG only/);
  assert.match(prompt, /旅行颈枕/);
  assert.doesNotMatch(prompt, /strawberry|2-unit uniform|AUTHORITATIVE_PREVIEW_STYLE/);
});
test("bold directly constructs negative space; pair shares one subject and card", () => {
  const single = linearBoldPrompt({styleId:"pure-solid",subject,theme:"light"}, "test");
  assert.match(single, /complete Bold SVG only/);
  assert.match(single, /Do NOT simply fill every closed Linear path/);
  assert.match(single, /Never paint fixed white/);
  assert.match(single, /Already-expanded solid geometry gets no extra border/);
  const pair = linearBoldPrompt({styleId:"state-pair",subject,theme:"light",pair:true}, "test");
  assert.match(pair, /outlineSvg \(Linear default state\) and solidSvg \(Bold selected state\)/);
  assert.match(pair, /one shared designCard/);
  assert.match(pair, /geometry \(one shared numeric source plan\)/);
  assert.doesNotMatch(pair, /complete Bold SVG only/);
});
test("output retains the actual subject-specific card and state members", () => {
  const designCard = {recognition:"软枕而非马蹄铁",formPlan:"厚圆 U 形且底部开放",parts:[{partId:"pillow",meaning:"软枕主体"}],linearConstruction:"连续圆润内外轮廓",boldConstruction:"厚实枕体与开放内腔",invariants:"朝向与开口保持一致"};
  const outlineSvg = '<svg viewBox="0 0 24 24"><path data-part-id="pillow"/></svg>';
  const solidSvg = outlineSvg;
  const output = parseLinearBoldOutput(JSON.stringify({designCard,outlineSvg,solidSvg}),true);
  assert.deepEqual(output.designCard,designCard);
  assert.deepEqual(output.svgs,{outline:outlineSvg,solid:solidSvg});
  assert.throws(() => parseLinearBoldOutput(JSON.stringify({designCard,svg:outlineSvg}),true));
});
test("production uses the dedicated contract and actual reference, not the legacy preview template", () => {
  const source = readFileSync(new URL("./generate-svg-icon.ts", import.meta.url),"utf8");
  assert.match(source,/compactDrawingPrompt\(input.styleId/);
  assert.match(source,/parseCompactOutput/);
  assert.match(source,/generationStyleReference/);
  assert.doesNotMatch(source,/ICON_STRUCTURE_QUALITY_PROMPT|style\.promptTemplate/);
});
