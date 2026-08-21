import assert from "node:assert/strict";
import test from "node:test";
import { CORE_SETTING_GROUPS, DESIGN_SETTINGS_VERSION, validateCoreSettingsCatalog } from "./design-settings";
import { createGenerationJobSchema, OUTPUT_SIZES, VARIANTS_PER_SUBJECT } from "./generation-v2";

test("MVP catalog contains exactly 6 groups and 25 core choices", () => {
  const result = validateCoreSettingsCatalog();
  assert.deepEqual(result.errors, []);
  assert.equal(result.valid, true);
  assert.equal(result.groupCount, 6);
  assert.equal(result.optionCount, 25);
  assert.equal(CORE_SETTING_GROUPS.length, 6);
});

test("accepts a valid multi-subject generation contract", () => {
  const result = createGenerationJobSchema.safeParse({
    idempotencyKey: "4c6be3f8-df54-4df1-b2ce-9fa2ec735705",
    settingsVersion: DESIGN_SETTINGS_VERSION,
    subjects: [
      { clientId: "search", name: "Search", description: "Magnifier for finding content" },
      { clientId: "delete", name: "Delete", description: "Trash can for deleting content" },
    ],
    subjectColor: { mode: "solid", color: "#6D4AFF" },
    background: { enabled: false },
    coreSettings: {
      graphicStructure: "outline", visualTone: "rounded", strokeWeight: "regular",
      colorMode: "monochrome", backgroundContainer: "none", detailLevel: "auto",
    },
    sizes: [24, 48, 128],
  });
  assert.equal(result.success, true);
  assert.equal(VARIANTS_PER_SUBJECT, 3);
  assert.deepEqual(OUTPUT_SIZES, [16, 20, 24, 32, 48, 64, 128, 256, 512, 1024]);
});

test("rejects background and duplicate subject contract conflicts", () => {
  const result = createGenerationJobSchema.safeParse({
    idempotencyKey: "4c6be3f8-df54-4df1-b2ce-9fa2ec735705",
    settingsVersion: DESIGN_SETTINGS_VERSION,
    subjects: [
      { clientId: "same", name: "Search", description: "Find content" },
      { clientId: "same", name: "Delete", description: "Delete content" },
    ],
    subjectColor: { mode: "solid", color: "#6D4AFF" },
    background: { enabled: false },
    coreSettings: {
      graphicStructure: "outline", visualTone: "neutral", strokeWeight: "regular",
      colorMode: "monochrome", backgroundContainer: "circle", detailLevel: "auto",
    },
    sizes: [24, 24],
  });
  assert.equal(result.success, false);
});
