import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

export function loadStagingSecurityConfig(env = process.env) {
  const url = env.SECURITY_TEST_SUPABASE_URL;
  const serviceRoleKey = env.SECURITY_TEST_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw new Error("SECURITY_TEST_SUPABASE_URL and SECURITY_TEST_SUPABASE_SERVICE_ROLE_KEY are required");
  if (env.SECURITY_TEST_ENVIRONMENT !== "staging") throw new Error("SECURITY_TEST_ENVIRONMENT must be staging");
  if (env.SECURITY_TEST_CONFIRM_MUTATION !== "YES_I_UNDERSTAND_STAGING_ONLY") {
    throw new Error("Refusing mutation: set SECURITY_TEST_CONFIRM_MUTATION=YES_I_UNDERSTAND_STAGING_ONLY");
  }
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" && parsed.hostname !== "127.0.0.1" && parsed.hostname !== "localhost") {
    throw new Error("Security test Supabase URL must use HTTPS");
  }
  return { url: parsed.toString().replace(/\/$/, ""), serviceRoleKey };
}

export function createAdmin(config) {
  return createClient(config.url, config.serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function createTestIdentity(admin, label = "security") {
  const password = `${randomUUID()}Aa1!`;
  const email = `${label}-${randomUUID()}@example.invalid`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) throw created.error;
  return { id: created.data.user.id, email, password };
}

export async function authenticatedClient(config, identity) {
  const anonKey = process.env.SECURITY_TEST_SUPABASE_ANON_KEY;
  if (!anonKey) throw new Error("SECURITY_TEST_SUPABASE_ANON_KEY is required");
  const client = createClient(config.url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const signedIn = await client.auth.signInWithPassword({ email: identity.email, password: identity.password });
  if (signedIn.error) throw signedIn.error;
  return client;
}

export function generationSpec(subjectCount = 1) {
  return {
    settingsVersion: "security-staging-v1",
    purpose: "interaction",
    subjects: Array.from({ length: subjectCount }, (_, index) => ({
      clientId: randomUUID(),
      name: `Security test ${index + 1}`,
      description: `Isolated staging security icon ${index + 1}`,
      colorOverride: null,
    })),
  };
}

export async function setBalance(admin, userId, balance) {
  const result = await admin.from("credit_accounts").update({ balance }).eq("user_id", userId);
  if (result.error) throw result.error;
}

export async function createJob(admin, userId, subjectCount = 1) {
  const result = await admin.rpc("create_generation_job_v2", {
    p_user_id: userId,
    p_spec: generationSpec(subjectCount),
    p_skill_version: "security-staging",
    p_idempotency_key: randomUUID(),
  });
  if (result.error) throw result.error;
  return result.data;
}

export async function removeTestIdentity(admin, identity) {
  if (!identity?.id) return;
  const removed = await admin.auth.admin.deleteUser(identity.id);
  if (removed.error) throw removed.error;
}

export function assertLimitError(result, marker) {
  assert.ok(result.error?.message.includes(marker), `Expected ${marker}, received ${result.error?.message ?? "success"}`);
}
