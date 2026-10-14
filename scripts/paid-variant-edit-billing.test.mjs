import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const migrationUrl = new URL("../infra/supabase/migrations/0025_paid_variant_detail_edits.sql", import.meta.url);
const routeUrl = new URL("../apps/web/src/app/api/generation/variants/[variantId]/edits/route.ts", import.meta.url);
const workerUrl = new URL("../services/icon-worker/src/run-variant-edit.ts", import.meta.url);

test("paid detail edit creation is atomic and idempotent after three included edits", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /where variant_id = p_variant_id and idempotency_key = p_idempotency_key/);
  assert.match(sql, /v_charge := case when v_used >= 3 then 1 else 0 end/);
  assert.match(sql, /where user_id = p_user_id for update/);
  assert.match(sql, /set balance = balance - 1/);
  assert.match(sql, /'variant-edit-debit:' \|\| v_revision_id::text/);
});

test("failed paid detail edits refund once through the immutable ledger", async () => {
  const [sql, worker] = await Promise.all([readFile(migrationUrl, "utf8"), readFile(workerUrl, "utf8")]);
  assert.match(sql, /credit_refunded_at is not null/);
  assert.match(sql, /v_revision\.status <> 'failed'/);
  assert.match(sql, /set balance = balance \+ 1/);
  assert.match(sql, /'variant-edit-refund:' \|\| p_revision_id::text/);
  assert.match(worker, /refund_failed_variant_detail_edit_v2/);
});

test("retired detail edit API returns 410 without charging or refunding", async () => {
  const route = await readFile(routeUrl, "utf8");
  assert.match(route, /LEGACY_EDIT_RETIRED/);
  assert.match(route, /status:410/);
  assert.doesNotMatch(route, /create_variant_detail_edit_v2|refund_failed_variant_detail_edit_v2|INSUFFICIENT_CREDITS/);
});
