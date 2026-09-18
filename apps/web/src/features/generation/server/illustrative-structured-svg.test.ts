import { strict as assert } from "node:assert";
import { test } from "node:test";
import { ILLUSTRATIVE_DESIGN_PLAN_PROMPT, ILLUSTRATIVE_STRUCTURED_OUTPUT_PROMPT, parseIllustrativeDesignPlan, renderIllustrativeStructuredSvg } from "./illustrative-structured-svg";

test("preserves model-designed paints outside project slots", () => {
  const svg = renderIllustrativeStructuredSvg(JSON.stringify({ designPlan: { chosenObject: "测试物件", silhouette: "规整主体轮廓", diagnosticFeatures: ["主体", "内层", "厚度", "附件甲", "附件乙"], assemblyRelations: ["内层嵌入主体", "厚度连接主体", "附件甲连接主体", "附件乙连接附件甲"] }, parts: [
    { id: "body", meaning: "主体", role: "primary", color: "#EF4560", shapes: [{ tag: "path", d: "M4 4H20V20H4Z" }] },
    { id: "detail", meaning: "附件", role: "tertiary", color: "#25352B", shapes: [{ tag: "circle", cx: 12, cy: 12, r: 2 }] },
  ] }), { palette: { primary: "#112233", secondary: "#445566", tertiary: "#778899", neutral: "#AABBCC" } });
  assert.doesNotMatch(svg, /fill="#112233"/);
  assert.doesNotMatch(svg, /fill="#778899"/);
  assert.doesNotMatch(svg, /#E77789/);
  assert.match(svg, /fill="#EF4560"/);
  assert.match(svg, /fill="#25352B"/);
});

test("structured contract delegates color design while retaining safe server assembly", () => {
  assert.match(ILLUSTRATIVE_STRUCTURED_OUTPUT_PROMPT, /server preserves your chosen paints/);
  assert.match(ILLUSTRATIVE_STRUCTURED_OUTPUT_PROMPT, /New hues are allowed/);
  assert.match(ILLUSTRATIVE_STRUCTURED_OUTPUT_PROMPT, /Do not copy the preview subject/);
  assert.match(ILLUSTRATIVE_STRUCTURED_OUTPUT_PROMPT, /no fixed color-slot palette/);
  assert.match(ILLUSTRATIVE_STRUCTURED_OUTPUT_PROMPT, /5–8 meaningful structural parts/);
  assert.match(ILLUSTRATIVE_STRUCTURED_OUTPUT_PROMPT, /structurally complete master object/);
  assert.match(ILLUSTRATIVE_STRUCTURED_OUTPUT_PROMPT, /coherent representative equipment assembly/);
  assert.match(ILLUSTRATIVE_STRUCTURED_OUTPUT_PROMPT, /Complete designPlan before writing any path data/);
  assert.match(ILLUSTRATIVE_STRUCTURED_OUTPUT_PROMPT, /Never add a floating semantic sticker/);
  assert.throws(() => renderIllustrativeStructuredSvg('{"parts":[]}', {}));
});

test("illustrative anatomy is planned before geometry without minimal-pictogram bias", () => {
  assert.match(ILLUSTRATIVE_DESIGN_PLAN_PROMPT, /before any SVG path is drawn/);
  assert.match(ILLUSTRATIVE_DESIGN_PLAN_PROMPT, /Do not choose the simplest possible pictogram/);
  const plan = parseIllustrativeDesignPlan({ chosenObject: "完整潜水呼吸装备", silhouette: "以面镜为宽主体，下接呼吸阀与弯管", diagnosticFeatures: ["面罩外框", "双镜片内层", "面罩厚度面", "呼吸阀", "弯管"], assemblyRelations: ["镜片对称嵌入外框", "厚度面连接外框", "呼吸阀连接面罩", "弯管连接呼吸阀"] });
  assert.equal(plan.diagnosticFeatures.length, 5);
});

test("preserves explicitly designed body and shade colors", () => {
  const svg = renderIllustrativeStructuredSvg(JSON.stringify({ designPlan: { chosenObject: "测试物件", silhouette: "规整主体轮廓", diagnosticFeatures: ["主体", "内层", "侧面", "附件甲", "附件乙"], assemblyRelations: ["内层嵌入主体", "侧面连接主体", "附件甲连接主体", "附件乙连接附件甲"] }, parts: [
    { id: "body", meaning: "主体", role: "primary", color: "#EF4560", shapes: [{ tag: "path", d: "M4 4H20V20H4Z" }] },
    { id: "side", meaning: "侧面", role: "primaryShade", color: "#B82348", shapes: [{ tag: "path", d: "M15 5H20V19H15Z" }] },
  ] }), { palette: { primary: "#80C060", secondary: "#5060C0", tertiary: "#E0B060", neutral: "#A0A0A0" } });
  const fills = [...svg.matchAll(/fill="(#[0-9A-F]{6})"/g)].map(match => match[1]);
  assert.equal(fills.length, 2);
  assert.notEqual(fills[0], fills[1]);
  assert.deepEqual(fills, ["#EF4560", "#B82348"]);
});

test("rejects missing paints and unsafe color strings instead of silently mapping a slot", () => {
  const designPlan = { chosenObject: "fruit", silhouette: "rounded", diagnosticFeatures: ["body", "skin", "flesh", "seed", "stem"], assemblyRelations: ["skin wraps flesh", "seeds in flesh", "stem joins skin", "flesh inside body"] };
  for (const color of [undefined, 'url(https://example.com/paint)', '#FF0000" onclick="x']) {
    assert.throws(() => renderIllustrativeStructuredSvg(JSON.stringify({ designPlan, parts: [{ id: "body", meaning: "flesh", role: "primary", color, shapes: [{ tag: "circle", cx: 12, cy: 12, r: 8 }] }] })));
  }
});
