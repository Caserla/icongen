import assert from "node:assert/strict";
import test from "node:test";
import { alignMovingGroup, type CanvasBounds } from "./canvas-alignment";

const bounds = (left: number, top: number, width = 100, height = 100): CanvasBounds => ({ left, top, right: left + width, bottom: top + height, width, height });

test("snaps only near an existing edge and returns a subtle guide position", () => {
  const near = alignMovingGroup({ proposed: { x: 96, y: 20 }, current: { x: 0, y: 0 }, moving: bounds(0, 0), others: [bounds(200, 180)], canvas: { left: 10, top: 10 }, scale: 1 });
  assert.deepEqual(near.position, { x: 100, y: 20 });
  assert.equal(near.guides.x, 190);
  assert.equal(near.guides.y, undefined);
  const far = alignMovingGroup({ proposed: { x: 80, y: 20 }, current: { x: 0, y: 0 }, moving: bounds(0, 0), others: [bounds(200, 180)], canvas: { left: 10, top: 10 }, scale: 1 });
  assert.deepEqual(far.position, { x: 80, y: 20 });
  assert.deepEqual(far.guides, { x: undefined, y: undefined });
});

test("converts screen-pixel snap distance back to world coordinates", () => {
  const result = alignMovingGroup({ proposed: { x: 48, y: 0 }, current: { x: 0, y: 0 }, moving: bounds(0, 0), others: [bounds(200, 200)], canvas: { left: 0, top: 0 }, scale: 2 });
  assert.equal(result.position.x, 50);
});
