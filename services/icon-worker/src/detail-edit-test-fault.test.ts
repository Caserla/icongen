import assert from "node:assert/strict";
import test from "node:test";
import { shouldInjectDetailEditFailure } from "./detail-edit-test-fault";

test("detail-edit fault injection requires test/preproduction, explicit enablement, and an exact revision id", () => {
  assert.equal(shouldInjectDetailEditFailure({ editId: "one", appEnvironment: "test", enabled: "1", targetEditId: "one" }), true);
  assert.equal(shouldInjectDetailEditFailure({ editId: "one", appEnvironment: "preproduction", enabled: "1", targetEditId: "one" }), true);
  assert.equal(shouldInjectDetailEditFailure({ editId: "one", appEnvironment: "production", enabled: "1", targetEditId: "one" }), false);
  assert.equal(shouldInjectDetailEditFailure({ editId: "one", appEnvironment: "development", enabled: "1", targetEditId: "one" }), false);
  assert.equal(shouldInjectDetailEditFailure({ editId: "one", appEnvironment: "test", enabled: "0", targetEditId: "one" }), false);
  assert.equal(shouldInjectDetailEditFailure({ editId: "one", appEnvironment: "test", enabled: "1", targetEditId: "two" }), false);
});
