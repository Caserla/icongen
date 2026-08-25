import assert from "node:assert/strict";
import test from "node:test";
import { getGenerationSettings } from "./generation-settings";
import { GET } from "@/app/api/generation/settings/route";

test("returns the versioned icon-style catalog", () => {
  const settings = getGenerationSettings();
  assert.equal(settings.stylePresets.length, 9);
  assert.ok(settings.stylePresets.every((preset) => preset.previewImage.startsWith("/images/icon-style-previews/hd-native/")));
  assert.equal(settings.styleAdjustments.length, 3);
  assert.deepEqual(settings.outputSizes, [16, 32, 48, 64, 128, 256]);
  assert.deepEqual(settings.limits, { maxSubjects: 20, maxOutputSizes: 3, variantsPerSubject: 3 });
});

test("serves the public settings endpoint consistently with cache headers", async () => {
  const first = GET();
  const second = GET();
  assert.equal(first.status, 200);
  assert.equal(first.headers.get("cache-control"), "public, max-age=300, stale-while-revalidate=3600");
  assert.deepEqual(await first.json(), await second.json());
});
