import assert from "node:assert/strict";
import test from "node:test";
import { getGenerationSettings } from "./generation-settings";
import { GET } from "@/app/api/generation/settings/route";

test("returns the versioned 6-group 25-option generation catalog", () => {
  const settings = getGenerationSettings();
  assert.equal(settings.groups.length, 6);
  assert.equal(settings.groups.reduce((count, group) => count + group.options.length, 0), 25);
  assert.equal(settings.outputSizes.length, 10);
  assert.deepEqual(settings.limits, { maxSubjectsPerJob: 20, variantsPerSubject: 3 });
});

test("serves the public settings endpoint consistently with cache headers", async () => {
  const first = GET();
  const second = GET();
  assert.equal(first.status, 200);
  assert.equal(first.headers.get("cache-control"), "public, max-age=300, stale-while-revalidate=3600");
  assert.deepEqual(await first.json(), await second.json());
});
