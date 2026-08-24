import assert from "node:assert/strict";
import test from "node:test";
import { BACKGROUND_TYPE_OPTION_IDS, DESIGN_SETTINGS_VERSION, ICON_STYLE_PRESETS, STYLE_ADJUSTMENT_GROUPS, validateIconStyleCatalog } from "./design-settings";
import { createGenerationJobSchema, OUTPUT_SIZES, parseStoredGenerationJobSpec, VARIANTS_PER_SUBJECT } from "./generation-v2";

const base = {
  idempotencyKey: "4c6be3f8-df54-4df1-b2ce-9fa2ec735705", settingsVersion: DESIGN_SETTINGS_VERSION,
  subjects: [{ clientId: "search", name: "Search", description: "Find content" }], subjectColor: { mode: "solid" as const, color: "#6D4AFF" },
  style: { preset: "clay-3d" as const, strokeWeight: "regular" as const, cornerStyle: "balanced" as const, detailLevel: "standard" as const }, sizes: [24],
};

test("style catalog provides nine visual presets and three refinements", () => {
  const result = validateIconStyleCatalog();
  assert.equal(result.valid, true); assert.deepEqual(result.errors, []);
  assert.equal(ICON_STYLE_PRESETS.length, 9); assert.equal(STYLE_ADJUSTMENT_GROUPS.length, 3);
});

test("generation UI exposes exactly the three approved background types", () => {
  assert.deepEqual(BACKGROUND_TYPE_OPTION_IDS, ["rounded-square", "circle", "square"]);
});

test("accepts a style-led multi-subject generation contract", () => {
  const result = createGenerationJobSchema.safeParse({ ...base, purpose: "app-icon", subjects: [...base.subjects, { clientId: "delete", name: "Delete", description: "Remove content" }], background: { enabled: true, container: "rounded-square", color: { mode: "solid", color: "#FFFFFF" } }, sizes: [24, 64, 256] });
  assert.equal(result.success, true); assert.equal(VARIANTS_PER_SUBJECT, 3);
  if (result.success) assert.equal(result.data.purpose, "app-icon");
  assert.deepEqual(OUTPUT_SIZES, [16, 24, 32, 64, 256, 1024]);
});

test("rejects unsupported style, duplicate subjects, and more than three sizes", () => {
  assert.equal(createGenerationJobSchema.safeParse({ ...base, purpose: "marketing", background: { enabled: false } }).success, false);
  assert.equal(createGenerationJobSchema.safeParse({ ...base, background: { enabled: true, container: "pill", color: { mode: "solid", color: "#FFFFFF" } } }).success, false);
  assert.equal(createGenerationJobSchema.safeParse({ ...base, style: { ...base.style, preset: "technical" } }).success, false);
  assert.equal(createGenerationJobSchema.safeParse({ ...base, subjects: [{ clientId: "same", name: "Search", description: "Find content" }, { clientId: "same", name: "Delete", description: "Remove content" }], background: { enabled: false }, sizes: [24, 24, 64, 256] }).success, false);
});

test("maps an existing queued legacy job to an equivalent icon design style", () => {
  const result = parseStoredGenerationJobSpec({
    ...base, settingsVersion: "core-settings-2026-08-20.1", background: { enabled: false },
    coreSettings: { graphicStructure: "filled", visualTone: "rounded", strokeWeight: "medium", colorMode: "monochrome", backgroundContainer: "none", detailLevel: "auto" },
  });
  assert.deepEqual(result.style, { preset: "minimal-logo", strokeWeight: "regular", cornerStyle: "soft", detailLevel: "standard" });
});
