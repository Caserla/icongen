import assert from "node:assert/strict";
import test from "node:test";
import { hasActiveWorkerLease, normalizeWorkerDuration, parseClaimedTask } from "./worker-runtime";

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

test("a stale worker loses write authority after lease takeover or expiry", () => {
  const now = Date.parse("2026-09-03T10:00:00.000Z");
  assert.equal(hasActiveWorkerLease({
    worker_lease_owner: "worker-a",
    worker_lease_expires_at: "2026-09-03T10:01:00.000Z",
  }, "worker-a", now), true);
  assert.equal(hasActiveWorkerLease({
    worker_lease_owner: "worker-b",
    worker_lease_expires_at: "2026-09-03T10:01:00.000Z",
  }, "worker-a", now), false);
  assert.equal(hasActiveWorkerLease({
    worker_lease_owner: "worker-a",
    worker_lease_expires_at: "2026-09-03T09:59:59.000Z",
  }, "worker-a", now), false);
});
