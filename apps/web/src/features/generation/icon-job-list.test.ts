import assert from "node:assert/strict";
import test from "node:test";
import { buildIconJobListHref, groupGenerationJobsByStyle } from "./components/icon-job-list";
import { generationJobFacetKey, parseGenerationJobUsage, parseGraphicStructure, parseStylePreset, readPreloadedGenerationJobPage, type GenerationJobListItem, type GenerationJobListPreload } from "./server/generation-job-list-reader";

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
  const base: Pick<GenerationJobListItem, "status" | "createdAt" | "subjects" | "usage" | "graphicStructure" | "previewAssetIds"> = { status: "completed", createdAt: "2026-08-31T00:00:00.000Z", subjects: [], usage: "illustration", graphicStructure: "linear", previewAssetIds: [] };
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

test("serves preloaded first pages for instant style and status switching", () => {
  const base: Pick<GenerationJobListItem, "createdAt" | "subjects" | "usage" | "graphicStructure" | "previewAssetIds"> = { createdAt: "2026-08-31T00:00:00.000Z", subjects: [], usage: "illustration", graphicStructure: "linear", previewAssetIds: [] };
  const preload: GenerationJobListPreload = {
    pageSize: 2,
    jobs: [
      { ...base, id: "neon-done", stylePreset: "neon", status: "completed" },
      { ...base, id: "neon-failed", stylePreset: "neon", status: "failed" },
      { ...base, id: "clay-done", stylePreset: "clay-3d", status: "completed" },
    ],
    totals: {
      [generationJobFacetKey("neon")]: 3,
      [generationJobFacetKey("neon", "completed")]: 1,
      [generationJobFacetKey(undefined, "completed")]: 2,
    },
  };
  const neon = readPreloadedGenerationJobPage(preload, "neon");
  assert.deepEqual(neon.jobs.map((job) => job.id), ["neon-done", "neon-failed"]);
  assert.equal(neon.totalPages, 2);
  assert.deepEqual(readPreloadedGenerationJobPage(preload, "neon", "completed").jobs.map((job) => job.id), ["neon-done"]);
});
