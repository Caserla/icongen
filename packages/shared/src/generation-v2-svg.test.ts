import assert from "node:assert/strict";
import test from "node:test";
import { createGenerationDownloadSchema } from "./generation-v2";

const variantIds = ["11111111-1111-4111-8111-111111111111"];

test("SVG downloads do not require a raster size", () => {
  const result = createGenerationDownloadSchema.parse({ variantIds, format: "svg" });
  assert.equal(result.format, "svg");
  assert.equal(result.size, undefined);
});

test("PNG downloads support original output and approved resized output", () => {
  const result = createGenerationDownloadSchema.parse({ variantIds, format: "png", includeSvg: true });
  assert.equal(result.includeSvg, true);
  assert.equal(createGenerationDownloadSchema.safeParse({ variantIds, format: "png", size: 256 }).success, true);
});

test("download requests reject more variants than one maximum-size icon set", () => {
  const variantIds = Array.from({ length: 21 }, (_, index) =>
    `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
  );
  assert.equal(
    createGenerationDownloadSchema.safeParse({ variantIds, format: "png" }).success,
    false,
  );
});
