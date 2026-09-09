import assert from "node:assert/strict";
import test from "node:test";
import {
  isVariantEditLeaseStale,
  localVariantWorkerEnabled,
} from "./variant-edit-lease";

const now = Date.parse("2026-09-02T00:20:00.000Z");

test("reclaims an edit that was queued without a worker", () => {
  assert.equal(
    isVariantEditLeaseStale(
      {
        id: "edit",
        status: "queued",
        created_at: "2026-09-02T00:17:59.000Z",
        updated_at: "2026-09-02T00:17:59.000Z",
      },
      now,
    ),
    true,
  );
});

test("keeps a processing edit alive while its heartbeat is fresh", () => {
  assert.equal(
    isVariantEditLeaseStale(
      {
        id: "edit",
        status: "processing",
        created_at: "2026-09-01T23:00:00.000Z",
        updated_at: "2026-09-02T00:19:30.000Z",
      },
      now,
    ),
    false,
  );
});

test("keeps a slow processing edit alive for provider retries", () => {
  assert.equal(
    isVariantEditLeaseStale(
      {
        id: "edit",
        status: "processing",
        created_at: "2026-09-01T23:00:00.000Z",
        updated_at: "2026-09-02T00:17:59.000Z",
      },
      now,
    ),
    false,
  );
});

test("reclaims a processing edit after five minutes without a heartbeat", () => {
  assert.equal(
    isVariantEditLeaseStale(
      {
        id: "edit",
        status: "processing",
        created_at: "2026-09-01T23:00:00.000Z",
        updated_at: "2026-09-02T00:14:59.000Z",
      },
      now,
    ),
    true,
  );
});

test("starts the local worker only for its explicitly bound Supabase project", () => {
  assert.equal(
    localVariantWorkerEnabled({
      NODE_ENV: "development",
      LOCAL_GENERATION_WORKER_ENABLED: "true",
      LOCAL_GENERATION_SUPABASE_PROJECT_REF: "development-ref",
      NEXT_PUBLIC_SUPABASE_URL: "https://development-ref.supabase.co",
    }),
    true,
  );
  assert.equal(
    localVariantWorkerEnabled({
      NODE_ENV: "development",
      LOCAL_GENERATION_WORKER_ENABLED: "true",
      LOCAL_GENERATION_SUPABASE_PROJECT_REF: "development-ref",
      NEXT_PUBLIC_SUPABASE_URL: "https://production-ref.supabase.co",
    }),
    false,
  );
  assert.equal(
    localVariantWorkerEnabled({
      NODE_ENV: "development",
      LOCAL_GENERATION_WORKER_ENABLED: "true",
      NEXT_PUBLIC_SUPABASE_URL: "https://development-ref.supabase.co",
    }),
    false,
  );
  assert.equal(localVariantWorkerEnabled({ NODE_ENV: "development" }), false);
});
