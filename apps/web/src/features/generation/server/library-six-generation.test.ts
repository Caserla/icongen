import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { generateSvgIconResponse } from "./generate-svg-icon";
import { librarySubjectPlanSchema, libraryCompactPlanOutputShape, parseLibraryReview } from "./library-six-plan";
import { inspectLibrarySvg, renderLibraryReview } from "./library-six-render";
import { LIBRARY_GENERATION_STYLES } from "../library-generation-styles";
import { generationStyleReference } from "./style-reference-board";
import { librarySessionBudgets } from "./library-six-session";

test("planning accommodates observed successful latency without extending the session deadline", () => {
  assert.ok(librarySessionBudgets.plan > 102_161);
  assert.equal(librarySessionBudgets.total, 360_000);
  assert.ok(librarySessionBudgets.plan + librarySessionBudgets.draw + librarySessionBudgets.review < librarySessionBudgets.total);
  assert.ok(librarySessionBudgets.plan + librarySessionBudgets.familyDraw + librarySessionBudgets.review < librarySessionBudgets.total);
});

const linear = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><rect data-part-id="body" x="4" y="5" width="16" height="14" rx="3" stroke="currentColor" stroke-width="1.5"/></svg>';
const solid = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect data-part-id="body" x="3.25" y="4.25" width="17.5" height="15.5" rx="3.75" fill="currentColor"/></svg>';
const planFor = (styles: string[]) => ({ subject: "box", viewpoint: "front", silhouette: "rounded enclosure", recognition: "enclosure", retained: ["body"], omitted: ["decoration"],
  parts: [{ id: "body", meaning: "enclosure", role: "body", bounds: [3.25,4.25,20.75,19.75], anchor: [12,12], connection: "single body" }],
  trueHoles: [], lineOnlyWhitespace: "Linear interior is not a physical hole", spacing: [], invariants: ["same bounds and corner centers"],
  constructions: styles.map(style => ({ style, masses: style === "bold" ? "filled body" : "body contour", negativeSpace: "none", hierarchy: "one body", opticalCorrections: "preserve ink footprint" })),
});
const cleanReview = { recognizedSubject: "rounded enclosure", issues: [], pairConsistency: "same body" };
const issue = { style: "linear", partId: "body", location: "right corner tangent", defect: "rough turn", repair: "smooth tangent without changing bounds" };
const request = (extra = {}) => new Request("http://test.local/api/generation/svg-icon", { method: "POST", body: JSON.stringify({ styleId: "linear", subject: { name: "box", description: "rounded enclosure" }, colors: { mode: "manual", locked: true, default: { mode: "solid", color: "#343A40", alpha: 100 } }, ...extra }) });
function provider(t: TestContext, respond: (stage: string, serialized: string) => unknown) {
  const keys = ["IMAGE_PROVIDER_BASE_URL", "IMAGE_PROVIDER_API_KEY"];
  const old = keys.map(key => process.env[key]);
  process.env.IMAGE_PROVIDER_BASE_URL = "http://provider.invalid"; process.env.IMAGE_PROVIDER_API_KEY = "test";
  t.after(() => { keys.forEach((key, i) => { if (old[i] === undefined) delete process.env[key]; else process.env[key] = old[i]; }); });
  t.mock.method(globalThis, "fetch", async (_url: unknown, init?: RequestInit) => {
    const serialized = String(init?.body), body = JSON.parse(serialized);
    const prompt = body.messages[0].content;
    const stage = prompt.includes("This is PLANNING") ? "plan" : prompt.includes("Inspect the actual rendered") ? "review" : "draw";
    const output = respond(stage, serialized);
    return output instanceof Response ? output : Response.json({ model: "actual-provider-model", choices: [{ message: { content: JSON.stringify(output) } }] });
  });
}
test("every library style has actual reference evidence", async () => {
  for (const style of LIBRARY_GENERATION_STYLES) assert.match((await generationStyleReference(style))?.source ?? "", new RegExp(`^library-${style}:`));
});
test("one plan drives both styles and both-theme rendered review", async t => {
  const calls: string[] = [];
  provider(t, (stage, body) => {
    calls.push(stage);
    if (stage === "plan") return planFor(["linear", "bold"]);
    if (stage === "draw") { assert.match(body, /lineOnlyWhitespace/); return { variants: { linear, bold: solid } }; }
    assert.match(body, /CANDIDATE linear; dark/); assert.match(body, /CANDIDATE bold; light/);
    return cleanReview;
  });
  const response = await generateSvgIconResponse(request({ styleFamily: true, secondaryStyleId: "bold" }));
  const result = await response.json();
  assert.equal(response.status, 200, JSON.stringify(result));
  assert.deepEqual(calls, ["plan", "draw", "review"]); assert.equal(result.reviewStatus, "model-reviewed");
  assert.equal(result.generationContext.calls[0].model, "actual-provider-model"); assert.equal(result.generationContext.protocolHash.length, 64);
  assert.equal(Object.keys(result.generationContext.finalHashes).length, 2);
});
test("default family request plans all six library styles under one subject", async t => {
  const requested = [...LIBRARY_GENERATION_STYLES];
  const calls: string[] = [];
  provider(t, (stage, body) => {
    calls.push(stage);
    if (stage === "plan") {
      for (const style of requested) assert.match(body, new RegExp(`\\b${style}\\b`));
      return planFor(requested);
    }
    assert.equal(stage, "draw");
    return new Response("down", { status: 503 });
  });
  const response = await generateSvgIconResponse(request({ styleFamily: true }));
  const result = await response.json();
  assert.equal(response.status, 503);
  assert.equal(result.error, "SVG_PROVIDER_FAILED");
  assert.deepEqual(calls, ["plan", "draw"]);
});
test("a complete six-style family returns one Linear canvas SVG plus all six detail variants", async t => {
  const requested = [...LIBRARY_GENERATION_STYLES];
  const centerline = linear.replace('fill="none"', 'fill="none" stroke-linecap="round" stroke-linejoin="round"');
  provider(t, stage => stage === "plan" ? planFor(requested) : stage === "draw"
    ? { variants: Object.fromEntries(requested.map(style => [style, style === "linear" || style === "outline" ? centerline : solid])) }
    : cleanReview);
  const response = await generateSvgIconResponse(request({ styleFamily: true }));
  const result = await response.json();
  assert.equal(response.status, 200, JSON.stringify(result));
  assert.deepEqual(Object.keys(result.variants), requested);
  assert.equal(result.svg, result.variants.linear);
  for (const style of requested) assert.equal(result.generationContext.finalHashes[style].length, 64);
});
test("form decisions survive parsing, reach drawing and repair, and references also reach review", async t => {
  const plan = { ...planFor(["linear"]), constructionFamily: "enclosure",
    formPlan: { proportions: "wide body", contour: "straight edges with tangent quarter circles", attachments: "none", repetition: "shared radii", retained: "outer enclosure", omitted: "texture" },
    geometryPlan: [{ partId: "body", construction: "rounded rectangle", smoothJoins: "horizontal and vertical at arc endpoints", sharedGeometry: "same radius at four corners" }],
  };
  let draws = 0, reviews = 0;
  provider(t, (stage, serialized) => {
    if (stage === "plan") return plan;
    const content = JSON.parse(serialized).messages[1].content;
    const input = JSON.parse(content[0].text);
    if (stage === "draw") {
      draws++;
      assert.deepEqual(input.PLAN.formPlan, plan.formPlan);
      assert.deepEqual(input.PLAN.geometryPlan, plan.geometryPlan);
      assert.match(serialized, /CONSTRUCTION_EXAMPLE/);
      return { variants: { linear } };
    }
    assert.deepEqual(input.plan.geometryPlan, plan.geometryPlan);
    const referenceIndex = content.findIndex((c: { text?: string }) => c.text?.includes("CONSTRUCTION_REFERENCE"));
    assert.ok(referenceIndex >= 0);
    assert.equal(content[referenceIndex + 1].type, "image_url");
    assert.doesNotMatch(content[referenceIndex].text, /geometryExample|<svg/);
    return reviews++ ? cleanReview : { ...cleanReview, issues: [issue] };
  });
  const result = await (await generateSvgIconResponse(request())).json();
  assert.equal(draws, 2); assert.equal(reviews, 2);
  assert.deepEqual(result.generationContext.plan.formPlan, plan.formPlan);
  assert.deepEqual(result.generationContext.plan.geometryPlan, plan.geometryPlan);
});
test("Outline is compiled from the shared Linear source before paint and rendered review", async t => {
  const source = linear.replace('fill="none"', 'fill="none" stroke-linecap="round" stroke-linejoin="round"');
  provider(t, (stage, body) => {
    if (stage === "plan") return planFor(["linear", "outline"]);
    if (stage === "draw") {
      assert.match(body, /LINEAR CENTERLINE SOURCE/);
      return { variants: { linear: source, outline: solid } }; // Independent outline is deliberately discarded.
    }
    assert.match(body, /CANDIDATE outline; dark/);
    return cleanReview;
  });
  const response = await generateSvgIconResponse(request({ styleFamily: true, secondaryStyleId: "outline" }));
  const result = await response.json();
  assert.equal(response.status, 200, JSON.stringify(result));
  assert.equal(result.generationContext.measurements.outline.compilation.compiler, "pathkit-wasm@1.0.0");
  assert.ok(result.generationContext.measurements.outline.compilation.samples.every((s: { relativeAlphaError: number }) => s.relativeAlphaError < 0.045));
  assert.match(result.variants.linear, /<rect/);
  assert.doesNotMatch(result.variants.outline, /<rect/);
  assert.equal(result.generationContext.outlineSource, source);
  const resumed = await (await generateSvgIconResponse(request({ styleFamily: true, secondaryStyleId: "outline", resume: { variants: result.variants, context: result.generationContext } }))).json();
  assert.deepEqual(resumed.generationContext.measurements.outline.compilation, result.generationContext.measurements.outline.compilation);
  assert.equal(resumed.generationContext.outlineSource, source);
  const invalid = await generateSvgIconResponse(request({ styleFamily: true, secondaryStyleId: "outline", resume: { variants: result.variants, context: { ...result.generationContext, outlineSource: solid } } }));
  assert.equal(invalid.status, 409);
});
test("concrete defects reach repair and repaired renders are reviewed again", async t => {
  let draws = 0, reviews = 0;
  provider(t, (stage, body) => {
    if (stage === "plan") return planFor(["linear"]);
    if (stage === "draw") { if (draws++) { assert.match(body, /right corner tangent/); assert.match(body, /PREVIOUS_OUTPUT/); assert.match(body, /REPAIR_CANDIDATE/); assert.match(body, /CANDIDATE linear; dark/); } return { variants: { linear } }; }
    return reviews++ ? cleanReview : { ...cleanReview, issues: [issue] };
  });
  const result = await (await generateSvgIconResponse(request())).json();
  assert.equal(draws, 2); assert.equal(reviews, 2); assert.equal(result.generationContext.repairCount, 1);
});
test("review outage preserves valid candidate instead of a generation error", async t => {
  provider(t, stage => stage === "plan" ? planFor(["linear"]) : stage === "draw" ? { variants: { linear } } : new Response("down", { status: 503 }));
  const response = await generateSvgIconResponse(request()); const result = await response.json();
  assert.equal(response.status, 200); assert.equal(result.reviewStatus, "pending"); assert.ok(result.svg); assert.equal(result.generationContext.review, undefined);
});
test("provider failures are not interpreted as bad geometry or repeated as model repairs", async t => {
  const calls: string[] = [];
  provider(t, stage => { calls.push(stage); return stage === "plan" ? planFor(["linear"]) : new Response("busy", { status: 503 }); });
  const response = await generateSvgIconResponse(request());
  const result = await response.json();
  assert.equal(response.status, 503); assert.equal(result.error, "SVG_PROVIDER_FAILED");
  assert.equal(result.retryable, false); assert.deepEqual(calls, ["plan", "draw"]);
  assert.equal(result.details.calls.at(-1).outcome, "provider-error");
});
test("drawing retry reuses a signed plan, not a new planning request", async t => {
  const calls: string[] = [];
  let unavailable = true;
  provider(t, (stage, serialized) => {
    calls.push(stage);
    if (stage === "plan") return { ...libraryCompactPlanOutputShape, constructionFamily: "enclosure", subject: "box",
      parts: libraryCompactPlanOutputShape.parts.map(p => ({ ...p, role: "body", joinKind: "none" })), trueHoles: [],
      constructions: libraryCompactPlanOutputShape.constructions.map(c => ({ ...c, style: "linear" })),
    };
    if (stage === "draw") {
      if (unavailable) return new Response("busy", { status: 503 });
      const plan = JSON.parse(JSON.parse(serialized).messages[1].content[0].text).PLAN;
      assert.ok(plan.formPlan && plan.geometryPlan?.length);
      return { variants: { linear } };
    }
    return cleanReview;
  });
  const first = await (await generateSvgIconResponse(request())).json();
  assert.ok(first.planCheckpoint); assert.equal(first.svg, undefined);
  unavailable = false;
  const response = await generateSvgIconResponse(request({ planCheckpoint: first.planCheckpoint }));
  const result = await response.json();
  assert.equal(response.status, 200, JSON.stringify(result));
  assert.deepEqual(calls, ["plan", "draw", "draw", "review"]);
  assert.equal(result.generationContext.calls.filter((c: { stage: string }) => c.stage === "plan").length, 1);
  assert.ok(result.generationContext.resumedFromPlan); assert.equal(result.planCheckpoint, undefined);
});
test("checkpoint refuses changed subject/style/paint/theme/reference/frozen partner and tampering before model calls", async t => {
  let calls = 0;
  provider(t, stage => { calls++; return stage === "plan" ? planFor(["linear", "bold"]) : new Response("busy", { status: 503 }); });
  const pair = { styleFamily: true, secondaryStyleId: "bold", existingVariants: { linear } };
  const first = await (await generateSvgIconResponse(request(pair))).json();
  const before = calls;
  for (const extra of [
    { subject: { name: "changed", description: "different" } }, { secondaryStyleId: "bulk" },
    { colors: { mode: "manual", locked: true, default: { mode: "solid", color: "#ff0000", alpha: 100 } } },
    { theme: "dark" }, { referenceUse: "subjects" }, { existingVariants: { linear: solid } },
    { planCheckpoint: { ...first.planCheckpoint, signature: "0".repeat(64) } },
    { planCheckpoint: { ...first.planCheckpoint, payload: first.planCheckpoint.payload.replace('"box"', '"changed"') } },
  ]) {
    const response = await generateSvgIconResponse(request({ ...pair, planCheckpoint: first.planCheckpoint, ...extra }));
    assert.equal(response.status, 409, JSON.stringify(extra));
  }
  assert.equal(calls, before);
});
test("checkpoint retry preserves a completed style while drawing only its missing partner", async t => {
  let failed = false;
  const calls: string[] = [];
  provider(t, stage => {
    calls.push(stage);
    if (stage === "plan") return planFor(["linear", "bold"]);
    if (stage === "draw" && !failed) { failed = true; return new Response("busy", { status: 503 }); }
    return stage === "draw" ? { variants: { bold: solid } } : cleanReview;
  });
  const pair = { styleFamily: true, secondaryStyleId: "bold", existingVariants: { linear } };
  const first = await (await generateSvgIconResponse(request(pair))).json();
  const result = await (await generateSvgIconResponse(request({ ...pair, planCheckpoint: first.planCheckpoint }))).json();
  assert.equal(result.variants.linear, linear);
  assert.deepEqual(calls, ["plan", "draw", "draw", "review"]);
});
test("planning outages stop before drawing and do not trigger client automatic retries", async t => {
  const calls: string[] = [];
  provider(t, stage => { calls.push(stage); return new Response("busy", { status: 503 }); });
  const response = await generateSvgIconResponse(request());
  assert.equal(response.status, 503); assert.equal((await response.json()).retryable, false);
  assert.deepEqual(calls, ["plan"]);
});

test("one invalid style repairs only itself, freezing valid siblings byte-for-byte", async t => {
  let draws = 0, frozenLinear = "";
  provider(t, (stage, body) => {
    if (stage === "plan") return planFor(["linear", "bold"]);
    if (stage === "review") return cleanReview;
    const input = JSON.parse(JSON.parse(body).messages[1].content[0].text);
    if (draws++ === 0) return { variants: { linear, bold: null } };
    assert.deepEqual(input.TASK.requestedStyles, ["bold"]);
    frozenLinear = input.EXISTING_VARIANTS.linear;
    assert.match(frozenLinear, /data-part-id="body"/);
    return { variants: { bold: solid } };
  });
  const response = await generateSvgIconResponse(request({ styleFamily: true, secondaryStyleId: "bold" }));
  assert.equal(response.status, 200, JSON.stringify(await response.clone().json()));
  assert.equal((await response.json()).variants.linear, frozenLinear);
  assert.equal(draws, 2);
});
test("partial family survives exhausted repairs and a later checkpoint retry skips planning and valid styles", async t => {
  let draws = 0, repaired = false, plans = 0;
  provider(t, (stage, body) => {
    if (stage === "plan") { plans++; return planFor(["linear", "bold"]); }
    if (stage === "review") return cleanReview;
    const input = JSON.parse(JSON.parse(body).messages[1].content[0].text);
    draws++;
    if (draws === 1) return { variants: { linear } }; // A missing key must not erase Linear.
    assert.deepEqual(input.TASK.requestedStyles, ["bold"]);
    assert.ok(input.EXISTING_VARIANTS.linear);
    return { variants: { bold: repaired ? solid : solid.replace('data-part-id="body"', 'data-part-id="wrong"') } };
  });
  const pair = { styleFamily: true, secondaryStyleId: "bold" };
  const firstResponse = await generateSvgIconResponse(request(pair));
  const first = await firstResponse.json();
  assert.equal(firstResponse.status, 422);
  const signed = JSON.parse(first.planCheckpoint.payload);
  assert.deepEqual(Object.keys(signed.variants), ["linear"]);
  repaired = true;
  const second = await generateSvgIconResponse(request({ ...pair, planCheckpoint: first.planCheckpoint }));
  const result = await second.json();
  assert.equal(second.status, 200, JSON.stringify(result));
  assert.equal(result.variants.linear, signed.variants.linear);
  assert.equal(plans, 1); assert.equal(draws, 4);
});
test("a six-style family keeps five successful variants when one style requires repair", async t => {
  const requested = [...LIBRARY_GENERATION_STYLES];
  const centerline = linear.replace('fill="none"', 'fill="none" stroke-linecap="round" stroke-linejoin="round"');
  let draws = 0;
  let frozen: Record<string, string> = {};
  provider(t, (stage, body) => {
    if (stage === "plan") return planFor(requested);
    if (stage === "review") return cleanReview;
    const input = JSON.parse(JSON.parse(body).messages[1].content[0].text);
    if (!draws++) return { variants: Object.fromEntries(requested.map(style => [style,
      style === "linear" || style === "outline" ? centerline : style === "bold" ? solid.replace('data-part-id="body"', 'data-part-id="wrong"') : solid])) };
    assert.deepEqual(input.TASK.requestedStyles, ["bold"]);
    frozen = input.EXISTING_VARIANTS;
    assert.equal(Object.keys(frozen).length, 5);
    return { variants: { bold: solid } };
  });
  const response = await generateSvgIconResponse(request({ styleFamily: true }));
  const result = await response.json();
  assert.equal(response.status, 200, JSON.stringify(result));
  assert.equal(Object.keys(result.variants).length, 6);
  for (const [style, svg] of Object.entries(frozen)) assert.equal(result.variants[style], svg);
  assert.ok(result.generationContext.measurements.outline.compilation.sourceHash);
});
test("invalid planning output is retained in the local trace without drawing or exposing it to clients", async t => {
  const calls: string[] = [];
  const traces: Array<{ stage: string; formatError?: string; rawOutput?: string }> = [];
  provider(t, stage => { calls.push(stage); return { ...planFor(["linear"]), geometryPlan: [{ partId: "not-a-part", construction: "arc", smoothJoins: "tangent", sharedGeometry: "none" }] }; });
  const response = await generateSvgIconResponse(request(), { onTrace: event => traces.push(event) });
  const result = await response.json();
  assert.equal(response.status, 422);
  assert.deepEqual(calls, ["plan"]);
  const failure = traces.find(t => t.stage === "format-error");
  assert.match(failure?.formatError ?? "", /Unknown geometry part/);
  assert.match(failure?.rawOutput ?? "", /not-a-part/);
  assert.doesNotMatch(JSON.stringify(result), /not-a-part|rawOutput/);
});
test("retry preserves successful partner byte-for-byte", async t => {
  provider(t, (stage, body) => {
    if (stage === "plan") return planFor(["linear", "bold"]);
    if (stage === "draw") { assert.match(body, /EXISTING_VARIANTS/); return { variants: { bold: solid } }; }
    return cleanReview;
  });
  const result = await (await generateSvgIconResponse(request({ styleFamily: true, secondaryStyleId: "bold", existingVariants: { linear } }))).json();
  assert.equal(result.variants.linear, linear); assert.ok(result.variants.bold);
});
test("two bounded visual repairs retain candidate and honest rework status", async t => {
  let draws = 0;
  provider(t, stage => stage === "plan" ? planFor(["linear"]) : stage === "draw" ? (draws++, { variants: { linear } }) : { ...cleanReview, issues: [issue] });
  const result = await (await generateSvgIconResponse(request())).json();
  assert.equal(draws, 3); assert.equal(result.reviewStatus, "rework-required"); assert.ok(result.svg);
});
test("invalid pairs rejected before provider", async t => {
  provider(t, () => { throw new Error("Should not call"); });
  assert.equal((await generateSvgIconResponse(request({ styleFamily: true, secondaryStyleId: "linear" }))).status, 400);
});
test("a shared cross-style defect is normalized into exact variant repairs", () => {
  const review = parseLibraryReview({ ...cleanReview, issues: [{ ...issue, style: "Linear and Bold" }] }, ["linear", "bold"]);
  assert.deepEqual(review.issues.map(i => i.style), ["linear", "bold"]);
  assert.deepEqual(parseLibraryReview({ ...cleanReview, issues: [{ ...issue, style: "outline and broken; light and dark" }] }, ["outline", "broken"]).issues.map(i => i.style), ["outline", "broken"]);
  assert.deepEqual(parseLibraryReview({ ...cleanReview, issues: [{ ...issue, style: "bold (light and dark)" }] }, ["linear", "bold"]).issues.map(i => i.style), ["bold"]);
  assert.throws(() => parseLibraryReview({ ...cleanReview, issues: [{ ...issue, style: "other" }] }, ["linear"]));
});
test("pending candidate resumes at review with no repeated planning or drawing; tampering is rejected", async t => {
  const calls: string[] = []; let fail = true;
  provider(t, stage => {
    calls.push(stage);
    return stage === "plan" ? planFor(["linear"]) : stage === "draw" ? { variants: { linear } } : fail ? new Response("down", { status: 503 }) : cleanReview;
  });
  const first = await (await generateSvgIconResponse(request())).json();
  fail = false; calls.length = 0;
  const resumed = await (await generateSvgIconResponse(request({ resume: { variants: first.variants, context: first.generationContext } }))).json();
  assert.deepEqual(calls, ["review"]); assert.equal(resumed.svg, first.svg); assert.equal(resumed.reviewStatus, "model-reviewed");
  assert.deepEqual(resumed.generationContext.calls.map((c: { stage: string }) => c.stage), ["plan", "draw", "review", "review"]);
  assert.equal(resumed.generationContext.calls[2].outcome, "provider-error");
  assert.deepEqual(resumed.generationContext.resumedFrom.finalHashes, first.generationContext.finalHashes);
  const invalid = await generateSvgIconResponse(request({ resume: { variants: { linear: solid }, context: first.generationContext } }));
  assert.equal(invalid.status, 409);
});
test("technical checks enforce actual ink bounds, parts, stroke width and fixed Outline", async () => {
  const plan = librarySubjectPlanSchema.parse(planFor(["linear"]));
  assert.ok((await inspectLibrarySvg(linear, "linear", plan)).inkArea > 0);
  const inherited = linear.replace('data-part-id="body"', '').replace('<rect', '<g data-part-ids="body"><rect').replace('</svg>', '</g></svg>');
  assert.deepEqual((await inspectLibrarySvg(inherited, "linear", plan)).partIds, ["body"]);
  await assert.rejects(inspectLibrarySvg(linear.replace('1.5', '0.5'), "linear", plan), /1.5/);
  await assert.rejects(inspectLibrarySvg(linear, "outline", plan), /expanded fills/);
  await assert.rejects(inspectLibrarySvg(linear.replace('data-part-id="body"', ''), "linear", plan), /part-id/);
  await assert.rejects(inspectLibrarySvg(linear.replace('x="4"', 'x="-1"'), "linear", plan), /Off-canvas/);
  assert.equal((await renderLibraryReview({ linear })).filter(x => x.type === "image_url").length, 2);
});
test("planned bounds are diagnostics, not a reason to blindly shrink geometry before visual review", async t => {
  let draws = 0; const calls: string[] = [];
  const plan = { ...planFor(["linear"]), parts: [...planFor(["linear"]).parts, { id: "hole", meaning: "visible opening", role: "aperture", bounds: [10,10,14,14], anchor: [12,12], connection: "inside body" }], trueHoles: [{ partId: "hole", meaning: "opening" }] };
  provider(t, (stage, body) => {
    calls.push(stage);
    if (stage === "plan") return plan;
    if (stage === "review") { assert.match(body, /allocationWarnings/); assert.match(body, /exceed the pre-drawing/); return cleanReview; }
    if (draws) assert.match(body, /Actual ink bounds/);
    const r = draws++ ? 1.25 : 3;
    return { variants: { linear: linear.replace("</svg>", `<circle data-part-id="hole" cx="12" cy="12" r="${r}" stroke="currentColor" stroke-width="1.5"/></svg>`) } };
  });
  const result = await (await generateSvgIconResponse(request())).json();
  assert.deepEqual(calls, ["plan", "draw", "review"]);
  assert.equal(draws, 1); assert.match(result.svg, /r="3"/);
  assert.ok(result.generationContext.measurements.linear.planWarnings.length > 0);
});
