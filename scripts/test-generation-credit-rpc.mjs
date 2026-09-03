import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  throw new Error("Supabase test credentials are not configured");
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const createdUsers = [];

function spec(subjectCount) {
  return {
    settingsVersion: "credit-rpc-e2e-v1",
    subjects: Array.from({ length: subjectCount }, (_, index) => ({
      clientId: randomUUID(),
      name: `Credit boundary ${index + 1}`,
      description: `Isolated credit boundary test icon ${index + 1}`,
      colorOverride: null,
    })),
  };
}

async function createTestUser(balance) {
  const email = `credit-e2e-${randomUUID()}@example.invalid`;
  const response = await supabase.auth.admin.createUser({
    email,
    password: `${randomUUID()}Aa1!`,
    email_confirm: true,
  });
  if (response.error) throw response.error;
  createdUsers.push(response.data.user.id);
  const updated = await supabase
    .from("credit_accounts")
    .update({ balance })
    .eq("user_id", response.data.user.id);
  if (updated.error) throw updated.error;
  return response.data.user.id;
}

async function accountSnapshot(userId) {
  const [account, jobs, debits] = await Promise.all([
    supabase.from("credit_accounts").select("balance").eq("user_id", userId).single(),
    supabase.from("generation_jobs").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("credit_ledger").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("entry_type", "generation_debit"),
  ]);
  if (account.error) throw account.error;
  if (jobs.error) throw jobs.error;
  if (debits.error) throw debits.error;
  return { balance: account.data.balance, jobs: jobs.count ?? 0, debits: debits.count ?? 0 };
}

try {
  const idempotentUser = await createTestUser(5);
  const idempotencyKey = randomUUID();
  const generationSpec = spec(1);
  const first = await supabase.rpc("create_generation_job_v2", {
    p_user_id: idempotentUser,
    p_spec: generationSpec,
    p_skill_version: "credit-e2e",
    p_idempotency_key: idempotencyKey,
  });
  if (first.error) throw first.error;
  const afterFirst = await accountSnapshot(idempotentUser);
  const replay = await supabase.rpc("create_generation_job_v2", {
    p_user_id: idempotentUser,
    p_spec: generationSpec,
    p_skill_version: "credit-e2e",
    p_idempotency_key: idempotencyKey,
  });
  if (replay.error) throw replay.error;
  const afterReplay = await accountSnapshot(idempotentUser);

  assert.equal(replay.data, first.data);
  assert.deepEqual(afterFirst, { balance: 4, jobs: 1, debits: 1 });
  assert.deepEqual(afterReplay, afterFirst);

  const insufficientUser = await createTestUser(1);
  const beforeInsufficient = await accountSnapshot(insufficientUser);
  const insufficient = await supabase.rpc("create_generation_job_v2", {
    p_user_id: insufficientUser,
    p_spec: spec(2),
    p_skill_version: "credit-e2e",
    p_idempotency_key: randomUUID(),
  });
  assert.ok(insufficient.error?.message.includes("INSUFFICIENT_CREDITS"));
  const afterInsufficient = await accountSnapshot(insufficientUser);
  assert.deepEqual(afterInsufficient, beforeInsufficient);

  console.log(JSON.stringify({
    idempotency: { jobId: first.data, afterFirst, afterReplay, passed: true },
    insufficientCredits: { before: beforeInsufficient, after: afterInsufficient, passed: true },
  }, null, 2));
} finally {
  for (const userId of createdUsers) {
    const removed = await supabase.auth.admin.deleteUser(userId);
    if (removed.error) console.error(`Could not remove isolated test user ${userId}: ${removed.error.message}`);
  }
}
