import assert from "node:assert/strict";
import test from "node:test";
import { normalizeGeneratedAssetUrl } from "./image-with-skeleton";

test("normalizes internal generated assets to the current page origin", () => {
  assert.equal(
    normalizeGeneratedAssetUrl(
      "http://localhost:3000/api/generation/assets/asset-id/preview?refresh=1",
    ),
    "/api/generation/assets/asset-id/preview?refresh=1",
  );
  assert.equal(
    normalizeGeneratedAssetUrl(
      "https://icons.example.com/api/generation/variant-revisions/revision/assets/asset/preview",
    ),
    "/api/generation/variant-revisions/revision/assets/asset/preview",
  );
});

test("does not rewrite external image provider URLs", () => {
  const source = "https://example.supabase.co/storage/v1/object/sign/generated-icons/image.png?token=test";
  assert.equal(normalizeGeneratedAssetUrl(source), source);
});
