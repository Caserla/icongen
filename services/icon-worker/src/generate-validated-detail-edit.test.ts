import assert from "node:assert/strict";
import test from "node:test";
import { isNativeTransparencyUnsupported } from "./generate-validated-detail-edit";

test("recognizes provider rejection of native transparent image editing", () => {
  assert.equal(
    isNativeTransparencyUnsupported(
      new Error("400 Transparent background is not supported for this model."),
    ),
    true,
  );
});

test("does not hide unrelated provider errors behind transparency fallback", () => {
  assert.equal(isNativeTransparencyUnsupported(new Error("503 No available compatible accounts")), false);
});
