import assert from "node:assert/strict";
import test from "node:test";
import type { PlanResult } from "./components/icon-plan-results";
import { recycleGroupState, recycleIconState, setGroupFavorite, setIconFavorite } from "./project-icon-state";

const group = { id: "group", plan: { subjects: [{ id: "one" }, { id: "two" }] }, snapshot: {}, favorite: true, favoriteIconIds: ["one"] } as PlanResult;

test("group favorite and recycle are mutually exclusive", () => {
  const recycled = recycleGroupState([group], "group")[0];
  assert.equal(recycled.recycled, true);
  assert.equal(recycled.favorite, false);
  assert.deepEqual(setGroupFavorite([recycled], "group", true)[0], { ...recycled, favorite: true, recycled: false });
});

test("recycling a single icon clears its favorite without affecting siblings", () => {
  const recycled = recycleIconState([group], "group", "one")[0];
  assert.deepEqual(recycled.favoriteIconIds, []);
  assert.deepEqual(recycled.recycledIconIds, ["one"]);
  assert.equal(recycled.recycled, undefined);
  const restoredAsFavorite = setIconFavorite([recycled], "group", "one", true)[0];
  assert.deepEqual(restoredAsFavorite.favoriteIconIds, ["one"]);
  assert.deepEqual(restoredAsFavorite.recycledIconIds, []);
});
