import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ICON_LIST_SKELETON_COUNT, buildIconJobListHref, groupGenerationJobsByStyle, validatePageJump } from "./components/icon-job-list";
import { chooseListThumbnail, matchesGenerationJobStatus, parseGenerationJobUsage, parseGraphicStructure, parseStylePreset, readGenerationJobs, type GenerationJobListItem } from "./server/generation-job-list-reader";

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

test("library previews prefer 256px thumbnails instead of full-size output", () => {
  assert.equal(chooseListThumbnail([{ size: 1024 }, { size: 128 }, { size: 256 }])?.size, 256);
  assert.equal(chooseListThumbnail([{ size: 1024 }, { size: 128 }, { size: 64 }])?.size, 128);
  assert.equal(chooseListThumbnail([{ size: 1024 }, { size: 512 }])?.size, 512);
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

test("applies icon usage and illustration style filters together when paging", async () => {
  const filters: Array<[string, unknown]> = [];
  const query = {
    select() { return this; },
    eq(field: string, value: unknown) { filters.push([field, value]); return this; },
    not() { return this; },
    order() { return this; },
    range() { return Promise.resolve({ data: [], error: null, count: 0 }); },
  };
  const client = { from: () => query };
  await readGenerationJobs(client as never, "user-1", {
    page: 4,
    usageFilter: "illustration",
    stylePreset: "isometric-3d",
  });
  assert.ok(filters.some(([field, value]) => field === "generation_spec->>purpose" && value === "app-icon"));
  assert.ok(filters.some(([field, value]) => field === "generation_spec->style->>preset" && value === "isometric-3d"));
});

test("validates direct page input against integer and page boundaries", () => {
  assert.deepEqual(validatePageJump("2", 4), { page: 2 });
  assert.deepEqual(validatePageJump(" 4 ", 4), { page: 4 });
  assert.deepEqual(validatePageJump("", 4), { error: "empty" });
  assert.deepEqual(validatePageJump("1.5", 4), { error: "integer" });
  assert.deepEqual(validatePageJump("abc", 4), { error: "integer" });
  assert.deepEqual(validatePageJump("0", 4), { error: "below-range" });
  assert.deepEqual(validatePageJump("5", 4), { error: "above-range" });
});

test("filter transitions use the list skeleton and do not render the removed empty-state CTA", () => {
  const source = readFileSync(
    new URL("./components/icon-job-list.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /function prepareListTransition/);
  assert.match(source, /setIsLoading\(true\)/);
  assert.match(source, /aria-busy="true"/);
  assert.equal(ICON_LIST_SKELETON_COUNT, 4);
  assert.match(source, /length: ICON_LIST_SKELETON_COUNT/);
  assert.doesNotMatch(source, /暂无图标|创建一套图标/);
  assert.doesNotMatch(source, /No icons yet|Create an icon set/);
  assert.doesNotMatch(source, /generated-icon-no-options/);
});
