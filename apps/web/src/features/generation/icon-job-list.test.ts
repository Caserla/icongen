import assert from "node:assert/strict";
import test from "node:test";
import { buildIconJobListHref, groupGenerationJobsByStyle } from "./components/icon-job-list";
import { matchesGenerationJobStatus, parseGenerationJobUsage, parseGraphicStructure, parseStylePreset, type GenerationJobListItem } from "./server/generation-job-list-reader";

test("parses stored style presets and safely classifies legacy jobs", () => {
  assert.equal(parseStylePreset({ style: { preset: "flat-playful" } }), "flat-playful");
  assert.equal(parseStylePreset({}), "line-icon");
  assert.equal(parseStylePreset(null), "line-icon");
  assert.equal(parseGraphicStructure({ style: { graphicStructure: "filled" } }), "filled");
  assert.equal(parseGraphicStructure({}), "linear");
  assert.equal(parseGenerationJobUsage({ purpose: "interaction", style: { preset: "minimal-logo" } }), "interaction");
  assert.equal(parseGenerationJobUsage({ purpose: "app-icon", style: { preset: "line-icon" } }), "illustration");
});

test("groups jobs in the shared style catalog order", () => {
  const base: Pick<GenerationJobListItem, "status" | "createdAt" | "subjects" | "usage" | "graphicStructure" | "previewUrls"> = { status: "completed", createdAt: "2026-08-31T00:00:00.000Z", subjects: [], usage: "illustration", graphicStructure: "linear", previewUrls: [] };
  const jobs: GenerationJobListItem[] = [
    { ...base, id: "pixel", stylePreset: "pixel-art" },
    { ...base, id: "clay", stylePreset: "clay-3d" },
    { ...base, id: "clay-2", stylePreset: "clay-3d" },
  ];
  const groups = groupGenerationJobsByStyle(jobs);
  assert.deepEqual(groups.map((group) => group.preset.id), ["clay-3d", "pixel-art"]);
  assert.deepEqual(groups.map((group) => group.jobs.length), [2, 1]);
});

test("pagination links preserve the selected style", () => {
  assert.equal(buildIconJobListHref(undefined), "/icons");
  assert.equal(buildIconJobListHref("minimal-logo"), "/icons?style=minimal-logo");
  assert.equal(buildIconJobListHref("minimal-logo", 3), "/icons?style=minimal-logo&page=3");
  assert.equal(buildIconJobListHref("minimal-logo", 3, "failed"), "/icons?style=minimal-logo&status=failed&page=3");
  assert.equal(buildIconJobListHref(undefined, 1, "in-progress"), "/icons?status=in-progress");
  assert.equal(buildIconJobListHref("neon", 2, "completed", "illustration"), "/icons?style=neon&status=completed&usage=illustration&page=2");
  assert.equal(buildIconJobListHref(undefined, 2, "completed", "interaction", "filled"), "/icons?status=completed&usage=interaction&structure=filled&page=2");
});

test("matches combined in-progress statuses without broadening other filters", () => {
  assert.equal(matchesGenerationJobStatus("queued", "in-progress"), true);
  assert.equal(matchesGenerationJobStatus("processing", "in-progress"), true);
  assert.equal(matchesGenerationJobStatus("completed", "in-progress"), false);
  assert.equal(matchesGenerationJobStatus("completed", "completed"), true);
});
