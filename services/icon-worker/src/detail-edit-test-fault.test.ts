import assert from "node:assert/strict";
import test from "node:test";
import { shouldInjectDetailEditFailure } from "./detail-edit-test-fault";

test("detail-edit fault injection requires non-production, explicit enablement, and an exact revision id", () => {
  assert.equal(shouldInjectDetailEditFailure({ editId: "one", nodeEnv: "test", enabled: "1", targetEditId: "one" }), true);
  assert.equal(shouldInjectDetailEditFailure({ editId: "one", nodeEnv: "production", enabled: "1", targetEditId: "one" }), false);
  assert.equal(shouldInjectDetailEditFailure({ editId: "one", nodeEnv: "test", enabled: "0", targetEditId: "one" }), false);
  assert.equal(shouldInjectDetailEditFailure({ editId: "one", nodeEnv: "test", enabled: "1", targetEditId: "two" }), false);
});
