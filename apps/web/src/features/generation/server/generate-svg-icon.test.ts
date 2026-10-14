import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import catalog from "../../../../../../docs/design/svg-style-prompts-v2.json";
import { generateSvgIconResponse } from "./generate-svg-icon";
import type { GenerationTrace } from "./generation-trace";
import { buildGenerationBrief, resolveGenerationBrief } from "../generation-intent";
import { uniformSmartBatchColors } from "./smart-project-colors";
import { readSmartColorPlan } from "./smart-color-plan";

const card = { recognition: "circular frame", layout: "center 10,10, radius 6", openings: "wide circular opening", connections: "handle tangent at lower right", stylePlan: "requested surface", parts: [{ partId: "frame", meaning: "frame" }] };
const specializedCard = { recognition: card.recognition, formPlan: card.layout, linearConstruction: "ring and handle", boldConstruction: "open ring and solid handle", invariants: "shared center and aperture", parts: card.parts };
const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><defs><linearGradient id="paint"><stop offset="0" stop-color="#4488DD"/><stop offset="1" stop-color="#7755CC"/></linearGradient><radialGradient id="radial"><stop offset="0" stop-color="#4488DD"/><stop offset="1" stop-color="#7755CC"/></radialGradient></defs><circle data-part-id="frame" cx="10" cy="10" r="6" fill="none" stroke="#4488DD" stroke-width="1.5"/></svg>';
const projectedGeometry = { version: "1", paths: [
  { id: "outer", commands: [["M", 3, 3], ["H", 19], ["V", 19], ["H", 3], ["Z"]] },
  { id: "hole", commands: [["M", 8, 8], ["H", 14], ["V", 14], ["H", 8], ["Z"]] },
] };
const projectedSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path data-geometry="outer hole" data-extrude-source="outer hole" data-extrude-hole="hole" fill="#8069C7" fill-rule="evenodd"/></svg>';
const doodleGeometry = { version: "1", paths: [{ id: "contour", commands: [["M", 3, 12], ["Q", 12, 3, 21, 12]] }] };
const request = (styleId: string, extra = {}) => new Request("http://debug/api/generation/svg-icon", { method: "POST", body: JSON.stringify({ styleId, subject: { name: "搜索", description: "放大镜" }, pair: styleId === "state-pair", colors: { mode: "smart", batchColor: "#34383D" }, ...extra }) });

test("pair review renders both states at three sizes without leaking subject hints", async t => {
  providerEnvironment(t);
  let calls = 0;
  const traces: GenerationTrace[] = [];
  t.mock.method(globalThis, "fetch", async (_url: unknown, init?: RequestInit) => {
    calls++;
    if (calls === 1) return Response.json({ choices: [{ message: { content: JSON.stringify({ designCard: specializedCard, outlineSvg: svg, solidSvg: svg }) } }] });
    const body = JSON.parse(String(init?.body));
    const content = body.messages[1].content;
    assert.equal(content.filter((item: { type: string }) => item.type === "image_url").length, 7);
    assert.doesNotMatch(content[0].text, /requestedSubject|designPlan|structureBlueprint|放大镜/);
    for (const state of ["outline", "solid"]) for (const size of [24, 48, 512]) {
      assert.ok(content.some((item: { text?: string }) => item.text === `Generated state: ${state}; rendered size: ${size}px; review background: #FFFFFF`));
    }
    return Response.json({ choices: [{ message: { content: JSON.stringify({ pass: true, score: 90, recognizedSubject: "magnifying glass", recognizabilityScore: 90, structureScore: 90, styleScore: 90, matchedTraits: [], issues: [], correction: "" }) } }] });
  });
  const response = await generateSvgIconResponse(request("state-pair"), { requireVisualReview: true, onTrace: trace => traces.push(trace) });
  assert.equal(response.status, 200);
  assert.equal(calls, 2);
  assert.ok(traces.some(trace => trace.stage === "visual-review" && trace.visualReview));
});

test("review timeout and invalid review JSON preserve SVG and never trigger redraw", async t => {
  providerEnvironment(t);
  for (const failure of ["timeout", "json"]) {
    let calls = 0;
    const traces: GenerationTrace[] = [];
    const mock = t.mock.method(globalThis, "fetch", async () => {
      calls++;
      if (calls === 1) return Response.json({ choices: [{ message: { content: JSON.stringify({ designCard: specializedCard, svg }) } }] });
      if (failure === "timeout") throw new DOMException("timed out", "TimeoutError");
      return Response.json({ choices: [{ message: { content: "not json" } }] });
    });
    const response = await generateSvgIconResponse(request("regular"), { requireVisualReview: true, onTrace: trace => traces.push(trace) });
    const result = await response.json();
    assert.equal(result.error, "STYLE_REVIEW_PROVIDER_FAILED");
    assert.match(result.details.svgs.single, /<svg/);
    assert.equal(calls, 2);
    assert.ok(traces.some(trace => trace.stage === "review-error"));
    assert.ok(!traces.some(trace => trace.stage === "format-error"));
    mock.mock.restore();
  }
});

test("blind review cannot redirect a retry to its mistaken subject", async t => {
  providerEnvironment(t);
  let calls = 0;
  t.mock.method(globalThis, "fetch", async (_url: unknown, init?: RequestInit) => {
    calls++;
    const body = JSON.parse(String(init?.body));
    if (calls === 3) {
      assert.match(JSON.stringify(body.messages[1].content), /requested subject remains \\"西瓜\\"/);
      assert.doesNotMatch(JSON.stringify(body.messages[1].content), /Draw a ball of yarn/);
    }
    if (calls % 2 === 1) return Response.json({ choices: [{ message: { content: JSON.stringify({ designCard: specializedCard, svg }) } }] });
    return Response.json({ choices: [{ message: { content: JSON.stringify({ pass: calls === 4, score: calls === 4 ? 90 : 70, recognizedSubject: calls === 4 ? "watermelon" : "yarn ball", recognizabilityScore: calls === 4 ? 90 : 70, structureScore: calls === 4 ? 90 : 70, styleScore: calls === 4 ? 90 : 70, matchedTraits: [], issues: [], correction: "Draw a ball of yarn with a trailing thread" }) } }] });
  });
  const response = await generateSvgIconResponse(request("regular", { subject: { name: "西瓜", description: "完整西瓜" } }), { requireVisualReview: true });
  assert.equal(response.status, 200);
  assert.equal(calls, 4);
});

function providerEnvironment(t: TestContext) {
  for (const [key, value] of Object.entries({ IMAGE_PROVIDER_BASE_URL: "http://provider.invalid", IMAGE_PROVIDER_API_KEY: "test-secret", ICON_REFERENCE_REVIEW_ENABLED: "false" })) {
    const old = process.env[key];
    process.env[key] = value;
    t.after(() => { if (old === undefined) delete process.env[key]; else process.env[key] = old; });
  }
}

test("all 46 styles use the actual shared core, preserve structured output and send reference evidence", async t => {
  providerEnvironment(t);
  let current = "";
  let messages: Array<{ content: unknown }> = [];
  let calls = 0;
  t.mock.method(globalThis, "fetch", async (_url: Parameters<typeof fetch>[0], init?: RequestInit) => {
    calls++;
    messages = JSON.parse(String(init?.body)).messages;
    const output = current === "state-pair" ? { outlineSvg: svg, solidSvg: svg }
      : current === "isometric" ? { geometry: projectedGeometry, svg: projectedSvg }
      : current === "doodle" ? { geometry: doodleGeometry, doodleRoles: { contour: "contour" }, svg }
      : { svg };
    return Response.json({ choices: [{ message: { content: JSON.stringify(output) } }] });
  });
  for (const { id } of catalog.styles) {
    current = id;
    const traces: GenerationTrace[] = [];
    const response = await generateSvgIconResponse(request(id), { onTrace: event => traces.push(event) });
    const result = await response.json();
    assert.equal(response.status, 200, `${id}: ${JSON.stringify(result)}`);
    assert.match(result.authoringProtocol, /style-production-compact-\d+/);
    assert.equal(result.designCard, undefined);
    assert.ok(String(messages[0].content).length < (id === "isometric" || id === "doodle" ? 10_000 : 6000), `${id}: compact system prompt`);
    assert.equal(traces.length, 2);
    assert.ok(result.reference?.sha256, `${id}: production reference required in regression`);
    assert.ok(Array.isArray(messages[1].content), `${id}: send image evidence`);
    assert.doesNotMatch(String(messages[0].content), /AUTHORITATIVE_PREVIEW_STYLE|strawberry/i);
    if (["regular", "pure-solid", "state-pair", "broken-outline"].includes(id)) {
      assert.match(result.reference.source, /^library-/);
      assert.ok(Array.isArray(messages[1].content));
    }
    if (id === "state-pair") assert.deepEqual(Object.keys(result.svgs).sort(), ["outline", "solid"]);
    if (["mono-pastel", "neon-tube", "soft-glow", "gradient-fill"].includes(id)) assert.match(result.svg, /#4488DD/); // not flattened to old gray
  }
  assert.equal(calls, 46, "no additional planning/review call, including Illustrative");
});

test("product defaults use geometry-backed isometric and doodle paths with manual colors", async t => {
  providerEnvironment(t);
  for (const styleId of ["isometric", "doodle"]) {
    const trace: GenerationTrace[] = [];
    const mock = t.mock.method(globalThis, "fetch", async (_url: unknown, init?: RequestInit) => {
      const prompt = JSON.parse(String(init?.body)).messages[0].content as string;
      assert.match(prompt, styleId === "isometric" ? /ISOMETRIC FRONT-GEOMETRY CONTRACT/ : /DOODLE GEOMETRY CONTRACT/);
      const output = styleId === "isometric" ? { geometry: projectedGeometry, svg: projectedSvg }
        : { geometry: doodleGeometry, doodleRoles: { contour: "contour" }, svg };
      return Response.json({ choices: [{ message: { content: JSON.stringify(output) } }] });
    });
    const response = await generateSvgIconResponse(request(styleId, {
      colors: { mode: "manual", locked: true, default: { mode: "solid", color: "#123456", alpha: 100 } },
    }), { onTrace: event => trace.push(event) });
    const result = await response.json();
    assert.equal(response.status, 200, `${styleId}: ${JSON.stringify(result)}`);
    assert.match(result.svg, /#123456/i);
    assert.ok(trace.some(event => event.stage === "result" && event.geometry));
    mock.mock.restore();
  }
});

test("user reference reaches drawing without mandatory blueprint or review call", async t => {
  providerEnvironment(t);
  process.env.ICON_REFERENCE_REVIEW_ENABLED = "true";
  let calls = 0;
  t.mock.method(globalThis, "fetch", async (_url: unknown, init?: RequestInit) => {
    calls++;
    const messages = JSON.parse(String(init?.body)).messages;
    assert.ok(messages[1].content.some((part: { image_url?: { url: string } }) => part.image_url?.url === "data:image/png;base64,AAAA"));
    assert.ok(messages[1].content.some((part: { text?: string }) => part.text?.includes("User reference use: subjects")));
    return Response.json({ choices: [{ message: { content: JSON.stringify({ svg }) } }] });
  });
  const response = await generateSvgIconResponse(request("regular", { referenceImage: "data:image/png;base64,AAAA", referenceUse: "subjects" }));
  assert.equal(response.status, 200);
  assert.equal(calls, 1);
});

test("upstream errors, invalid styles and cancellation stay local failures", async t => {
  providerEnvironment(t);
  t.mock.method(globalThis, "fetch", async () => new Response("", { status: 429 }));
  assert.equal((await generateSvgIconResponse(request("regular"))).status, 503);
  assert.equal((await generateSvgIconResponse(request("unknown"))).status, 400);
  assert.equal((await generateSvgIconResponse(new Request("http://debug", { method: "POST", body: "{}" }))).status, 400);
});

test("offline timeout extension is bounded and is never accepted from public input", async t => {
  providerEnvironment(t);
  const deadlines: number[] = [];
  t.mock.method(AbortSignal, "timeout", (ms: number) => {
    deadlines.push(ms);
    return new AbortController().signal;
  });
  t.mock.method(globalThis, "fetch", async () => new Response("", { status: 503 }));
  await generateSvgIconResponse(request("regular", { providerTimeoutMs: 360_000 }));
  await generateSvgIconResponse(request("state-pair"));
  await generateSvgIconResponse(request("regular"), { providerTimeoutMs: 360_000 });
  await generateSvgIconResponse(request("regular"), { providerTimeoutMs: 999_999 });
  await generateSvgIconResponse(request("regular"), { providerTimeoutMs: 1 });
  await generateSvgIconResponse(request("regular"), { providerTimeoutMs: Infinity });
  assert.deepEqual(deadlines, [150_000, 180_000, 360_000, 360_000, 150_000, 150_000]);
});

test("saved brief is user data, not privileged instructions; retry uses the same frozen colors and counterpart", async t => {
  providerEnvironment(t);
  const designBrief = buildGenerationBrief({ styleRequest: { kind: "none", evidence: "", message: "" }, modifiers: [{ text: "user-marker", evidence: "user-marker", source: "user" }], exclusions: [], projectContext: [], colorIntent: { partColors: [] } }, { prompt: "搜索 user-marker", styleId: "state-pair" });
  const colors = uniformSmartBatchColors({ mode: "smart" }, "state-pair", "dark", undefined, "#171A20");
  const colorPlan = readSmartColorPlan(colors)!;
  let calls = 0;
  t.mock.method(globalThis, "fetch", async (_url: Parameters<typeof fetch>[0], init?: RequestInit) => {
    calls++;
    const messages = JSON.parse(String(init?.body)).messages;
    assert.doesNotMatch(messages[0].content, /user-marker/);
    const content = Array.isArray(messages[1].content) ? messages[1].content[0].text : messages[1].content;
    const input = JSON.parse(content.split("TASK: ")[1]);
    assert.equal(input.requirements.modifiers[0].text, "user-marker");
    assert.equal(input.designBrief, undefined);
    assert.equal(input.existingStates.outline, svg);
    assert.equal(input.theme, "dark");
    assert.equal(input.targetSurface, "#171A20");
    assert.deepEqual(input.paint.roles, colorPlan.variants.dark.roles);
    return Response.json({ choices: [{ message: { content: JSON.stringify({ designCard: specializedCard, outlineSvg: svg, solidSvg: svg }) } }] });
  });
  for (let i = 0; i < 2; i++) {
    const response = await generateSvgIconResponse(request("state-pair", { designBrief, colors: JSON.parse(JSON.stringify(colors)), existingStates: { outline: svg }, theme: "light" }));
    assert.equal(response.status, 200);
    const output = await response.json();
    assert.ok(output.svgs.outline.includes(colorPlan.variants.dark.roles.ink));
    assert.ok(output.svgs.solid.includes(colorPlan.variants.dark.roles.ink));
  }
  assert.equal(calls, 2);
});

test("unresolved or mismatched intent/color cannot start a provider call", async t => {
  providerEnvironment(t);
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => { calls++; return Response.json({}); });
  const brief = buildGenerationBrief({ styleRequest: { kind: "conflict", styleId: "thin", evidence: "细线", message: "" } }, { prompt: "细线", styleId: "pure-solid" });
  assert.equal((await generateSvgIconResponse(request("pure-solid", { designBrief: brief }))).status, 409);
  assert.equal((await generateSvgIconResponse(request("pure-solid", { designBrief: resolveGenerationBrief(brief, "requested") }))).status, 409);
  assert.equal((await generateSvgIconResponse(request("regular", { colors: { mode: "smart", smartColorPlan: {} } }))).status, 422);
  assert.equal(calls, 0);
});

test("geometry plan is assembled in the actual production core, shared across pair states and traced", async t => {
  providerEnvironment(t);
  const geometry = { version: "1", paths: [{ id: "shell", commands: [["M", 12, 4], ["L", 17, 4], ["L", 20, 12]], repeat: { kind: "radial", count: 4, center: [12, 12] }, join: "closed" }] };
  const source = '<svg viewBox="0 0 24 24"><path data-geometry="shell" fill="none" stroke="#343A40" stroke-width="1.5"/></svg>';
  let calls = 0, paired = false;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    return Response.json({ choices: [{ message: { content: JSON.stringify(paired
      ? { designCard: specializedCard, geometry, outlineSvg: source, solidSvg: source.replace('fill="none"', 'fill="#343A40"') }
      : { designCard: card, geometry, svg: source }) } }] });
  });
  for (const styleId of ["pixel-outline", "state-pair"]) {
    paired = styleId === "state-pair";
    const traces: GenerationTrace[] = [];
    const response = await generateSvgIconResponse(request(styleId), { onTrace: e => traces.push(e) });
    assert.equal(response.status, 200);
    const result = await response.json();
    for (const s of Object.values(paired ? result.svgs : { single: result.svg }) as string[]) {
      assert.match(s, /d="M12 4H17L20 12/);
      assert.doesNotMatch(s, /data-geometry/);
    }
    const resultTrace = traces.find(e => e.stage === "result")!;
    assert.ok(resultTrace.geometry);
    assert.match(Object.values(resultTrace.rawSvgs!)[0], /data-geometry/);
    assert.doesNotMatch(Object.values(resultTrace.assembledSvgs!)[0], /data-geometry/);
  }
  assert.equal(calls, 2, "assembly adds no provider call");
});

test("malformed geometry follows bounded format retry with frozen paint and leaves diagnostic evidence", async t => {
  providerEnvironment(t);
  let calls = 0;
  const inputs: string[] = [];
  t.mock.method(globalThis, "fetch", async (_url: Parameters<typeof fetch>[0], init?: RequestInit) => {
    calls++;
    const messages = JSON.parse(String(init?.body)).messages;
    inputs.push(JSON.stringify(messages[1].content));
    return Response.json({ choices: [{ message: { content: JSON.stringify({ designCard: card, svg: calls === 1 ? '<svg viewBox="0 0 24 24"><path data-geometry="missing"/></svg>' : svg }) } }] });
  });
  const traces: GenerationTrace[] = [];
  const response = await generateSvgIconResponse(request("pixel-outline"), { onTrace: e => traces.push(e) });
  assert.equal(response.status, 200);
  assert.equal(calls, 2);
  assert.equal(JSON.parse(inputs[0])[0].text, JSON.parse(inputs[1])[0].text);
  assert.match(inputs[1], /preserving the same planned subject/);
  assert.match(traces.find(e => e.stage === "format-error")!.formatError!, /unresolved geometry/);
  assert.equal(traces.find(e => e.stage === "request" && e.attempt === 1)!.prompt, traces.find(e => e.stage === "request" && e.attempt === 0)!.prompt);
});
