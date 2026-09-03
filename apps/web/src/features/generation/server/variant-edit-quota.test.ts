import assert from "node:assert/strict";
import test from "node:test";
import { remainingDetailEdits } from "./variant-edit-quota";

test("each variant starts with three included detail edits", () => {
  assert.equal(remainingDetailEdits(0), 3);
});

test("successful detail edits consume only that variant's quota", () => {
  assert.equal(remainingDetailEdits(1), 2);
  assert.equal(remainingDetailEdits(2), 1);
  assert.equal(remainingDetailEdits(3), 0);
});

test("remaining quota never becomes negative", () => {
  assert.equal(remainingDetailEdits(4), 0);
});
