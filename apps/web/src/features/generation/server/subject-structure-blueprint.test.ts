import test from "node:test";
import assert from "node:assert/strict";
import { subjectBlueprintInstruction, subjectStructureBlueprintSchema } from "./subject-structure-blueprint";

const apple = subjectStructureBlueprintSchema.parse({
  version: "1",
  subject: "apple",
  canonicalSilhouette: "One broad fruit body with a shallow top cleft and rounded lower lobes.",
  viewpoint: "upright front view",
  proportions: "body wider than stem; leaf remains subordinate",
  identityFeatures: ["shallow top cleft", "short stem with one attached leaf"],
  partRelationships: ["stem emerges from the top cleft and leaf attaches to the stem"],
  negativeSpaces: [],
  confusionRisks: [{ mistakenFor: "heart", prevention: "asymmetric stem and leaf plus a shallower top cleft" }],
  invariantGeometry: ["one continuous fruit body", "stem remains connected at the top cleft"],
  allowedStyleChanges: ["stroke weight", "fill and material treatment"],
});

test("locked structure blueprint separates subject anatomy from style treatment", () => {
  const prompt = subjectBlueprintInstruction(apple);
  assert.match(prompt, /cross-style source of truth/);
  assert.match(prompt, /never substitute a generic shell/);
  assert.match(prompt, /one continuous fruit body/);
  assert.doesNotMatch(JSON.stringify(apple.allowedStyleChanges), /viewpoint|part count|topology/);
});

test("blueprint refuses an underspecified identity", () => {
  assert.throws(() => subjectStructureBlueprintSchema.parse({ ...apple, identityFeatures: ["round"] }));
});

test("blueprint never silently truncates constraints and allows coherent projection", () => {
  assert.throws(() => subjectStructureBlueprintSchema.parse({ ...apple, proportions: "a".repeat(1201) }));
  assert.throws(() => subjectStructureBlueprintSchema.parse({ ...apple, invariantGeometry: Array(11).fill("essential constraint") }));
  assert.match(subjectBlueprintInstruction(apple), /isometric styles must apply one consistent projection/);
  assert.match(subjectBlueprintInstruction(apple), /not executable or numerically locked geometry/);
});
