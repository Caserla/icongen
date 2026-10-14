import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const migrationUrl = new URL(
  "../infra/supabase/migrations/0024_partial_generation_billing_settlement.sql",
  import.meta.url,
);
const retryRouteUrl = new URL(
  "../apps/web/src/app/api/generation/variants/[variantId]/retry/route.ts",
  import.meta.url,
);

test("partial subjects retain the original generation charge", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /if v_completed = 0 then\s+update public\.credit_accounts/s);
  assert.doesNotMatch(sql, /if v_completed < 3 then\s+update public\.credit_accounts/s);
  assert.match(sql, /'generation-subject-refund:' \|\| v_subject\.id::text/);
});

test("failed variant retry uses one database transaction", async () => {
  const [sql, route] = await Promise.all([
    readFile(migrationUrl, "utf8"),
    readFile(retryRouteUrl, "utf8"),
  ]);
  assert.match(sql, /create or replace function public\.retry_generation_variant_v2/);
  assert.match(sql, /where id = p_variant_id\s+for update/);
  assert.match(route, /client\.rpc\(\s*localReservation\s*\? "retry_local_generation_variant_v2"\s*: "retry_generation_variant_v2"/);
  assert.doesNotMatch(route, /from\("generation_variants"\)\.update/);
});
