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

function assetIdentity(
  assets: GenerationJobV2["subjects"][number]["variants"][number]["assets"],
) {
  return assets
    .map((asset) => `${asset.id}:${asset.format}:${asset.size}`)
    .sort()
    .join("|");
}

/**
 * Polling re-signs storage URLs on every request. Preserve URLs for completed,
 * unchanged variants so React and the browser do not reload the same image
 * while another option is still generating.
 */
export function mergePolledGenerationJob(
  current: GenerationJobV2,
  incoming: GenerationJobV2,
): GenerationJobV2 {
  const currentVariants = new Map(
    current.subjects.flatMap((subject) =>
      subject.variants.map((variant) => [variant.id, variant] as const),
    ),
  );

  return {
    ...incoming,
    subjects: incoming.subjects.map((subject) => ({
      ...subject,
      variants: subject.variants.map((variant) => {
        const previous = currentVariants.get(variant.id);
        const unchangedCompletedAsset =
          previous?.status === "completed" &&
          variant.status === "completed" &&
          previous.activeRevisionId === variant.activeRevisionId &&
          assetIdentity(previous.assets) === assetIdentity(variant.assets);

        if (!unchangedCompletedAsset) return variant;
        return {
          ...variant,
          previewUrl: previous.previewUrl,
          vectorUrl: previous.vectorUrl,
          assets: variant.assets.map((asset) => {
            const previousAsset = previous.assets.find(
              (candidate) => candidate.id === asset.id,
            );
            return previousAsset
              ? { ...asset, previewUrl: previousAsset.previewUrl }
              : asset;
          }),
        };
      }),
    })),
  };
}

export function shouldRevealGenerationPreview(input: {
  revealedDuringGeneration: boolean;
  allPreviewsReady: boolean;
  currentPreviewSettled: boolean;
}) {
  return input.revealedDuringGeneration
    ? input.currentPreviewSettled
    : input.allPreviewsReady;
}
