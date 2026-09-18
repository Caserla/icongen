import { strict as assert } from "node:assert";
import { test } from "node:test";
import { pendingGenerationId, updateActiveGenerationSets } from "./generation-busy";

test("keeps project switching locked from plan handoff through SVG completion", () => {
  const pending = new Set([pendingGenerationId("set-1")]);
  const generating = updateActiveGenerationSets(pending, "set-1:batch:run-1", true);
  assert.deepEqual([...generating], ["set-1:batch:run-1"]);
  assert.equal(updateActiveGenerationSets(generating, "set-1:batch:run-1", false).size, 0);
});

test("a stale aborted run cannot unlock a newer SVG generation run", () => {
  const first = updateActiveGenerationSets(new Set([pendingGenerationId("set-1")]), "set-1:batch:run-1", true);
  const afterCleanup = updateActiveGenerationSets(first, "set-1:batch:run-1", false);
  const second = updateActiveGenerationSets(afterCleanup, "set-1:batch:run-2", true);
  const staleFinally = updateActiveGenerationSets(second, "set-1:batch:run-1", false);
  assert.deepEqual([...staleFinally], ["set-1:batch:run-2"]);
  assert.equal(updateActiveGenerationSets(staleFinally, "set-1:batch:run-2", false).size, 0);
});

test("retry locks independently of the initial batch", () => {
  const initial = new Set(["set-1:batch:run-1"]);
  const retrying = updateActiveGenerationSets(initial, "set-1:icon-2", true);
  const batchDone = updateActiveGenerationSets(retrying, "set-1:batch:run-1", false);
  assert.deepEqual([...batchDone], ["set-1:icon-2"]);
  assert.equal(updateActiveGenerationSets(batchDone, "set-1:icon-2", false).size, 0);
});
