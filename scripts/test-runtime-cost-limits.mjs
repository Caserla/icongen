import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  assertLimitError, createAdmin, createJob, createTestIdentity, generationSpec,
  loadStagingSecurityConfig, removeTestIdentity, setBalance,
} from "./lib/staging-security-test.mjs";

const config = loadStagingSecurityConfig();
const admin = createAdmin(config);
const users = [];
const limits = await admin.from("generation_runtime_limits").select("*").eq("singleton", true).single();
if (limits.error) throw limits.error;

try {
  const update = await admin.from("generation_runtime_limits").update({
    enforcement_enabled: true,
    max_global_active_jobs: 1000,
    max_global_subjects_per_day: 1000000,
    max_global_subjects_per_month: 1000000,
    max_user_subjects_per_day: 1,
    updated_at: new Date().toISOString(),
  }).eq("singleton", true);
  if (update.error) throw update.error;

  const user = await createTestIdentity(admin, "cost-limit"); users.push(user);
  await setBalance(admin, user.id, 5);
  const firstJob = await createJob(admin, user.id, 1);
  await admin.from("generation_jobs").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", firstJob);
  const rejected = await admin.rpc("create_generation_job_v2", {
    p_user_id: user.id,
    p_spec: generationSpec(1),
    p_skill_version: "security-staging",
    p_idempotency_key: randomUUID(),
  });
  assertLimitError(rejected, "GENERATION_USER_DAILY_LIMIT");
  const account = await admin.from("credit_accounts").select("balance").eq("user_id", user.id).single();
  if (account.error) throw account.error;
  assert.equal(account.data.balance, 4, "rejected creation must not debit credits");

  const concurrency = await admin.from("generation_runtime_limits").update({
    max_global_active_jobs: 1,
    max_user_subjects_per_day: 1000,
  }).eq("singleton", true);
  if (concurrency.error) throw concurrency.error;
  const activeUser = await createTestIdentity(admin, "active-job"); users.push(activeUser); await setBalance(admin, activeUser.id, 2);
  await createJob(admin, activeUser.id, 1);
  const blockedUser = await createTestIdentity(admin, "blocked-job"); users.push(blockedUser); await setBalance(admin, blockedUser.id, 2);
  const before = await admin.from("credit_accounts").select("balance").eq("user_id", blockedUser.id).single();
  const blocked = await admin.rpc("create_generation_job_v2", {
    p_user_id: blockedUser.id,
    p_spec: generationSpec(1),
    p_skill_version: "security-staging",
    p_idempotency_key: randomUUID(),
  });
  assertLimitError(blocked, "GENERATION_GLOBAL_CONCURRENCY_LIMIT");
  const after = await admin.from("credit_accounts").select("balance").eq("user_id", blockedUser.id).single();
  assert.equal(after.data.balance, before.data.balance, "capacity rejection must not debit credits");
  console.log(JSON.stringify({ userDailyLimit: "passed", concurrencyLimit: "passed", rejectedDebit: "passed" }, null, 2));
} finally {
  await admin.from("generation_runtime_limits").update(limits.data).eq("singleton", true);
  for (const user of users.reverse()) await removeTestIdentity(admin, user);
}
