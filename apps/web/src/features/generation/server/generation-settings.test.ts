import assert from "node:assert/strict";
import test from "node:test";
import { getGenerationSettings } from "./generation-settings";
import { GET } from "@/app/api/generation/settings/route";

test("returns the versioned icon-style catalog", () => {
  const settings = getGenerationSettings();
  assert.equal(settings.stylePresets.length, 10);
  assert.ok(
    settings.stylePresets.every((preset) =>
      preset.previewImage.startsWith("/images/icon-style-previews/"),
    ),
  );
  assert.equal(
    settings.stylePresets.filter((preset) => preset.id !== "line-icon").every(
      (preset) =>
        preset.previewImage.startsWith(
          "/images/icon-style-previews/favorites-2026-09-10/",
        ),
    ),
    true,
  );
  assert.ok(
    settings.stylePresets.every((preset) => !("promptToken" in preset)),
  );
  assert.equal(settings.styleAdjustments.length, 3);
  assert.ok(
    settings.styleAdjustments.every((group) =>
      group.options.every((item) => !("promptToken" in item)),
    ),
  );
  assert.deepEqual(settings.outputSizes, [24, 32, 48, 64, 128]);
  assert.deepEqual(settings.limits, {
    maxSubjects: 20,
    maxOutputSizes: 3,
    variantsPerSubject: 3,
  });
});

test("serves the public settings endpoint consistently with cache headers", async () => {
  const first = GET();
  const second = GET();
  assert.equal(first.status, 200);
  assert.equal(
    first.headers.get("cache-control"),
    "public, max-age=300, stale-while-revalidate=3600",
  );
  assert.deepEqual(await first.json(), await second.json());
});
