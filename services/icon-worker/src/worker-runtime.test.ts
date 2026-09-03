import assert from "node:assert/strict";
import test from "node:test";
import { normalizeWorkerDuration, parseClaimedTask } from "./worker-runtime";

test("worker duration rejects non-numeric values and clamps unsafe ranges", () => {
  assert.equal(normalizeWorkerDuration(undefined, 120, 30, 900), 120);
  assert.equal(normalizeWorkerDuration("not-a-number", 120, 30, 900), 120);
  assert.equal(normalizeWorkerDuration("1", 120, 30, 900), 30);
  assert.equal(normalizeWorkerDuration("9999", 120, 30, 900), 900);
});

test("claimed tasks map only known database task types", () => {
  assert.deepEqual(parseClaimedTask([{ task_type: "job", task_id: "job-1" }]), {
    script: "process-job",
    id: "job-1",
  });
  assert.deepEqual(parseClaimedTask([{ task_type: "edit", task_id: "edit-1" }]), {
    script: "process-edit",
    id: "edit-1",
  });
  assert.equal(parseClaimedTask([]), null);
  assert.throws(() => parseClaimedTask([{ task_type: "unknown", task_id: "x" }]));
});
