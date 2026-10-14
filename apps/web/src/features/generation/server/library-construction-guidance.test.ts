import assert from "node:assert/strict";
import test from "node:test";
import { libraryConstructionGuidance, libraryConnectionGuidance, libraryCurveConstructionGuidance } from "./library-construction-guidance";
import { libraryFamilyDrawingPrompt, libraryPlanningPrompt, librarySubjectPlanSchema, libraryPlanOutputShape, libraryCompactPlanOutputShape, libraryPlanningOutputSchema } from "./library-six-plan";
import { LIBRARY_GENERATION_STYLES } from "../library-generation-styles";

test("canonical style rules are routed only to requested styles", () => {
  const line = libraryConstructionGuidance(["outline", "broken"]);
  assert.match(line, /\| Outline \|/); assert.match(line, /\| Broken \|/);
  assert.doesNotMatch(line, /\| Bold \||\| Bulk \||\*\*Bold 直接|\*\*Bulk 独立|Bold 的外围/);
  const solid = libraryConstructionGuidance(["bold", "bulk"]);
  assert.match(solid, /\*\*Bold 直接/); assert.match(solid, /\*\*Bulk 独立/);
  assert.match(solid, /透明孔洞/);
  assert.throws(() => libraryConstructionGuidance(["missing"]));
});
test("all six single styles and thirty ordered main-secondary pairs receive exactly their own canonical rows", () => {
  for (const primary of LIBRARY_GENERATION_STYLES) {
    for (const secondary of [undefined, ...LIBRARY_GENERATION_STYLES.filter(s => s !== primary)]) {
      const requested = secondary ? [primary, secondary] : [primary];
      const rows = [...libraryConstructionGuidance(requested).matchAll(/^\| (Linear|Outline|Bold|Broken|Bulk|Twotone) \|/gm)].map(m => m[1].toLowerCase());
      assert.deepEqual(rows.sort(), [...requested].sort());
    }
  }
});
test("generic connection planning is delivered before drawing without subject recipes", () => {
  const plan = libraryPlanningPrompt(["linear", "bold"]);
  assert.match(plan, /joinKind/); assert.match(plan, /visibleBoundary/); assert.match(plan, /smallSizeSignature/);
  assert.ok(plan.includes(libraryConnectionGuidance));
  assert.ok(libraryFamilyDrawingPrompt(["linear", "bold"]).includes(libraryConnectionGuidance));
  assert.doesNotMatch(libraryConnectionGuidance, /scissors|camera|backpack|剪刀|相机|背包/);
  assert.match(libraryFamilyDrawingPrompt(["broken"]), /Round caps consume 1.5/);
});
test("planning schema retains visibility and style evidence while accepting old plans", () => {
  const old = { subject: "shape", viewpoint: "front", silhouette: "body", recognition: "object", retained: ["body"], omitted: [],
    parts: [{ id: "body", meaning: "body", role: "body", bounds: [3,3,21,21], anchor: [12,12], connection: "none" }],
    trueHoles: [], lineOnlyWhitespace: "inside", spacing: [], invariants: ["body"],
    constructions: [{ style: "linear", masses: "contour", negativeSpace: "inside", hierarchy: "primary", opticalCorrections: "none" }] };
  assert.ok(librarySubjectPlanSchema.safeParse(old).success);
  const next = { ...old, parts: [{ ...old.parts[0], joinKind: "none", visibleBoundary: "exposed outer edge" }], constructions: [{ ...old.constructions[0], smallSizeSignature: "continuous unfilled contour" }] };
  assert.equal(librarySubjectPlanSchema.parse(next).parts[0].visibleBoundary, "exposed outer edge");
  const shapeDecisions = { ...next,
    formPlan: { proportions: "wide body", contour: "long edges into quarter arcs", attachments: "none", repetition: "paired corners share radii", retained: "shell", omitted: "texture" },
    geometryPlan: [{ partId: "body", construction: "rounded rect", smoothJoins: "horizontal and vertical tangents", sharedGeometry: "shared corner radius" }],
  };
  assert.deepEqual(librarySubjectPlanSchema.parse(shapeDecisions).formPlan, shapeDecisions.formPlan);
  assert.deepEqual(librarySubjectPlanSchema.parse(shapeDecisions).geometryPlan, shapeDecisions.geometryPlan);
  assert.equal(librarySubjectPlanSchema.safeParse({ ...shapeDecisions, geometryPlan: [{ ...shapeDecisions.geometryPlan[0], partId: "missing" }] }).success, false);
});
test("drawing receives reusable curve construction rather than subject-specific recipes", () => {
  for (const style of LIBRARY_GENERATION_STYLES) {
    const prompt = libraryFamilyDrawingPrompt([style]);
    assert.ok(prompt.includes(libraryCurveConstructionGuidance));
    assert.match(prompt, /PLAN\.formPlan and PLAN\.geometryPlan/);
    assert.match(prompt, /older plan lacks these fields/);
  }
  assert.match(libraryCurveConstructionGuidance, /P1-P0/);
  assert.match(libraryCurveConstructionGuidance, /subdivide a cubic from the same continuous source/);
  assert.match(libraryCurveConstructionGuidance, /Natural asymmetry/);
  assert.doesNotMatch(libraryCurveConstructionGuidance, /headphone|earcup|耳机|scissors|camera/i);
  assert.doesNotMatch(libraryPlanningPrompt(["linear"]), /under 1200 tokens/);
});
test("the single planning output shape includes all construction fields and matches the parser", () => {
  const sample = { ...libraryPlanOutputShape, constructionFamily: "enclosure",
    parts: libraryPlanOutputShape.parts.map(p => ({ ...p, role: "body", joinKind: "none" })),
    constructions: libraryPlanOutputShape.constructions.map(c => ({ ...c, style: "linear" })),
  };
  const parsed = librarySubjectPlanSchema.parse(sample);
  assert.deepEqual(parsed.formPlan, sample.formPlan);
  assert.deepEqual(parsed.geometryPlan, sample.geometryPlan);
  assert.equal(parsed.parts[0].visibleBoundary, sample.parts[0].visibleBoundary);
  assert.equal(parsed.constructions[0].smallSizeSignature, sample.constructions[0].smallSizeSignature);
  assert.ok(libraryPlanningPrompt(["linear"]).includes(JSON.stringify(libraryCompactPlanOutputShape)));
  assert.match(libraryPlanningPrompt(["linear"]), /Describe each decision once/);
});

test("compact wire plan preserves form and per-part geometry without repeated output fields", () => {
  const compact = { ...libraryCompactPlanOutputShape, constructionFamily: "enclosure",
    parts: libraryCompactPlanOutputShape.parts.map(p => ({ ...p, role: "body", joinKind: "none" })),
    constructions: libraryCompactPlanOutputShape.constructions.map(c => ({ ...c, style: "linear" })),
  };
  const parsed = libraryPlanningOutputSchema.parse(compact);
  assert.deepEqual(parsed.formPlan, compact.formPlan);
  assert.equal(parsed.geometryPlan?.[0].construction, compact.parts[0].geometry.construction);
  assert.equal(parsed.parts[0].visibleBoundary, compact.parts[0].visibleBoundary);
  assert.deepEqual(parsed.retained, [compact.formPlan.retained]);
  assert.ok(!('retained' in compact) && !('geometryPlan' in compact) && !('silhouette' in compact));
  assert.ok(JSON.stringify(compact).length < JSON.stringify({ ...parsed, constructionFamily: "enclosure" }).length);
  assert.equal(libraryPlanningOutputSchema.safeParse({ ...compact, trueHoles: [{ partId: "missing", meaning: "hole" }] }).success, false);
  assert.equal(libraryPlanningOutputSchema.safeParse({ ...compact, parts: [...compact.parts, ...compact.parts] }).success, false);
  assert.equal(libraryPlanningOutputSchema.safeParse({ ...compact, parts: compact.parts.map(p => ({ ...p, geometry: undefined })) }).success, false);
});

test("snake_case plan IDs normalize with all references, while collisions remain invalid", () => {
  const compact = { ...libraryCompactPlanOutputShape, constructionFamily: "enclosure",
    parts: libraryCompactPlanOutputShape.parts.map(p => ({ ...p, id: "main_body", role: "body", joinKind: "none", connection: "main_body outer edge" })),
    formPlan: { ...libraryCompactPlanOutputShape.formPlan, retained: "main_body" },
    trueHoles: [{ partId: "main_body", meaning: "opening in main_body" }],
    constructions: libraryCompactPlanOutputShape.constructions.map(c => ({ ...c, style: "linear", masses: "main_body: contour" })),
  };
  const parsed = libraryPlanningOutputSchema.parse(compact);
  assert.equal(parsed.parts[0].id, "main-body");
  assert.equal(parsed.geometryPlan?.[0].partId, "main-body");
  assert.equal(parsed.trueHoles[0].partId, "main-body");
  assert.equal(parsed.parts[0].connection, "main-body outer edge");
  assert.equal(parsed.formPlan?.retained, "main-body");
  assert.equal(parsed.constructions[0].masses, "main-body: contour");
  assert.equal(libraryPlanningOutputSchema.safeParse({ ...compact, parts: [...compact.parts, { ...compact.parts[0], id: "main-body" }] }).success, false);
  assert.equal(libraryPlanningOutputSchema.safeParse({ ...compact, parts: compact.parts.map(p => ({ ...p, id: "<script>" })) }).success, false);
});
