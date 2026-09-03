import assert from "node:assert/strict";
import test from "node:test";
import { isVariantEditLeaseStale, localVariantWorkerEnabled } from "./variant-edit-lease";

const now = Date.parse("2026-09-02T00:20:00.000Z");

test("reclaims an edit that was queued without a worker", () => {
  assert.equal(isVariantEditLeaseStale({ id: "edit", status: "queued", created_at: "2026-09-02T00:17:59.000Z", updated_at: "2026-09-02T00:17:59.000Z" }, now), true);
});

test("keeps a processing edit alive while its heartbeat is fresh", () => {
  assert.equal(isVariantEditLeaseStale({ id: "edit", status: "processing", created_at: "2026-09-01T23:00:00.000Z", updated_at: "2026-09-02T00:19:30.000Z" }, now), false);
});

test("keeps a slow processing edit alive for provider retries", () => {
  assert.equal(isVariantEditLeaseStale({ id: "edit", status: "processing", created_at: "2026-09-01T23:00:00.000Z", updated_at: "2026-09-02T00:17:59.000Z" }, now), false);
});

test("reclaims a processing edit after five minutes without a heartbeat", () => {
  assert.equal(isVariantEditLeaseStale({ id: "edit", status: "processing", created_at: "2026-09-01T23:00:00.000Z", updated_at: "2026-09-02T00:14:59.000Z" }, now), true);
});

test("uses an explicit worker switch for production previews", () => {
  assert.equal(localVariantWorkerEnabled({ NODE_ENV: "production", LOCAL_GENERATION_WORKER_ENABLED: "true" }), true);
  assert.equal(localVariantWorkerEnabled({ NODE_ENV: "production" }), false);
  assert.equal(localVariantWorkerEnabled({ NODE_ENV: "development" }), true);
});
