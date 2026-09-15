import type {
  AppLogger,
  AssetStore,
  GenerationJobRecord,
  GenerationRepository,
  ImageProcessor,
  ImageProvider,
  ImageQualityGate,
  PromptCompiler,
  VectorImageProcessor,
} from "./ports";
import { generateValidatedImage } from "./generate-validated-image";

export type ProcessGenerationJobDependencies = {
  repository: GenerationRepository;
  imageProvider: ImageProvider;
  imageProcessor: ImageProcessor;
  vectorImageProcessor?: VectorImageProcessor;
  imageQualityGate?: ImageQualityGate;
  assetStore: AssetStore;
  promptCompiler: PromptCompiler;
  logger: AppLogger;
  generationConcurrency?: number;
};

const DEFAULT_GENERATION_CONCURRENCY = 3;

function supportsSvg(job: GenerationJobRecord) {
  return (
    job.spec.purpose === "interaction" ||
    job.spec.style.preset === "minimal-logo"
  );
}

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>,
) {
  let nextIndex = 0;
  const runners = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (nextIndex < items.length) {
        const item = items[nextIndex];
        nextIndex += 1;
        await worker(item);
      }
    },
  );
  await Promise.all(runners);
}

export async function processGenerationJob(
  jobId: string,
  dependencies: ProcessGenerationJobDependencies,
) {
  const job = await dependencies.repository.getJob(jobId);
  if (!job) throw new Error(`Generation job ${jobId} was not found`);

  if (job.status === "completed" || job.status === "partial") {
    dependencies.logger.info("Generation job is already complete", { jobId });
    return;
  }

  if (job.status === "failed")
    throw new Error(`Generation job ${jobId} is already failed`);

  const execution = {
    skillName: dependencies.promptCompiler.name,
    skillVersion: dependencies.promptCompiler.version,
    imageProvider: dependencies.imageProvider.name,
    imageModel: dependencies.imageProvider.model,
  };

  await dependencies.repository.markProcessing(jobId, execution);

  // Interleave subjects by variant slot so the concurrency pool starts work for
  // different subjects first. With a limit of three, A1/B1/C1 now start
  // together instead of A1/A2/A3 occupying every worker.
  const variants = ([1, 2, 3] as const).flatMap((slot) =>
    job.subjects.flatMap((subject) =>
      subject.variants
        .filter((variant) => variant.slot === slot)
        .map((variant) => ({ subject, variant })),
    ),
  );
  const totalUnits = variants.length;
  let completedUnits = variants.filter(
    ({ variant }) => variant.status === "completed",
  ).length;
  let progressUpdate = Promise.resolve();
  const failures: Array<{ variantId: string; message: string }> = [];
  const enforcesInteractionGeometry = job.spec.purpose === "interaction";
  const pendingVariants = variants.filter(
    ({ variant }) =>
      variant.status === "queued" || variant.status === "processing",
  );
  await runWithConcurrency(
    pendingVariants,
    dependencies.generationConcurrency ?? DEFAULT_GENERATION_CONCURRENCY,
    async ({ subject, variant }) => {
      try {
        await dependencies.repository.markVariantProcessing(variant.id);
        const effectiveBackground =
          subject.backgroundOverride ?? job.spec.background;
        const compiled = dependencies.promptCompiler.compile({
          purpose: job.spec.purpose,
          illustrationSubset: job.spec.illustrationSubset,
          illustrationComposition: subject.illustrationComposition,
          name: subject.name,
          description: subject.description,
          color: subject.colorOverride ?? job.spec.subjectColor,
          background: effectiveBackground,
          style: job.spec.style,
          sizes: job.spec.sizes,
          slot: variant.slot,
          iconSetConsistency: {
            enabled: enforcesInteractionGeometry,
            subjectCount: job.subjects.length,
            targetOccupancyPercent: job.spec.style.subjectSizePercent,
            targetStrokeWidthPercent: job.spec.style.linearStrokeWidthPercent,
          },
        });
        const { image, qualityWarnings } = await generateValidatedImage(
          {
            jobId,
            variantId: variant.id,
            prompt: compiled.prompt,
            outputBackground: compiled.outputBackground,
            backgroundContainer: effectiveBackground.enabled
              ? effectiveBackground.container
              : undefined,
            purpose: job.spec.purpose,
            stylePreset: job.spec.style.preset,
            qualityContract: compiled.qualityContract,
            referenceImage: compiled.referenceImage,
            geometryContract: compiled.geometryContract,
          },
          dependencies,
        );
        const maskedAppIcon =
          job.spec.purpose === "app-icon" &&
          effectiveBackground.enabled &&
          effectiveBackground.container !== "square" &&
          dependencies.imageProcessor.applyRoundedMask
            ? await dependencies.imageProcessor.applyRoundedMask({
                bytes: image.bytes,
                cornerRadiusPercent:
                  effectiveBackground.container === "circle"
                    ? 50
                    : (effectiveBackground.cornerRadius ?? 22),
              })
            : null;
        const opacityAdjusted =
          job.spec.purpose === "interaction" &&
          compiled.outputBackground === "transparent" &&
          job.spec.style.subjectOpacityPercent < 100 &&
          dependencies.imageProcessor.applyOpacity
            ? await dependencies.imageProcessor.applyOpacity({
                bytes: maskedAppIcon?.bytes ?? image.bytes,
                opacityPercent: job.spec.style.subjectOpacityPercent,
              })
            : null;
        const sourceBytes = opacityAdjusted?.bytes ?? maskedAppIcon?.bytes ?? image.bytes;
        const sourceMetadata = opacityAdjusted ?? maskedAppIcon ??
          (await dependencies.imageProcessor.inspect({ bytes: sourceBytes }));
        for (const warning of qualityWarnings)
          dependencies.logger.info("Generated image quality warning", {
            jobId,
            variantId: variant.id,
            qualityWarningCode: warning.code,
            qualityWarning: warning.message,
          });
        const sourceSize = Math.max(
          sourceMetadata.width,
          sourceMetadata.height,
        );
        const sourceAsset = await dependencies.assetStore.put({
          jobId,
          subjectId: subject.id,
          variantId: variant.id,
          slot: variant.slot,
          assetRole: "source",
          format: "png",
          size: sourceSize,
          bytes: sourceBytes,
          mimeType: "image/png",
        });
        await dependencies.repository.saveAsset({
          jobId,
          subjectId: subject.id,
          variantId: variant.id,
          assetRole: "source",
          format: "png",
          size: sourceSize,
          width: sourceMetadata.width,
          height: sourceMetadata.height,
          hasAlpha: sourceMetadata.hasAlpha,
          bucket: sourceAsset.bucket,
          objectPath: sourceAsset.objectPath,
        });

        const resizeProfile =
          job.spec.style.preset === "pixel-art" ? "pixel-art" : "icon";
        const preview = await dependencies.imageProcessor.process({
          bytes: sourceBytes,
          size: 512,
          profile: resizeProfile,
        });
        const previewAsset = await dependencies.assetStore.put({
          jobId,
          subjectId: subject.id,
          variantId: variant.id,
          slot: variant.slot,
          assetRole: "preview",
          format: "png",
          size: 512,
          bytes: preview.bytes,
          mimeType: preview.mimeType,
        });
        await dependencies.repository.saveAsset({
          jobId,
          subjectId: subject.id,
          variantId: variant.id,
          assetRole: "preview",
          format: "png",
          size: 512,
          width: preview.width,
          height: preview.height,
          hasAlpha: preview.hasAlpha,
          bucket: previewAsset.bucket,
          objectPath: previewAsset.objectPath,
        });

        for (const size of job.spec.sizes) {
          const processed = await dependencies.imageProcessor.process({
            bytes: sourceBytes,
            size,
            profile: resizeProfile,
          });
          if (!effectiveBackground.enabled && !processed.hasAlpha)
            throw new Error(
              `Generated icon ${variant.id} is missing an alpha channel`,
            );
          const asset = await dependencies.assetStore.put({
            jobId,
            subjectId: subject.id,
            variantId: variant.id,
            slot: variant.slot,
            assetRole: "output",
            format: "png",
            size,
            bytes: processed.bytes,
            mimeType: processed.mimeType,
          });
          await dependencies.repository.saveAsset({
            jobId,
            subjectId: subject.id,
            variantId: variant.id,
            assetRole: "output",
            format: "png",
            size,
            width: processed.width,
            height: processed.height,
            hasAlpha: processed.hasAlpha,
            bucket: asset.bucket,
            objectPath: asset.objectPath,
          });
        }
        if (supportsSvg(job) && dependencies.vectorImageProcessor) {
          try {
            const vector = await dependencies.vectorImageProcessor.process({
              bytes: sourceBytes,
              mode:
                job.spec.style.graphicStructure === "linear" ||
                job.spec.style.preset === "minimal-logo"
                  ? "binary"
                  : "color",
            });
            const asset = await dependencies.assetStore.put({
              jobId,
              subjectId: subject.id,
              variantId: variant.id,
              slot: variant.slot,
              assetRole: "output",
              format: "svg",
              size: Math.max(vector.width, vector.height),
              bytes: vector.bytes,
              mimeType: vector.mimeType,
            });
            await dependencies.repository.saveAsset({
              jobId,
              subjectId: subject.id,
              variantId: variant.id,
              assetRole: "output",
              format: "svg",
              size: Math.max(vector.width, vector.height),
              width: vector.width,
              height: vector.height,
              hasAlpha: true,
              bucket: asset.bucket,
              objectPath: asset.objectPath,
            });
          } catch (error) {
            dependencies.logger.info("SVG derivation skipped; PNG assets remain available", {
              jobId,
              variantId: variant.id,
              error: error instanceof Error ? error.message : "Unknown SVG derivation error",
            });
          }
        }
        await dependencies.repository.markVariantCompleted({
          variantId: variant.id,
          ...execution,
          providerRequestId: image.providerRequestId,
        });
        completedUnits += 1;
        const currentCompletedUnits = completedUnits;
        progressUpdate = progressUpdate.then(() =>
          dependencies.repository.updateProgress(
            jobId,
            currentCompletedUnits,
            totalUnits,
          ),
        );
        await progressUpdate;
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unknown variant generation error";
        await dependencies.repository.markVariantFailed({
          variantId: variant.id,
          errorCode: "VARIANT_GENERATION_FAILED",
          errorMessage: message,
        });
        failures.push({ variantId: variant.id, message });
        dependencies.logger.error("Generation variant failed", {
          jobId,
          variantId: variant.id,
          error: message,
        });
      }
    },
  );

  if (failures.length > 0)
    throw new Error(
      failures
        .map((failure) => `${failure.variantId}: ${failure.message}`)
        .join("; "),
    );
  await dependencies.repository.markCompleted(jobId);
  dependencies.logger.info("Generation job completed", {
    jobId,
    subjectCount: job.subjects.length,
    variantCount: totalUnits,
  });
}
