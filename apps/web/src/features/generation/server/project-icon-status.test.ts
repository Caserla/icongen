import assert from "node:assert/strict";
import test from "node:test";
import { projectIconStatusChanges, projectIconStatusSchema } from "./project-icon-status";

test("group and icon status use the same favorite/recycle exclusion rules", () => {
  assert.deepEqual(projectIconStatusChanges({ favorite: true }), { is_favorite: true, recycled_at: null });
  assert.deepEqual(projectIconStatusChanges({ recycled: true }, "2026-09-18T00:00:00.000Z"), { recycled_at: "2026-09-18T00:00:00.000Z", is_favorite: false });
  assert.deepEqual(projectIconStatusChanges({ recycled: false }), { recycled_at: null });
  assert.equal(projectIconStatusSchema.safeParse({ favorite: "yes" }).success, false);
});
