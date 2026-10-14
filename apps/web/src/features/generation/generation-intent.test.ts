import assert from "node:assert/strict";
import test from "node:test";
import { buildGenerationBrief, needsIntentResolution, resolveGenerationBrief, RESOLVED_INTENT_RULES } from "./generation-intent";
import { generationSnapshotSchema } from "./generation-snapshot";
import { normalizeIconPlan, parsePersistedIconPlan } from "./icon-plan";
import { prepareGenerationDraft } from "./server/prepare-generation-draft";
import { readSmartColorPlan } from "./server/smart-color-plan";

const input = { prompt: "生成搜索和设置，圆润可爱，配色不要太花", projectDescription: "儿童学习 App，面向小学生", styleId: "illustrative" };
const extracted = { styleRequest: { kind: "none", evidence: "", message: "" }, modifiers: [{ text: "圆润可爱", evidence: "圆润可爱", source: "user" }], exclusions: [{ text: "配色不要太花", evidence: "配色不要太花", source: "user" }], projectContext: [{ text: "小学生使用", evidence: "面向小学生", source: "project" }], colorIntent: { partColors: [] } };
const plan = () => normalizeIconPlan({ recognizable: true, intent: "explicit_subjects", referenceUse: "none", summary: "搜索和设置", subjects: [{ name: "搜索", description: "搜索" }, { name: "设置", description: "设置" }] });
const snapshot = (designBrief = buildGenerationBrief(extracted, input)) => ({ projectId: "00000000-0000-4000-8000-000000000001", prompt: input.prompt, projectName: "测试项目", projectDescription: input.projectDescription, styleId: designBrief.selectedStyleId, theme: "light", targetSurface: "#F1F3F4", colors: { mode: "smart" }, designBrief });

test("global modifiers, exclusions, raw request and relevant project context survive save/reload", () => {
  const draft = prepareGenerationDraft(plan(), snapshot());
  const loaded = generationSnapshotSchema.parse(JSON.parse(JSON.stringify(draft.snapshot)));
  assert.equal(loaded.prompt, input.prompt);
  assert.equal(loaded.designBrief?.originalPrompt, input.prompt);
  assert.equal(loaded.designBrief?.modifiers[0].text, "圆润可爱");
  assert.equal(loaded.designBrief?.exclusions[0].text, "配色不要太花");
  assert.equal(loaded.designBrief?.projectContext[0].text, "小学生使用");
  assert.deepEqual(parsePersistedIconPlan(draft.plan), draft.plan);
  assert.deepEqual(prepareGenerationDraft(draft.plan, loaded), JSON.parse(JSON.stringify(draft)));
  assert.equal(readSmartColorPlan(loaded.colors)?.targetSurface, "#F1F3F4");
});

test("project prose cannot invent modifiers or spoof a current user style request", () => {
  const brief = buildGenerationBrief({ ...extracted, modifiers: [...extracted.modifiers, { text: "加星星", evidence: "高级科技感", source: "user" }] }, input);
  assert.equal(brief.modifiers.length, 1);
  assert.throws(() => buildGenerationBrief({ ...extracted, styleRequest: { kind: "switch", styleId: "clay", evidence: "项目改成黏土", message: "" } }, input), /evidence/);
});

test("compatible adjectives never switch the selected style", () => {
  const brief = buildGenerationBrief(extracted, input);
  assert.equal(needsIntentResolution(brief), false);
  assert.equal(resolveGenerationBrief(brief).resolvedStyleId, "illustrative");
});

test("conflicting rendering waits; both choices preserve other user intent", () => {
  const request = { ...input, prompt: "生成搜索和设置，圆润可爱，要细线描边，内部空心", styleId: "pure-solid" };
  const brief = buildGenerationBrief({ ...extracted, styleRequest: { kind: "conflict", styleId: "thin", evidence: "要细线描边，内部空心", message: "选择实心或细线" } }, request);
  assert.equal(needsIntentResolution(brief), true);
  assert.throws(() => prepareGenerationDraft(plan(), snapshot(brief)), /Choose/);
  const keep = prepareGenerationDraft(plan(), snapshot(brief), "keep");
  const requested = prepareGenerationDraft(plan(), snapshot(brief), "requested");
  assert.equal(keep.snapshot.styleId, "pure-solid");
  assert.equal(requested.snapshot.styleId, "thin");
  assert.equal(requested.snapshot.designBrief?.modifiers[0].text, "圆润可爱");
  assert.equal(requested.snapshot.designBrief?.originalPrompt, request.prompt);
  assert.equal(readSmartColorPlan(requested.snapshot.colors)?.styleId, "thin");
});

test("explicit switching is automatic; merely mentioning another style is not", () => {
  const request = { ...input, prompt: "改成状态配对，生成搜索和设置", styleId: "pure-solid" };
  const extraction = { ...extracted, styleRequest: { kind: "switch", styleId: "state-pair", evidence: "改成状态配对", message: "" } };
  const brief = buildGenerationBrief(extraction, request);
  assert.equal(needsIntentResolution(brief), false);
  const result = prepareGenerationDraft(plan(), snapshot(brief));
  assert.equal(result.snapshot.styleId, "state-pair");
  assert.equal(result.plan.count, 4);
  assert.deepEqual(result.plan.subjects.map(item => item.state), ["outline", "solid", "outline", "solid"]);
  assert.deepEqual(prepareGenerationDraft(result.plan, result.snapshot), result);
  const vague = buildGenerationBrief({ ...extraction, styleRequest: { ...extraction.styleRequest, evidence: "状态配对" } }, { ...request, prompt: "生成状态配对的搜索" });
  assert.equal(needsIntentResolution(vague), true);
  const negated = buildGenerationBrief({ ...extraction, styleRequest: { ...extraction.styleRequest, evidence: "不要改成状态配对" } }, { ...request, prompt: "不要改成状态配对" });
  assert.equal(needsIntentResolution(negated), true);
});

test("unsupported combination cannot bypass resolution by posting a choice", () => {
  const brief = buildGenerationBrief({ ...extracted, styleRequest: { kind: "unsupported", evidence: "圆润可爱", message: "请修改矛盾要求" } }, input);
  assert.throws(() => resolveGenerationBrief(brief, "requested"), /请修改/);
  assert.throws(() => resolveGenerationBrief(brief, "keep"), /请修改/);
});

test("only explicit current color evidence can override neutral defaults", () => {
  const intent = { foreground: "#DC754E", recipeId: "warm-orange", evidence: "统一橙色", partColors: [] };
  const absent = buildGenerationBrief({ ...extracted, colorIntent: intent }, input);
  assert.equal(absent.colorIntent.foreground, undefined);
  const present = buildGenerationBrief({ ...extracted, colorIntent: intent }, { ...input, prompt: "搜索和设置统一橙色", styleId: "regular" });
  const result = prepareGenerationDraft(plan(), snapshot(present));
  assert.equal(readSmartColorPlan(result.snapshot.colors)?.variants.light.roles.ink, "#DC754E");
});

test("part colors are local to real planned subjects and have valid user evidence", () => {
  const brief = buildGenerationBrief({ ...extracted, colorIntent: { partColors: [
    { subjectName: "搜索", part: "handle", color: "#C4773C", source: "semantic", evidence: "wood" },
    { subjectName: "不存在的物品", part: "body", color: "#C4773C", source: "semantic", evidence: "wood" },
    { subjectName: "设置", part: "body", color: "#00FF00", source: "explicit", evidence: "并未说过的绿色" },
  ] } }, input);
  const saved = prepareGenerationDraft(plan(), snapshot(brief));
  assert.equal(readSmartColorPlan(saved.snapshot.colors)?.partColors.length, 1);
});

test("legacy snapshots work without manufacturing a new raw intent", () => {
  const saved = prepareGenerationDraft(plan(), { projectId: snapshot().projectId, styleId: "regular", colors: { mode: "manual", default: { mode: "solid", color: "#123456" } } });
  assert.equal(saved.snapshot.designBrief, undefined);
  assert.equal((saved.snapshot.colors as { default: { color: string } }).default.color, "#123456");
});

test("state pair limit is reported rather than silently deleting requested subjects", () => {
  const many = { ...plan(), subjects: Array.from({ length: 21 }, (_, i) => ({ id: `icon-${i}`, name: `主体${i}`, description: `主体${i}` })), count: 21 };
  assert.throws(() => prepareGenerationDraft(many, { projectId: snapshot().projectId, styleId: "state-pair" }), /20/);
  assert.match(RESOLVED_INTENT_RULES, /disregard ONLY the incompatible rendering instruction/);
});

test("secondary library style expands one subject into two persisted variants", () => {
  const value = { projectId: snapshot().projectId, styleId: "linear", secondaryStyleId: "bold", colors: { mode: "manual", locked: true, default: { mode: "solid", color: "#34383D" } } };
  const draft = prepareGenerationDraft(plan(), value);
  assert.equal(draft.plan.count, 4);
  assert.deepEqual(draft.plan.subjects.map(subject => subject.styleRole), ["main", "secondary", "main", "secondary"]);
  assert.deepEqual(prepareGenerationDraft(draft.plan, draft.snapshot), draft);
  assert.deepEqual(parsePersistedIconPlan(draft.plan), draft.plan);
  assert.throws(() => prepareGenerationDraft(plan(), { ...value, secondaryStyleId: "linear" }), /不能相同/);
});
test("six-style generation keeps one canvas subject per requested object", () => {
  const value = { projectId: snapshot().projectId, styleId: "bold", styleFamily: true, colors: { mode: "manual", locked: true, default: { mode: "solid", color: "#34383D" } } };
  const draft = prepareGenerationDraft(plan(), value);
  assert.equal(draft.plan.count, 2);
  assert.deepEqual(draft.plan.subjects.map(subject => subject.name), ["搜索", "设置"]);
  assert.ok(draft.plan.subjects.every(subject => !subject.styleRole));
  assert.equal(generationSnapshotSchema.parse(draft.snapshot).styleFamily, true);
  assert.deepEqual(prepareGenerationDraft(draft.plan, draft.snapshot), draft);
});

test("an overlooked explicit manual color conflict cannot be silently discarded", () => {
  const brief = buildGenerationBrief({ ...extracted, colorIntent: { foreground: "#FF0000", evidence: "红色", partColors: [] } }, { ...input, prompt: "红色搜索", styleId: "regular" });
  const value = { ...snapshot(brief), colors: { mode: "manual", default: { mode: "solid", color: "#0000FF" } } };
  assert.throws(() => prepareGenerationDraft(plan(), value), /手动配色/);
  assert.doesNotThrow(() => prepareGenerationDraft(plan(), { ...value, colors: { mode: "manual", default: { mode: "solid", color: "#FF0000" } } }));
});

test("missing style choices and explicit per-part paints cannot bypass single-color intent resolution", () => {
  assert.throws(() => buildGenerationBrief({ styleRequest: { kind: "conflict", evidence: "圆润可爱", message: "" } }, input), /Missing/);
  const brief = buildGenerationBrief({ ...extracted, colorIntent: { partColors: [{ subjectName: "搜索", part: "handle", color: "#FF0000", source: "explicit", evidence: "手柄红色" }] } }, { ...input, prompt: "搜索的手柄红色", styleId: "regular" });
  assert.throws(() => prepareGenerationDraft(plan(), snapshot(brief)), /整批统一/);
});
