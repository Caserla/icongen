import assert from "node:assert/strict";
import test from "node:test";
import type { GenerationJobV2 } from "@icongen/shared";
import {
  applyVariantPreview,
  hasAppliedVariantPreview,
} from "./variant-preview-update";

const job = {
  id: "job",
  subjects: [
    {
      id: "subject",
      variants: [
        {
          id: "variant-1",
          previewUrl: "https://example.com/original.png",
        },
        {
          id: "variant-2",
          previewUrl: "https://example.com/other.png",
        },
      ],
    },
  ],
} as GenerationJobV2;

test("publishing an edit replaces only the edited option preview", () => {
  const change = {
    variantId: "variant-1",
    activeRevisionId: "revision-1",
    previewUrl: "https://example.com/revised.png",
  };
  const updated = applyVariantPreview(job, change);

  assert.equal(updated.subjects[0].variants[0].previewUrl, change.previewUrl);
  assert.equal(
    updated.subjects[0].variants[0].activeRevisionId,
    change.activeRevisionId,
  );
  assert.equal(
    updated.subjects[0].variants[1].previewUrl,
    "https://example.com/other.png",
  );
  assert.equal(hasAppliedVariantPreview(updated, change), true);
  assert.equal(hasAppliedVariantPreview(job, change), false);
});
