import type { GenerationJobV2 } from "@icongen/shared";

export type AppliedVariantPreview = {
  variantId: string;
  activeRevisionId: string;
  previewUrl: string;
};

export function applyVariantPreview(
  job: GenerationJobV2,
  change: AppliedVariantPreview,
): GenerationJobV2 {
  return {
    ...job,
    subjects: job.subjects.map((subject) => ({
      ...subject,
      variants: subject.variants.map((variant) =>
        variant.id === change.variantId
          ? {
              ...variant,
              previewUrl: change.previewUrl,
              activeRevisionId: change.activeRevisionId,
            }
          : variant,
      ),
    })),
  };
}

export function hasAppliedVariantPreview(
  job: GenerationJobV2,
  change: AppliedVariantPreview,
) {
  return job.subjects.some((subject) =>
    subject.variants.some(
      (variant) =>
        variant.id === change.variantId &&
        variant.activeRevisionId === change.activeRevisionId,
    ),
  );
}
