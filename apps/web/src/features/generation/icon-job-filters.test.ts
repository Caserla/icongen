import assert from "node:assert/strict";
import test from "node:test";
import { reduceIconJobFilters } from "./icon-job-filters";

test("changing icon usage clears incompatible lower-level filters", () => {
  const next = reduceIconJobFilters(
    {
      usage: "illustration",
      style: "neon",
      status: "completed",
    },
    { type: "select-usage", usage: "interaction" },
  );
  assert.deepEqual(next, { usage: "interaction" });
});

test("style and structure filters are mutually exclusive and reset status", () => {
  const style = reduceIconJobFilters(
    { usage: "illustration", status: "failed" },
    { type: "select-style", style: "clay-3d" },
  );
  assert.deepEqual(style, { usage: "illustration", style: "clay-3d" });
  const structure = reduceIconJobFilters(style, {
    type: "select-structure",
    structure: "filled",
  });
  assert.deepEqual(structure, {
    usage: "illustration",
    structure: "filled",
  });
});

test("changing status preserves the selected usage and style", () => {
  const next = reduceIconJobFilters(
    { usage: "illustration", style: "flat-playful" },
    { type: "select-status", status: "partial" },
  );
  assert.deepEqual(next, {
    usage: "illustration",
    style: "flat-playful",
    status: "partial",
  });
});
