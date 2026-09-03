import assert from "node:assert/strict";
import test from "node:test";
import { generationSpec, loadStagingSecurityConfig } from "./lib/staging-security-test.mjs";

test("staging mutation guard rejects missing explicit confirmation", () => {
  assert.throws(() => loadStagingSecurityConfig({
    SECURITY_TEST_SUPABASE_URL: "https://example.supabase.co",
    SECURITY_TEST_SUPABASE_SERVICE_ROLE_KEY: "secret",
    SECURITY_TEST_ENVIRONMENT: "staging",
  }), /Refusing mutation/);
});

test("staging mutation guard accepts an explicitly confirmed HTTPS target", () => {
  assert.deepEqual(loadStagingSecurityConfig({
    SECURITY_TEST_SUPABASE_URL: "https://example.supabase.co/",
    SECURITY_TEST_SUPABASE_SERVICE_ROLE_KEY: "secret",
    SECURITY_TEST_ENVIRONMENT: "staging",
    SECURITY_TEST_CONFIRM_MUTATION: "YES_I_UNDERSTAND_STAGING_ONLY",
  }), { url: "https://example.supabase.co", serviceRoleKey: "secret" });
});

test("security generation fixture has deterministic cardinality without production content", () => {
  const spec = generationSpec(3);
  assert.equal(spec.subjects.length, 3);
  assert.equal(new Set(spec.subjects.map((subject) => subject.clientId)).size, 3);
});
