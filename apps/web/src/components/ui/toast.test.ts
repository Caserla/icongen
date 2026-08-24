import assert from "node:assert/strict";
import test from "node:test";
import { TOAST_PRESENTATION } from "./toast";

test("toast provides distinct success, error, and warning presentations", () => {
  assert.deepEqual(Object.keys(TOAST_PRESENTATION), ["success", "error", "warning"]);
  assert.equal(TOAST_PRESENTATION.success.icon, "✓");
  assert.equal(TOAST_PRESENTATION.error.icon, "×");
  assert.equal(TOAST_PRESENTATION.warning.icon, "!");
  assert.notEqual(TOAST_PRESENTATION.success.container, TOAST_PRESENTATION.error.container);
  assert.notEqual(TOAST_PRESENTATION.error.container, TOAST_PRESENTATION.warning.container);
});
