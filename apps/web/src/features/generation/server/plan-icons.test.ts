import test from "node:test";
import assert from "node:assert/strict";
import { planIcons, IconPlanProviderError } from "./plan-icons";
import { readSmartColorPlan } from "./smart-color-plan";
import { parsePersistedIconPlan } from "../icon-plan";

const input = { projectId: "00000000-0000-4000-8000-000000000046", projectName: "验收", projectDescription: "通用交互图标", prompt: "生成搜索和设置两个常用交互图标。", locale: "zh" as const, styleId: "regular", theme: "light" as const, targetSurface: "#FFFFFF", colors: { mode: "smart" } };
const planned = { recognizable: true, intent: "explicit_subjects", referenceUse: "none", summary: "搜索和设置", subjects: [{ name: "搜索", description: "搜索" }, { name: "设置", description: "设置" }], designIntent: { styleRequest: { kind: "none", evidence: "", message: "" }, modifiers: [], exclusions: [], projectContext: [], colorIntent: { partColors: [] } } };
const structuredPlan = () => ({ ...planned, subjects: planned.subjects.map(subject => ({ ...subject, structureBlueprint: { version: "1", subject: subject.name, canonicalSilhouette: "recognizable conventional silhouette", viewpoint: "front", proportions: "balanced", identityFeatures: ["outer contour", "identity opening"], partRelationships: ["connected parts"], negativeSpaces: ["clear opening"], confusionRisks: [{ mistakenFor: "generic ring", prevention: "retain attachment" }], invariantGeometry: ["connected anatomy", "open aperture"], allowedStyleChanges: ["coherent projection"] } })) });

test("shared production planner preserves raw input, freezes colors and does not expose credentials in traces", async t => {
  const oldBase = process.env.IMAGE_PROVIDER_BASE_URL, oldKey = process.env.IMAGE_PROVIDER_API_KEY;
  process.env.IMAGE_PROVIDER_BASE_URL = "http://provider.test/v1"; process.env.IMAGE_PROVIDER_API_KEY = "private-test-key";
  t.after(() => { if (oldBase === undefined) delete process.env.IMAGE_PROVIDER_BASE_URL; else process.env.IMAGE_PROVIDER_BASE_URL = oldBase; if (oldKey === undefined) delete process.env.IMAGE_PROVIDER_API_KEY; else process.env.IMAGE_PROVIDER_API_KEY = oldKey; });
  const requests: Record<string, unknown>[] = [], trace: Record<string, unknown>[] = [];
  t.mock.method(globalThis, "fetch", async (_: unknown, init: RequestInit) => {
    requests.push(JSON.parse(String(init.body)));
    return Response.json({ choices: [{ message: { content: JSON.stringify(planned) } }] });
  });
  const result = await planIcons(input, { referenceDataUrl: "data:image/png;base64,AAAA", onTrace: event => trace.push(event) });
  assert.equal(result.needsResolution, false);
  assert.equal(result.plan.count, 2);
  assert.equal(result.plan.subjects[0].structureBlueprint, undefined);
  assert.equal(result.snapshot.referenceImage, "data:image/png;base64,AAAA");
  const restored = parsePersistedIconPlan(JSON.parse(JSON.stringify(result.plan)));
  assert.deepEqual(restored.subjects[0].structureBlueprint, result.plan.subjects[0].structureBlueprint);
  assert.equal(result.snapshot.designBrief?.originalPrompt, input.prompt);
  assert.equal(readSmartColorPlan(result.snapshot.colors)?.styleId, "regular");
  assert.equal(requests.length, 1);
  assert.ok(!JSON.stringify(requests[0]).includes("SELECTED_STYLE_CONTRACT"));
  assert.ok(JSON.stringify(requests[0]).includes("Extract requirements only"));
  assert.ok(!JSON.stringify(trace).includes("private-test-key"));
  const pair = await planIcons({ ...input, prompt: "使用当前主次风格生成搜索和设置", styleId: "linear", secondaryStyleId: "bold", colors: { mode: "manual", locked: true, default: { mode: "solid", color: "#343A40", alpha: 100 } } });
  assert.equal(pair.needsResolution, false);
  assert.equal(pair.plan.count, 4);
  assert.deepEqual(pair.plan.subjects.map(s => s.styleRole), ["main", "secondary", "main", "secondary"]);
  assert.match(JSON.stringify(requests[1]), /SUPPORTED PAIR/);
  assert.match(JSON.stringify(requests[1]), /two separate SVGs/);
});

test("shared planner expands state pair once and reports provider errors without fallback icons", async t => {
  const oldBase = process.env.IMAGE_PROVIDER_BASE_URL, oldKey = process.env.IMAGE_PROVIDER_API_KEY;
  process.env.IMAGE_PROVIDER_BASE_URL = "http://provider.test/v1"; process.env.IMAGE_PROVIDER_API_KEY = "test-key";
  t.after(() => { if (oldBase === undefined) delete process.env.IMAGE_PROVIDER_BASE_URL; else process.env.IMAGE_PROVIDER_BASE_URL = oldBase; if (oldKey === undefined) delete process.env.IMAGE_PROVIDER_API_KEY; else process.env.IMAGE_PROVIDER_API_KEY = oldKey; });
  const mocked = t.mock.method(globalThis, "fetch", async () => Response.json({ choices: [{ message: { content: JSON.stringify(structuredPlan()) } }] }));
  const result = await planIcons({ ...input, styleId: "state-pair" });
  assert.equal(result.plan.count, 4);
  assert.deepEqual(result.plan.subjects.map(s => s.state), ["outline", "solid", "outline", "solid"]);
  assert.deepEqual(result.plan.subjects[0].structureBlueprint, result.plan.subjects[1].structureBlueprint);
  mocked.mock.mockImplementation(async () => new Response("Unavailable", { status: 503 }));
  await assert.rejects(planIcons(input), (e: unknown) => e instanceof IconPlanProviderError && e.status === 503);
});
