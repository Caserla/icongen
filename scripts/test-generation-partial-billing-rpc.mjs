import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) throw new Error("Supabase test credentials are not configured");

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const createdUsers = [];

async function createTestUser(balance = 5) {
  const response = await supabase.auth.admin.createUser({
    email: `partial-billing-${randomUUID()}@example.invalid`,
    password: `${randomUUID()}Aa1!`,
    email_confirm: true,
  });
  if (response.error) throw response.error;
  createdUsers.push(response.data.user.id);
  const account = await supabase
    .from("credit_accounts")
    .update({ balance })
    .eq("user_id", response.data.user.id);
  if (account.error) throw account.error;
  return response.data.user.id;
}

async function createJob(userId) {
  const created = await supabase.rpc("create_generation_job_v2", {
    p_user_id: userId,
    p_spec: {
      settingsVersion: "partial-billing-e2e-v1",
      subjects: [{
        clientId: randomUUID(),
        name: "Partial billing test",
        description: "Isolated partial billing settlement test",
      }],
    },
    p_skill_version: "partial-billing-e2e",
    p_idempotency_key: randomUUID(),
  });
  if (created.error) throw created.error;
  const subject = await supabase
    .from("generation_subjects")
    .select("id")
    .eq("job_id", created.data)
    .single();
  if (subject.error) throw subject.error;
  const variants = await supabase
    .from("generation_variants")
    .select("id,slot")
    .eq("subject_id", subject.data.id)
    .order("slot");
  if (variants.error) throw variants.error;
  return { jobId: created.data, subjectId: subject.data.id, variants: variants.data };
}

async function balance(userId) {
  const result = await supabase
    .from("credit_accounts")
    .select("balance")
    .eq("user_id", userId)
    .single();
  if (result.error) throw result.error;
  return result.data.balance;
}

async function refundCount(userId) {
  const result = await supabase
    .from("credit_ledger")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("entry_type", "generation_refund");
  if (result.error) throw result.error;
  return result.count ?? 0;
}

async function setAttemptResult({ jobId, subjectId, variants }, completedSlots) {
  const now = new Date().toISOString();
  const job = await supabase.from("generation_jobs").update({ status: "processing" }).eq("id", jobId);
  if (job.error) throw job.error;
  const subject = await supabase.from("generation_subjects").update({ status: "processing" }).eq("id", subjectId);
  if (subject.error) throw subject.error;
  for (const variant of variants) {
    const succeeded = completedSlots.includes(variant.slot);
    const update = await supabase.from("generation_variants").update({
      status: succeeded ? "completed" : "failed",
      completed_at: now,
      error_code: succeeded ? null : "E2E_FAILURE",
      error_message: succeeded ? null : "Isolated expected failure",
    }).eq("id", variant.id);
    if (update.error) throw update.error;
  }
}

try {
  const partialUser = await createTestUser();
  const partial = await createJob(partialUser);
  assert.equal(await balance(partialUser), 4);
  await setAttemptResult(partial, [1, 2]);
  const finalizedPartial = await supabase.rpc("finalize_generation_job_v2_failure", {
    p_job_id: partial.jobId,
    p_error_code: "E2E_PARTIAL",
    p_error_message: "Expected isolated partial result",
  });
  if (finalizedPartial.error) throw finalizedPartial.error;
  assert.equal(await balance(partialUser), 4);
  assert.equal(await refundCount(partialUser), 0);

  const failedVariant = partial.variants.find((variant) => variant.slot === 3);
  const retries = await Promise.all([
    supabase.rpc("retry_generation_variant_v2", {
      p_user_id: partialUser,
      p_variant_id: failedVariant.id,
    }),
    supabase.rpc("retry_generation_variant_v2", {
      p_user_id: partialUser,
      p_variant_id: failedVariant.id,
    }),
  ]);
  assert.equal(retries.filter((result) => !result.error).length, 1);
  assert.equal(retries.filter((result) => result.error?.message.includes("VARIANT_NOT_FAILED")).length, 1);
  assert.equal(await balance(partialUser), 4);
  assert.equal(await refundCount(partialUser), 0);

  const retryState = await supabase
    .from("generation_variants")
    .select("status")
    .eq("id", failedVariant.id)
    .single();
  if (retryState.error) throw retryState.error;
  assert.equal(retryState.data.status, "queued");

  const failedUser = await createTestUser();
  const failed = await createJob(failedUser);
  assert.equal(await balance(failedUser), 4);
  await setAttemptResult(failed, []);
  const finalizedFailure = await supabase.rpc("finalize_generation_job_v2_failure", {
    p_job_id: failed.jobId,
    p_error_code: "E2E_FAILURE",
    p_error_message: "Expected isolated full failure",
  });
  if (finalizedFailure.error) throw finalizedFailure.error;
  assert.equal(await balance(failedUser), 5);
  assert.equal(await refundCount(failedUser), 1);
  const duplicateFinalization = await supabase.rpc("finalize_generation_job_v2_failure", {
    p_job_id: failed.jobId,
    p_error_code: "E2E_FAILURE",
    p_error_message: "Expected isolated duplicate finalization",
  });
  if (duplicateFinalization.error) throw duplicateFinalization.error;
  assert.equal(await balance(failedUser), 5);
  assert.equal(await refundCount(failedUser), 1);

  console.log(JSON.stringify({
    partial: {
      jobId: partial.jobId,
      balanceAfterDebitAndRetry: await balance(partialUser),
      refunds: await refundCount(partialUser),
      concurrentRetry: "one accepted, one rejected",
      passed: true,
    },
    fullFailure: {
      jobId: failed.jobId,
      balanceAfterRefund: await balance(failedUser),
      refunds: await refundCount(failedUser),
      duplicateFinalization: "no duplicate refund",
      passed: true,
    },
  }, null, 2));
} finally {
  for (const userId of createdUsers) {
    const removed = await supabase.auth.admin.deleteUser(userId);
    if (removed.error) console.error(`Could not remove isolated test user ${userId}: ${removed.error.message}`);
  }
}
