import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

test('local account and admin have no billing query', () => {
  for (const path of ['apps/web/src/app/api/account/route.ts', 'apps/web/src/app/api/admin/overview/route.ts', 'apps/web/src/features/admin/components/admin-dashboard.tsx']) {
    assert.doesNotMatch(readFileSync(path, 'utf8'), /credit_accounts|credit_ledger|creditBalance|payment_orders/);
  }
});
test('paid entry points retired and redemption routes removed', () => {
  for (const path of ['apps/web/src/app/api/account/credits/query/route.ts', 'apps/web/src/app/api/account/credits/redeem/route.ts', 'scripts/create-cd-key.mjs']) assert.equal(existsSync(path), false);
  for (const path of ['apps/web/src/app/api/generation/jobs/route.ts', 'apps/web/src/app/api/generation/variants/[variantId]/edits/route.ts']) {
    assert.match(readFileSync(path, 'utf8'), /410/);
    assert.doesNotMatch(readFileSync(path, 'utf8'), /refund_failed_variant_detail_edit_v2/);
  }
});
test('local migration stops signup credits without deleting history', () => {
  const sql = readFileSync('infra/supabase/migrations/0048_local_self_use.sql', 'utf8');
  assert.match(sql, /revoke execute/i);
  assert.doesNotMatch(sql, /insert into public\.credit_accounts|drop table|truncate/i);
});
