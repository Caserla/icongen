import assert from "node:assert/strict";
import test from "node:test";
import { mergeProjectSvgSetPage } from "./project-svg-set-pages";

type SetRecord = { id: string; saved?: boolean; snapshot: { projectId: string } };
const record = (id: string, projectId = "project-a", saved = true): SetRecord => ({ id, saved, snapshot: { projectId } });

test("loads more than 50 project sets in stable pages without dropping pending sets", () => {
  let sets = [record("other", "project-b"), record("old-cache"), record("pending", "project-a", false)];
  const serverSets = Array.from({ length: 120 }, (_, index) => record(`set-${index}`));
  sets = mergeProjectSvgSetPage(sets, "project-a", serverSets.slice(0, 50), true);
  assert.equal(sets.some(item => item.id === "old-cache"), false);
  sets = mergeProjectSvgSetPage(sets, "project-a", serverSets.slice(50, 100), false);
  sets = mergeProjectSvgSetPage(sets, "project-a", serverSets.slice(100), false);
  assert.equal(sets.length, 122);
  assert.equal(sets[0].id, "other");
  assert.equal(sets[1].id, "pending");
  assert.equal(sets.at(-1)?.id, "set-119");
  sets = mergeProjectSvgSetPage(sets, "project-a", [serverSets[99]], false);
  assert.equal(sets.length, 122);
});
