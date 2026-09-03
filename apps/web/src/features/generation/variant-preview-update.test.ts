import assert from "node:assert/strict";
import test from "node:test";
import type { GenerationJobV2 } from "@icongen/shared";
import {
  applyVariantPreview,
  hasAppliedVariantPreview,
  mergePolledGenerationJob,
  shouldRevealGenerationPreview,
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

test("completed previews stay visible through the final polling transition", () => {
  assert.equal(
    shouldRevealGenerationPreview({
      revealedDuringGeneration: true,
      allPreviewsReady: false,
      currentPreviewSettled: true,
    }),
    true,
  );
  assert.equal(
    shouldRevealGenerationPreview({
      revealedDuringGeneration: true,
      allPreviewsReady: false,
      currentPreviewSettled: false,
    }),
    false,
  );
});

test("polling preserves signed URLs for completed variants while another variant progresses", () => {
  const current = {
    ...job,
    status: "processing",
    subjects: [
      {
        ...job.subjects[0],
        variants: [
          {
            id: "variant-1",
            status: "completed",
            previewUrl: "https://example.com/stable-preview.png?token=old",
            vectorUrl: "https://example.com/stable.svg?token=old",
            assets: [
              {
                id: "asset-1",
                format: "png",
                size: 256,
                previewUrl: "https://example.com/stable-output.png?token=old",
              },
            ],
          },
          { id: "variant-2", status: "processing", assets: [] },
        ],
      },
    ],
  } as unknown as GenerationJobV2;
  const incoming = {
    ...current,
    progress: { ...current.progress, percent: 66 },
    subjects: [
      {
        ...current.subjects[0],
        variants: [
          {
            ...current.subjects[0].variants[0],
            previewUrl: "https://example.com/stable-preview.png?token=new",
            vectorUrl: "https://example.com/stable.svg?token=new",
            assets: [
              {
                ...current.subjects[0].variants[0].assets[0],
                previewUrl: "https://example.com/stable-output.png?token=new",
              },
            ],
          },
          { id: "variant-2", status: "completed", assets: [] },
        ],
      },
    ],
  } as GenerationJobV2;

  const merged = mergePolledGenerationJob(current, incoming);
  assert.equal(merged.progress.percent, 66);
  assert.equal(
    merged.subjects[0].variants[0].previewUrl,
    "https://example.com/stable-preview.png?token=old",
  );
  assert.equal(
    merged.subjects[0].variants[0].assets[0].previewUrl,
    "https://example.com/stable-output.png?token=old",
  );
  assert.equal(merged.subjects[0].variants[1].status, "completed");
});

test("polling accepts new URLs when a published revision changes", () => {
  const current = {
    ...job,
    subjects: [
      {
        ...job.subjects[0],
        variants: [
          {
            id: "variant-1",
            status: "completed",
            activeRevisionId: "11111111-1111-4111-8111-111111111111",
            previewUrl: "https://example.com/original.png?token=old",
            assets: [],
          },
        ],
      },
    ],
  } as unknown as GenerationJobV2;
  const incoming = {
    ...current,
    subjects: [
      {
        ...current.subjects[0],
        variants: [
          {
            ...current.subjects[0].variants[0],
            activeRevisionId: "22222222-2222-4222-8222-222222222222",
            previewUrl: "https://example.com/revised.png?token=new",
          },
        ],
      },
    ],
  } as GenerationJobV2;

  assert.equal(
    mergePolledGenerationJob(current, incoming).subjects[0].variants[0]
      .previewUrl,
    "https://example.com/revised.png?token=new",
  );
});
