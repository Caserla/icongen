import { strict as assert } from "node:assert";
import { test } from "node:test";
import { buildIconStructurePlan, ICON_STRUCTURE_QUALITY_PROMPT } from "./icon-structure-quality";

test("uses the complete concrete subject in the pre-generation plan", () => {
  const plan = buildIconStructurePlan({ name: "潜水探索", description: "主体为潜水面罩与呼吸管" });
  assert.match(plan.representation, /潜水面罩与呼吸管/);
  assert.match(plan.mainContour, /潜水面罩与呼吸管/);
  assert.equal(plan.identitySpecification, "主体为潜水面罩与呼吸管");
});

test("rejects block collages and accidental asymmetry without forcing fusion", () => {
  assert.match(ICON_STRUCTURE_QUALITY_PROMPT, /EASYDESIGN V3\.2\.1/);
  assert.match(ICON_STRUCTURE_QUALITY_PROMPT, /SILENT DESIGN CARD/);
  assert.match(ICON_STRUCTURE_QUALITY_PROMPT, /Keep the user's requested subject and intent unchanged/);
  assert.match(ICON_STRUCTURE_QUALITY_PROMPT, /not a logo, monogram, symbolic abbreviation/);
  assert.match(ICON_STRUCTURE_QUALITY_PROMPT, /FORM BEFORE DETAIL/);
  assert.match(ICON_STRUCTURE_QUALITY_PROMPT, /Do not assemble the subject from generic rounded rectangles/);
  assert.match(ICON_STRUCTURE_QUALITY_PROMPT, /near one optical stroke width/);
  assert.match(ICON_STRUCTURE_QUALITY_PROMPT, /one intentional contour/);
  assert.match(ICON_STRUCTURE_QUALITY_PROMPT, /must be visibly present/);
  assert.match(ICON_STRUCTURE_QUALITY_PROMPT, /Style may transform rendering but may not change anatomy/);
});
