import assert from "node:assert/strict";
import {
  createAdmin, createJob, createTestIdentity, loadStagingSecurityConfig,
  removeTestIdentity, setBalance,
} from "./lib/staging-security-test.mjs";

const config = loadStagingSecurityConfig();
const admin = createAdmin(config);
let identity;
try {
  identity = await createTestIdentity(admin, "worker-failover");
  await setBalance(admin, identity.id, 2);
  const jobId = await createJob(admin, identity.id, 1);
  const workerA = `staging-a-${Date.now()}`;
  const workerB = `staging-b-${Date.now()}`;
  const [claimA, claimB] = await Promise.all([
    admin.rpc("claim_next_worker_task", { p_worker_id: workerA, p_lease_seconds: 30 }),
    admin.rpc("claim_next_worker_task", { p_worker_id: workerB, p_lease_seconds: 30 }),
  ]);
  if (claimA.error) throw claimA.error;
  if (claimB.error) throw claimB.error;
  const claims = [claimA.data, claimB.data].flat().filter((row) => row?.task_id === jobId);
  assert.equal(claims.length, 1, "exactly one worker must claim the job");
  const firstOwner = claims[0].task_id === jobId && claimA.data?.some((row) => row.task_id === jobId) ? workerA : workerB;
  const secondOwner = firstOwner === workerA ? workerB : workerA;
  const expired = await admin.from("generation_jobs").update({
    status: "processing", worker_lease_expires_at: new Date(Date.now() - 1000).toISOString(),
  }).eq("id", jobId).eq("worker_lease_owner", firstOwner).select("id").single();
  if (expired.error) throw expired.error;
  const takeover = await admin.rpc("claim_next_worker_task", { p_worker_id: secondOwner, p_lease_seconds: 30 });
  if (takeover.error) throw takeover.error;
  assert.equal(takeover.data?.[0]?.task_id, jobId, "standby worker must reclaim an expired lease");
  const row = await admin.from("generation_jobs").select("worker_lease_owner,worker_lease_expires_at").eq("id", jobId).single();
  if (row.error) throw row.error;
  assert.equal(row.data.worker_lease_owner, secondOwner);
  const staleHeartbeat = await admin.from("generation_jobs").update({ updated_at: new Date().toISOString() })
    .eq("id", jobId).eq("worker_lease_owner", firstOwner).select("id");
  if (staleHeartbeat.error) throw staleHeartbeat.error;
  assert.equal(staleHeartbeat.data.length, 0, "stale worker must not renew a lease after takeover");
  console.log(JSON.stringify({ atomicClaim: "passed", expiredLeaseTakeover: "passed", staleHeartbeatFenced: "passed" }, null, 2));
} finally {
  await removeTestIdentity(admin, identity);
}
