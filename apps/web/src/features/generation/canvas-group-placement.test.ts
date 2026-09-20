import assert from "node:assert/strict";
import test from "node:test";
import { placeGeneratedGroup } from "./canvas-group-placement";

test("places a newly generated group below the combined visible group bounds", () => {
  assert.deepEqual(placeGeneratedGroup({
    current: { x: 0, y: 0 },
    generated: { left: 400, right: 620, top: 1200, bottom: 1400 },
    existing: [
      { left: 100, right: 500, top: 200, bottom: 500 },
      { left: 520, right: 760, top: 220, bottom: 620 },
    ],
    scale: 1,
  }), { x: -80, y: -556 });
});

test("converts screen deltas to world coordinates at the current scale", () => {
  assert.deepEqual(placeGeneratedGroup({
    current: { x: 10, y: 20 },
    generated: { left: 400, right: 500, top: 800, bottom: 900 },
    existing: [{ left: 200, right: 600, top: 200, bottom: 500 }],
    scale: 0.5,
  }), { x: -90, y: -556 });
});

test("keeps the natural position when there are no existing groups", () => {
  assert.deepEqual(placeGeneratedGroup({
    current: { x: 4, y: 8 },
    generated: { left: 0, right: 220, top: 0, bottom: 200 },
    existing: [],
    scale: 1,
  }), { x: 4, y: 8 });
});
